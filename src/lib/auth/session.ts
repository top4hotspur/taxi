import crypto from "node:crypto";

const SESSION_COOKIE = "ni_session";

export interface SessionUser {
  userId: string;
  email: string;
  role: "customer" | "admin" | "driver";
}

function b64(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(value: string) {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload = b64(JSON.stringify(user));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  },
};
