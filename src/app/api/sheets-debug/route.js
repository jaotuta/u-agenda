// app/api/sheets-debug/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuth();
  return NextResponse.json({
    envSeen: {
      privateKey: pk.replace(/\\n/g, "\n"),
      privateKey2: pk,
    },
  });
}
