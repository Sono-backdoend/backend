import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseConfirmationWindow } from "@/lib/confirmation-window";

// GET /api/admin/guests/:id — detalhe de um convidado com todos os acessos
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guest = await prisma.guest.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      createdAt: true,
      updatedAt: true,
      confirmationStartsAt: true,
      confirmationEndsAt: true,
      response: {
        select: {
          confirmed: true,
          plusOne: true,
          plusOneName: true,
          plusOnePhone: true,
          respondedAt: true,
        },
      },
      accesses: {
        select: {
          id: true,
          ip: true,
          userAgent: true,
          fingerprint: true,
          usedAt: true,
        },
        orderBy: { usedAt: "asc" },
      },
    },
  });

  if (!guest) {
    return NextResponse.json(
      { error: "Convidado não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...guest,
    accessCount: guest.accesses.length,
  });
}

// PATCH /api/admin/guests/:id — atualiza o nome do convidado
// (código não é editável pois já pode ter sido enviado ao convidado)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { name, confirmationStartsAt, confirmationEndsAt } = body as {
    name?: string;
    confirmationStartsAt?: string | null;
    confirmationEndsAt?: string | null;
  };

  const hasNameField = Object.prototype.hasOwnProperty.call(body, "name");
  const hasStartsAtField = Object.prototype.hasOwnProperty.call(
    body,
    "confirmationStartsAt"
  );
  const hasEndsAtField = Object.prototype.hasOwnProperty.call(
    body,
    "confirmationEndsAt"
  );

  if (!hasNameField && !hasStartsAtField && !hasEndsAtField) {
    return NextResponse.json(
      {
        error:
          "Envie ao menos um campo para atualizar: 'name', 'confirmationStartsAt' ou 'confirmationEndsAt'",
      },
      { status: 400 }
    );
  }

  if (hasNameField && !name?.trim()) {
    return NextResponse.json(
      { error: "O campo 'name' é obrigatório" },
      { status: 400 }
    );
  }

  if (hasStartsAtField !== hasEndsAtField) {
    return NextResponse.json(
      {
        error:
          "Os campos 'confirmationStartsAt' e 'confirmationEndsAt' devem ser enviados juntos",
      },
      { status: 400 }
    );
  }

  const updateData: {
    name?: string;
    confirmationStartsAt?: Date | null;
    confirmationEndsAt?: Date | null;
  } = {};

  if (hasNameField && name?.trim()) {
    updateData.name = name.trim();
  }

  if (hasStartsAtField && hasEndsAtField) {
    const parsedWindow = parseConfirmationWindow(
      confirmationStartsAt,
      confirmationEndsAt
    );

    if ("error" in parsedWindow) {
      return NextResponse.json({ error: parsedWindow.error }, { status: 400 });
    }

    updateData.confirmationStartsAt = parsedWindow.data.confirmationStartsAt;
    updateData.confirmationEndsAt = parsedWindow.data.confirmationEndsAt;
  }

  const exists = await prisma.guest.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json(
      { error: "Convidado não encontrado" },
      { status: 404 }
    );
  }

  const guest = await prisma.guest.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      code: true,
      updatedAt: true,
      confirmationStartsAt: true,
      confirmationEndsAt: true,
    },
  });

  return NextResponse.json(guest);
}

// DELETE /api/admin/guests/:id — remove o convidado e todos os seus dados
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const exists = await prisma.guest.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json(
      { error: "Convidado não encontrado" },
      { status: 404 }
    );
  }

  // Prisma não tem cascade automático aqui — deletamos na ordem certa
  await prisma.guestAccess.deleteMany({ where: { guestId: id } });
  await prisma.guestResponse.deleteMany({ where: { guestId: id } });
  await prisma.guest.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
