import { createHash, randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from "crypto";
import { promisify } from "util";

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_LEN = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
};

const scryptAsync = promisify(scryptCallback);

function encodeScryptHash(saltHex: string, derivedHex: string): string {
  return `${SCRYPT_PREFIX}$${saltHex}$${derivedHex}`;
}

function parseScryptHash(storedHash: string): { saltHex: string; derivedHex: string } | null {
  const parts = storedHash.split("$");
  if (parts.length !== 3) return null;
  if (parts[0] !== SCRYPT_PREFIX) return null;

  const saltHex = parts[1] || "";
  const derivedHex = parts[2] || "";

  if (!/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(derivedHex)) {
    return null;
  }

  return { saltHex, derivedHex };
}

function isLegacySha256Hash(storedHash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(storedHash);
}

export function passwordNeedsUpgrade(storedHash: string): boolean {
  return isLegacySha256Hash(storedHash);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = (await scryptAsync(password, salt, SCRYPT_KEY_LEN, SCRYPT_PARAMS)) as Buffer;
  return encodeScryptHash(salt.toString("hex"), derived.toString("hex"));
}

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(password, salt, SCRYPT_KEY_LEN, SCRYPT_PARAMS);
  return encodeScryptHash(salt.toString("hex"), derived.toString("hex"));
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseScryptHash(storedHash);
  if (parsed) {
    const salt = Buffer.from(parsed.saltHex, "hex");
    const expected = Buffer.from(parsed.derivedHex, "hex");
    const actual = (await scryptAsync(password, salt, expected.length, SCRYPT_PARAMS)) as Buffer;

    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  if (isLegacySha256Hash(storedHash)) {
    const legacy = createHash("sha256").update(password).digest("hex");
    const expected = Buffer.from(storedHash, "hex");
    const actual = Buffer.from(legacy, "hex");

    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  return false;
}
