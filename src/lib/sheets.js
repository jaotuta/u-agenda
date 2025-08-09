// lib/sheets.js
import { google } from "googleapis";

let sheetsClient = null;

function getServiceAccountJSON() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ausente");

  // Aceita: JSON em uma linha com \\n OU com quebras reais \n
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Se alguém colou com aspas de mais ou menos, avise:
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida (JSON parse falhou)");
  }

  // Normaliza private_key: se vier com \\n, converte para \n
  if (parsed.private_key && typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("client_email/private_key ausentes na service account");
  }
  return parsed;
}

async function getAuth() {
  const creds = getServiceAccountJSON();
  // escopos mínimos p/ Sheets
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  // força obtenção do token (pega erro cedo, não no append)
  await auth.authorize();
  return auth;
}

export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = await getAuth();
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export async function appendTransactionToSheet(spreadsheetId, tx) {
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID ausente");
  const sheets = await getSheetsClient();
  const values = [
    [
      tx.messageId ?? "",
      tx.waId ?? "",
      tx.contactName ?? "",
      tx.type ?? "",
      tx.category ?? "",
      Number(tx.amount) ?? 0,
      tx.dateBr ?? "",
      tx.rawText ?? "",
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}
