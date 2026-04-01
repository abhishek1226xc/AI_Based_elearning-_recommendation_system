import { createHash } from "crypto";

/**
 * Hash a password using SHA-256
 * Used for secure password storage and comparison
 */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}
