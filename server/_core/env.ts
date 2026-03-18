const isProduction = process.env.NODE_ENV === "production";
const configuredAppId = process.env.VITE_APP_ID?.trim() ?? "";

export const ENV = {
  appId: configuredAppId || (isProduction ? "" : "local-app"),
  cookieSecret:
    process.env.JWT_SECRET ??
    (isProduction ? "" : "dev-local-session-secret-change-me"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  localAiFallbackEnabled: process.env.LOCAL_AI_FALLBACK !== "false",
  oauthEnabled: Boolean(process.env.OAUTH_SERVER_URL && configuredAppId),
};
