// lib/sheets.js
import { google } from "googleapis";
import { JWT } from "google-auth-library";

let sheetsClient = null;

async function getAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const b64 = process.env.GOOGLE_PRIVATE_KEY_B64;
  if (!email || !b64)
    throw new Error("GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY_B64 ausentes");

  const key = Buffer.from(b64, "base64")
    .toString("utf8")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!key.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY_B64 inválida (sem PEM)");
  }

  const auth = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return auth;
}

export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = await getAuth();
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export async function appendTransactionToSheet(tx) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID ausente");

  const sheets = await getSheetsClient();
  const values = [
    [
      tx.date,
      tx.type,
      tx.category,
      Number(tx.amount),
      tx.contactName || "",
      tx.waId || "",
      tx.rawText || "",
      tx.messageId || "",
      new Date().toISOString(),
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Transações!A:I",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { ok: true };
}
