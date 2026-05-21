/**
 * Secretaria.jsx — Painel Administrativo
 * Mobile-first · Bottom Nav · Dark Premium
 *
 * Abas: Dashboard · Mensalidades · Caixa · Alunos
 *
 * Fluxo de mensalidade:
 *  1. Ao virar o mês → App.jsx auto-gera "pendente" para todos os 44 alunos
 *  2. Aluno (PublicPage) envia comprovante → status "aguardando_aprovacao"
 *  3. Secretária aprova → "pago" → entrada registrada no caixa
 *  4. Secretária rejeita → "rejeitado" → aluno pode reenviar
 *  5. Secretária pode marcar diretamente como pago sem comprovante
 */
import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  LayoutDashboard, DollarSign, Wallet, Users,
  LogOut, RefreshCw, Bell, Shield, GraduationCap,
  TrendingUp, TrendingDown, UserCheck, UserX, Clock,
  CheckCircle, XCircle, AlertTriangle, Plus, Minus,
  Trash2, Edit3, Eye, Search, Zap, Settings, ChevronRight,
  ChevronLeft, Calendar, Info, Loader2, Send,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { db } from "../lib/supabase.js";
import {
  C, MESES, MESES_SHORT, TURMA, TOTAL_ALUNOS,
  fmt, fmtDate, fmtDateShort, fmtDateTime, today, nowYear, nowMes,
  avatarLetters, avatarColor, catInfo, CATS_ENTRADA, CATS_SAIDA,
} from "../lib/utils.js";
import {
  Btn, Modal, Input, Select, Textarea, Card,
  KPICard, SBadge, Avatar, Skeleton,
  Empty, Alert, SectionHeader, ProgressBar,
  ConfirmDialog, Divider, QuickAction, Spinner, PageLoader,
} from "../lib/ui.jsx";

// ─── BOTTOM NAV ITEMS ─────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard",     label:"Início",      icon:LayoutDashboard },
  { id:"mensalidades",  label:"Mensalidades",icon:DollarSign      },
  { id:"caixa",         label:"Caixa",       icon:Wallet          },
  { id:"alunos",        label:"Alunos",      icon:Users           },
];

// ─── HELPERS LOCAIS ───────────────────────────────────────────────────────────
const statusLabel = {
  pendente:             "Pendente",
  aguardando_aprovacao: "Aguardando",
  pago:                 "Pago",
  rejeitado:            "Rejeitado",
};

const statusColor = {
  pendente:             C.warn,
  aguardando_aprovacao: C.acc,
  pago:                 C.ok,
  rejeitado:            C.err,
};

// ════════════════════════════════════════════════════════════════════════════════
//  MODAL: REGISTRAR ENTRADA/SAÍDA
// ════════════════════════════════════════════════════════════════════════════════
function ModalMovimentacao({ open, onClose, editando, onSalvo, valorMensal }) {
  const emptyForm = {
    tipo:"entrada", valor:"", categoria:"mensalidade",
    descricao:"", data:today(), responsavel:"Secretária",
  };
  const [form, setForm]    = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errs,  setErrs]   = useState({});

  // Sync quando abre/edita
  useMemo(() => {
    if (editando) {
      setForm({
        tipo:       editando.tipo,
        valor:      String(editando.valor),
        categoria:  editando.categoria,
        descricao:  editando.descricao,
        data:       editando.data,
        responsavel:editando.responsavel || "Secretária",
      });
    } else {
      setForm(emptyForm);
    }
    setErrs({});
  }, [editando, open]);

  const set = (k, v) => { setForm(p=>({...p,[k]:v})); setErrs(p=>({...p,[k]:""})); };

  const validate = () => {
    const e = {};
    if (!form.valor || Number(form.valor) <= 0) e.valor = "Informe um valor válido";
    if (!form.descricao.trim())                 e.descricao = "Descrição obrigatória";
    if (!form.data)                             e.data = "Data obrigatória";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const salvar = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        tipo: form.tipo, valor: Number(Number(form.valor).toFixed(2)),
        categoria: form.categoria, descricao: form.descricao.trim(),
        data: form.data, responsavel: form.responsavel || "Secretária",
      };
      if (editando) {
        await db.updateMovimentacao(editando.id, body);
        toast.success("Movimentação atualizada!");
      } else {
        await db.insertMovimentacao(body);
        toast.success(form.tipo==="entrada" ? "✅ Entrada registrada!" : "💸 Saída registrada!");
      }
      onSalvo?.();
      onClose();
    } catch(e) { toast.error("Erro: " + e.message); }
    setSaving(false);
  };

  const cats = Object.entries(form.tipo==="entrada" ? CATS_ENTRADA : CATS_SAIDA);

  return (
    <Modal open={open} onClose={onClose} width={520}
      title={editando ? "Editar Movimentação" : form.tipo==="entrada" ? "Registrar Entrada" : "Registrar Saída"}
      subtitle={!editando && (form.tipo==="entrada" ? "Receita da turma" : "Despesa da turma")}
      footer={
        <div style={{display:"flex",gap:10}}>
          <Btn variant="ghost" full onClick={onClose}>Cancelar</Btn>
          <Btn variant={form.tipo==="entrada"?"ok":"err"} full loading={saving} onClick={salvar}>
            {saving ? "Salvando…" : editando ? "Salvar" : form.tipo==="entrada" ? "Registrar Entrada" : "Registrar Saída"}
          </Btn>
        </div>
      }
    >
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Tipo toggle */}
        {!editando && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {["entrada","saida"].map(t => (
              <button key={t} type="button" onClick={() => set("tipo",t)}
                style={{
                  padding:"12px 0", borderRadius:14, fontWeight:700, fontFamily:"inherit",
                  fontSize:14, cursor:"pointer",
                  border:`1.5px solid ${form.tipo===t?(t==="entrada"?C.ok:C.err):C.border}`,
                  background:form.tipo===t?(t==="entrada"?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)"):C.surfB,
                  color:form.tipo===t?(t==="entrada"?C.ok:C.err):C.sub,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  transition:"all .18s",
                }}>
                {t==="entrada"?<TrendingUp size={16} strokeWidth={2}/>:<TrendingDown size={16} strokeWidth={2}/>}
                {t==="entrada"?"Entrada":"Saída"}
              </button>
            ))}
          </div>
        )}

        <Input label="Valor (R$)" type="number" min="0.01" step="0.01" placeholder="0,00"
          value={form.valor} onChange={e=>set("valor",e.target.value)} error={errs.valor} icon={DollarSign}/>

        <Select label="Categoria" value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
          {cats.map(([k,{label}]) => <option key={k} value={k}>{label}</option>)}
        </Select>

        <Input label="Descrição" placeholder="Ex: Mensalidade de Dante — Maio/2026"
          value={form.descricao} onChange={e=>set("descricao",e.target.value)} error={errs.descricao}/>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label="Data" type="date" value={form.data}
            onChange={e=>set("data",e.target.value)} error={errs.data}/>
          <Input label="Responsável" placeholder="Secretária"
            value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  MODAL: APROVAR / REJEITAR MENSALIDADE
