import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAdminToken } from "@/lib/jwt";
import { getClientIp } from "@/lib/get-client-ip";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "email e password são obrigatórios" },
      { status: 400 }
    );
  }

  // Limite por IP (evita um IP testar várias contas) e por e-mail (evita
  // força bruta distribuída entre vários IPs contra uma única conta).
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`login:ip:${ip}`, 20, WINDOW_MS);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

  const emailLimit = checkRateLimit(`login:email:${email}`, 5, WINDOW_MS);
  if (!emailLimit.allowed) return rateLimitResponse(emailLimit);

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  const token = await signAdminToken({ id: admin.id, email: admin.email, name: admin.name });

  return NextResponse.json({ token });
}
