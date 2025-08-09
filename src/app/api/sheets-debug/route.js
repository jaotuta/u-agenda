// app/api/sheets-debug/route.js
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/sheets";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuth();
  return NextResponse.json({
    envSeen: {
      hasClientEmail: auth,
    },
  });
}
