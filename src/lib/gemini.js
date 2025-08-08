// lib/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// ————————————————————————————————————————————————————————————————————
// Singletons para reduzir latência em serverless
// ————————————————————————————————————————————————————————————————————
let _genAI = null;
let _model = null;
function getModel() {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null; // fallback seguro; não lance erro no webhook
  if (!_genAI) _genAI = new GoogleGenerativeAI(key);
  if (!_model) _model = _genAI.getGenerativeModel({ model: modelName });
  return _model;
}

// ————————————————————————————————————————————————————————————————————
// Util: datas em pt-BR
// ————————————————————————————————————————————————————————————————————
function formatDateBR(date = new Date(), timeZone = "America/Sao_Paulo") {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(date);
}

// ————————————————————————————————————————————————————————————————————
// Instruções
// ————————————————————————————————————————————————————————————————————
export const ROUTER_INSTRUCTIONS = `
Você é um roteador de intenção financeira em pt-BR.
Dado um texto curto de WhatsApp, responda SOMENTE em JSON:
- Se o usuário estiver pedindo informações dos próprios gastos/receitas, retorne:
  {"intent":"consulta","range":{"from":"DD/MM/AAAA","to":"DD/MM/AAAA"},"type":"Débito|Crédito|Todos","focus":"totais|categorias|recentes|mensal"}
  Regras:
  - Interprete expressões como "hoje", "ontem", "essa semana", "mês passado".
  - Se não houver período explícito, use: de 01 do mês atual até hoje (America/Sao_Paulo).
  - type: "Débito" se falar de gastos/despesas; "Crédito" se falar de receitas; "Todos" caso ambíguo.
  - focus:
    - "totais" quando pedir "quanto gastei" / "quanto recebi".
    - "categorias" quando pedir "por categoria".
    - "recentes" para "últimas transações".
    - "mensal" para "por mês".
- Caso não seja consulta financeira, retorne: {"intent":"chat"}.
APENAS JSON.
`;

export const SYSTEM_PARSER = `
Você atua como um parser financeiro em pt-BR. Transforme uma única mensagem curta de WhatsApp
em JSON representando uma transação financeira, quando aplicável.

REGRAS:
- Saída: APENAS JSON no formato:
{
  "transaction": {
    "type": "Débito" | "Crédito",
    "category": "string",
    "amount": number,
    "date": "DD/MM/AAAA"
  }
}
Ou { "transaction": null } se não for transação.
- "amount": número em reais, ponto como decimal, sem "R$" (ex.: 20, 35.5, 1234.56).
- "date": use a data atual (America/Sao_Paulo) a menos que o texto cite outra ("ontem", "05/08", etc.).
- Categorias simples em pt-BR (ex.: Mercado, Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Eletrônicos, Vestuário, Receita, Outros).
`;

// ————————————————————————————————————————————————————————————————————
// Helpers de contexto: selecione só o necessário (evita cortar JSON com slice)
// ————————————————————————————————————————————————————————————————————
function safeContext(ctx = {}) {
  const out = {};
  if (ctx.contactName) out.contactName = ctx.contactName;
  if (ctx.waId) out.waId = ctx.waId;
  if (ctx.financeData) {
    const fd = ctx.financeData;
    out.financeData = {
      period: fd.period || null,
      typeFilter: fd.typeFilter || null,
      focus: fd.focus || null,
    };
    if (fd.totals) out.financeData.totals = fd.totals;
    if (fd.byCategory) out.financeData.byCategory = fd.byCategory;
    if (fd.recent) out.financeData.recent = fd.recent;
    if (fd.monthly) out.financeData.monthly = fd.monthly;
  }
  return out;
}

// ————————————————————————————————————————————————————————————————————
// Classificar intenção de consulta financeira
// ————————————————————————————————————————————————————————————————————
export async function classifyFinanceIntent(userText) {
  const model = getModel();
  if (!model) return { intent: "chat" }; // sem IA, segue como chat

  const generationConfig = {
    responseMimeType: "application/json",
    // maxOutputTokens: 256, // opcional: limite de saída
  };

  const contents = [
    {
      role: "user",
      parts: [
        { text: ROUTER_INSTRUCTIONS },
        { text: `Data de referência: ${formatDateBR()}` },
        { text: `Mensagem: ${userText}` },
      ],
    },
  ];

  try {
    const result = await model.generateContent({ contents, generationConfig });
    const raw = result?.response?.text?.() || "{}";
    return JSON.parse(raw);
  } catch (err) {
    console.error("classifyFinanceIntent error:", err);
    return { intent: "chat" };
  }
}

// ————————————————————————————————————————————————————————————————————
// Parser de transação
// ————————————————————————————————————————————————————————————————————
export async function parseTransactionWithGemini(userText) {
  const model = getModel();
  if (!model) return { transaction: null };

  const generationConfig = {
    responseMimeType: "application/json",
    // maxOutputTokens: 256,
  };

  const contents = [
    {
      role: "user",
      parts: [
        { text: SYSTEM_PARSER },
        {
          text: `Data de referência: ${formatDateBR(
            new Date(),
            "America/Sao_Paulo"
          )}`,
        },
        { text: `Mensagem: ${userText}` },
      ],
    },
  ];

  try {
    const result = await model.generateContent({ contents, generationConfig });
    const raw = result?.response?.text?.() || "{}";
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.transaction)
      return parsed;
    return { transaction: null };
  } catch (err) {
    console.error("parseTransactionWithGemini error:", err);
    return { transaction: null };
  }
}

// ————————————————————————————————————————————————————————————————————
// Chat geral (usa financeData quando disponível)
// ————————————————————————————————————————————————————————————————————
export async function chatWithGemini(userText, ctx = {}) {
  const model = getModel();
  if (!model) return "IA não configurada no momento.";

  const SYSTEM_CHAT = `
Você é um assistente de WhatsApp em português.
Responda de forma amigável, clara e objetiva.
Se \"financeData\" existir no contexto, RESPONDA BASEADO NELE.
Se os dados estiverem vazios, diga que não encontrou registros no período solicitado.
Não invente números.
`;

  const parts = [
    { text: SYSTEM_CHAT },
    { text: `Contexto:\n${JSON.stringify(safeContext(ctx))}` },
    { text: `Pergunta do usuário:\n${userText}` },
  ];

  try {
    const res = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    return res?.response?.text?.() || "Certo!";
  } catch (err) {
    console.error("chatWithGemini error:", err);
    return "Não foi possível processar sua mensagem agora.";
  }
}
