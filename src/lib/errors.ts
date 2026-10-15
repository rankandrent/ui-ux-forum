type DbError = { code?: string; message?: string } | null | undefined;

// Messages raised by our SQL functions are written for end users; pass them through.
const USER_FACING_CODES = new Set(["28000", "42501", "22023", "P0002", "P0429"]);

export function friendlyError(error: DbError, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  if (error.code && USER_FACING_CODES.has(error.code) && error.message) return error.message;
  if (error.code === "23514") return "Some fields are too short or too long. Please check and try again.";
  if (error.code === "23505") return "That value is already taken.";
  console.error("db error", error.code, error.message);
  return fallback;
}
