export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";

export async function GET() {
  try {
    const email = !!process.env.GOOGLE_CLIENT_EMAIL;
    const pk = process.env.GOOGLE_PRIVATE_KEY ? "present" : "absent";
    const sj = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    console.log("[debug] env flags:", { email, pk, sj });

    const client = await getSheetsClient();
    return NextResponse.json({ ok: true, email, pk, sj, client: !!client });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
