import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://rlpudoysvbzfmysfzkgk.supabase.co";
const SB_KEY = "sb_publishable_c-OZm-N8nddYxuBJgzESRA_lnRHjyNJ";

// createClient nunca lança exceção — mas envolvemos para segurança
export const supabase = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    storageKey:         "csala_v8",
  },
  global: {
    // Timeout de 10s por requisição — evita hang infinito
    fetch: (url, options) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
    },
  },
});

// ─── Normaliza mensalidade ─────────────────────────────────────────────────────
const normM = (m) => ({
  ...m,
  id:          Number(m.id),
  aluno_id:    Number(m.aluno_id),
  ano:         Number(m.ano),
  mes:         Number(m.mes),
  valor:       Number(m.valor),
});

// ─── Executa ignorando "tabela não existe" ─────────────────────────────────────
const safe = async (fn, fallback = []) => {
  try { return await fn(); }
  catch (e) {
    if (
      e?.code === "42P01" ||
      e?.message?.includes("does not exist") ||
      e?.message?.includes("relation") ||
      e?.name === "AbortError"
    ) return fallback;
    throw e;
  }
};

export const db = {

  // ════════════════════════════════════════════════════════════════════════════
  //  ALUNOS
  // ════════════════════════════════════════════════════════════════════════════
  getAlunos: async () => {
    const { data, error } = await supabase.from("alunos").select("*").order("nome");
    if (error) throw error;
    return data || [];
  },
  insertAluno: async (nome) => {
    const { data, error } = await supabase
      .from("alunos").insert({ nome: nome.trim(), turma: "2A" }).select().single();
    if (error) throw error;
    return data;
  },
  deleteAluno: async (id) => {
    const { error } = await supabase.from("alunos").delete().eq("id", id);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  MOVIMENTAÇÕES
  // ════════════════════════════════════════════════════════════════════════════
  getMovimentacoes: async () => {
    const { data, error } = await supabase
      .from("movimentacoes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  insertMovimentacao: async (body) => {
    const { data, error } = await supabase.from("movimentacoes").insert(body).select().single();
    if (error) throw error;
    return data;
  },
  updateMovimentacao: async (id, body) => {
    const { data, error } = await supabase
      .from("movimentacoes").update(body).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  deleteMovimentacao: async (id) => {
    const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
    if (error) throw error;
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  CONFIGURAÇÃO
  // ════════════════════════════════════════════════════════════════════════════
  getConfig: async () => {
    // Nunca lança exceção — retorna default se falhar
    try {
      const { data } = await supabase
        .from("mensalidades_config").select("*").limit(1).maybeSingle();
      return data ?? { id: null, valor_mensal: 15, dia_vencimento: 10 };
    } catch {
      return { id: null, valor_mensal: 15, dia_vencimento: 10 };
    }
  },
  saveConfig: async (body) => {
    const { data: ex } = await supabase
      .from("mensalidades_config").select("id").limit(1).maybeSingle();
    const payload = {
      valor_mensal:   Number(body.valor_mensal)   || 15,
      dia_vencimento: Number(body.dia_vencimento) || 10,
      updated_at:     new Date().toISOString(),
    };
    if (ex?.id) {
      const { data, error } = await supabase
        .from("mensalidades_config").update(payload).eq("id", ex.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase
      .from("mensalidades_config").insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  MENSALIDADES
  // ════════════════════════════════════════════════════════════════════════════
  getMensalidades: async () => {
    return safe(async () => {
      const { data, error } = await supabase
        .from("mensalidades")
        .select("*")
        .order("ano",      { ascending: false })
        .order("mes",      { ascending: false })
        .order("aluno_id", { ascending: true });
      if (error) throw error;
      return (data || []).map(normM);
    });
  },

  getMensalidadesMes: async (ano, mes) => {
    return safe(async () => {
      const { data, error } = await supabase
        .from("mensalidades")
        .select("*")
        .eq("ano", ano)
        .eq("mes", mes)
        .order("aluno_id", { ascending: true });
      if (error) throw error;
      return (data || []).map(normM);
    });
  },

  gerarMensalidadesMes: async (alunos, ano, mes, config) => {
    if (!alunos || !alunos.length) return [];
    const valor = Number(config?.valor_mensal) || 15;
    const rows  = alunos.map(a => ({
      aluno_id: Number(a.id),
      ano:      Number(ano),
      mes:      Number(mes),
      valor,
      status:   "pendente",
    }));
    const { data, error } = await supabase
      .from("mensalidades")
      .upsert(rows, { onConflict: "aluno_id,ano,mes", ignoreDuplicates: true })
      .select();
    if (error) throw error;
    return (data || []).map(normM);
  },

  enviarComprovante: async (alunoId, ano, mes, valor, comprovanteUrl, observacao) => {
    const { data: existing } = await supabase
      .from("mensalidades")
      .select("id, status")
      .eq("aluno_id", Number(alunoId))
      .eq("ano", Number(ano))
      .eq("mes", Number(mes))
      .maybeSingle();

    const payload = {
      aluno_id:         Number(alunoId),
      ano:              Number(ano),
      mes:              Number(mes),
      valor:            Number(valor) || 15,
      status:           "aguardando_aprovacao",
      comprovante_url:  comprovanteUrl || null,
      observacao_aluno: observacao?.trim() || null,
      enviado_em:       new Date().toISOString(),
    };

    if (existing) {
      if (existing.status === "pago") throw new Error("Esta mensalidade já está paga.");
      const { data, error } = await supabase
        .from("mensalidades").update(payload).eq("id", existing.id).select().single();
      if (error) throw error;
      return normM(data);
    }
    const { data, error } = await supabase
      .from("mensalidades").insert(payload).select().single();
    if (error) throw error;
    return normM(data);
  },

  aprovarMensalidade: async (mensalidadeId) => {
    const dp = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("mensalidades")
      .update({ status: "pago", data_pagamento: dp, analisado_em: new Date().toISOString(), motivo_recusa: null })
      .eq("id", mensalidadeId)
      .select().single();
    if (error) throw error;
    return normM(data);
  },

  rejeitarMensalidade: async (mensalidadeId, motivo) => {
    const { data, error } = await supabase
      .from("mensalidades")
      .update({ status: "rejeitado", analisado_em: new Date().toISOString(), motivo_recusa: motivo?.trim() || "Comprovante inválido." })
      .eq("id", mensalidadeId)
      .select().single();
    if (error) throw error;
    return normM(data);
  },

  pagarMensalidadeDireto: async (mensalidadeId) => {
    const dp = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("mensalidades")
      .update({ status: "pago", data_pagamento: dp, analisado_em: new Date().toISOString() })
      .eq("id", mensalidadeId)
      .select().single();
    if (error) throw error;
    return normM(data);
  },

  upsertMensalidade: async (body) => {
    const { data, error } = await supabase
      .from("mensalidades")
      .upsert({ ...body, valor: Number(body.valor) || 15 }, { onConflict: "aluno_id,ano,mes" })
      .select().single();
    if (error) throw error;
    return normM(data);
  },

  // Estatísticas do mês — função pura, não lança exceção
  estatisticasMes: (mensalidades, alunos, ano, mes) => {
    if (!Array.isArray(mensalidades) || !Array.isArray(alunos)) {
      return { total: 0, pagos: 0, aguardando: 0, pendentes: 0, rejeitados: 0, arrecadado: 0 };
    }
    const doMes  = mensalidades.filter(m => Number(m.ano) === ano && Number(m.mes) === mes);
    const total  = alunos.length;
    const pagos  = doMes.filter(m => m.status === "pago").length;
    const aguard = doMes.filter(m => m.status === "aguardando_aprovacao").length;
    const rejeit = doMes.filter(m => m.status === "rejeitado").length;
    const pendt  = Math.max(0, total - pagos - aguard - rejeit);
    const arrecadado = doMes.filter(m => m.status === "pago").reduce((s, m) => s + Number(m.valor), 0);
    return { total, pagos, aguardando: aguard, pendentes: pendt, rejeitados: rejeit, arrecadado };
  },

  statusPorAluno: (mensalidades, ano, mes) => {
    if (!Array.isArray(mensalidades)) return {};
    const map = {};
    for (const m of mensalidades) {
      if (Number(m.ano) === ano && Number(m.mes) === mes) {
        map[m.aluno_id] = m;
      }
    }
    return map;
  },

  uploadComprovante: async (file, alunoId, ano, mes) => {
    const ext  = file.name.split(".").pop().toLowerCase();
    const path = `${alunoId}/${ano}-${String(mes).padStart(2, "0")}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("comprovantes")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("comprovantes").getPublicUrl(path);
    return { path, url: data.publicUrl };
  },
};
