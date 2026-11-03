import { google } from "googleapis";
import { createGoogleOAuthClient } from "@/lib/google/oauth";

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function plainTextToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "<br>");
}

export function buildEmailHtml({
  body,
  signatureHtml,
}: {
  body: string;
  signatureHtml?: string | null;
}) {
  const bodyHtml = plainTextToHtml(body);

  if (!signatureHtml?.trim()) {
    return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${bodyHtml}</div>`;
  }

  return [
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">',
    bodyHtml,
    '<div style="height:20px"></div>',
    signatureHtml,
    "</div>",
  ].join("");
}

export async function getGmailSignature({
  refreshToken,
  email,
}: {
  refreshToken: string;
  email: string;
}) {
  const oauth2Client = createGoogleOAuthClient();

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  const response = await gmail.users.settings.sendAs.get({
    userId: "me",
    sendAsEmail: email,
  });

  return response.data.signature ?? "";
}

export async function sendGmail({
  refreshToken,
  to,
  subject,
  body,
  html,
  threadId,
}: {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
  html?: string | null;
  threadId?: string | null;
}) {
  const oauth2Client = createGoogleOAuthClient();

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  const boundary = `crm_boundary_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const messageLines = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html || buildEmailHtml({ body }),
    "",
    `--${boundary}--`,
  ];

  const raw = toBase64Url(messageLines.join("\r\n"));

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      ...(threadId ? { threadId } : {}),
    },
  });

  return {
    messageId: response.data.id ?? null,
    threadId: response.data.threadId ?? null,
  };
}
