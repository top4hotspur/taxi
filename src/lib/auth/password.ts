import crypto from "node:crypto";

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function comparePassword(password: string, hash: string) {
  return hashPassword(password) === hash;
}
