import { google } from "googleapis";

export type Backup = {
  id: string;
  name: string;
  size: number;
  createdTime: string;
};

const NAME_PATTERN = /^crm_supabase_\d{8}T\d{6}\+0900\.tar\.gz\.enc$/;

function driveClient() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!encoded) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not configured in Vercel");
  const serviceAccount = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const auth = new google.auth.GoogleAuth({ credentials: serviceAccount, scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  return google.drive({ version: "v3", auth });
}

export async function listCrmBackups(): Promise<Backup[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured in Vercel");
  const drive = driveClient();
  const files: Backup[] = [];
  let pageToken: string | undefined;
  do {
    const result = await drive.files.list({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,size,createdTime,mimeType)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of result.data.files ?? []) {
      if (f.id && f.name && NAME_PATTERN.test(f.name)) {
        files.push({
          id: f.id,
          name: f.name,
          size: Number(f.size ?? 0),
          createdTime: f.createdTime ?? "",
        });
      }
    }
    pageToken = result.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files.sort((a, b) => b.name.localeCompare(a.name));
}
