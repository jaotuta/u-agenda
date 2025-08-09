// app/api/sheets-auth-test/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const keyB64 = process.env.GOOGLE_PRIVATE_KEY_B64;
    const key = Buffer.from(keyB64, "base64").toString("utf8");

    const auth = new google.auth.JWT(email, null, key, [
      "https://www.googleapis.com/auth/spreadsheets",
    ]);
    await auth.authorize();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
