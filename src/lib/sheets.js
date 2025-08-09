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
    newlineStyle: hasEscaped ? "\\n" : hasReal ? "\\n(real)" : "none",
    lines,
    startsWith: key.slice(0, 30),
    endsWith: key.slice(-30),
    hasHeader: key.includes("BEGIN PRIVATE KEY"),
  };
}

function readCreds() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || null;
  let key = process.env.GOOGLE_PRIVATE_KEY || null;

  console.log("[sheets] PATH: two-envs?", { hasEmail: !!email, hasKey: !!key });

  if (email && key) {
    // normaliza: \\n -> \n (faz ANTES de logar o sumário final)
    if (key.includes("\\n")) key = key.replace(/\\r?\\n/g, "\n");

    const sum = summarize(key);
    console.log("[sheets] USING two-envs; key summary AFTER replace:", {
      present: sum.present,
      length: sum.length,
      lines: sum.lines,
      newlineStyle: sum.newlineStyle,
      hasHeader: sum.hasHeader,
    });

    return { client_email: email, private_key: key };
  }

  // fallback: JSON único
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || null;
  console.log("[sheets] PATH: service-json?", !!raw);

  if (!raw) {
    throw new Error(
      "Credenciais ausentes (defina GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY OU GOOGLE_SERVICE_ACCOUNT_KEY)."
    );
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida (JSON parse falhou).");
  }

  let pk = json.private_key || "";
  if (pk.includes("\\n")) pk = pk.replace(/\\r?\\n/g, "\n");

  const sum = summarize(pk);
  console.log("[sheets] USING service-json; key summary AFTER replace:", {
    present: sum.present,
    length: sum.length,
    lines: sum.lines,
    newlineStyle: sum.newlineStyle,
    hasHeader: sum.hasHeader,
  });

  return { client_email: json.client_email, private_key: pk };
}

async function getAuth() {
  const { client_email, private_key } = readCreds();

  if (!client_email) throw new Error("client_email ausente.");
  if (!private_key || !private_key.includes("BEGIN PRIVATE KEY")) {
    console.error("[sheets] private_key inválida:", summarize(private_key));
    throw new Error("private_key inválida ou vazia.");
  }

  console.log("[sheets] creating JWT for:", client_email);
  const auth = new google.auth.JWT(client_email, null, private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);

  try {
    await auth.authorize();
    console.log("[sheets] auth.authorize() OK");
  } catch (e) {
    console.error("[sheets] auth.authorize() FAIL:", e?.message || e);
    throw e;
  }
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
  console.log(
    "[sheets] append → spreadsheetId:",
    spreadsheetId.slice(0, 8) + "..."
  );

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

  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    console.log(
      "[sheets] append OK, updatedRange:",
      res.data?.updates?.updatedRange
    );
    return res.data;
  } catch (e) {
    console.error("[sheets] append FAIL:", e?.message || e);
    throw e;
  }
}
