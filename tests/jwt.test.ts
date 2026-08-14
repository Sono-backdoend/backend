import { describe, it, expect, vi } from "vitest";

// Define a chave no ambiente ANTES de qualquer código/módulo ser avaliado
vi.hoisted(() => {
  process.env.AUTH_SECRET = "chave_secreta_para_testes_unitarios_123456";
});

import { signAdminToken, verifyAdminToken, AdminTokenPayload } from "../lib/jwt";

describe("JWT Utility Tests", () => {
  it("deve assinar e verificar um token de admin com sucesso", async () => {
    const payload: AdminTokenPayload = {
      id: "admin-123",
      email: "admin@arraia.com",
      name: "Admin Geral",
    };

    const token = await signAdminToken(payload);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const decoded = await verifyAdminToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.name).toBe(payload.name);
  });
});