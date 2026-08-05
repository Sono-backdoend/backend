export type ParsedConfirmationWindow = {
  confirmationStartsAt: Date | null;
  confirmationEndsAt: Date | null;
};

// Valida o par confirmationStartsAt/confirmationEndsAt: ambos ausentes (sem
// janela) ou ambos presentes com início < fim. Não compara com o momento
// atual — permite janelas totalmente no passado (backdating) ou no futuro.
export function parseConfirmationWindow(
  startsAt: unknown,
  endsAt: unknown
): { data: ParsedConfirmationWindow } | { error: string } {
  if (startsAt == null && endsAt == null) {
    return { data: { confirmationStartsAt: null, confirmationEndsAt: null } };
  }

  if (startsAt == null || endsAt == null) {
    return {
      error:
        "Os campos 'confirmationStartsAt' e 'confirmationEndsAt' devem ser enviados juntos",
    };
  }

  if (typeof startsAt !== "string" || typeof endsAt !== "string") {
    return {
      error:
        "Os campos 'confirmationStartsAt' e 'confirmationEndsAt' devem ser strings de data (ISO-8601)",
    };
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      error:
        "Os campos 'confirmationStartsAt' e 'confirmationEndsAt' devem conter datas válidas",
    };
  }

  if (start.getTime() >= end.getTime()) {
    return {
      error: "'confirmationStartsAt' deve ser anterior a 'confirmationEndsAt'",
    };
  }

  return { data: { confirmationStartsAt: start, confirmationEndsAt: end } };
}

// Sem janela definida (ambos null) = sem restrição.
export function isWithinConfirmationWindow(
  now: Date,
  confirmationStartsAt: Date | null | undefined,
  confirmationEndsAt: Date | null | undefined
): boolean {
  if (!confirmationStartsAt && !confirmationEndsAt) return true;
  if (!confirmationStartsAt || !confirmationEndsAt) return false;
  return now >= confirmationStartsAt && now <= confirmationEndsAt;
}

// Só deve ser chamada quando isWithinConfirmationWindow já retornou false.
export function getConfirmationWindowMessage(
  now: Date,
  confirmationStartsAt: Date | null | undefined,
  confirmationEndsAt: Date | null | undefined
): string {
  if (!confirmationStartsAt || !confirmationEndsAt) {
    return "Janela de confirmação inválida";
  }

  const format = (date: Date) =>
    date.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });

  if (now < confirmationStartsAt) {
    return `A confirmação deste convite ainda não está disponível. Ela abre em ${format(confirmationStartsAt)}.`;
  }

  return `O prazo para confirmar este convite já encerrou em ${format(confirmationEndsAt)}.`;
}
