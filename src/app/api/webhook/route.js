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
          const period = { from: range.from, to: range.to };
          const typeFilter = route.type || "Todos";
          const focus = route.focus || "totais";

          let reply = "";

          if (focus === "totais") {
            const totals = await getTotals(
              from,
              period.from,
              period.to,
              typeFilter
            );
            const deb = Number(totals?.total_debitos || 0).toLocaleString(
              "pt-BR",
              { minimumFractionDigits: 2 }
            );
            const cre = Number(totals?.total_creditos || 0).toLocaleString(
              "pt-BR",
              { minimumFractionDigits: 2 }
            );
            reply =
              `📊 Resumo (${typeFilter}) — ${period.from} a ${period.to}\n` +
              `- Débitos: R$ ${deb}\n` +
              `- Créditos: R$ ${cre}`;
          } else if (focus === "categorias") {
            const rows = await getTotalsByCategory(
              from,
              period.from,
              period.to,
              typeFilter
            );
            reply =
              `📂 Por categoria (${typeFilter}) — ${period.from} a ${period.to}\n` +
              (rows.length
                ? rows
                    .map(
                      (r) =>
                        `- ${r.category}: R$ ${Number(r.total).toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2 }
                        )}`
                    )
                    .join("\n")
                : "Nenhum registro no período.");
          } else if (focus === "recentes") {
            const rows = await getRecentTransactions(
              from,
              period.from,
              period.to,
              typeFilter,
              5
            );
            reply =
              `🕑 Recentes (${typeFilter}) — ${period.from} a ${period.to}\n` +
              (rows.length
                ? rows
                    .map(
                      (tx) =>
                        `- ${tx.date} • ${tx.category} • ${
                          tx.type
                        } • R$ ${Number(tx.amount).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}`
                    )
                    .join("\n")
                : "Nenhum registro no período.");
          } else if (focus === "mensal") {
            const rows = await getMonthly(
              from,
              period.from,
              period.to,
              typeFilter
            );
            reply =
              `📅 Totais mensais (${typeFilter})\n` +
              (rows.length
                ? rows
                    .map(
                      (r) =>
                        `- ${r.month} • ${r.type}: R$ ${Number(
                          r.total
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}`
                    )
                    .join("\n")
                : "Nenhum registro.");
          } else {
            reply =
              "Não entendi o tipo de consulta. Tente: totais, categorias, recentes ou mensal.";
          }

          await waSendText(from, reply);
          return NextResponse.json({ ok: true });
        } else {
          // 3b) Não é consulta → chat normal
          reply = await chatWithGemini(text, { contactName, waId: from });
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
