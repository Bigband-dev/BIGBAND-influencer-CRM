import { google } from "googleapis";

import {
  createGoogleOAuthClient,
} from "@/lib/google/oauth";

export async function sendGmail({
  refreshToken,
  to,
  subject,
  body,
  threadId,
}: {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string | null;
}) {
  const oauth2Client =
    createGoogleOAuthClient();

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  const messageLines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(
      subject
    ).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ];

  const rawMessage = messageLines.join("\r\n");

  const raw = Buffer.from(
    rawMessage
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response =
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        ...(threadId
          ? { threadId }
          : {}),
      },
    });

  return {
    messageId:
      response.data.id ?? null,
    threadId:
      response.data.threadId ?? null,
  };
}