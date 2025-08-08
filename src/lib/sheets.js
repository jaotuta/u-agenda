import { google } from "googleapis";

let sheetsClient;

export async function getSheetsClient() {
  if (!sheetsClient) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

export async function appendTransactionToSheet(spreadsheetId, tx) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A1", // começa no topo, ele vai adicionar no final
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          tx.messageId,
          tx.waId,
          tx.contactName,
          tx.type,
          tx.category,
          tx.amount,
          tx.dateBr,
          tx.rawText,
        ],
      ],
    },
  });
}
