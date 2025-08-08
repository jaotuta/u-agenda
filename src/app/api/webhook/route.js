import { NextResponse } from "next/server";
import { waSendText, waMarkRead } from "@/lib/whatsapp";
import {
  parseTransactionWithGemini,
  chatWithGemini,
  classifyFinanceIntent,
} from "@/lib/gemini";
import {
  getTotals,
  getTotalsByCategory,
  getRecentTransactions,
  getMonthly,
  saveTransaction,
} from "@/lib/db";

function formatTxReply(tx) {
  const valor = Number(tx.amount).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Tipo: ${tx.type}\nCategoria: ${tx.category}\nValor: ${valor}\nData: ${tx.date}`;
}

export async function GET(req) {
  /* igual */
}

export async function POST(req) {
  const body = await req.json();

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const statuses = value?.statuses?.[0];

    if (statuses) return NextResponse.json({ ok: true });

    if (message) {
      const from = message.from; // wa_id
      const type = message.type;
      const msgId = message.id;
      const contactName = value?.contacts?.[0]?.profile?.name;

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
        // 1) Primeiro: continua registrando transações (se for o caso)
        const { transaction } = await parseTransactionWithGemini(text);
        if (transaction) {
          try {
            const saved = await saveTransaction({
              messageId: msgId, // cuidado: se repetir o mesmo id, não insere de novo
              waId: from,
              contactName,
              type: transaction.type,
              category: transaction.category,
              amount: transaction.amount,
              dateBr: transaction.date,
              rawText: text,
            });
            console.log("saved tx:", saved); // log rápido p/ ver se inseriu ou foi DO NOTHING
          } catch (err) {
            console.error("saveTransaction error:", err?.message || err);
          }

          const reply = formatTxReply(transaction);
          await waSendText(from, reply);
          return NextResponse.json({ ok: true });
        }

        // 2) Não é transação → pergunta: é consulta financeira?
        const route = await classifyFinanceIntent(text);
        if (route?.intent === "consulta") {
          const range = route.range || {};
          const period = {
            from: range.from,
            to: range.to,
          };
          const typeFilter = route.type || "Todos";
          const focus = route.focus || "totais";

          // Busca conforme foco
          let financeData = { period, typeFilter, focus };
          if (focus === "totais") {
            financeData.totals = await getTotals(
              from,
              period.from,
              period.to,
              typeFilter
            );
          } else if (focus === "categorias") {
            financeData.byCategory = await getTotalsByCategory(
              from,
              period.from,
              period.to,
              typeFilter
            );
          } else if (focus === "recentes") {
            financeData.recent = await getRecentTransactions(
              from,
              period.from,
              period.to,
              typeFilter,
              5
            );
          } else if (focus === "mensal") {
            financeData.monthly = await getMonthly(
              from,
              period.from,
              period.to,
              typeFilter
            );
          }

          // 3) Envia a pergunta + dados para o Gemini responder baseado no DB
          reply = await chatWithGemini(text, {
            contactName,
            waId: from,
            financeData,
          });
        } else {
          // 3b) Não é consulta → chat normal
          reply = await chatWithGemini(text, { contactName, waId: from });
        }
      } else {
        reply = await chatWithGemini(
          text,
          { contactName, waId: from, financeData },
          { format: "list" } // <— instrução para responder em formato de lista
        );
      }

      await waSendText(from, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e?.message || e);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
