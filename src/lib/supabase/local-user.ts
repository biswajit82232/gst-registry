import { getSupabaseEnv } from "./config";

const LAST_USER_KEY = "gst-registry-last-user";

export type LocalUser = { id: string; email: string | null };

export function rememberLocalUser(user: LocalUser) {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode */
  }
}

export function forgetLocalUser() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* private mode */
  }
}

export function recalledLocalUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalUser;
    if (parsed && typeof parsed.id === "string" && parsed.id) {
      return { id: parsed.id, email: parsed.email ?? null };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function projectRef(): string | null {
  const url = getSupabaseEnv().url;
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function cookieValue(name: string, cookies: Record<string, string>): string {
  return cookies[name] ?? "";
}

function cookiesByName(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const out: Record<string, string> = {};
  for (const part of document.cookie.split(";")) {
    const cut = part.indexOf("=");
    if (cut < 0) continue;
    const name = part.slice(0, cut).trim();
    let value = part.slice(cut + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    out[name] = value;
  }
  return out;
}

function decodeBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function userFromJwt(token: string): LocalUser | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { sub?: string; email?: string };
    if (!payload.sub) return null;
    return { id: payload.sub, email: payload.email ?? null };
  } catch {
    return null;
  }
}

function userFromSessionJson(raw: string): LocalUser | null {
  let json = raw;
  if (raw.startsWith("base64-")) {
    try {
      json = decodeBase64Url(raw.slice("base64-".length));
    } catch {
      return null;
    }
  }
  try {
    const session = JSON.parse(json) as {
      access_token?: string;
      user?: { id?: string; email?: string | null };
    };
    if (session.user?.id) return { id: session.user.id, email: session.user.email ?? null };
    if (session.access_token) return userFromJwt(session.access_token);
  } catch {
    return null;
  }
  return null;
}

export function userFromAuthCookie(): LocalUser | null {
  const ref = projectRef();
  if (!ref) return null;
  const key = `sb-${ref}-auth-token`;
  const cookies = cookiesByName();
  let raw = cookieValue(key, cookies);
  if (!raw) {
    const parts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const chunk = cookieValue(`${key}.${i}`, cookies);
      if (!chunk) break;
      parts.push(chunk);
    }
    raw = parts.join("");
  }
  if (!raw) return null;
  return userFromSessionJson(raw);
}

/** Read the last signed-in user from cookies or localStorage. Does not hit the network. */
export function peekStoredUser(): LocalUser | null {
  return userFromAuthCookie() ?? recalledLocalUser();
}
