import {
  getTotals,
  getTotalsByCategory,
  getRecentTransactions,
  getMonthly,
} from "@/lib/db";

// Pega somente strings seguras de searchParams
function getStr(sp, key) {
  const v = sp?.[key];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
  return "";
}

function toParams(sp) {
  const from = getStr(sp, "from") || null; // "DD/MM/AAAA"
  const to = getStr(sp, "to") || null;
  const typeRaw = getStr(sp, "type");
  const type =
    typeRaw === "Débito" || typeRaw === "Crédito" ? typeRaw : "Todos";
  return { from, to, type };
}

function fmtBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function ResumoUsuario({ params, searchParams }) {
  const waId = params.waId;
  const { from, to, type } = toParams(searchParams || {});

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
              <li key={c.category || "(sem)"}>
                {c.category || "Sem categoria"} —{" "}
                <strong>R$ {fmtBRL(c.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

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
              <li key={`${t.date}-${t.category}-${i}`}>
                {t.date} — {t.category} — {t.type} —{" "}
                <strong>R$ {fmtBRL(t.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

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
              <li key={`${m.month}-${m.type}-${i}`}>
                {m.month} — {m.type}: <strong>R$ {fmtBRL(m.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
