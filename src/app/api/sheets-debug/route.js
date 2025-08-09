// app/api/sheets-debug/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
function summarizeKey(k) {
  if (!k) return { present: false };
  const hasEscaped = k.includes("\\n");
  const hasReal = k.includes("\n");
  const starts = k.slice(0, 30);
  const ends = k.slice(-30);
  return {
    present: true,
    length: k.length,
    newlineStyle: hasEscaped ? "\\n" : hasReal ? "\\n(real)" : "none",
    startsWith: starts,
    endsWith: ends,
    hasHeader: k.includes("BEGIN PRIVATE KEY"),
  };
}

export async function GET() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || null;
  const pk = process.env.GOOGLE_PRIVATE_KEY || null;
  const serviceJsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || null;

  let service = null;
  if (serviceJsonRaw) {
    try {
      const json = JSON.parse(serviceJsonRaw);
      service = {
        hasEmail: !!json.client_email,
        hasKey: !!json.private_key,
        keySummary: summarizeKey(json.private_key || ""),
      };
    } catch {
      service = { parseError: true };
    }
  }

  return NextResponse.json({
    envSeen: {
      hasClientEmail: !!email,
      privateKey: summarizeKey(pk),
      privateKey2: pk,
      hasServiceJson: !!serviceJsonRaw,
      serviceJson: service,
    },
  });
}
