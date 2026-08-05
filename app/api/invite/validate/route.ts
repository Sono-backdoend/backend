import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWithinConfirmationWindow } from "@/lib/confirmation-window";
import { getClientIp } from "@/lib/get-client-ip";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, fingerprint } = body as {
    code?: string;
    fingerprint?: string;
  };

  if (!code) {
    return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });
  }

  // Verificado antes de consultar o banco — o código tem só 32 bits de
  // espaço de busca, então precisa de um limite para dificultar enumeração.
  const ip = getClientIp(req);
  const limit = checkRateLimit(`invite-validate:${ip}`, 30, 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit);

  const guest = await prisma.guest.findUnique({
    where: { code },
    include: {
      response: true,
    },
  });

  if (!guest) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;

  await prisma.guestAccess.create({
    data: { guestId: guest.id, ip, userAgent, fingerprint: fingerprint ?? null },
  });

  const canRespondNow =
    guest.response === null &&
    isWithinConfirmationWindow(new Date(), guest.confirmationStartsAt, guest.confirmationEndsAt);

  return NextResponse.json({
    guest: {
      id: guest.id,
      name: guest.name,
    },
    alreadyResponded: guest.response !== null,
    response: guest.response
      ? {
        confirmed: guest.response.confirmed,
        plusOne: guest.response.plusOne,
        plusOneName: guest.response.plusOneName,
        plusOnePhone: guest.response.plusOnePhone,
      }
      : null,
    confirmationStartsAt: guest.confirmationStartsAt,
    confirmationEndsAt: guest.confirmationEndsAt,
    canRespondNow,
  });
}