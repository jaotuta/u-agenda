// app/api/sheets-debug/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const email = process.env.GOOGLE_CLIENT_EMAIL || null;
  const pk = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_B64, "base64").toString(
    "utf-8"
  );

  return NextResponse.json({
    envSeen: {
      hasClientEmail: !!email,
      privateKey: pk.replace(/\\n/g, "\n"),
      privateKey2: pk,
    },
  });
}
