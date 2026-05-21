/**
 * PublicPage.jsx — Área Pública do Aluno
 * Aluno seleciona nome → vê histórico mensal → envia comprovante PIX
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  GraduationCap, Lock, Star, Search, ChevronRight,
  CheckCircle, Clock, XCircle, AlertTriangle,
  Send, TrendingUp, TrendingDown, Wallet, UserCheck,
  RefreshCw, ChevronLeft, X, Info, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { db } from "../lib/supabase.js";
import {
  C, MESES, MESES_SHORT, TURMA, fmt, fmtDate, fmtDateShort, fmtDateTime,
  today, nowYear, nowMes, avatarLetters, avatarColor,
} from "../lib/utils.js";
import { Btn, Modal, FileUpload, Card, ProgressBar, Alert, SectionHeader, Divider, Spinner, Avatar } from "../lib/ui.jsx";

// ─── Status visual ─────────────────────────────────────────────────────────────
const STV = {
  pago:                 { l:"PAGO",       c:"#10b981", bg:"rgba(16,185,129,.13)", bd:"rgba(16,185,129,.3)",  I:CheckCircle    },
  aguardando_aprovacao: { l:"AGUARDANDO", c:"#6366f1", bg:"rgba(99,102,241,.13)", bd:"rgba(99,102,241,.3)",  I:Clock          },
  pendente:             { l:"PENDENTE",   c:"#f59e0b", bg:"rgba(245,158,11,.13)", bd:"rgba(245,158,11,.3)",  I:AlertTriangle  },
  rejeitado:            { l:"REJEITADO",  c:"#ef4444", bg:"rgba(239,68,68,.13)",  bd:"rgba(239,68,68,.3)",   I:XCircle        },
};

function StatusChip({ status }) {
  const v = STV[status] || STV.pendente;
  return (
    <span style={{
      background:v.bg, color:v.c, border:`1px solid ${v.bd}`,
      padding:"3px 11px", borderRadius:99, fontSize:10, fontWeight:800,
      display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
      letterSpacing:".04em",
    }}>
      <v.I size={9} strokeWidth={2.5}/>{v.l}
    </span>
  );
}

// ─── Modal: Aluno envia comprovante ───────────────────────────────────────────
function ModalEnviarComprovante({ open, onClose, aluno, mens, config, onEnviado }) {
  const [file,     setFile]    = useState(null);
  const [obs,      setObs]     = useState("");
  const [enviando, setEnv]     = useState(false);
  const [step,     setStep]    = useState("form"); // "form" | "sucesso"

  const anoN = nowYear(), mesN = nowMes();
  const ano  = mens?.ano  || anoN;
  const mes  = mens?.mes  || mesN;
  const valor= Number(mens?.valor||config?.valor_mensal||15);

  const handleEnviar = async () => {
    setEnv(true);
    try {
      let comprovanteUrl = null;
      if (file) {
        const { url } = await db.uploadComprovante(file, aluno.id, ano, mes);
        comprovanteUrl = url;
      }
      await db.enviarComprovante(aluno.id, ano, mes, valor, comprovanteUrl, obs);
      setStep("sucesso");
      toast.success("✅ Comprovante enviado! Aguarde aprovação.");
      await onEnviado?.();
    } catch(e) {
      toast.error(e.message === "Esta mensalidade já está paga."
        ? "Esta mensalidade já foi paga!"
        : "Erro ao enviar: " + e.message);
    }
    setEnv(false);
  };

  const handleClose = () => { setStep("form"); setFile(null); setObs(""); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} width={480}
      title={step==="sucesso" ? "Comprovante Enviado! 🎉" : `Pagar ${MESES[mes-1]} ${ano}`}
      subtitle={step==="form" ? aluno?.nome : undefined}
      footer={step==="form" ? (
        <div style={{display:"flex",gap:10}}>
          <Btn variant="ghost" full onClick={handleClose}>Cancelar</Btn>
          <Btn variant="ok" full loading={enviando} onClick={handleEnviar} icon={Send}>
            {enviando ? "Enviando…" : "Enviar Comprovante"}
          </Btn>
        </div>
      ) : (
        <Btn full onClick={handleClose}>Fechar</Btn>
      )}
    >
      {step === "form" ? (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Resumo */}
          <div style={{background:C.surfB,borderRadius:14,border:`1px solid ${C.border}`,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:C.muted,fontSize:13}}>Mensalidade</span>
              <span style={{color:C.txt,fontWeight:700,fontSize:13}}>{MESES[mes-1]} / {ano}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{color:C.muted,fontSize:13}}>Valor</span>
              <span style={{color:C.gold,fontWeight:900,fontSize:20}}>{fmt(valor)}</span>
            </div>
          </div>

          <Alert type="info">
            Faça o PIX de <strong>{fmt(valor)}</strong> para a chave da turma e envie o comprovante abaixo. A secretária irá analisar e aprovar.
          </Alert>

          {/* Upload */}
          <FileUpload onFile={setFile} label="Comprovante (foto ou PDF)" hint="JPG, PNG ou PDF · máx 5MB"/>

          {/* Observação */}
          <div>
            <label style={{display:"block",color:C.sub,fontSize:12,fontWeight:600,marginBottom:6}}>
              Observação (opcional)
            </label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)}
              placeholder="Ex: Paguei às 14h, chave PIX: 11 99999-9999"
              style={{
                width:"100%", background:C.surfB, border:`1.5px solid ${C.border}`,
                borderRadius:14, padding:"11px 14px", color:C.txt, fontSize:13,
                fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:70,
                boxSizing:"border-box",
              }}/>
          </div>
        </div>
      ) : (
        /* Sucesso */
        <div style={{textAlign:"center",padding:"20px 10px 10px"}}>
          <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:200}}>
            <div style={{width:72,height:72,borderRadius:22,background:C.okDim,border:`2px solid ${C.okBdr}`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
              <CheckCircle size={36} strokeWidth={2} color={C.ok}/>
            </div>
          </motion.div>
          <div style={{color:C.txt,fontWeight:800,fontSize:18,marginBottom:8}}>Comprovante enviado!</div>
          <div style={{color:C.sub,fontSize:14,lineHeight:1.6}}>
            A secretária irá analisar e aprovar seu pagamento. Você será notificado assim que for confirmado.
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Modal detalhe do aluno ───────────────────────────────────────────────────
function ModalAluno({ aluno, mensalidades, config, onClose, onReload }) {
  const [step,     setStep]    = useState("main"); // "main" | "pagar"
  const [mesSel,   setMesSel]  = useState(nowMes());
  const [anoSel,   setAnoSel]  = useState(nowYear());
  const [enviandoModal, setEnvModal] = useState(false);

  if (!aluno) return null;

  const hist = mensalidades
    .filter(m => Number(m.aluno_id) === Number(aluno.id))
    .sort((a,b) => b.ano-a.ano || b.mes-a.mes);

  const totalPago = hist.filter(m=>m.status==="pago").reduce((s,m)=>s+Number(m.valor),0);
  const pendentes = hist.filter(m=>m.status!=="pago").length;

  const mensAtual = hist.find(m=>Number(m.ano)===nowYear()&&Number(m.mes)===nowMes());
  const statusAtual = mensAtual?.status || "pendente";

  // Mensalidade para o modal de envio
  const [mensParaPagar, setMensParaPagar] = useState(null);

  const handleAbrirPagamento = (mes) => {
    setMensParaPagar(mes);
    setEnvModal(true);
  };

  return (
    <Modal open={!!aluno} onClose={onClose} title={aluno.nome.split(" ")[0]} width={540}>
      {/* Header aluno */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:C.surfB,borderRadius:14,border:`1px solid ${C.border}`,marginBottom:18}}>
        <Avatar nome={aluno.nome} size={50}/>
        <div style={{flex:1}}>
          <div style={{color:C.txt,fontWeight:800,fontSize:16}}>{aluno.nome}</div>
          <div style={{color:C.sub,fontSize:12,marginTop:3}}>Turma {TURMA}</div>
          <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
            <span style={{color:C.ok,fontSize:12,fontWeight:700}}>Pago: {fmt(totalPago)}</span>
            {pendentes>0 && <span style={{color:C.warn,fontSize:12,fontWeight:700}}>{pendentes} pendente(s)</span>}
          </div>
        </div>
      </div>

      {/* Status mês atual */}
      <div style={{marginBottom:16}}>
        <div style={{color:C.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
          {MESES[nowMes()-1]} {nowYear()} — Mês Atual
        </div>
        {mensAtual ? (
          <div style={{
            background:statusAtual==="pago"?"rgba(16,185,129,.08)":statusAtual==="aguardando_aprovacao"?"rgba(99,102,241,.08)":"rgba(245,158,11,.08)",
            border:`1px solid ${statusAtual==="pago"?C.okBdr:statusAtual==="aguardando_aprovacao"?C.accBdr:C.warnBdr}`,
            borderRadius:14, padding:"14px 16px",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <StatusChip status={statusAtual}/>
              <span style={{color:C.gold,fontWeight:900,fontSize:18}}>{fmt(mensAtual.valor)}</span>
            </div>
            {statusAtual==="aguardando_aprovacao" && (
              <div style={{color:C.acc,fontSize:12,marginTop:4}}>✓ Comprovante enviado. Aguardando análise da secretária.</div>
            )}
            {statusAtual==="pago" && (
              <div style={{color:C.ok,fontSize:12,marginTop:4}}>✓ Pago em {fmtDate(mensAtual.data_pagamento)}</div>
            )}
            {statusAtual==="rejeitado" && (
              <>
                <div style={{color:C.err,fontSize:12,marginTop:4}}>Motivo: {mensAtual.motivo_recusa}</div>
                <Btn full variant="ok" size="sm" style={{marginTop:10}} onClick={()=>handleAbrirPagamento(mensAtual)}>
                  <Send size={13}/> Reenviar Comprovante
                </Btn>
              </>
            )}
            {statusAtual==="pendente" && (
              <Btn full variant="ok" style={{marginTop:10}} onClick={()=>handleAbrirPagamento(mensAtual)}>
                <Send size={15}/> Enviar Comprovante PIX
              </Btn>
            )}
          </div>
        ) : (
          <div style={{background:C.warnDim,border:`1px solid ${C.warnBdr}`,borderRadius:14,padding:"14px 16px"}}>
            <div style={{color:C.warn,fontWeight:700,fontSize:14,marginBottom:4}}>Mensalidade não gerada</div>
            <div style={{color:C.sub,fontSize:13}}>A secretária ainda não gerou a cobrança deste mês.</div>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div style={{color:C.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>
        Histórico Completo
      </div>

      {hist.length === 0 ? (
        <div style={{textAlign:"center",padding:"24px 0",color:C.muted,fontSize:13}}>
          Nenhuma mensalidade registrada.
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {hist.map(m => (
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,background:C.surfB,borderRadius:12,border:`1px solid ${C.border}`,padding:"12px 14px"}}>
              <div style={{textAlign:"center",minWidth:40}}>
                <div style={{color:C.acc,fontWeight:800,fontSize:12}}>{MESES[m.mes-1].slice(0,3).toUpperCase()}</div>
                <div style={{color:C.muted,fontSize:10,marginTop:1}}>{m.ano}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <StatusChip status={m.status}/>
                  <span style={{color:C.txt,fontWeight:700,fontSize:13}}>{fmt(m.valor)}</span>
                </div>
                {m.data_pagamento && <div style={{color:C.muted,fontSize:11,marginTop:3}}>Pago em {fmtDate(m.data_pagamento)}</div>}
                {m.enviado_em && m.status==="aguardando_aprovacao" && <div style={{color:C.muted,fontSize:11,marginTop:3}}>Enviado {fmtDateTime(m.enviado_em)}</div>}
                {m.motivo_recusa && <div style={{color:C.err,fontSize:11,marginTop:3}}>{m.motivo_recusa}</div>}
              </div>
              {(m.status==="pendente"||m.status==="rejeitado") && (
                <Btn size="xs" variant="subtle" onClick={()=>handleAbrirPagamento(m)}>
                  <Send size={11}/> Pagar
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal enviar comprovante */}
      <ModalEnviarComprovante
        open={enviandoModal}
        onClose={()=>{setEnvModal(false);setMensParaPagar(null);}}
        aluno={aluno}
        mens={mensParaPagar}
        config={config}
        onEnviado={async()=>{ await onReload?.(); setEnvModal(false); setMensParaPagar(null); }}
      />
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
//  PUBLIC PAGE
// ════════════════════════════════════════════════════════════════════════════════
export default function PublicPage({ data }) {
  const { movs, alunos, mensalidades, config, loading, reload } = data;
  const navigate  = useNavigate();
  const [busca,   setBusca]  = useState("");
  const [selAluno,setSel]    = useState(null);

  const anoN = nowYear(), mesN = nowMes();

  const totalEnt  = movs.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+Number(m.valor),0);
  const totalSai  = movs.filter(m=>m.tipo==="saida").reduce((s,m)=>s+Number(m.valor),0);
  const saldo     = totalEnt - totalSai;

  const stats = useMemo(() =>
    db.estatisticasMes(mensalidades, alunos, anoN, mesN),
    [mensalidades, alunos, anoN, mesN]
  );

  const statusMap = useMemo(() =>
    db.statusPorAluno(mensalidades, anoN, mesN),
    [mensalidades, anoN, mesN]
  );

  // Gráfico 6 meses
  const chartData = useMemo(() => {
    const res = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anoN, mesN-1-i, 1);
      const a = d.getFullYear(), m = d.getMonth()+1;
      const lst = movs.filter(mv => mv.data?.startsWith(`${a}-${String(m).padStart(2,"0")}`));
      res.push({
        mes:     MESES_SHORT[m-1],
        entrada: lst.filter(mv=>mv.tipo==="entrada").reduce((s,mv)=>s+Number(mv.valor),0),
        saida:   lst.filter(mv=>mv.tipo==="saida").reduce((s,mv)=>s+Number(mv.valor),0),
      });
    }
    return res;
  }, [movs, anoN, mesN]);

  const alunosFilt = useMemo(() => {
    if (!busca) return alunos;
    return alunos.filter(a=>a.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [alunos, busca]);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.txt, fontFamily:"'Inter',system-ui,sans-serif", paddingBottom:32 }}>
      {/* BG glow */}
      <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:600,height:300,background:`radial-gradient(ellipse, ${C.acc}0e 0%, transparent 70%)`,pointerEvents:"none",zIndex:0}}/>

      {/* HEADER */}
      <header style={{background:C.surf+"dd",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:760,margin:"0 auto",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:C.accGrad,borderRadius:10,padding:"7px 8px",boxShadow:`0 0 16px ${C.acc}44`}}>
              <GraduationCap size={18} strokeWidth={2} color="#fff"/>
            </div>
            <div>
              <div style={{fontWeight:900,fontSize:14,letterSpacing:"-.02em"}}>CaixaSala</div>
              <div style={{fontSize:10,color:C.muted}}>Turma {TURMA}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {loading && <Spinner size={16} color={C.acc}/>}
            <button onClick={reload} type="button"
              style={{background:C.surfB,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 8px",cursor:"pointer",color:C.muted,display:"flex"}}>
              <RefreshCw size={14} strokeWidth={2}/>
            </button>
            <Btn variant="ghost" size="sm" icon={Lock} onClick={()=>navigate("/login")}>Secretária</Btn>
          </div>
        </div>
      </header>

      <div style={{maxWidth:760,margin:"0 auto",padding:"24px 16px",position:"relative",zIndex:1}}>

        {/* HERO */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:C.accDim,border:`1px solid ${C.accBdr}`,borderRadius:20,padding:"5px 14px",marginBottom:12}}>
            <Star size={11} strokeWidth={2} color={C.acc}/>
            <span style={{fontSize:12,color:C.acc,fontWeight:700}}>Transparência Total · Turma {TURMA}</span>
          </div>
          <h1 style={{fontSize:"clamp(24px,6vw,40px)",fontWeight:900,margin:"0 0 8px",letterSpacing:"-.03em",background:`linear-gradient(135deg,${C.txt},${C.acc})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Caixa da Turma {TURMA}
          </h1>
          <p style={{color:C.muted,fontSize:14,margin:"0 auto",maxWidth:400,lineHeight:1.5}}>
            Acompanhe os pagamentos da turma. Toque no seu nome para ver e enviar comprovante.
          </p>
        </div>

        {/* Saldo destaque */}
        <div style={{background:C.accGrad,borderRadius:20,padding:"20px 20px",marginBottom:20,position:"relative",overflow:"hidden",boxShadow:`0 8px 32px ${C.acc}33`}}>
          <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,background:"rgba(255,255,255,.06)",borderRadius:"50%"}}/>
          <div style={{color:"rgba(255,255,255,.7)",fontSize:11,fontWeight:600,marginBottom:4}}>SALDO ATUAL</div>
          <div style={{color:"#fff",fontSize:30,fontWeight:900,letterSpacing:"-.03em"}}>{fmt(saldo)}</div>
          <div style={{display:"flex",gap:16,marginTop:12}}>
            <div><div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>Entradas</div><div style={{color:"#fff",fontWeight:700}}>{fmt(totalEnt)}</div></div>
            <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
            <div><div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>Saídas</div><div style={{color:"#fff",fontWeight:700}}>{fmt(totalSai)}</div></div>
            <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
            <div><div style={{color:"rgba(255,255,255,.6)",fontSize:11}}>Mês atual</div><div style={{color:"#fff",fontWeight:700}}>{fmt(stats.arrecadado)}</div></div>
          </div>
        </div>

        {/* Adimplência */}
        <Card style={{padding:"18px 18px 16px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{color:C.txt,fontSize:14,fontWeight:700}}>{MESES[mesN-1]} {anoN}</div>
            <div style={{color:C.ok,fontWeight:800,fontSize:14}}>
              {alunos.length?Math.round(stats.pagos/alunos.length*100):0}% pagos
            </div>
          </div>
          <ProgressBar value={stats.pagos} max={alunos.length||44} color={C.ok} height={10}
            showLabel label={`${stats.pagos} pagos · ${stats.aguardando} aguardando · ${stats.pendentes} pendentes`}/>
        </Card>

        {/* Gráfico */}
        {chartData.some(d=>d.entrada>0||d.saida>0) && (
          <Card style={{padding:"18px 16px",marginBottom:20}}>
            <div style={{color:C.txt,fontSize:14,fontWeight:700,marginBottom:14}}>Movimentações — 6 Meses</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ge2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.ok}  stopOpacity={.3}/><stop offset="95%" stopColor={C.ok}  stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gs2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.err} stopOpacity={.2}/><stop offset="95%" stopColor={C.err} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} width={50}
                  tickFormatter={v=>v>=1000?`R$${(v/1000).toFixed(0)}k`:`R$${v}`}/>
                <Tooltip contentStyle={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:12,fontSize:13,color:C.txt}}/>
                <Area type="monotone" dataKey="entrada" name="Entradas" stroke={C.ok}  fill="url(#ge2)" strokeWidth={2.5} dot={false}/>
                <Area type="monotone" dataKey="saida"   name="Saídas"   stroke={C.err} fill="url(#gs2)" strokeWidth={2.5} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* LISTA ALUNOS */}
        <Card>
          <div style={{padding:"16px 18px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{color:C.txt,fontSize:14,fontWeight:700}}>Alunos da Turma {TURMA}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:2}}>Toque para ver e pagar</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <span style={{background:C.okDim,color:C.ok,border:`1px solid ${C.okBdr}`,padding:"3px 11px",borderRadius:99,fontSize:11,fontWeight:800}}>✓ {stats.pagos}</span>
              <span style={{background:C.warnDim,color:C.warn,border:`1px solid ${C.warnBdr}`,padding:"3px 11px",borderRadius:99,fontSize:11,fontWeight:800}}>○ {stats.pendentes+stats.aguardando}</span>
            </div>
          </div>

          {/* Busca */}
          <div style={{padding:"0 18px 12px",position:"relative"}}>
            <Search size={13} strokeWidth={2} style={{position:"absolute",left:30,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder={`Buscar dentre ${alunos.length} alunos…`}
              style={{width:"100%",background:C.surfB,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"10px 14px 10px 34px",color:C.txt,fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>

          <Divider/>

          {/* Lista */}
          <div>
            {alunosFilt.map((a,i)=>{
              const mens  = statusMap[Number(a.id)];
              const status= mens?.status || "pendente";
              const sv    = STV[status] || STV.pendente;
              const {bg,border:bd,text} = avatarColor(a.nome);
              return (
                <div key={a.id}>
                  <motion.button type="button" whileTap={{scale:.98}} onClick={()=>setSel(a)}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", gap:12,
                      padding:"13px 18px", background:"none", border:"none", cursor:"pointer",
                      fontFamily:"inherit", textAlign:"left",
                    }}>
                    <div style={{width:40,height:40,borderRadius:12,background:bg,border:`1.5px solid ${bd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:text,flexShrink:0}}>
                      {avatarLetters(a.nome)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.txt,fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.nome}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                        <span style={{background:sv.bg,color:sv.c,border:`1px solid ${sv.bd}`,padding:"2px 9px",borderRadius:99,fontSize:9,fontWeight:800,display:"inline-flex",alignItems:"center",gap:4}}>
                          <sv.I size={9} strokeWidth={2.5}/>{sv.l}
                        </span>
                        <span style={{color:C.muted,fontSize:11}}>{fmt(mens?.valor||config.valor_mensal||15)}</span>
                      </div>
                    </div>
                    <ChevronRight size={15} strokeWidth={2} color={C.muted}/>
                  </motion.button>
                  {i<alunosFilt.length-1 && <Divider/>}
                </div>
              );
            })}
            {alunosFilt.length===0 && (
              <div style={{textAlign:"center",padding:"32px 20px",color:C.muted,fontSize:14}}>
                Nenhum aluno encontrado
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modal aluno */}
      <ModalAluno aluno={selAluno} mensalidades={mensalidades} config={config}
        onClose={()=>setSel(null)} onReload={reload}/>
    </div>
  );
}
