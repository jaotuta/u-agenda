export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { JWT } from "google-auth-library";

export async function GET() {
  try {
    const email = process.env.GOOGLE_CLIENT_EMAIL;
    const b64 = process.env.GOOGLE_PRIVATE_KEY_B64;
    if (!email || !b64)
      throw new Error(
        "Env ausente: GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY_B64"
      );

    const key = Buffer.from(b64, "base64")
      .toString("utf8")
      .replace(/\r\n/g, "\n")
      .trim();

    if (!key.includes("BEGIN PRIVATE KEY")) {
      throw new Error("Base64 decodificado sem header BEGIN PRIVATE KEY");
    }

    const client = new JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    await client.authorize();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
