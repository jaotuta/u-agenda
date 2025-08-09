// lib/sheets.js
import { google } from "googleapis";

let sheetsClient = null;

async function getAuth() {
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  let private_key = process.env.GOOGLE_PRIVATE_KEY;

  if (!client_email || !private_key) {
    throw new Error(
      "Variáveis de ambiente GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY ausentes"
    );
  }

  // Substitui \n literais por quebras reais
  private_key = private_key.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT(client_email, null, private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);

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
  try {
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
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
