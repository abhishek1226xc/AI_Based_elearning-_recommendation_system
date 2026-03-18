import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("auth session expiry", () => {
  it("rejects expired session tokens", async () => {
    const token = await sdk.signSession(
      {
        openId: "expired-user",
        appId: "local-app",
        name: "Expired User",
      },
      {
        expiresInMs: -1,
      }
    );

    const verified = await sdk.verifySession(token);
    expect(verified).toBeNull();
  });
});