// ════════════════════════════════════════════════════════════════════════════════
function ModalAprovacao({ item, onClose, onAprovar, onRejeitar }) {
  const [motivo, setMotivo]   = useState("");
  const [rejecting, setRej]   = useState(false);
  const [approving, setApp]   = useState(false);
  const [showRejeitar, setShowRej] = useState(false);

  if (!item) return null;
  const { mens, aluno } = item;

  const handleAprovar = async () => {
    setApp(true);
    await onAprovar(mens);
    setApp(false);
  };

  const handleRejeitar = async () => {
    if (!motivo.trim()) { toast.error("Informe o motivo da rejeição"); return; }
    setRej(true);
    await onRejeitar(mens, motivo);
    setRej(false);
    setShowRej(false);
    setMotivo("");
  };

  return (
    <Modal open={!!item} onClose={onClose} title="Comprovante de Pagamento"
      subtitle={aluno?.nome}
      footer={
        showRejeitar ? (
          <div style={{display:"flex",gap:10}}>
            <Btn variant="ghost" full onClick={()=>setShowRej(false)}>Voltar</Btn>
            <Btn variant="err" full loading={rejecting} onClick={handleRejeitar}>Confirmar Rejeição</Btn>
          </div>
        ) : (
          <div style={{display:"flex",gap:10}}>
            <Btn variant="ghost" full onClick={()=>setShowRej(true)}>Rejeitar</Btn>
            <Btn variant="ok" full loading={approving} onClick={handleAprovar}>
              <CheckCircle size={15} strokeWidth={2}/> Aprovar Pagamento
            </Btn>
          </div>
        )
      }
    >
      {/* Info */}
      <div style={{background:C.surfB,borderRadius:14,border:`1px solid ${C.border}`,padding:18,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <Avatar nome={aluno?.nome||""} size={42}/>
          <div>
            <div style={{color:C.txt,fontWeight:800,fontSize:15}}>{aluno?.nome}</div>
            <div style={{color:C.sub,fontSize:13,marginTop:2}}>Turma {TURMA}</div>
          </div>
        </div>
        {[
          ["Mês/Ano",  `${MESES[mens.mes-1]} / ${mens.ano}`],
          ["Valor",    fmt(mens.valor)],
          ["Enviado",  fmtDateTime(mens.enviado_em)],
        ].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{color:C.muted,fontSize:13}}>{l}</span>
            <span style={{color:C.txt,fontWeight:600,fontSize:13}}>{v}</span>
          </div>
        ))}
        {mens.observacao_aluno && (
          <div style={{marginTop:10,padding:"10px 12px",background:C.surfC,borderRadius:10}}>
            <div style={{color:C.muted,fontSize:11,marginBottom:3}}>Observação do aluno:</div>
            <div style={{color:C.sub,fontSize:13,fontStyle:"italic"}}>"{mens.observacao_aluno}"</div>
          </div>
        )}
      </div>

      {/* Comprovante */}
      {mens.comprovante_url ? (
        <div style={{borderRadius:14,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:16}}>
          <img src={mens.comprovante_url} alt="comprovante"
            style={{width:"100%",maxHeight:280,objectFit:"contain",background:C.surfB,display:"block"}}/>
          <a href={mens.comprovante_url} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 0",color:C.acc,fontSize:13,fontWeight:700,textDecoration:"none",background:C.surfB,borderTop:`1px solid ${C.border}`}}>
            <Eye size={14}/> Ver em tamanho completo
          </a>
        </div>
      ) : (
        <div style={{border:`2px dashed ${C.border}`,borderRadius:14,padding:"28px 20px",textAlign:"center",marginBottom:16}}>
          <Info size={28} strokeWidth={1.5} color={C.muted} style={{marginBottom:8}}/>
          <div style={{color:C.muted,fontSize:13}}>Sem comprovante anexado</div>
          <div style={{color:C.muted,fontSize:11,marginTop:4}}>Aluno declarou pagamento sem enviar imagem</div>
        </div>
      )}

      {/* Form rejeição */}
      {showRejeitar && (
        <div style={{marginTop:4}}>
          <Textarea label="Motivo da rejeição (obrigatório)" placeholder="Ex: Comprovante ilegível, valor incorreto…"
            value={motivo} onChange={e=>setMotivo(e.target.value)} style={{minHeight:80}}/>
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  ABA DASHBOARD — Premium redesign
//  Lógica 100% preservada. Apenas visual melhorado.
// ════════════════════════════════════════════════════════════════════════════════
function TabDashboard({ data, onNewEntry, onNewExit, onTabChange }) {
  const { movs, mensalidades, alunos, config, loading } = data;
  const anoN = nowYear(), mesN = nowMes();

  // ── Toda a lógica original intacta ──────────────────────────────────────────
  const stats    = useMemo(() => db.estatisticasMes(mensalidades, alunos, anoN, mesN), [mensalidades, alunos, anoN, mesN]);
  const totalEnt = useMemo(() => movs.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+Number(m.valor),0), [movs]);
  const totalSai = useMemo(() => movs.filter(m=>m.tipo==="saida").reduce((s,m)=>s+Number(m.valor),0), [movs]);
  const saldo    = totalEnt - totalSai;
  const aguardando = mensalidades.filter(m=>m.status==="aguardando_aprovacao").length;

  const chartData = useMemo(() => {
    const res = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoN, mesN-1-i, 1);
      const a = d.getFullYear(), m = d.getMonth()+1;
      const pagosMes = mensalidades.filter(x => Number(x.ano)===a && Number(x.mes)===m && x.status==="pago");
      res.push({
        mes:    MESES_SHORT[m-1],
        pago:   pagosMes.reduce((s,x)=>s+Number(x.valor),0),
        alunos: pagosMes.length,
      });
    }
    return res;
  }, [mensalidades, anoN, mesN]);

  const recentMovs = movs.slice(0, 6);

  if (loading) return <PageLoader label="Carregando dashboard…"/>;

  const pct = alunos.length ? Math.round(stats.pagos / alunos.length * 100) : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, animation:"fadeUp .28s ease" }}>

      {/* ── ALERTA: comprovantes aguardando ─────────────────────────────── */}
      <AnimatePresence>
        {aguardando > 0 && (
          <motion.button
            type="button"
            initial={{ opacity:0, y:-10, scale:.97 }}
            animate={{ opacity:1, y:0,   scale:1   }}
            exit={{    opacity:0, y:-10, scale:.97 }}
            transition={{ duration:.22 }}
            onClick={() => onTabChange("mensalidades")}
            style={{
              background: `linear-gradient(120deg, ${C.acc}1e 0%, ${C.purple}1e 100%)`,
              border: `1px solid ${C.accBdr}`,
              borderRadius: 16,
              padding: "13px 16px",
              display: "flex", alignItems: "center", gap: 12,
              cursor: "pointer", width: "100%", textAlign: "left",
              fontFamily: "inherit",
              boxShadow: `0 4px 24px ${C.acc}20`,
            }}
          >
            {/* Pulsing dot */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <div style={{ width:38, height:38, borderRadius:12, background:C.accDim, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Bell size={17} strokeWidth={2.2} color={C.acc}/>
              </div>
              <span style={{
                position:"absolute", top:-3, right:-3,
                width:14, height:14, borderRadius:99,
                background: C.err,
                border: `2px solid ${C.bg}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:8, fontWeight:900, color:"#fff",
              }}>
                {aguardando > 9 ? "9+" : aguardando}
              </span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:C.txt, fontWeight:800, fontSize:14, marginBottom:2 }}>
                {aguardando} comprovante{aguardando>1?"s":""} aguardando aprovação
              </div>
              <div style={{ color:C.sub, fontSize:12 }}>Toque para revisar e confirmar pagamentos</div>
            </div>
            <ChevronRight size={17} strokeWidth={2.5} color={C.acc}/>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── HERO CARD: Saldo ────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, #1a1060 0%, #0e1a3a 50%, #0a1628 100%)`,
        borderRadius: 22,
        padding: "22px 20px 20px",
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${C.accBdr}`,
        boxShadow: `0 8px 40px rgba(99,102,241,.22), 0 2px 12px rgba(0,0,0,.5)`,
      }}>
        {/* Decorative circles */}
        <div style={{ position:"absolute", top:-44, right:-44, width:160, height:160, borderRadius:"50%", background:`radial-gradient(circle, ${C.acc}28 0%, transparent 70%)`, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-50, left:-30, width:130, height:130, borderRadius:"50%", background:`radial-gradient(circle, ${C.purple}18 0%, transparent 70%)`, pointerEvents:"none" }}/>

        {/* Label */}
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
          <div style={{ width:6, height:6, borderRadius:99, background:saldo>=0?C.ok:C.err }}/>
          <span style={{ color:"rgba(255,255,255,.55)", fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" }}>
            Saldo Atual
          </span>
        </div>

        {/* Valor */}
        <div style={{ color:"#fff", fontSize:34, fontWeight:900, letterSpacing:"-.035em", lineHeight:1, marginBottom:18, position:"relative" }}>
          {fmt(saldo)}
        </div>

        {/* Linha divisória */}
        <div style={{ height:1, background:"rgba(255,255,255,.1)", marginBottom:16 }}/>

        {/* Métricas */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:0 }}>
          {[
            { l:"Entradas", v:fmt(totalEnt), c:C.ok   },
            { l:"Saídas",   v:fmt(totalSai), c:C.err  },
            { l:"Este mês", v:fmt(stats.arrecadado), c:C.gold },
          ].map(({ l, v, c }, i) => (
            <div key={l} style={{
              padding: "0 12px",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,.1)" : "none",
            }}>
              <div style={{ color:"rgba(255,255,255,.45)", fontSize:10, fontWeight:600, marginBottom:4, letterSpacing:".04em" }}>{l.toUpperCase()}</div>
              <div style={{ color: c, fontWeight:800, fontSize:13, letterSpacing:"-.01em" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI GRID 2×3 ───────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>

        {/* Pagos */}
        <motion.div whileHover={{ y:-2 }} style={{
          background: C.surf,
          border: `1px solid ${C.okBdr}`,
          borderRadius: 18,
          padding: "16px 16px 14px",
          position: "relative", overflow:"hidden",
          boxShadow: `0 2px 16px ${C.ok}18`,
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.okGrad, borderRadius:"18px 18px 0 0" }}/>
          <div style={{ width:34, height:34, borderRadius:10, background:C.okDim, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:11 }}>
            <UserCheck size={17} strokeWidth={2} color={C.ok}/>
          </div>
          <div style={{ fontSize:28, fontWeight:900, color:C.txt, letterSpacing:"-.03em", lineHeight:1 }}>{stats.pagos}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:5, fontWeight:500 }}>Pagos este mês</div>
          <div style={{ fontSize:11, color:C.ok, marginTop:3, fontWeight:700 }}>de {alunos.length} alunos</div>
        </motion.div>

        {/* Aguardando */}
        <motion.div whileHover={{ y:-2 }} onClick={() => onTabChange("mensalidades")} style={{
          background: C.surf,
          border: `1px solid ${aguardando > 0 ? C.accBdr : C.border}`,
          borderRadius: 18,
          padding: "16px 16px 14px",
          position: "relative", overflow:"hidden", cursor:"pointer",
          boxShadow: aguardando > 0 ? `0 2px 16px ${C.acc}18` : "0 1px 8px rgba(0,0,0,.2)",
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.accGrad, borderRadius:"18px 18px 0 0" }}/>
          {aguardando > 0 && (
            <div style={{ position:"absolute", top:10, right:10, width:8, height:8, borderRadius:99, background:C.acc }} className="pulse"/>
          )}
          <div style={{ width:34, height:34, borderRadius:10, background:C.accDim, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:11 }}>
            <Clock size={17} strokeWidth={2} color={C.acc}/>
          </div>
          <div style={{ fontSize:28, fontWeight:900, color:C.txt, letterSpacing:"-.03em", lineHeight:1 }}>{stats.aguardando}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:5, fontWeight:500 }}>Aguardando</div>
          <div style={{ fontSize:11, color:C.acc, marginTop:3, fontWeight:700 }}>
            {aguardando > 0 ? "Revisar →" : "Sem pendências"}
          </div>
        </motion.div>

        {/* Pendentes */}
        <motion.div whileHover={{ y:-2 }} style={{
          background: C.surf,
          border: `1px solid ${C.warnBdr}`,
          borderRadius: 18,
          padding: "16px 16px 14px",
          position: "relative", overflow:"hidden",
          boxShadow: `0 2px 12px ${C.warn}12`,
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.warnGrad, borderRadius:"18px 18px 0 0" }}/>
          <div style={{ width:34, height:34, borderRadius:10, background:C.warnDim, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:11 }}>
            <UserX size={17} strokeWidth={2} color={C.warn}/>
          </div>
          <div style={{ fontSize:28, fontWeight:900, color:C.txt, letterSpacing:"-.03em", lineHeight:1 }}>{stats.pendentes}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:5, fontWeight:500 }}>Pendentes</div>
          <div style={{ fontSize:11, color:C.warn, marginTop:3, fontWeight:700 }}>Sem pagamento</div>
        </motion.div>

        {/* Arrecadado */}
        <motion.div whileHover={{ y:-2 }} style={{
          background: C.surf,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: "16px 16px 14px",
          position: "relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${C.gold}, #f97316)`, borderRadius:"18px 18px 0 0" }}/>
          <div style={{ width:34, height:34, borderRadius:10, background:C.goldDim, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:11 }}>
            <TrendingUp size={17} strokeWidth={2} color={C.gold}/>
          </div>
          <div style={{ fontSize:20, fontWeight:900, color:C.txt, letterSpacing:"-.025em", lineHeight:1 }}>{fmt(stats.arrecadado)}</div>
          <div style={{ fontSize:11, color:C.muted, marginTop:5, fontWeight:500 }}>Arrecadado</div>
          <div style={{ fontSize:11, color:C.gold, marginTop:3, fontWeight:700 }}>{MESES[mesN-1]} / {anoN}</div>
        </motion.div>
      </div>

      {/* ── ADIMPLÊNCIA ─────────────────────────────────────────────────── */}
      <Card style={{ padding:"18px 18px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ color:C.txt, fontSize:14, fontWeight:700 }}>Adimplência</div>
            <div style={{ color:C.muted, fontSize:12, marginTop:2 }}>{MESES[mesN-1]} · {anoN}</div>
          </div>
          {/* Donut mini */}
          <div style={{ position:"relative", width:52, height:52 }}>
            <svg viewBox="0 0 44 44" style={{ transform:"rotate(-90deg)", width:"100%", height:"100%" }}>
              <circle cx="22" cy="22" r="17" fill="none" stroke={C.border} strokeWidth="5"/>
              <motion.circle cx="22" cy="22" r="17" fill="none" stroke={C.ok} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 17}`}
                initial={{ strokeDashoffset: 2*Math.PI*17 }}
                animate={{ strokeDashoffset: 2*Math.PI*17 * (1 - pct/100) }}
                transition={{ duration:1.4, ease:"easeOut" }}
              />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:11, fontWeight:900, color:C.ok }}>{pct}%</span>
            </div>
          </div>
        </div>

        <ProgressBar value={stats.pagos} max={alunos.length || TOTAL_ALUNOS} color={C.ok} height={8}/>

        <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, flexWrap:"wrap", gap:6 }}>
          {[
            ["Pagos",      stats.pagos,      C.ok  ],
            ["Aguardando", stats.aguardando,  C.acc ],
            ["Pendentes",  stats.pendentes,   C.warn],
            ["Rejeitados", stats.rejeitados,  C.err ],
          ].map(([l, v, c]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted }}>
              <div style={{ width:7, height:7, borderRadius:99, background:c }}/>
              {l} <strong style={{ color:c }}>{v}</strong>
            </div>
          ))}
        </div>
      </Card>

      {/* ── GRÁFICO ─────────────────────────────────────────────────────── */}
      <Card style={{ padding:"18px 16px 14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ color:C.txt, fontSize:14, fontWeight:700 }}>Arrecadação Mensal</div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:99, background:C.acc }}/>
            <span style={{ color:C.muted, fontSize:11 }}>Últimos 6 meses</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={148}>
          <BarChart data={chartData} barCategoryGap="34%" margin={{ top:0, right:4, left:-16, bottom:0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.acc} stopOpacity={1}/>
                <stop offset="100%" stopColor={C.purple} stopOpacity={.7}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} width={46}
              tickFormatter={v => v>=1000?`${(v/1000).toFixed(0)}k`:String(v)}/>
            <Tooltip
              cursor={{ fill:"rgba(99,102,241,.07)" }}
              contentStyle={{ background:C.surfC, border:`1px solid ${C.border}`, borderRadius:12, fontSize:12, color:C.txt, boxShadow:"0 8px 24px rgba(0,0,0,.4)" }}
              formatter={v => [fmt(v), "Arrecadado"]}/>
            <Bar dataKey="pago" name="Pago" fill="url(#barGrad)" radius={[7,7,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── AÇÕES RÁPIDAS ───────────────────────────────────────────────── */}
      <div>
        <div style={{ color:C.muted, fontSize:11, fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", marginBottom:10 }}>
          Ações Rápidas
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { icon:TrendingUp,   label:"Nova Entrada",  color:C.ok,     fn:onNewEntry                           },
            { icon:TrendingDown, label:"Nova Saída",    color:C.err,    fn:onNewExit                            },
            { icon:DollarSign,   label:"Mensalidades",  color:C.acc,    fn:()=>onTabChange("mensalidades")      },
            { icon:Users,        label:"Ver Alunos",    color:C.purple, fn:()=>onTabChange("alunos")            },
          ].map(a => (
            <motion.button key={a.label} type="button" onClick={a.fn}
              whileHover={{ scale:1.03, boxShadow:`0 4px 20px ${a.color}22` }}
              whileTap={{ scale:.95 }}
              style={{
                background: C.surf,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: "15px 14px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", fontFamily:"inherit", textAlign:"left",
                transition: "border-color .18s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = a.color+"55"}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <div style={{ width:38, height:38, borderRadius:12, background:a.color+"1d", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <a.icon size={18} strokeWidth={2} color={a.color}/>
              </div>
              <span style={{ color:C.sub, fontSize:13, fontWeight:600 }}>{a.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── ÚLTIMAS MOVIMENTAÇÕES ───────────────────────────────────────── */}
      {recentMovs.length > 0 && (
        <Card>
          <div style={{ padding:"16px 18px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ color:C.txt, fontSize:14, fontWeight:700 }}>Últimas Movimentações</div>
            <button type="button" onClick={() => onTabChange("caixa")}
              style={{ background:"none", border:"none", color:C.acc, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
              Ver todas <ChevronRight size={13}/>
            </button>
          </div>
          <Divider/>
          {recentMovs.map((m, i) => {
            const ci = catInfo(m.tipo, m.categoria);
            const isEnt = m.tipo === "entrada";
            return (
              <div key={m.id}>
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 18px" }}>
                  {/* Ícone */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 13,
                    background: (isEnt ? C.ok : C.err) + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {isEnt
                      ? <TrendingUp  size={17} strokeWidth={2.2} color={C.ok}/>
                      : <TrendingDown size={17} strokeWidth={2.2} color={C.err}/>
                    }
                  </div>
                  {/* Texto */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C.txt, fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {m.descricao}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                      <span style={{ color:C.muted, fontSize:11 }}>{fmtDateShort(m.data)}</span>
                      <span style={{ width:3, height:3, borderRadius:99, background:C.border, flexShrink:0 }}/>
                      <span style={{ background:ci.color+"18", color:ci.color, fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:99 }}>
                        {ci.label}
                      </span>
                    </div>
                  </div>
                  {/* Valor */}
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ color: isEnt ? C.ok : C.err, fontWeight:800, fontSize:14 }}>
                      {isEnt ? "+" : "-"}{fmt(m.valor)}
                    </div>
                  </div>
                </div>
                {i < recentMovs.length - 1 && <Divider/>}
              </div>
            );
          })}
        </Card>
      )}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  ABA MENSALIDADES
//  — Lista todos os alunos com status do mês selecionado
//  — Permite navegar entre meses
//  — Secretária pode aprovar, rejeitar, marcar pago
// ════════════════════════════════════════════════════════════════════════════════
function TabMensalidades({ data }) {
  const { alunos, mensalidades, config, reload } = data;

  const [anoSel,  setAno]    = useState(nowYear());
  const [mesSel,  setMes]    = useState(nowMes());
  const [filtro,  setFiltro] = useState("todos");
  const [busca,   setBusca]  = useState("");
  const [gerando, setGer]    = useState(false);
  const [mAprov,  setMAprov] = useState(null); // { mens, aluno }
  const [mPagar,  setMPagar] = useState(null); // { mens, aluno } — marcar direto
  const [savingId,setSavId]  = useState(null);

  // Mapa { alunoId: mensalidade } para o mês selecionado
  const statusMap = useMemo(() =>
    db.statusPorAluno(mensalidades, anoSel, mesSel),
    [mensalidades, anoSel, mesSel]
  );

  const stats = useMemo(() =>
    db.estatisticasMes(mensalidades, alunos, anoSel, mesSel),
    [mensalidades, alunos, anoSel, mesSel]
  );

  const aguardando = useMemo(() =>
    mensalidades.filter(m=>Number(m.ano)===anoSel&&Number(m.mes)===mesSel&&m.status==="aguardando_aprovacao"),
    [mensalidades, anoSel, mesSel]
  );

  const alunosFilt = useMemo(() => {
    let l = [...alunos];
    if (busca) l = l.filter(a=>a.nome.toLowerCase().includes(busca.toLowerCase()));
    const getMStatus = (a) => statusMap[Number(a.id)]?.status || "pendente";
    if (filtro==="pago")                 l = l.filter(a=>getMStatus(a)==="pago");
    if (filtro==="aguardando_aprovacao") l = l.filter(a=>getMStatus(a)==="aguardando_aprovacao");
    if (filtro==="pendente")             l = l.filter(a=>!statusMap[Number(a.id)]||getMStatus(a)==="pendente"||getMStatus(a)==="rejeitado");
    return l;
  }, [alunos, busca, filtro, statusMap]);

  const navMes = (dir) => {
    let m = mesSel + dir, a = anoSel;
    if (m < 1)  { m = 12; a--; }
    if (m > 12) { m = 1;  a++; }
    setMes(m); setAno(a);
  };

  const handleGerar = async () => {
    setGer(true);
    try {
      const criados = await db.gerarMensalidadesMes(alunos, anoSel, mesSel, config);
      toast.success(criados.length>0
        ? `✅ ${criados.length} mensalidades geradas para ${MESES[mesSel-1]}!`
        : "Mensalidades já existem para este mês.");
      await reload();
    } catch(e) { toast.error(e.message); }
    setGer(false);
  };

  const handleAprovar = async (mens) => {
    setSavId(mens.id);
    try {
      await db.aprovarMensalidade(mens.id);
      // Registra entrada no caixa
      const aluno = alunos.find(a=>Number(a.id)===Number(mens.aluno_id));
      await db.insertMovimentacao({
        tipo:"entrada", valor:Number(mens.valor), categoria:"mensalidade",
        descricao:`Mensalidade ${MESES[mens.mes-1]}/${mens.ano} — ${aluno?.nome||"Aluno"}`,
        data:today(), responsavel:"Secretária",
      });
      toast.success(`✅ Pagamento aprovado!`);
      setMAprov(null); await reload();
    } catch(e) { toast.error(e.message); }
    setSavId(null);
  };

  const handleRejeitar = async (mens, motivo) => {
    setSavId(mens.id);
    try {
      await db.rejeitarMensalidade(mens.id, motivo);
      toast.success("Comprovante rejeitado. Aluno será notificado.");
      setMAprov(null); await reload();
    } catch(e) { toast.error(e.message); }
    setSavId(null);
  };

  const handlePagarDireto = async () => {
    if (!mPagar) return;
    setSavId(mPagar.mens.id);
    try {
      await db.pagarMensalidadeDireto(mPagar.mens.id);
      await db.insertMovimentacao({
        tipo:"entrada", valor:Number(mPagar.mens.valor), categoria:"mensalidade",
        descricao:`Mensalidade ${MESES[mPagar.mens.mes-1]}/${mPagar.mens.ano} — ${mPagar.aluno?.nome||"Aluno"}`,
        data:today(), responsavel:"Secretária",
      });
      toast.success(`✅ ${mPagar.aluno?.nome?.split(" ")[0]} marcado como pago!`);
      setMPagar(null); await reload();
    } catch(e) { toast.error(e.message); }
    setSavId(null);
  };

  const handlePagarDiretoSemMens = async (aluno) => {
    // Cria mensalidade e marca pago
    setSavId("new-"+aluno.id);
    try {
      const mens = await db.upsertMensalidade({
        aluno_id: Number(aluno.id), ano:anoSel, mes:mesSel,
        valor: Number(config.valor_mensal)||15, status:"pago",
        data_pagamento: today(),
      });
      await db.insertMovimentacao({
        tipo:"entrada", valor:Number(config.valor_mensal)||15, categoria:"mensalidade",
        descricao:`Mensalidade ${MESES[mesSel-1]}/${anoSel} — ${aluno.nome}`,
        data:today(), responsavel:"Secretária",
      });
      toast.success(`✅ ${aluno.nome.split(" ")[0]} marcado como pago!`);
      await reload();
    } catch(e) { toast.error(e.message); }
    setSavId(null);
  };

  const filtroOpts = [
    ["todos",              `Todos (${alunos.length})`],
    ["pago",               `✓ Pagos (${stats.pagos})`],
    ["aguardando_aprovacao",`⏳ Aguardando (${stats.aguardando})`],
    ["pendente",           `○ Pendentes (${stats.pendentes})`],
  ];

  return (
    <div>
      {/* Header de navegação de mês */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button type="button" onClick={()=>navMes(-1)}
          style={{background:C.surfB,border:`1px solid ${C.border}`,borderRadius:12,padding:"9px 10px",cursor:"pointer",color:C.sub,display:"flex"}}>
          <ChevronLeft size={18} strokeWidth={2}/>
        </button>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{color:C.txt,fontSize:16,fontWeight:800,letterSpacing:"-.01em"}}>
            {MESES[mesSel-1]} {anoSel}
          </div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>
            {stats.pagos}/{alunos.length} pagos · {fmt(stats.arrecadado)} arrecadados
          </div>
        </div>
        <button type="button" onClick={()=>navMes(1)}
          style={{background:C.surfB,border:`1px solid ${C.border}`,borderRadius:12,padding:"9px 10px",cursor:"pointer",color:C.sub,display:"flex"}}>
          <ChevronRight size={18} strokeWidth={2}/>
        </button>
      </div>

      {/* Barra progresso */}
      <Card style={{padding:"14px 16px",marginBottom:14}}>
        <ProgressBar value={stats.pagos} max={alunos.length||TOTAL_ALUNOS} color={C.ok} height={10}
          showLabel label={`${stats.pagos} pagos · ${stats.aguardando} aguardando · ${stats.pendentes} pendentes`}/>
      </Card>

      {/* Botão gerar */}
      {stats.pagos===0 && stats.aguardando===0 && (
        <Alert type="info" style={{marginBottom:12}}>
          Mensalidades não geradas para {MESES[mesSel-1]}.{" "}
          <button type="button" onClick={handleGerar} disabled={gerando}
            style={{background:"none",border:"none",color:C.acc,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>
            {gerando?"Gerando…":"Gerar agora →"}
          </button>
        </Alert>
      )}

      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {filtroOpts.map(([f,l])=>(
          <button key={f} type="button" onClick={()=>setFiltro(f)}
            style={{
              padding:"7px 14px", borderRadius:99, whiteSpace:"nowrap",
              border:`1px solid ${filtro===f?C.acc:C.border}`,
              background:filtro===f?C.accDim:C.surfB,
              color:filtro===f?C.acc:C.sub,
              cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit",
              transition:"all .18s",
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div style={{position:"relative",marginBottom:14}}>
        <Search size={14} strokeWidth={2} style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
        <input value={busca} onChange={e=>setBusca(e.target.value)}
          placeholder={`Buscar dentre ${alunos.length} alunos…`}
          style={{
            width:"100%", background:C.surfB, border:`1.5px solid ${C.border}`,
            borderRadius:14, padding:"11px 14px 11px 36px",
            color:C.txt, fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box",
          }}/>
      </div>

      {/* Lista de alunos */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {alunosFilt.length===0 ? (
          <Empty icon={Users} title="Nenhum aluno encontrado"/>
        ) : (
          alunosFilt.map((aluno,i) => {
            const mens = statusMap[Number(aluno.id)];
            const status = mens?.status || "pendente";
            const sc = statusColor[status] || C.warn;
            const sl = statusLabel[status] || "Pendente";
            const isLoading = savingId === (mens?.id || "new-"+aluno.id);

            return (
              <motion.div key={aluno.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*.008}}>
                <Card style={{
                  border:`1px solid ${status==="pago"?C.okBdr:status==="aguardando_aprovacao"?C.accBdr:C.border}`,
                }}>
                  <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <Avatar nome={aluno.nome} size={40}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.txt,fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {aluno.nome}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                        <span style={{
                          background:sc+"1a", color:sc, border:`1px solid ${sc}44`,
                          padding:"2px 9px", borderRadius:99, fontSize:10, fontWeight:800,
                          display:"inline-flex", alignItems:"center", gap:4,
                        }}>
                          {status==="pago"?<CheckCircle size={9} strokeWidth={2.5}/>
                           :status==="aguardando_aprovacao"?<Clock size={9} strokeWidth={2.5}/>
                           :status==="rejeitado"?<XCircle size={9} strokeWidth={2.5}/>
                           :<AlertTriangle size={9} strokeWidth={2.5}/>}
                          {sl}
                        </span>
                        <span style={{color:C.muted,fontSize:11}}>{fmt(mens?.valor||config.valor_mensal||15)}</span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {status==="aguardando_aprovacao" && (
                        <Btn size="sm" variant="ok" loading={isLoading}
                          onClick={()=>setMAprov({mens,aluno})}>
                          <Eye size={13}/> Revisar
                        </Btn>
                      )}
                      {(status==="pendente"||status==="rejeitado"||!mens) && (
                        <Btn size="sm" variant="subtle" loading={isLoading}
                          onClick={()=>{
                            if (mens) setMPagar({mens,aluno});
                            else handlePagarDiretoSemMens(aluno);
                          }}>
                          <CheckCircle size={13}/> Pagar
                        </Btn>
                      )}
                      {status==="pago" && (
                        <div style={{color:C.ok,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:5,padding:"0 4px"}}>
                          <CheckCircle size={14} strokeWidth={2.5}/> Pago
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info extra se aguardando */}
                  {status==="aguardando_aprovacao" && (
                    <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 16px",background:C.accDim,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:C.acc,fontSize:12}}>Comprovante enviado — {fmtDateTime(mens?.enviado_em)}</span>
                      {mens?.comprovante_url && <Eye size={13} color={C.acc}/>}
                    </div>
                  )}
                  {status==="rejeitado" && (
                    <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 16px",background:C.errDim}}>
                      <span style={{color:C.err,fontSize:12}}>Rejeitado: {mens?.motivo_recusa||"—"}</span>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Botão gerar mensalidades */}
      <Btn variant="dark" full size="md" icon={Zap} loading={gerando} onClick={handleGerar}
        style={{marginTop:16}}>
        Gerar Mensalidades — {MESES[mesSel-1]} {anoSel}
      </Btn>

      {/* Modal aprovação */}
      <ModalAprovacao item={mAprov} onClose={()=>setMAprov(null)}
        onAprovar={handleAprovar} onRejeitar={handleRejeitar}/>

      {/* Confirm pagar direto */}
      <ConfirmDialog
        open={!!mPagar}
        onClose={()=>setMPagar(null)}
        onConfirm={handlePagarDireto}
        loading={!!savingId}
        title="Confirmar Pagamento"
        message={`Marcar ${mPagar?.aluno?.nome?.split(" ")[0]} como PAGO em ${MESES[mesSel-1]} ${anoSel}? (${fmt(mPagar?.mens?.valor||config.valor_mensal||15)})\n\nUma entrada será registrada no caixa automaticamente.`}
        confirmLabel="Confirmar Pagamento"
        confirmVariant="ok"
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  ABA CAIXA
// ════════════════════════════════════════════════════════════════════════════════
function TabCaixa({ data, onNew }) {
  const { movs, loading, reload, config } = data;
  const [busca,   setBusca]  = useState("");
  const [filtro,  setFiltro] = useState("todos");
  const [editando,setEdit]   = useState(null);
  const [delId,   setDelId]  = useState(null);
  const [deleting,setDel]    = useState(false);

  const filtered = useMemo(() => {
    let l = movs;
    if (busca)            l = l.filter(m=>m.descricao?.toLowerCase().includes(busca.toLowerCase())||m.categoria?.toLowerCase().includes(busca.toLowerCase()));
    if (filtro!=="todos") l = l.filter(m=>m.tipo===filtro);
    return l;
  }, [movs, busca, filtro]);

  const totalEnt = filtered.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+Number(m.valor),0);
  const totalSai = filtered.filter(m=>m.tipo==="saida").reduce((s,m)=>s+Number(m.valor),0);

  const handleDelete = async () => {
    setDel(true);
    try { await db.deleteMovimentacao(delId); toast.success("Excluído."); await reload(); setDelId(null); }
    catch(e) { toast.error(e.message); }
    setDel(false);
  };

  const exportCSV = () => {
    const rows = filtered.map(m=>`${m.data},${m.tipo},${m.categoria},"${m.descricao}",${m.valor},"${m.responsavel}"`).join("\n");
    const blob = new Blob(["\uFEFF"+"Data,Tipo,Categoria,Descrição,Valor,Responsável\n"+rows],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`movimentacoes-${today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast.success("CSV exportado!");
  };

  if (loading) return <PageLoader label="Carregando movimentações…"/>;

  return (
    <div>
      <SectionHeader title="Caixa" sub={`${filtered.length} registros`}
        style={{marginBottom:16}}
        right={
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" size="sm" onClick={exportCSV}>CSV</Btn>
            <Btn variant="ok"   size="sm" icon={TrendingUp}  onClick={()=>onNew("entrada")}>+ Entrada</Btn>
            <Btn variant="err"  size="sm" icon={TrendingDown} onClick={()=>onNew("saida")}>+ Saída</Btn>
          </div>
        }
      />

      {/* Totais */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {l:"Entradas",v:fmt(totalEnt),c:C.ok},
          {l:"Saídas",  v:fmt(totalSai),c:C.err},
          {l:"Saldo",   v:fmt(totalEnt-totalSai),c:(totalEnt-totalSai)>=0?C.acc:C.err},
        ].map(x=>(
          <div key={x.l} style={{background:C.surfB,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
            <div style={{color:x.c,fontWeight:900,fontSize:15}}>{x.v}</div>
            <div style={{color:C.muted,fontSize:11,marginTop:3}}>{x.l}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["todos","entrada","saida"].map(f=>(
          <button key={f} type="button" onClick={()=>setFiltro(f)}
            style={{
              padding:"7px 16px", borderRadius:99,
              border:`1px solid ${filtro===f?C.acc:C.border}`,
              background:filtro===f?C.accDim:C.surfB,
              color:filtro===f?C.acc:C.sub,
              cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit",
              transition:"all .18s",
            }}>
            {f==="todos"?"Todos":f==="entrada"?"Entradas":"Saídas"}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div style={{position:"relative",marginBottom:14}}>
        <Search size={14} strokeWidth={2} style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar movimentações…"
          style={{width:"100%",background:C.surfB,border:`1.5px solid ${C.border}`,borderRadius:14,padding:"11px 14px 11px 36px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>

      {/* Lista */}
      {filtered.length===0 ? (
        <Empty icon={Wallet} title="Sem movimentações" desc="Registre uma entrada ou saída acima."/>
      ) : (
        <Card>
          {filtered.map((m,i)=>{
            const ci = catInfo(m.tipo, m.categoria);
            return (
              <div key={m.id}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px"}}>
                  <div style={{width:38,height:38,borderRadius:12,background:(m.tipo==="entrada"?C.ok:C.err)+"1a",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {m.tipo==="entrada"?<TrendingUp size={17} strokeWidth={2} color={C.ok}/>:<TrendingDown size={17} strokeWidth={2} color={C.err}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.txt,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.descricao}</div>
                    <div style={{display:"flex",gap:8,marginTop:3,alignItems:"center"}}>
                      <span style={{color:C.muted,fontSize:11}}>{fmtDateShort(m.data)}</span>
                      <span style={{background:ci.color+"1a",color:ci.color,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:99}}>{ci.label}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:m.tipo==="entrada"?C.ok:C.err,fontWeight:900,fontSize:14,whiteSpace:"nowrap"}}>
                      {m.tipo==="entrada"?"+":"-"}{fmt(m.valor)}
                    </span>
                    <div style={{display:"flex",gap:4}}>
                      <button type="button" onClick={()=>setEdit(m)}
                        style={{background:C.accDim,border:"none",borderRadius:8,padding:"5px 7px",cursor:"pointer",color:C.acc,display:"flex"}}>
                        <Edit3 size={13}/>
                      </button>
                      <button type="button" onClick={()=>setDelId(m.id)}
                        style={{background:C.errDim,border:"none",borderRadius:8,padding:"5px 7px",cursor:"pointer",color:C.err,display:"flex"}}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                </div>
                {i<filtered.length-1 && <Divider/>}
              </div>
            );
          })}
        </Card>
      )}

      <ModalMovimentacao open={!!editando} onClose={()=>setEdit(null)} editando={editando}
        onSalvo={reload} valorMensal={config.valor_mensal}/>
      <ConfirmDialog open={!!delId} onClose={()=>setDelId(null)} onConfirm={handleDelete}
        loading={deleting} title="Excluir Movimentação" message="Esta ação não pode ser desfeita."/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  ABA ALUNOS
//  — Lista os 44 alunos com histórico mensal completo
// ════════════════════════════════════════════════════════════════════════════════
function TabAlunos({ data }) {
  const { alunos, mensalidades, config, reload } = data;
  const [busca,   setBusca]   = useState("");
  const [selAluno,setSel]     = useState(null);
  const [mNovo,   setMNovo]   = useState(false);
  const [novoNome,setNome]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState(null);
  const [deleting,setDel]     = useState(false);

  // Mapa: alunoId → { totalPago, mesesPendentes }
  const resumoMap = useMemo(() => {
    const map = {};
    for (const m of mensalidades) {
      const id = Number(m.aluno_id);
      if (!map[id]) map[id] = { totalPago:0, pendentes:0, historico:[] };
      if (m.status==="pago") map[id].totalPago += Number(m.valor);
      else map[id].pendentes++;
      map[id].historico.push(m);
    }
    return map;
  }, [mensalidades]);

  const filtered = useMemo(() => {
    if (!busca) return alunos;
    return alunos.filter(a=>a.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [alunos, busca]);

  const handleAdd = async () => {
    if (!novoNome.trim()) { toast.error("Digite o nome"); return; }
    setSaving(true);
    try { await db.insertAluno(novoNome); toast.success("👤 Aluno adicionado!"); setNome(""); setMNovo(false); await reload(); }
    catch(e) { toast.error(e.message); }
    setSaving(false);
  };

  const handleDel = async () => {
    setDel(true);
    try { await db.deleteAluno(delId); toast.success("Aluno removido."); setDelId(null); await reload(); }
    catch(e) { toast.error(e.message); }
    setDel(false);
  };

  return (
    <div>
      <SectionHeader title={`Alunos — Turma ${TURMA}`} sub={`${alunos.length} de ${TOTAL_ALUNOS} cadastrados`}
        style={{marginBottom:14}}
        right={<Btn size="sm" icon={Plus} onClick={()=>setMNovo(true)}>Adicionar</Btn>}
      />

      {alunos.length < TOTAL_ALUNOS && (
        <Alert type="warn" style={{marginBottom:12}}>
          Faltam {TOTAL_ALUNOS - alunos.length} aluno(s). Execute o SQL para cadastrar todos os 44 alunos.
        </Alert>
      )}

      <div style={{position:"relative",marginBottom:14}}>
        <Search size={14} strokeWidth={2} style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar aluno…"
          style={{width:"100%",background:C.surfB,border:`1.5px solid ${C.border}`,borderRadius:14,padding:"11px 14px 11px 36px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map((a,i)=>{
          const r = resumoMap[Number(a.id)] || {totalPago:0,pendentes:0,historico:[]};
          const {bg,border:bd,text} = avatarColor(a.nome);
          return (
            <motion.div key={a.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*.008}}>
              <Card onClick={()=>setSel(a)} style={{cursor:"pointer"}}>
                <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:42,height:42,borderRadius:13,background:bg,border:`1.5px solid ${bd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:text,flexShrink:0}}>
                    {avatarLetters(a.nome)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.txt,fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nome}</div>
                    <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap"}}>
                      <span style={{color:C.ok,fontSize:11,fontWeight:600}}>Total pago: {fmt(r.totalPago)}</span>
                      {r.pendentes>0 && <span style={{color:C.warn,fontSize:11,fontWeight:600}}>{r.pendentes} pend.</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <button type="button" onClick={e=>{e.stopPropagation();setDelId(a.id);}}
                      style={{background:C.errDim,border:"none",borderRadius:8,padding:"5px 7px",cursor:"pointer",color:C.err,display:"flex"}}>
                      <Trash2 size={13}/>
                    </button>
                    <ChevronRight size={16} color={C.muted}/>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Modal histórico do aluno */}
      <ModalHistoricoAluno aluno={selAluno} resumo={selAluno ? resumoMap[Number(selAluno.id)] : null}
        onClose={()=>setSel(null)} config={config} reload={reload}/>

      {/* Modal novo aluno */}
      <Modal open={mNovo} onClose={()=>{setMNovo(false);setNome("");}} title="Adicionar Aluno" width={400}
        footer={
          <div style={{display:"flex",gap:10}}>
            <Btn variant="ghost" full onClick={()=>{setMNovo(false);setNome("");}}>Cancelar</Btn>
            <Btn full loading={saving} onClick={handleAdd}>Adicionar</Btn>
          </div>
        }>
        <Input label="Nome completo" placeholder="Ex: Dante Santos Melo"
          value={novoNome} onChange={e=>setNome(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdd()}/>
      </Modal>

      <ConfirmDialog open={!!delId} onClose={()=>setDelId(null)} onConfirm={handleDel}
        loading={deleting} title="Excluir Aluno"
        message="Isso removerá o aluno e TODAS as suas mensalidades. Ação irreversível."/>
    </div>
  );
}

// ─── Modal Histórico Aluno ────────────────────────────────────────────────────
function ModalHistoricoAluno({ aluno, resumo, onClose, config, reload }) {
  const [savingId, setSav] = useState(null);

  if (!aluno || !resumo) return null;

  const hist = [...(resumo.historico||[])].sort((a,b)=>b.ano-a.ano||b.mes-a.mes);

  const handlePagar = async (m) => {
    setSav(m.id);
    try {
      await db.pagarMensalidadeDireto(m.id);
      await db.insertMovimentacao({
        tipo:"entrada", valor:Number(m.valor), categoria:"mensalidade",
        descricao:`Mensalidade ${MESES[m.mes-1]}/${m.ano} — ${aluno.nome}`,
        data:today(), responsavel:"Secretária",
      });
      toast.success("✅ Pago!");
      await reload();
    } catch(e) { toast.error(e.message); }
    setSav(null);
  };

  return (
    <Modal open={!!aluno} onClose={onClose} title="Histórico do Aluno" width={520}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:C.surfB,borderRadius:14,border:`1px solid ${C.border}`,marginBottom:18}}>
        <Avatar nome={aluno.nome} size={48}/>
        <div>
          <div style={{color:C.txt,fontWeight:800,fontSize:15}}>{aluno.nome}</div>
          <div style={{color:C.sub,fontSize:12,marginTop:3}}>
            Total pago: <strong style={{color:C.ok}}>{fmt(resumo.totalPago)}</strong>
            {resumo.pendentes>0 && <> · <strong style={{color:C.warn}}>{resumo.pendentes} pendente(s)</strong></>}
          </div>
        </div>
      </div>

      {hist.length===0 ? (
        <Empty icon={DollarSign} title="Sem histórico" desc="Nenhuma mensalidade registrada para este aluno."/>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {hist.map(m => {
            const sc = statusColor[m.status]||C.warn;
            const sl = statusLabel[m.status]||"Pendente";
            return (
              <div key={m.id} style={{background:C.surfB,borderRadius:14,border:`1px solid ${C.border}`,padding:"13px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{textAlign:"center",minWidth:44}}>
                  <div style={{color:C.acc,fontWeight:800,fontSize:13}}>{MESES[m.mes-1].slice(0,3).toUpperCase()}</div>
                  <div style={{color:C.muted,fontSize:10,marginTop:1}}>{m.ano}</div>
                </div>
                <Divider style={{width:1,height:36,margin:"0 2px"}}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:C.txt,fontWeight:700,fontSize:14}}>{fmt(m.valor)}</span>
                    <span style={{background:sc+"1a",color:sc,border:`1px solid ${sc}44`,padding:"2px 9px",borderRadius:99,fontSize:9,fontWeight:800}}>
                      {sl}
                    </span>
                  </div>
                  {m.data_pagamento && <div style={{color:C.muted,fontSize:11,marginTop:3}}>Pago em {fmtDate(m.data_pagamento)}</div>}
                  {m.enviado_em && m.status==="aguardando_aprovacao" && <div style={{color:C.muted,fontSize:11,marginTop:3}}>Enviado em {fmtDateTime(m.enviado_em)}</div>}
                  {m.motivo_recusa && <div style={{color:C.err,fontSize:11,marginTop:3}}>Rejeitado: {m.motivo_recusa}</div>}
                </div>
                {m.status!=="pago" && (
                  <Btn size="xs" variant="subtle" loading={savingId===m.id} onClick={()=>handlePagar(m)}>
                    Pagar
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  SECRETARIA — LAYOUT PRINCIPAL — Mobile-first premium
//  Toda lógica preservada. Apenas visual melhorado.
// ════════════════════════════════════════════════════════════════════════════════
export default function Secretaria({ user, onLogout, data }) {
  const { movs, mensalidades, alunos, loading, dbError, reload, config } = data;
  const [tab,  setTab]  = useState("dashboard");
  const [mMov, setMMov] = useState(null); // "entrada" | "saida" | null

  // Toda lógica original intacta
  const pendAprov = mensalidades.filter(m=>m.status==="aguardando_aprovacao").length;
  const totalEnt  = movs.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+Number(m.valor),0);
  const totalSai  = movs.filter(m=>m.tipo==="saida").reduce((s,m)=>s+Number(m.valor),0);
  const saldo     = totalEnt - totalSai;

  const navBadge = {
    dashboard:    0,
    mensalidades: pendAprov,
    caixa:        0,
    alunos:       0,
  };

  return (
    <div style={{
      display:"flex", flexDirection:"column", minHeight:"100dvh",
      background:C.bg, fontFamily:"'Inter',system-ui,sans-serif",
      overflowX:"hidden",
    }}>

      {/* ════════════════════════════════════════════
           TOP BAR — Sticky, glass effect
      ════════════════════════════════════════════ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 200, flexShrink: 0,
        background: C.surf + "e8",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          padding: "0 16px",
          height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <div style={{
              background: C.accGrad,
              borderRadius: 11,
              width: 34, height: 34,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 18px ${C.acc}44`,
              flexShrink: 0,
            }}>
              <GraduationCap size={17} strokeWidth={2.2} color="#fff"/>
            </div>
            <div>
              <div style={{ fontWeight:900, fontSize:14, letterSpacing:"-.025em", color:C.txt, lineHeight:1.2 }}>
                CaixaSala
              </div>
              <div style={{ fontSize:10, color:C.muted, lineHeight:1 }}>
                Turma {TURMA}
              </div>
            </div>
          </div>

          {/* Right cluster */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Saldo pill */}
            <div style={{
              background: C.surfB,
              border: `1px solid ${saldo>=0 ? C.okBdr : C.errBdr}`,
              borderRadius: 99,
              padding: "5px 11px",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <div style={{ width:6, height:6, borderRadius:99, background:saldo>=0?C.ok:C.err }}/>
              <span style={{ color:saldo>=0?C.ok:C.err, fontSize:12, fontWeight:800, letterSpacing:"-.01em" }}>
                {fmt(saldo)}
              </span>
            </div>

            {/* Spinner de loading */}
            {loading && <Spinner size={16} color={C.acc}/>}

            {/* Badge aprovações */}
            {pendAprov > 0 && (
              <motion.button
                type="button"
                animate={{ scale:[1,1.06,1] }}
                transition={{ repeat:Infinity, duration:2.4 }}
                onClick={() => setTab("mensalidades")}
                style={{
                  background: C.accDim,
                  border: `1px solid ${C.accBdr}`,
                  borderRadius: 99,
                  padding: "5px 10px",
                  display: "flex", alignItems: "center", gap: 5,
                  cursor: "pointer", fontFamily:"inherit",
                }}
              >
                <Bell size={12} strokeWidth={2.5} color={C.acc}/>
                <span style={{ color:C.acc, fontSize:12, fontWeight:800 }}>{pendAprov}</span>
              </motion.button>
            )}

            {/* Refresh */}
            <motion.button
              type="button"
              whileTap={{ rotate: 180, scale:.88 }}
              transition={{ duration:.25 }}
              onClick={reload}
              style={{
                background: C.surfB,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted, flexShrink: 0,
              }}
            >
              <RefreshCw size={14} strokeWidth={2}/>
            </motion.button>

            {/* Logout */}
            <motion.button
              type="button"
              whileTap={{ scale:.9 }}
              onClick={onLogout}
              style={{
                background: C.errDim,
                border: `1px solid ${C.errBdr}`,
                borderRadius: 10,
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.err, flexShrink: 0,
              }}
            >
              <LogOut size={14} strokeWidth={2}/>
            </motion.button>
          </div>
        </div>

        {/* Tab name pill — shows current section */}
        <div style={{
          padding: "0 16px 10px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ color:C.muted, fontSize:12, fontWeight:500 }}>
            {NAV.find(n=>n.id===tab)?.label || "Dashboard"}
          </span>
          {user?.email && (
            <>
              <span style={{ color:C.muted, fontSize:12 }}>·</span>
              <span style={{ color:C.muted, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:180 }}>
                {user.email}
              </span>
            </>
          )}
        </div>
      </header>

      {/* DB Error banner */}
      {dbError && (
        <motion.div
          initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
          style={{ background:C.errDim, borderBottom:`1px solid ${C.errBdr}`, padding:"10px 16px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}
        >
          <AlertTriangle size={14} strokeWidth={2} color={C.err}/>
          <span style={{ color:C.err, fontSize:13, fontWeight:500 }}>{dbError}</span>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════
           CONTENT AREA
      ════════════════════════════════════════════ */}
      <main style={{
        flex: 1,
        padding: "14px 14px 0",
        overflowY: "auto",
        overflowX: "hidden",
        paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px) + 14px)",
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity:0, y:8  }}
            animate={{ opacity:1, y:0  }}
            exit={{    opacity:0, y:-8 }}
            transition={{ duration:.17, ease:"easeOut" }}
          >
            {tab==="dashboard"    && <TabDashboard    data={data} onNewEntry={()=>setMMov("entrada")} onNewExit={()=>setMMov("saida")} onTabChange={setTab}/>}
            {tab==="mensalidades" && <TabMensalidades  data={data}/>}
            {tab==="caixa"        && <TabCaixa         data={data} onNew={(t)=>setMMov(t)}/>}
            {tab==="alunos"       && <TabAlunos        data={data}/>}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ════════════════════════════════════════════
           BOTTOM NAVIGATION — Premium mobile nav
      ════════════════════════════════════════════ */}
      <nav style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 300,
        background: C.surf + "f2",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: `1px solid ${C.border}`,
        boxShadow: "0 -8px 32px rgba(0,0,0,.45)",
        paddingBottom: "env(safe-area-inset-bottom, 4px)",
      }}>
        <div style={{ display:"flex", height:58 }}>
          {NAV.map(item => {
            const active = tab === item.id;
            const badge  = navBadge[item.id] || 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={{
                  flex: 1,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 4,
                  background: "none", border: "none",
                  cursor: "pointer",
                  color: active ? C.acc : C.muted,
                  position: "relative",
                  fontFamily: "inherit",
                  padding: "8px 0",
                  transition: "color .16s",
                }}
              >
                {/* Active pill bg */}
                {active && (
                  <motion.div
                    layoutId="bottom-nav-bg"
                    style={{
                      position: "absolute",
                      top: 7, left: "12%", right: "12%", bottom: 7,
                      background: C.accDim,
                      borderRadius: 12,
                    }}
                    transition={{ type:"spring", stiffness:380, damping:34 }}
                  />
                )}

                {/* Icon with scale animation */}
                <motion.div
                  animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                  transition={{ type:"spring", stiffness:300, damping:22 }}
                  style={{ position:"relative", zIndex:1 }}
                >
                  <item.icon
                    size={20}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {/* Badge */}
                  {badge > 0 && (
                    <motion.span
                      initial={{ scale:0 }} animate={{ scale:1 }}
                      style={{
                        position: "absolute",
                        top: -4, right: -5,
                        background: C.err,
                        color: "#fff",
                        borderRadius: 99,
                        fontSize: 8, fontWeight: 900,
                        padding: "1px 4px",
                        minWidth: 15, textAlign: "center",
                        border: `1.5px solid ${C.surf}`,
                        lineHeight: "1.4",
                      }}
                    >
                      {badge > 9 ? "9+" : badge}
                    </motion.span>
                  )}
                </motion.div>

                {/* Label */}
                <span style={{
                  fontSize: 9,
                  fontWeight: active ? 800 : 500,
                  letterSpacing: ".015em",
                  position: "relative", zIndex: 1,
                  transition: "font-weight .16s",
                }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal Movimentação (global, sem mudança) */}
      <ModalMovimentacao
        open={!!mMov}
        onClose={() => setMMov(null)}
        editando={null}
        onSalvo={reload}
        valorMensal={config.valor_mensal}
        key={mMov}
      />
    </div>
  );
}
