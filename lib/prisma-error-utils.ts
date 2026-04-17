/**
 * In some Next.js server bundles, `instanceof PrismaClientKnownRequestError` is false
 * because the thrown error comes from a different copy of `@prisma/client` than the
 * one imported here — so always inspect `code` instead.
 */
export function getPrismaErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === "object" && "code" in error) {
    const c = (error as { code: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

export function isPrismaClientValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === "PrismaClientValidationError";
}
