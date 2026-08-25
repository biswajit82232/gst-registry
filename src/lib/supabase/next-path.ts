/** Same-origin path for post-auth redirects. Rejects protocol-relative and userinfo hosts. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  const value = next.trim();
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.includes("://") || value.includes("\\") || value.includes("@")) return "/";
  if (value.includes("..")) return "/";
  return value;
}
