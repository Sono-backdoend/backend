import { verifyAdminToken } from "@/lib/jwt";
import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",");

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin") ?? "";
  if (allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.headers.set(key, value);
  }
  return res;
}

export default async function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return withCors(req, new NextResponse(null, { status: 204 }));
  }

  const isLoginRoute = req.nextUrl.pathname === "/api/admin/login";
  if (isLoginRoute) return withCors(req, NextResponse.next());

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return withCors(req, NextResponse.json({ error: "Não autorizado" }, { status: 401 }));
  }

  try {
    await verifyAdminToken(authHeader.slice(7));
    return withCors(req, NextResponse.next());
  } catch {
    return withCors(req, NextResponse.json({ error: "Token inválido ou expirado" }, { status: 401 }));
  }
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
