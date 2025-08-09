// lib/sheets.js
import { google } from "googleapis";
let sheetsClient = null;

function summarize(key) {
  if (!key) return { present: false };
  const hasEscaped = key.includes("\\n");
  const hasReal = key.includes("\n");
  const lines = key.split(/\r?\n/).length;
  return {
    present: true,
    length: key.length,
    lines,
    style: hasEscaped ? "\\n" : hasReal ? "\\n(real)" : "none",
    hasHeader: key.includes("BEGIN PRIVATE KEY"),
  };
}

function readCreds() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || null;

  // 1) Prioriza base64 (se usar)
  const b64 = process.env.GOOGLE_PRIVATE_KEY_B64 || null;
  if (email && b64) {
    const key = Buffer.from(b64, "base64").toString("utf8");
    console.log("[sheets] using GOOGLE_PRIVATE_KEY_B64:", summarize(key));
    return { client_email: email, private_key: key };
  }

  // 2) Depois plaintext com \\n
  let key = process.env.GOOGLE_PRIVATE_KEY || null;
  if (email && key) {
    if (key.includes("\\n")) key = key.replace(/\\r?\\n/g, "\n");
    console.log(
      "[sheets] using GOOGLE_PRIVATE_KEY (after replace):",
      summarize(key)
    );
    return { client_email: email, private_key: key };
  }

  // 3) Fallback: JSON único
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || null;
  if (raw) {
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida");
    }
    let pk = json.private_key || "";
    if (pk.includes("\\n")) pk = pk.replace(/\\r?\\n/g, "\n");
    console.log("[sheets] using GOOGLE_SERVICE_ACCOUNT_KEY:", summarize(pk));
    return { client_email: json.client_email, private_key: pk };
  }

  throw new Error("Credenciais do Google ausentes");
}

async function getAuth() {
  const { client_email, private_key } = readCreds();
  if (!client_email) throw new Error("client_email ausente");
  if (!private_key || !private_key.includes("BEGIN PRIVATE KEY")) {
    console.error("[sheets] private_key inválida:", summarize(private_key));
    throw new Error("private_key inválida");
  }
  console.log("[sheets] creating JWT for:", client_email);
  const auth = new google.auth.JWT(client_email, null, private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  await auth.authorize();
  console.log("[sheets] auth.authorize() OK");
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
  console.log("[sheets] append →", spreadsheetId.slice(0, 8) + "...");
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
      new Date().toISOString(),
    ],
  ];
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  console.log("[sheets] append OK →", res.data?.updates?.updatedRange);
  return res.data;
}
