export type CookieOptions = {
  path: string;
  sameSite: "lax";
  secure: boolean;
};

export function cookieOptions(secure: boolean): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure,
  };
}

export function requestIsHttps(request?: Request): boolean {
  if (request) {
    const proto =
      request.headers.get("x-forwarded-proto") ||
      new URL(request.url).protocol.replace(":", "");
    return proto === "https";
  }
  if (typeof window !== "undefined") {
    return window.location.protocol === "https:";
  }
  return process.env.NODE_ENV === "production";
}

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  const proto =
    request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
