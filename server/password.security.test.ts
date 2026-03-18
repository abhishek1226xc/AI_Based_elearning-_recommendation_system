import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, passwordNeedsUpgrade, verifyPassword } from "./_core/password";

describe("password security", () => {
  it("hashes and verifies passwords with scrypt format", async () => {
    const hashed = await hashPassword("Str0ngPassword!");

    expect(hashed.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("Str0ngPassword!", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hashed)).resolves.toBe(false);
  });

  it("detects legacy sha256 hashes for migration", async () => {
    const legacy = createHash("sha256").update("legacy-pass").digest("hex");

    expect(passwordNeedsUpgrade(legacy)).toBe(true);
    await expect(verifyPassword("legacy-pass", legacy)).resolves.toBe(true);
  });
});
