export function friendlyError(
  error: unknown,
  fallback = "Unable to complete this request. Please try again.",
) {
  if (error instanceof Error && error.message.startsWith("Set VITE_SUPABASE"))
    return error.message;
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "invalid_credentials") return "Email or password is incorrect.";
  if (code === "email_not_confirmed")
    return "This account must be confirmed by management before sign-in.";
  if (code === "42501")
    return "Access denied. Your current session does not have permission.";
  return fallback;
}
