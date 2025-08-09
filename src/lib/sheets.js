// lib/sheets.js
import { google } from "googleapis";

let sheetsClient = null;

function summarizeKey(key) {
  if (!key) return { present: false };
  const lines = key.split(/\r?\n/);
  return {
    present: true,
    length: key.length,
    lines: lines.length,
    startsWith: lines[0],
    endsWith: lines[lines.length - 1],
  };
}

function readCreds() {
  const emailEnv = process.env.GOOGLE_CLIENT_EMAIL;
  let keyEnv = process.env.GOOGLE_PRIVATE_KEY;

  console.log("[sheets] has GOOGLE_CLIENT_EMAIL:", !!emailEnv);
  console.log(
    "[sheets] has GOOGLE_PRIVATE_KEY:",
    !!keyEnv,
    "len:",
    keyEnv?.length || 0
  );

  // Caminho A: duas envs separadas (preferido)
  if (emailEnv && keyEnv) {
    // Se vier escapado (\\n), normaliza para \n
    if (keyEnv.includes("\\n")) keyEnv = keyEnv.replace(/\\n/g, "\n");

    const sum = summarizeKey(keyEnv);
    console.log("[sheets] private_key summary:", {
      present: sum.present,
      length: sum.length,
      lines: sum.lines,
      startsWith: sum.startsWith,
      endsWith: sum.endsWith,
    });

    return { client_email: emailEnv, private_key: keyEnv };
  }

  // Caminho B: JSON único
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  console.log("[sheets] has GOOGLE_SERVICE_ACCOUNT_KEY:", !!raw);
  if (!raw) {
    throw new Error(
      "Nenhuma credencial encontrada (defina GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY ou GOOGLE_SERVICE_ACCOUNT_KEY)."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[sheets] JSON.parse falhou em GOOGLE_SERVICE_ACCOUNT_KEY");
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida (JSON parse falhou).");
  }

  if (!parsed.client_email || !parsed.private_key) {
    console.error("[sheets] service JSON sem client_email/private_key");
    throw new Error(
      "client_email/private_key ausentes em GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }

  // Normaliza \n
  if (parsed.private_key.includes("\\n"))
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  const sum = summarizeKey(parsed.private_key);
  console.log("[sheets] private_key (from JSON) summary:", {
    present: sum.present,
    length: sum.length,
    lines: sum.lines,
    startsWith: sum.startsWith,
    endsWith: sum.endsWith,
  });

  return parsed;
}

async function getAuth() {
  const { client_email, private_key } = readCreds();

  if (!private_key || !private_key.includes("BEGIN PRIVATE KEY")) {
    console.error("[sheets] private_key sem header BEGIN PRIVATE KEY");
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
