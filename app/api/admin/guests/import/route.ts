import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { parseConfirmationWindow } from "@/lib/confirmation-window";

async function generateUniqueCode(existingCodes: Set<string>): Promise<string> {
  let code: string;
  do {
    code = randomBytes(4).toString("hex");
  } while (
    existingCodes.has(code) ||
    !!(await prisma.guest.findUnique({ where: { code } }))
  );
  existingCodes.add(code);
  return code;
}

function parseNamesFromText(text: string): string[] {
  return text
    .split(/[\n\r,;]/)
    .map((n) => n.trim())
    .filter(Boolean);
}

type ImportPayload = {
  names: string[];
  confirmationStartsAt?: string | null;
  confirmationEndsAt?: string | null;
};

async function extractPayload(req: NextRequest): Promise<ImportPayload> {
  const contentType = req.headers.get("content-type") ?? "";

  // multipart/form-data — arquivo .csv enviado pelo Insomnia
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");

    if (file && typeof file !== "string") {
      const text = await (file as File).text();
      return {
        names: parseNamesFromText(text),
        confirmationStartsAt:
          typeof formData.get("confirmationStartsAt") === "string"
            ? (formData.get("confirmationStartsAt") as string)
            : null,
        confirmationEndsAt:
          typeof formData.get("confirmationEndsAt") === "string"
            ? (formData.get("confirmationEndsAt") as string)
            : null,
      };
    }

    // campo de texto simples no form
    const names = formData.get("names");
    return {
      names: typeof names === "string" ? parseNamesFromText(names) : [],
      confirmationStartsAt:
        typeof formData.get("confirmationStartsAt") === "string"
          ? (formData.get("confirmationStartsAt") as string)
          : null,
      confirmationEndsAt:
        typeof formData.get("confirmationEndsAt") === "string"
          ? (formData.get("confirmationEndsAt") as string)
          : null,
    };
  }

  // application/json
  const body = await req.json();
  if (!body || typeof body !== "object") return { names: [] };

  const confirmationStartsAt =
    (body as { confirmationStartsAt?: unknown }).confirmationStartsAt ?? null;
  const confirmationEndsAt =
    (body as { confirmationEndsAt?: unknown }).confirmationEndsAt ?? null;

  if (Array.isArray((body as { names?: unknown }).names)) {
    return {
      names: (body as { names: unknown[] }).names
        .map((n) => (typeof n === "string" ? n.trim() : ""))
        .filter(Boolean),
      confirmationStartsAt:
        typeof confirmationStartsAt === "string" || confirmationStartsAt === null
          ? confirmationStartsAt
          : undefined,
      confirmationEndsAt:
        typeof confirmationEndsAt === "string" || confirmationEndsAt === null
          ? confirmationEndsAt
          : undefined,
    };
  }

  if (typeof (body as { csv?: unknown }).csv === "string") {
    return {
      names: parseNamesFromText((body as { csv: string }).csv),
      confirmationStartsAt:
        typeof confirmationStartsAt === "string" || confirmationStartsAt === null
          ? confirmationStartsAt
          : undefined,
      confirmationEndsAt:
        typeof confirmationEndsAt === "string" || confirmationEndsAt === null
          ? confirmationEndsAt
          : undefined,
    };
  }

  return { names: [] };
}

// POST /api/admin/guests/import — cria múltiplos convidados de uma vez
export async function POST(req: NextRequest) {
  const { names, confirmationStartsAt, confirmationEndsAt } =
    await extractPayload(req);

  if (names.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nenhum nome encontrado. Envie um arquivo CSV (campo 'file'), JSON { names: string[] } ou { csv: string }",
      },
      { status: 400 }
    );
  }

  const parsedWindow = parseConfirmationWindow(
    confirmationStartsAt,
    confirmationEndsAt
  );

  if ("error" in parsedWindow) {
    return NextResponse.json({ error: parsedWindow.error }, { status: 400 });
  }

  const usedCodes = new Set<string>();
  const created = [];
  const errors: { name: string; reason: string }[] = [];

  for (const name of names) {
    try {
      const code = await generateUniqueCode(usedCodes);
      const guest = await prisma.guest.create({
        data: { name, code, ...parsedWindow.data },
        select: {
          id: true,
          name: true,
          code: true,
          createdAt: true,
          confirmationStartsAt: true,
          confirmationEndsAt: true,
        },
      });
      created.push(guest);
    } catch {
      errors.push({ name, reason: "Falha ao criar no banco de dados" });
    }
  }

  return NextResponse.json(
    { created: created.length, guests: created, errors },
    { status: errors.length > 0 && created.length === 0 ? 500 : 201 }
  );
}
