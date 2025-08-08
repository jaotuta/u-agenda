import { sql } from "@vercel/postgres";

export function parseBrDateToISO(br) {
  if (!br || typeof br !== "string" || !/^\d{2}\/\d{2}\/\d{4}$/.test(br)) {
    const d = new Date();
    const dd = `${d.getDate()}`.padStart(2, "0");
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }
  const [dd, mm, yyyy] = br.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export async function getTotals(waId, fromBr, toBr, typeFilter = "Todos") {
  const from = parseBrDateToISO(fromBr);
  const to = parseBrDateToISO(toBr);
  const { rows } = await sql`
    SELECT 
      SUM(CASE WHEN type = 'Débito' THEN amount ELSE 0 END) AS total_debitos,
      SUM(CASE WHEN type = 'Crédito' THEN amount ELSE 0 END) AS total_creditos
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      AND (${typeFilter} = 'Todos' OR type = ${typeFilter})
  `;
  return rows[0];
}

export async function getTotalsByCategory(
  waId,
  fromBr,
  toBr,
  typeFilter = "Todos"
) {
  const from = parseBrDateToISO(fromBr);
  const to = parseBrDateToISO(toBr);
  const { rows } = await sql`
    SELECT category, SUM(amount) AS total
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      AND (${typeFilter} = 'Todos' OR type = ${typeFilter})
    GROUP BY category
    ORDER BY total DESC
    LIMIT 20
  `;
  return rows;
}

export async function getRecentTransactions(
  waId,
  fromBr,
  toBr,
  typeFilter = "Todos",
  limit = 5
) {
  const from = parseBrDateToISO(fromBr);
  const to = parseBrDateToISO(toBr);
  const { rows } = await sql`
    SELECT type, category, amount, to_char(date,'DD/MM/YYYY') as date
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      AND (${typeFilter} = 'Todos' OR type = ${typeFilter})
    ORDER BY date DESC, id DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getMonthly(waId, fromBr, toBr, typeFilter = "Todos") {
  const from = parseBrDateToISO(fromBr);
  const to = parseBrDateToISO(toBr);
  const { rows } = await sql`
    SELECT to_char(date, 'YYYY-MM') as month, type, SUM(amount) as total
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      AND (${typeFilter} = 'Todos' OR type = ${typeFilter})
    GROUP BY 1,2
    ORDER BY 1 DESC
    LIMIT 12
  `;
  return rows;
}
