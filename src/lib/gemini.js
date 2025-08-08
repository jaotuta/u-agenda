import { GoogleGenerativeAI } from "@google/generative-ai";

const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// prompt de sistema p/ manter tom/idioma do bot
const SYSTEM_PROMPT = `
Você é um assistente de WhatsApp em português do Brasil.
- Seja claro, curto e útil.
- Se a pergunta for técnica, dê passos práticos.
- Se não souber, diga que não sabe e sugira próximo passo.
- Nunca exponha chaves/segredos.
`;

export async function generateReply(userText, ctx = {}) {
  if (!process.env.GOOGLE_AI_API_KEY) {
    return "IA indisponível no momento (chave não configurada).";
  }
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });

  const parts = [
    { text: SYSTEM_PROMPT },
    { text: `Contexto: ${JSON.stringify(ctx).slice(0, 4000)}` },
    { text: `Usuário: ${userText}` },
    { text: "Responda em uma única mensagem." },
  ];

  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  const text = result.response?.text?.() || "";
  // fallback seguro
  return (text || "Certo! Como posso ajudar?").slice(0, 4000); // WhatsApp tem limites de tamanho prático
}
