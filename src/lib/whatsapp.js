const GRAPH_URL = (phoneId) =>
  `https://graph.facebook.com/v20.0/${phoneId}/messages`;

export async function waSendText(to, body) {
  const resp = await fetch(GRAPH_URL(process.env.WA_PHONE_NUMBER_ID), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body },
    }),
    cache: "no-store",
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`WA send failed: ${resp.status} ${err}`);
  }
  return resp.json();
}

export async function waMarkRead(messageId) {
  const resp = await fetch(GRAPH_URL(process.env.WA_PHONE_NUMBER_ID), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
    cache: "no-store",
  });
  return resp.ok;
}