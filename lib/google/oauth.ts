import { google } from "googleapis";

const REQUIRED_GOOGLE_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
] as const;

function requireGoogleEnv(name: (typeof REQUIRED_GOOGLE_ENV)[number]) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name}가 설정되지 않았습니다.`);
  }

  return value;
}

export function createGoogleOAuthClient() {
  const clientId = requireGoogleEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireGoogleEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requireGoogleEnv("GOOGLE_REDIRECT_URI");

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

export function getGoogleAuthUrl(returnTo = "/account") {
  const oauth2Client = createGoogleOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: returnTo,
  });
}
