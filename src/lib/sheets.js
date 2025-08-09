// lib/sheets.js
import { google } from "googleapis";
let sheetsClient = null;

function summarize(key) {
  if (!key) return { present: false };
  const hasEscaped = key.includes("\\n");
  const hasReal = key.includes("\n");
  return {
    present: true,
    length: key.length,
    style: hasEscaped ? "\\n" : hasReal ? "\\n(real)" : "none",
    hasHeader: key.includes("BEGIN PRIVATE KEY"),
  };
}

function readCreds() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || null;

  // 1) B64 (opcional)
  const b64 = process.env.GOOGLE_PRIVATE_KEY_B64 || null;
  if (email && b64) {
    const key = Buffer.from(b64, "base64").toString("utf8");
    console.log("[sheets] using B64:", summarize(key));
    return { client_email: email, private_key: key };
  }

  // 2) Plaintext com \n
  let key = process.env.GOOGLE_PRIVATE_KEY || null;
  if (email && key) {
    // cobre \\n, \r\n e etc
    key = key.replace(/\\r?\\n/g, "\n");
    console.log("[sheets] using PLAIN:", summarize(key));
    return { client_email: email, private_key: key };
  }

  // 3) JSON único (fallback)
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || null;
  if (raw) {
    const json = JSON.parse(raw);
    let pk = (json.private_key || "").replace(/\\r?\\n/g, "\n");
    console.log("[sheets] using JSON:", summarize(pk));
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

export async function appendTransactionToSheet(tx) {
  try {
    console.log("=== appendTransactionToSheet ===");
    console.log("ENV email:", !!process.env.GOOGLE_CLIENT_EMAIL);
    console.log(
      "ENV key:",
      !!process.env.GOOGLE_PRIVATE_KEY ||
        !!process.env.GOOGLE_PRIVATE_KEY_B64 ||
        !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    );

    const spreadsheetId = process.env.SPREADSHEET_ID; // <— padronize aqui!
    if (!spreadsheetId) throw new Error("SPREADSHEET_ID ausente");
    console.log("Using spreadsheetId:", spreadsheetId.slice(0, 8) + "...");

    const sheets = await getSheetsClient();

    // Ajuste o nome da aba conforme existir na sua planilha
    const range = "Transações!A:I"; // 9 colunas (inclui timestamp)
    const values = [
      [
        tx.date, // A
        tx.type, // B
        tx.category, // C
        Number(tx.amount),
        tx.contactName || "",
        tx.waId || "",
        tx.rawText || "",
        tx.messageId || "",
        new Date().toISOString(), // timestamp
      ],
    ];

    console.log("Append range:", range, "values cols:", values[0].length);

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    console.log(
      "Sheets append OK:",
      res.data?.updates?.updatedRange || res.status
    );
    return { ok: true };
  } catch (error) {
    console.error("appendTransactionToSheet error:", error?.message || error);
    return { ok: false, error: String(error?.message || error) };
  }
}
