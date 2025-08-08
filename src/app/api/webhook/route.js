// app/api/webhook/route.js
import { NextResponse } from "next/server";
import { waSendText, waMarkRead } from "@/lib/whatsapp";
import { parseTransactionWithGemini, chatWithGemini } from "@/lib/gemini";

function formatReply(tx) {
  const valor = tx.amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Tipo: ${tx.type}\nCategoria: ${tx.category}\nValor: ${valor}\nData: ${tx.date}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const statuses = value?.statuses?.[0];

    // callbacks de status (delivered, read, etc.)
    if (statuses) return NextResponse.json({ ok: true });

    // mensagem recebida
    if (message) {
      const from = message.from;
      const type = message.type;
      const msgId = message.id;

      const text =
        type === "text"
          ? message.text?.body?.trim()
          : type === "interactive"
          ? message.interactive?.type === "button_reply"
            ? message.interactive.button_reply?.title
            : message.interactive?.list_reply?.title
          : undefined;

      if (msgId) await waMarkRead(msgId);

      let reply = "Não entendi. Pode reformular?";

      if (text) {
        const { transaction } = await parseTransactionWithGemini(text);

        if (transaction) {
          reply = formatReply(transaction);
        } else {
          const context = {
            contactName: value?.contacts?.[0]?.profile?.name,
            waId: value?.contacts?.[0]?.wa_id,
          };
          reply = await chatWithGemini(text, context);
        }
      } else {
        reply = "Recebi sua mensagem! (não-texto)";
      }

      await waSendText(from, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e?.message || e);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
