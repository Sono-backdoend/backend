import { describe, it, expect } from "vitest";
import {
  parseConfirmationWindow,
  isWithinConfirmationWindow,
  getConfirmationWindowMessage,
} from "../lib/confirmation-window";

describe("Confirmation Window Tests", () => {
  describe("parseConfirmationWindow", () => {
    it("deve retornar null se ambos os campos forem nulos", () => {
      const result = parseConfirmationWindow(null, null);
      expect(result).toEqual({
        data: { confirmationStartsAt: null, confirmationEndsAt: null },
      });
    });

    it("deve retornar erro se apenas um dos campos for enviado", () => {
      const result = parseConfirmationWindow("2026-01-01", null);
      expect(result).toEqual({
        error:
          "Os campos 'confirmationStartsAt' e 'confirmationEndsAt' devem ser enviados juntos",
      });
    });

    it("deve retornar erro se a data inicial for maior ou igual à final", () => {
      const result = parseConfirmationWindow("2026-05-10", "2026-05-01");
      expect(result).toEqual({
        error: "'confirmationStartsAt' deve ser anterior a 'confirmationEndsAt'",
      });
    });

    it("deve converter datas ISO válidas com sucesso", () => {
      const start = "2026-05-01T00:00:00.000Z";
      const end = "2026-05-10T00:00:00.000Z";
      const result = parseConfirmationWindow(start, end);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.confirmationStartsAt).toEqual(new Date(start));
        expect(result.data.confirmationEndsAt).toEqual(new Date(end));
      }
    });
  });

  describe("isWithinConfirmationWindow", () => {
    const start = new Date("2026-05-01T00:00:00.000Z");
    const end = new Date("2026-05-10T00:00:00.000Z");

    it("deve retornar true se a data atual estiver dentro da janela", () => {
      const now = new Date("2026-05-05T00:00:00.000Z");
      expect(isWithinConfirmationWindow(now, start, end)).toBe(true);
    });

    it("deve retornar false se a data for anterior ao início", () => {
      const now = new Date("2026-04-30T00:00:00.000Z");
      expect(isWithinConfirmationWindow(now, start, end)).toBe(false);
    });

    it("deve retornar false se a data for posterior ao fim", () => {
      const now = new Date("2026-05-11T00:00:00.000Z");
      expect(isWithinConfirmationWindow(now, start, end)).toBe(false);
    });
  });

  describe("getConfirmationWindowMessage", () => {
    const start = new Date("2026-05-01T10:00:00.000Z");
    const end = new Date("2026-05-10T18:00:00.000Z");

    it("deve exibir mensagem de que a confirmação ainda não abriu", () => {
      const now = new Date("2026-04-01T00:00:00.000Z");
      const msg = getConfirmationWindowMessage(now, start, end);
      expect(msg).toContain("ainda não está disponível");
    });

    it("deve exibir mensagem de prazo encerrado", () => {
      const now = new Date("2026-06-01T00:00:00.000Z");
      const msg = getConfirmationWindowMessage(now, start, end);
      expect(msg).toContain("já encerrou em");
    });
  });
});