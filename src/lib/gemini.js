// lib/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const SYSTEM_PARSER = `
Você atua como um parser financeiro em pt-BR. Sua tarefa é transformar uma mensagem de WhatsApp
em um JSON bem-formado representando uma transação financeira.

REGRAS:
- Débito = gasto/saída de dinheiro
- Crédito = entrada/recebimento de dinheiro
- "category": uma única palavra ou termo simples (ex: Mercado, Alimentação, Transporte, Saúde, Lazer, Educação, Eletrônicos, Vestuário, Outros, Receita).
- "amount": número em reais (ponto decimal), sem "R$".
- "date": no formato DD/MM/AAAA (America/Sao_Paulo), usando data atual a menos que o texto especifique outra.

Se o texto não descrever uma transação, responda:
{ "transaction": null }

FORMATO DE SAÍDA (somente JSON):
{
  "transaction": {
    "type": "Débito" | "Crédito",
    "category": "string",
    "amount": number,
    "date": "DD/MM/AAAA"
  }
}
ou
{ "transaction": null }
`;

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
Mantenha contexto básico: nome do contato = ${
    ctx.contactName || "Desconhecido"
  }.
`;

  const contents = [
    {
      role: "user",
      parts: [{ text: SYSTEM_CHAT }, { text: `Mensagem: ${userText}` }],
    },
  ];

  const result = await model.generateContent({ contents });
  return result?.response?.text?.() || "Certo!";
}
