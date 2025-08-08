// lib/db.js
import { sql } from "@vercel/postgres";

export function parseBrDateToISO(br) {
  const [dd, mm, yyyy] = br.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export async function getTotals(waId, fromBr, toBr, typeFilter = "Todos") {
  const from = parseBrDateToISO(fromBr);
  const to = parseBrDateToISO(toBr);
  const typeSql =
    typeFilter === "Todos" ? sql`` : sql`AND type = ${typeFilter}`;
  const { rows } = await sql`
    SELECT 
      SUM(CASE WHEN type='Débito' THEN amount ELSE 0 END) AS total_debitos,
      SUM(CASE WHEN type='Crédito' THEN amount ELSE 0 END) AS total_creditos
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      ${typeSql}
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
  const typeSql =
    typeFilter === "Todos" ? sql`` : sql`AND type = ${typeFilter}`;
  const { rows } = await sql`
    SELECT category, SUM(amount) AS total
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      ${typeSql}
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
  const typeSql =
    typeFilter === "Todos" ? sql`` : sql`AND type = ${typeFilter}`;
  const { rows } = await sql`
    SELECT type, category, amount, to_char(date,'DD/MM/YYYY') as date
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      ${typeSql}
    ORDER BY date DESC, id DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getMonthly(waId, fromBr, toBr, typeFilter = "Todos") {
  const from = parseBrDateToISO(fromBr);
  const to = parseBrDateToISO(toBr);
  const typeSql =
    typeFilter === "Todos" ? sql`` : sql`AND type = ${typeFilter}`;
  const { rows } = await sql`
    SELECT to_char(date, 'YYYY-MM') as month, type, SUM(amount) as total
    FROM transactions
    WHERE wa_id = ${waId}
      AND date BETWEEN ${from} AND ${to}
      ${typeSql}
    GROUP BY 1,2
    ORDER BY 1 DESC
    LIMIT 12
  `;
  return rows;
}
