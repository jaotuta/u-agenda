// lib/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const ROUTER_INSTRUCTIONS = `
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

function todayBR(tz = "America/Sao_Paulo") {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(d);
}

export async function classifyFinanceIntent(userText) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });
  const generationConfig = { responseMimeType: "application/json" };

  const contents = [
    {
      role: "user",
      parts: [
        { text: ROUTER_INSTRUCTIONS },
        { text: `Data de referência: ${todayBR()}` },
        { text: `Mensagem: ${userText}` },
      ],
    },
  ];

  const result = await model.generateContent({ contents, generationConfig });
  const raw = result?.response?.text?.() || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { intent: "chat" };
  }
}

function ptBRDateString(date = new Date(), timeZone = "America/Sao_Paulo") {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(date);
}

export async function parseTransactionWithGemini(userText) {
  const today = ptBRDateString(new Date(), "America/Sao_Paulo");
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const generationConfig = { responseMimeType: "application/json" };

  const contents = [
    {
      role: "user",
      parts: [
        { text: SYSTEM_PARSER },
        { text: `Data de referência: ${today}` },
        { text: `Mensagem: ${userText}` },
      ],
    },
  ];

  const result = await model.generateContent({ contents, generationConfig });
  const raw = result?.response?.text?.() || "{}";

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.transaction) {
      return parsed;
    }
  } catch {
    return { transaction: null };
  }
  return { transaction: null };
}

export async function chatWithGemini(userText, ctx = {}) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const SYSTEM_CHAT = `
Você é um assistente de WhatsApp em português.
Responda de forma amigável, clara e objetiva.
Se "financeData" existir no contexto, RESPONDA BASEADO NELE. 
Se os dados estiverem vazios, diga que não encontrou registros no período solicitado.
Não invente números.
`;
  const parts = [
    { text: SYSTEM_CHAT },
    { text: `Contexto:\n${JSON.stringify(ctx).slice(0, 6000)}` },
    { text: `Pergunta do usuário:\n${userText}` },
  ];

  const res = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  return res?.response?.text?.() || "Certo!";
}

// (mantém também suas funções anteriores: parseTransactionWithGemini, etc.)
