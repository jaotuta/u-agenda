// app/usuarios/[waId]/resumo/page.js
import {
  getTotals,
  getTotalsByCategory,
  getRecentTransactions,
  getMonthly,
} from "@/lib/db";

function toParams(searchParams) {
  const from = searchParams.get("from") || null; // "DD/MM/AAAA"
  const to = searchParams.get("to") || null;
  const type = searchParams.get("type") || "Todos"; // "Débito" | "Crédito" | "Todos"
  return { from, to, type };
}

function fmtBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ResumoUsuario({ params, searchParams }) {
  const waId = params.waId;
  const { from, to, type } = toParams(new URLSearchParams(searchParams));

  // Carrega tudo em paralelo
  const [totals, byCategory, recent, monthly] = await Promise.all([
    getTotals(waId, from, to, type),
    getTotalsByCategory(waId, from, to, type),
    getRecentTransactions(waId, from, to, type, 10),
    getMonthly(waId, from, to, type),
  ]);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Resumo financeiro</h1>
      <div style={{ color: "#666", marginBottom: 24 }}>WA ID: {waId}</div>

      {/* Filtros simples via querystring */}
      <form
        method="GET"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <input
          name="from"
          placeholder="De (DD/MM/AAAA)"
          defaultValue={from || ""}
        />
        <input
          name="to"
          placeholder="Até (DD/MM/AAAA)"
          defaultValue={to || ""}
        />
        <select name="type" defaultValue={type}>
          <option>Todos</option>
          <option>Débito</option>
          <option>Crédito</option>
        </select>
        <button type="submit">Filtrar</button>
      </form>

      {/* Totais */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Totais</h2>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            Débitos: <strong>R$ {fmtBRL(totals?.total_debitos)}</strong>
          </div>
          <div>
            Créditos: <strong>R$ {fmtBRL(totals?.total_creditos)}</strong>
          </div>
        </div>
      </section>

      {/* Por categoria */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Por categoria</h2>
        {!byCategory || byCategory.length === 0 ? (
          <div style={{ color: "#666" }}>Sem registros para o filtro.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {byCategory.map((c) => (
              <li key={c.category}>
                {c.category || "Sem categoria"} —{" "}
                <strong>R$ {fmtBRL(c.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Últimas transações */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Últimas transações</h2>
        {!recent || recent.length === 0 ? (
          <div style={{ color: "#666" }}>Sem registros para o filtro.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {recent.map((t, i) => (
              <li key={i}>
                {t.date} — {t.category} — {t.type} —{" "}
                <strong>R$ {fmtBRL(t.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Série mensal (últimos 12 meses) */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Série mensal</h2>
        {!monthly || monthly.length === 0 ? (
          <div style={{ color: "#666" }}>Sem dados mensais para o filtro.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {monthly.map((m, i) => (
              <li key={i}>
                {m.month} — {m.type}: <strong>R$ {fmtBRL(m.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
