/**
 * App.jsx — Root com auto-geração de mensalidades mensais
 * FIXES:
 *  - Error boundary ao redor do app para capturar crashes silenciosos
 *  - Auto-gen protegido com try/catch que não trava o app
 *  - Supabase getSession com fallback seguro
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { supabase, db } from "./lib/supabase.js";
import Login      from "./components/Login.jsx";
import PublicPage from "./components/PublicPage.jsx";
import Secretaria from "./components/Secretaria.jsx";

// ─── Error Boundary — captura qualquer crash de componente filho ──────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[CaixaSala] ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#080b12",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', system-ui, sans-serif", padding: 24,
        }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ color: "#e2e8f8", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              Erro ao carregar o app
            </div>
            <div style={{ color: "#6b7a99", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
              {this.state.error?.message || "Erro desconhecido"}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                color: "#fff", border: "none", borderRadius: 12,
                padding: "11px 24px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Hook de dados globais ────────────────────────────────────────────────────
export function useAppData() {
  const [alunos,       setAlunos]  = useState([]);
  const [movs,         setMovs]    = useState([]);
  const [mensalidades, setMens]    = useState([]);
  const [config,       setConfig]  = useState({ id: null, valor_mensal: 15, dia_vencimento: 10 });
  const [loading,      setLoad]    = useState(true);
  const [dbError,      setErr]     = useState(null);

  const autoGenRef = useRef(false);

  const loadAll = useCallback(async () => {
    setLoad(true);
    setErr(null);
    try {
      const [a, m, mens, cfg] = await Promise.all([
        db.getAlunos(),
        db.getMovimentacoes(),
        db.getMensalidades(),
        db.getConfig(),
      ]);
      setAlunos(a     || []);
      setMovs(m       || []);
      setMens(mens    || []);
      if (cfg) setConfig(cfg);
    } catch (e) {
      console.error("[CaixaSala] loadAll error:", e);
      setErr(e.message || "Erro ao carregar dados do Supabase");
    } finally {
      setLoad(false);
    }
  }, []);

  // Auto-geração mensal — só roda uma vez, com proteção total
  useEffect(() => {
    if (autoGenRef.current) return;
    if (!alunos.length)     return;
    if (loading)            return;

    const now   = new Date();
    const anoN  = now.getFullYear();
    const mesN  = now.getMonth() + 1;
    const doMes = mensalidades.filter(
      m => Number(m.ano) === anoN && Number(m.mes) === mesN
    );

    if (doMes.length === 0) {
      autoGenRef.current = true;
      db.gerarMensalidadesMes(alunos, anoN, mesN, config)
        .then(criadas => {
          if ((criadas || []).length > 0) {
            console.info(`[CaixaSala] Auto-gerou ${criadas.length} mensalidades para ${mesN}/${anoN}`);
            loadAll();
          }
        })
        .catch(err => {
          console.warn("[CaixaSala] Auto-gen falhou (não crítico):", err.message);
          autoGenRef.current = false; // permite tentar de novo
        });
    }
  }, [alunos, mensalidades, loading, config, loadAll]);

  // Carga inicial
  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime
  useEffect(() => {
    const tables = ["alunos", "movimentacoes", "mensalidades", "mensalidades_config"];
    const ch = supabase.channel("rt-csala-v8");
    tables.forEach(t =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, loadAll)
    );
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll]);

  return { alunos, movs, mensalidades, config, loading, dbError, reload: loadAll };
}

// ─── Guard de rota autenticada ────────────────────────────────────────────────
function Guard({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ─── Spinner de boot ──────────────────────────────────────────────────────────
function BootLoader() {
  return (
    <div style={{
      background: "#080b12", minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid rgba(99,102,241,.25)",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          margin: "0 auto 16px",
          animation: "spin .75s linear infinite",
        }}/>
        <div style={{ color: "#3d4a6a", fontSize: 14 }}>CaixaSala · Conectando…</div>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
function AppInner() {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);
  const navigate          = useNavigate();
  const appData           = useAppData();

  useEffect(() => {
    // Busca sessão existente
    supabase.auth.getSession()
      .then(({ data }) => {
        setUser(data?.session?.user ?? null);
      })
      .catch(err => {
        console.warn("[CaixaSala] getSession error:", err);
      })
      .finally(() => {
        setReady(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return <BootLoader />;

  return (
    <Routes>
      <Route
        path="/"
        element={<PublicPage data={appData} />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/secretaria" replace /> : <Login onLogin={setUser} />}
      />
      <Route
        path="/secretaria"
        element={
          <Guard user={user}>
            <Secretaria
              user={user}
              onLogout={async () => {
                await supabase.auth.signOut();
                navigate("/");
              }}
              data={appData}
            />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
