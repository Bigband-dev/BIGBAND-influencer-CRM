import { google } from "googleapis";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/directory.readonly",
];

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name}가 설정되지 않았습니다.`);
  }

  return value;
}

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function getGoogleAuthUrl(returnTo = "/account") {
  const oauth2Client = createGoogleOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state: returnTo,
  });
}
