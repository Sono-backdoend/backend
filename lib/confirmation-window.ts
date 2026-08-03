type ParseResult =
  | { data: { confirmationStartsAt: Date | null; confirmationEndsAt: Date | null } }
  | { error: string };

export function parseConfirmationWindow(
  startsAt: unknown,
  endsAt: unknown
): ParseResult {
  if (startsAt == null && endsAt == null) {
    return {
      data: {
        confirmationStartsAt: null,
        confirmationEndsAt: null,
      },
    };
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
        "Os campos 'confirmationStartsAt' e 'confirmationEndsAt' devem ser strings ISO-8601 válidas",
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

  if (start >= end) {
    return {
      error: "'confirmationStartsAt' deve ser anterior a 'confirmationEndsAt'",
    };
  }

  return {
    data: {
      confirmationStartsAt: start,
      confirmationEndsAt: end,
    },
  };
}

export function isWithinConfirmationWindow(
  now: Date,
  confirmationStartsAt: Date | null | undefined,
  confirmationEndsAt: Date | null | undefined
) {
  if (!confirmationStartsAt && !confirmationEndsAt) return true;
  if (!confirmationStartsAt || !confirmationEndsAt) return false;
  return now >= confirmationStartsAt && now <= confirmationEndsAt;
}

export function getConfirmationWindowMessage(
  now: Date,
  confirmationStartsAt: Date | null | undefined,
  confirmationEndsAt: Date | null | undefined
) {
  if (!confirmationStartsAt || !confirmationEndsAt) {
    return "Janela de confirmação inválida";
  }

  if (now < confirmationStartsAt) {
    return `A confirmação estará disponível a partir de ${confirmationStartsAt.toISOString()}`;
  }

  if (now > confirmationEndsAt) {
    return `O prazo de confirmação encerrou em ${confirmationEndsAt.toISOString()}`;
  }

  return "A confirmação está disponível";
}
