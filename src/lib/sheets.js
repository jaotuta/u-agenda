import { google } from "googleapis";

let sheetsClient = null;

function readCreds() {
  // Caminho A: duas envs separadas (recomendado)
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const keyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (email && keyRaw) {
    // Vercel armazena com quebras reais se Encrypted. Se vier escapado, normaliza:
    const key = keyRaw.includes("\\n") ? keyRaw.replace(/\\n/g, "\n") : keyRaw;
    return { client_email: email, private_key: key };
  }

  // Caminho B: JSON único em GOOGLE_SERVICE_ACCOUNT_KEY
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw)
    throw new Error(
      "Nenhuma credencial encontrada (defina GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY ou GOOGLE_SERVICE_ACCOUNT_KEY)."
    );

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida (JSON parse falhou).");
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "client_email/private_key ausentes na GOOGLE_SERVICE_ACCOUNT_KEY."
    );
  }

  // Se a chave veio com \\n, converte para \n
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

async function getAuth() {
  const { client_email, private_key } = readCreds();
  if (!private_key || !private_key.includes("BEGIN PRIVATE KEY")) {
    throw new Error("private_key inválida ou vazia.");
  }
  const auth = new google.auth.JWT(client_email, null, private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  await auth.authorize(); // falha cedo se algo estiver errado
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
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
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
      ],
    },
  });
}
