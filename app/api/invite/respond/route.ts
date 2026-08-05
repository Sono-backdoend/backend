import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getConfirmationWindowMessage,
  isWithinConfirmationWindow,
} from "@/lib/confirmation-window";
import { getClientIp } from "@/lib/get-client-ip";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// POST /api/invite/respond
// Body: {
//   code: string;
//   confirmed: boolean;
//   plusOne: boolean;
//   plusOneName?: string;   — obrigatório se plusOne = true
//   plusOnePhone?: string;  — obrigatório se plusOne = true
// }
//
// Regras:
//  - O convidado só pode responder uma vez (GuestResponse é 1-para-1).
//  - Só aceita a resposta se o IP atual for o mesmo do primeiro acesso.
//  - Se plusOne = true, plusOneName e plusOnePhone são obrigatórios.

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, confirmed, plusOne, plusOneName, plusOnePhone } = body as {
    code?: string;
    confirmed?: boolean;
    plusOne?: boolean;
    plusOneName?: string;
    plusOnePhone?: string;
  };

  // ── Validação de campos obrigatórios ───────────────────────────────────────
  if (!code) {
    return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });
  }

  // Verificado antes de consultar o banco — mesmo raciocínio do
  // /api/invite/validate: código com só 32 bits de espaço de busca.
  const ip = getClientIp(req);
  const limit = checkRateLimit(`invite-respond:${ip}`, 10, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit);

  if (typeof confirmed !== "boolean") {
    return NextResponse.json(
      { error: "O campo 'confirmed' é obrigatório e deve ser boolean" },
      { status: 400 }
    );
  }

  if (typeof plusOne !== "boolean") {
    return NextResponse.json(
      { error: "O campo 'plusOne' é obrigatório e deve ser boolean" },
      { status: 400 }
    );
  }

  if (plusOne) {
    if (!plusOneName?.trim()) {
      return NextResponse.json(
        { error: "Nome do acompanhante é obrigatório quando plusOne = true" },
        { status: 400 }
      );
    }
    if (!plusOnePhone?.trim()) {
      return NextResponse.json(
        { error: "Telefone do acompanhante é obrigatório quando plusOne = true" },
        { status: 400 }
      );
    }
  }

  // ── Busca o convidado ──────────────────────────────────────────────────────
  const guest = await prisma.guest.findUnique({
    where: { code },
    include: {
      response: true,
      accesses: { select: { ip: true }, take: 1, orderBy: { usedAt: "asc" } },
    },
  });

  if (!guest) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }

  // ── Verifica se já respondeu ───────────────────────────────────────────────
  if (guest.response) {
    return NextResponse.json(
      { error: "Este convite já foi respondido" },
      { status: 409 }
    );
  }

  // ── Verifica janela de confirmação ─────────────────────────────────────────
  const now = new Date();
  if (!isWithinConfirmationWindow(now, guest.confirmationStartsAt, guest.confirmationEndsAt)) {
    return NextResponse.json(
      {
        error: getConfirmationWindowMessage(
          now,
          guest.confirmationStartsAt,
          guest.confirmationEndsAt
        ),
      },
      { status: 403 }
    );
  }

  // ── Verifica autorização por IP ────────────────────────────────────────────
  const firstAccess = guest.accesses[0];

  if (!firstAccess) {
    // Nunca acessou o link de validação antes — não pode responder diretamente.
    return NextResponse.json(
      { error: "Acesse o convite antes de responder" },
      { status: 403 }
    );
  }

  if (firstAccess.ip !== ip) {
    return NextResponse.json(
      { error: "Este convite pertence a outro dispositivo" },
      { status: 403 }
    );
  }

  // ── Salva a resposta ───────────────────────────────────────────────────────
  const response = await prisma.guestResponse.create({
    data: {
      guestId: guest.id,
      confirmed,
      plusOne,
      plusOneName: plusOne ? plusOneName!.trim() : null,
      plusOnePhone: plusOne ? plusOnePhone!.trim() : null,
    },
  });

  return NextResponse.json(
    {
      message: "Resposta registrada com sucesso",
      response: {
        confirmed: response.confirmed,
        plusOne: response.plusOne,
        plusOneName: response.plusOneName,
        plusOnePhone: response.plusOnePhone,
        respondedAt: response.respondedAt,
      },
    },
    { status: 201 }
  );
}
