/* ══════════════════════════════════════════════════════════════════
   SIGMAN — Core: Configuração, Estado Global e Camada de API
   Super Muffato
   ORDEM DE CARREGAMENTO: este arquivo deve vir ANTES do script
   principal no index.html.
   ══════════════════════════════════════════════════════════════════ */

const API_URL = 'https://script.google.com/macros/s/AKfycbwxVCk6ad9N4PfUY9xZeft3g1NjKYq3135ig-4klTizLr0mAQ6Nr7u4w1-3U3V2_LIE6g/exec';
const USE_API = true; // false = modo offline (só localStorage)
const POLL_MS = 180000; // Atualização automática a cada 3 minutos
const CACHE_TTL_MS = 180000; // TTL do readAll: só busca novamente após 3 min


// ══════════════════════════════════════════════════════════════════════
// BANCO DE DADOS LOCAL (cache em memória + localStorage)
// ══════════════════════════════════════════════════════════════════════
let db = {
  lojas: [],
  lojasTag: {}, // {NOME_DA_LOJA: 'valor do indexador'} — indexador é o antigo campo Tag, agora em nível de loja
  areas: [],
  ordens: [],
  planejadas: [],
  solicitacoes: [],
  usuarios: [],
  configuracoes: {
    horas_turno_1: 7.1, horas_turno_2: 7.1, horas_turno_3: 0
  },
  osC:1, plC:1, solC:1,
  historico: []
};

// ══════════════════════════════════════════════════════════════════════
// CONTROLE DE ACESSO (menus por nível)
// ══════════════════════════════════════════════════════════════════════
const ROLES = {
  administracao: {
    label: 'Administração',
    menus: ['dashboard','planejadas','executadas','abertura','pcm','solicitacao','ativos','usuarios']
  },
  manutencao: {
    label: 'Manutenção',
    menus: ['dashboard','planejadas','executadas','abertura']
  },
  gerente: {
    label: 'Gerente de Loja',
    menus: ['solicitacao']
  }
};

let CU = null; // usuário logado
let _pollTimer = null; // timer de atualização automática

// ══════════════════════════════════════════════════════════════════════
// ÁREAS PADRÃO — criadas automaticamente ao cadastrar uma loja nova
// ══════════════════════════════════════════════════════════════════════
const AREAS_PADRAO = [
  'PADARIA', 'AÇOUGUE', 'DEPÓSITO', 'PORTARIA',
  'ESTACIONAMENTO', 'CÂMARAS FRIAS', 'INTERIOR LOJA', 'SALA MÁQUINAS'
];

// ══════════════════════════════════════════════════════════════════════
// RESTRIÇÃO DE ACESSO POR LOJA (gerente / manutenção)
// Administração sempre vê tudo. CU.todasLojas = true também vê tudo
// (usuário de manutenção/gerente multi-função). Caso contrário, só as
// lojas listadas em CU.lojas.
// IMPORTANTE: estas funções NÃO alteram db.lojas/db.ordens/etc — elas
// devolvem cópias filtradas. Nunca filtre os arrays de `db` em memória
// (eles são persistidos em localStorage por saveDB() e são compartilhados
// entre logins no mesmo navegador; filtrar em memória vazaria a visão
// restrita de um usuário para o próximo que logar no mesmo aparelho).
// ══════════════════════════════════════════════════════════════════════
function usuarioTemAcessoTotal() {
  return !!(CU && (CU.tipo === 'administracao' || CU.todasLojas));
}

function tagDaLoja(loja) {
  return (db.lojasTag && db.lojasTag[loja]) || '';
}

function usuarioTemAcessoLoja(loja) {
  if (!CU) return false;
  if (usuarioTemAcessoTotal()) return true;
  if ((CU.lojas || []).includes(loja)) return true;
  const tag = tagDaLoja(loja);
  return !!tag && (CU.indexadores || []).includes(tag);
}

function lojasPermitidas() {
  if (usuarioTemAcessoTotal()) return [...db.lojas];
  return db.lojas.filter(l => usuarioTemAcessoLoja(l));
}

function planejadasVisiveis() {
  if (usuarioTemAcessoTotal()) return [...db.planejadas];
  return db.planejadas.filter(p => usuarioTemAcessoLoja(p.loja));
}

function ordensVisiveis() {
  if (usuarioTemAcessoTotal()) return [...db.ordens];
  return db.ordens.filter(o => usuarioTemAcessoLoja(o.loja));
}

function solicitacoesVisiveis() {
  if (usuarioTemAcessoTotal()) return [...db.solicitacoes];
  return db.solicitacoes.filter(s => usuarioTemAcessoLoja(s.loja));
}

let _dashTimer = null; // timer específico do dashboard (15s)
let _curDet = null;
let _dashAutoRf = false; // auto-refresh dashboard ativo?

// ══════════════════════════════════════════════════════════════════════
// API — comunicação com Google Sheets
// ══════════════════════════════════════════════════════════════════════
async function apiGet(params, _tentativa = 1) {
  if (!USE_API) return null;
  const MAX_TENTATIVAS = 3;
  const TIMEOUT_MS = 35000; // 35s cobre o cold start do Apps Script
  try {
    const q = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const res = await fetch(API_URL + '?' + q, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch(e) {
    const isTimeout = e.name === 'TimeoutError' || e.name === 'AbortError';
    console.warn(`[API GET] ${isTimeout ? 'Timeout' : 'Erro'} (tentativa ${_tentativa}/${MAX_TENTATIVAS}) — ${e.message}`);
    if (_tentativa < MAX_TENTATIVAS) {
      // Espera 3s antes de tentar novamente (deixa o Apps Script acordar)
      await new Promise(r => setTimeout(r, 3000));
      return apiGet(params, _tentativa + 1);
    }
    // Todas as tentativas falharam — avisa visualmente
    showApiStatus('offline');
    return null;
  }
}

async function apiPost(body) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000)
    });
    const json = await res.json();
    if (!json.ok) {
      console.error('[API POST] Erro:', json.error);
      apiQueueFailed(body);
      return null;
    }
    return json;
  } catch(e) {
    console.error('[API POST]', e.message);
    apiQueueFailed(body);
    return null;
  }
}

// Fila de operações que falharam
function apiQueueFailed(body) {
  try {
    const fila = JSON.parse(localStorage.getItem('sigvarejo_fila') || '[]');
    fila.push({ body, ts: Date.now() });
    localStorage.setItem('sigvarejo_fila', JSON.stringify(fila));
    showApiStatus('offline');
  } catch(e) {}
}

async function apiFlushQueue() {
  try {
    const fila = JSON.parse(localStorage.getItem('sigvarejo_fila') || '[]');
    if (!fila.length) return;
    const restante = [];
    for (const item of fila) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(item.body)
      }).then(r => r.json()).catch(() => null);
      if (!res || !res.ok) restante.push(item);
    }
    localStorage.setItem('sigvarejo_fila', JSON.stringify(restante));
    if (!restante.length) showApiStatus('online');
  } catch(e) {}
}

// Tenta reenviar fila a cada 30 segundos
setInterval(async () => {
  const fila = JSON.parse(localStorage.getItem('sigvarejo_fila') || '[]');
  if (fila.length > 0) await apiFlushQueue();
}, 45000);

function showApiStatus(status) {
  let el = document.getElementById('api-status-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'api-status-bar';
    el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;padding:10px 16px;border-radius:8px;font-family:var(--fw);font-size:14px;font-weight:700;font-variant:small-caps;letter-spacing:.04em;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.4);transition:all .3s';
    document.body.appendChild(el);
  }
  if (status === 'offline') {
    el.style.background = 'rgba(196,18,48,.92)';
    el.style.color = '#fff';
    el.style.border = '1px solid rgba(196,18,48,.5)';
    el.innerHTML = '⚠️ Sheets indisponível — dado salvo localmente. Tentando reconectar...';
    el.style.display = 'flex';
  } else {
    el.style.background = 'rgba(31,217,136,.92)';
    el.style.color = '#000';
    el.style.border = '1px solid rgba(31,217,136,.4)';
    el.innerHTML = '✅ Reconectado — dados sincronizados.';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

// Envia nova linha para o Sheets
function apiAppend(sheet, row) { return apiPost({ action:'append', sheet, row, usuario: (typeof CU!=='undefined'&&CU)?CU.nome:'' }); }
// Atualiza linha existente
function apiUpdate(sheet, id, idCol, row) { return apiPost({ action:'update', sheet, id, idCol, row, usuario: (typeof CU!=='undefined'&&CU)?CU.nome:'' }); }
// Remove linha
function apiDelete(sheet, id, idCol) { return apiPost({ action:'delete', sheet, id, idCol, usuario: (typeof CU!=='undefined'&&CU)?CU.nome:'' }); }

// ── Normalização de valores vindos do Sheets ─────────────────────────────
function normDate(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  return s.slice(0,10);
}

function normTime(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    const frac = v % 1;
    const min = Math.round(frac * 1440);
    return String(Math.floor(min/60)).padStart(2,'0') + ':' + String(min%60).padStart(2,'0');
  }
  const s = String(v);
  if (s.includes('T')) {
    // Usa horário LOCAL, não UTC
    const d = new Date(s);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0,5);
  return '';
}

function driveThumb(url) {
  if (!url) return url;
  var m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (!m) return url;
  return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
}

function normStr(v) { return v === null || v === undefined ? '' : String(v); }

// ── Carrega todos os dados do Sheets ────────────────────────────────────
async function apiLoadAll(silent = false, force = false) {
  if (!USE_API) return;
  // TTL: só vai ao Sheets se passou mais de CACHE_TTL_MS desde o último readAll
  // force=true é usado após gravações (append/update/delete) para garantir consistência
  const lastLoad = Number(localStorage.getItem('sigvarejo_last_load') || 0);
  if (!force && (Date.now() - lastLoad) < CACHE_TTL_MS) {
    if (!silent) console.log('[SIGMAN] Cache válido — readAll ignorado');
    return;
  }
  const json = await apiGet({ action: 'readAll' });
  if (!json || !json.ok) {
    if (!silent) {
      showToast('⚠️ Sheets indisponível — exibindo dados do cache local.', 'er', 5000);
      console.warn('[SIGMAN] Sheets indisponível, usando cache local');
    }
    return;
  }
  localStorage.setItem('sigvarejo_last_load', String(Date.now()));
  const d = json.data;

  // Ordens Executadas
  if (d.ordens && d.ordens.length) {
    db.ordens = d.ordens.map(r => ({
      id: crypto.randomUUID(),
      numero: normStr(r.OS_Numero),
      loja: normStr(r.Loja),
      maq: normStr(r.Area),
      tipo: normStr(r.Tipo),
      prioridade: normStr(r.Prioridade),
      manut: normStr(r.Manutentor),
      data: normDate(r.Data),
      ini: normTime(r.Hora_Inicio),
      fim: normTime(r.Hora_Fim),
      durMin: Number(r.Duracao_Min) || 0,
      paradaMin: Number(r.Tempo_Parada_Min) || 0,
      prob: normStr(r.Problema),
      acao: normStr(r.Acao_Executada),
      fotoUrl: normStr(r.Foto_URL||''),
      origem: normStr(r.Origem),
      origemNum: normStr(r.OS_Origem_Ref),
      criadoEm: normStr(r.Criado_Em)
    }));
    const max = Math.max(...db.ordens.map(o => parseInt(o.numero.replace(/\D/g,''))||0), 0);
    db.osC = max + 1;
  }

  // OS Planejadas
  if (d.planejadas && d.planejadas.length) {
    db.planejadas = d.planejadas.map(r => ({
      id: crypto.randomUUID(),
      numero: normStr(r.PL_Numero),
      loja: normStr(r.Loja),
      maq: normStr(r.Area),
      tipo: normStr(r.Tipo),
      prioridade: normStr(r.Prioridade),
      prazo: normDate(r.Prazo_Limite),
      desc: normStr(r.Descricao_Planejada),
      status: normStr(r.Status) || 'Pendente',
      manut: normStr(r.Manutentor_Exec),
      dtExec: normDate(r.Data_Execucao),
      ini: normTime(r.Hora_Inicio),
      fim: normTime(r.Hora_Fim),
      durMin: Number(r.Duracao_Min) || 0,
      desc2: normStr(r.Servico_Executado),
      criadoEm: normStr(r.Criado_Em)
    }));
    const max = Math.max(...db.planejadas.map(p => parseInt(p.numero.replace(/\D/g,''))||0), 0);
    db.plC = max + 1;
  }

  // Solicitações
  if (d.solicitacoes && d.solicitacoes.length) {
    db.solicitacoes = d.solicitacoes.map(r => ({
      id: crypto.randomUUID(),
      numero: normStr(r.SOL_Numero),
      loja: normStr(r.Loja),
      maq: normStr(r.Area),
      tipo: normStr(r.Tipo),
      prioridade: normStr(r.Prioridade),
      desc: normStr(r.Descricao),
      status: normStr(r.Status) || 'Não Executada',
      solicitante:normStr(r.Solicitante),
      manut: normStr(r.Manutentor_Exec),
      dtExec: normDate(r.Data_Execucao),
      desc2: normStr(r.Servico_Executado),
      criadoEm: normStr(r.Criado_Em),
      fotoUrl: normStr(r.Foto_URL||'')
    }));
    const max = Math.max(...db.solicitacoes.map(s => parseInt(s.numero.replace(/\D/g,''))||0), 0);
    db.solC = max + 1;
  }

  // Usuários — Sheets é a fonte de verdade; Senha_Hash do Sheets é usada diretamente.
  // Se o usuário mudou a senha pelo app, a versão local tem prioridade.
  const localUsers = JSON.parse(localStorage.getItem('sigvarejo_users') || '[]');
  if (d.usuarios && d.usuarios.length) {
    // Mantém TODOS os usuários (ativos e desativados) — desativar não é excluir.
    // Login continua funcionando normalmente pra quem está ativo.
    db.usuarios = d.usuarios
      .filter(r => r.Login)
      .map(r => {
        const loc = localUsers.find(u => u.login === r.Login);
        // Prioridade: senha alterada no app (localStorage) > Senha_Hash do Sheets > fallback
        const senha = loc ? loc.senha : (r.Senha_Hash || 'mudar123');
        const lojasRaw = normStr(r.Lojas);
        const indexRaw = normStr(r.Indexadores);
        return {
          login: r.Login,
          nome: r.Nome,
          cargo: r.Cargo || '',
          tipo: r.Tipo_Acesso,
          senha,
          ativo: String(r.Ativo).toLowerCase() !== 'nao',
          todasLojas: lojasRaw === '*',
          lojas: (lojasRaw && lojasRaw !== '*') ? lojasRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
          indexadores: indexRaw ? indexRaw.split(',').map(s => s.trim()).filter(Boolean) : []
        };
      });
  } else if (localUsers.length) {
    db.usuarios = localUsers;
  }

  // Ativos (Lojas e Áreas) — substitui completamente pelo Sheets (reflete exclusões)
  if (d.lojas && d.lojas.length) {
    const lojasAtivas = d.lojas.filter(r => r.Ativo !== 'nao');
    db.lojas = lojasAtivas.map(r => normStr(r.Nome)).filter(Boolean);
    db.lojas.sort();
    db.lojasTag = {};
    lojasAtivas.forEach(r => { db.lojasTag[normStr(r.Nome)] = normStr(r.Tag); });
  }
  if (d.areas && d.areas.length) {
    db.areas = d.areas.filter(r => r.Ativo !== 'nao').map(r => ({
      id: normStr(r.ID_Area) || (normStr(r.Loja)+'_'+normStr(r.Nome)).replace(/\s+/g,'_'),
      nome: normStr(r.Nome),
      loja: normStr(r.Loja),
      tag: normStr(r.Tag)
    }));
    db.areas.sort((a,b) => (a.loja+a.nome).localeCompare(b.loja+b.nome));
  }

  // Configurações
  if (d.configuracoes && d.configuracoes.length) {
    d.configuracoes.forEach(r => {
      if (r.Chave) db.configuracoes[r.Chave] = isNaN(r.Valor) ? r.Valor : Number(r.Valor);
    });
  }

  saveDB();
  if (!silent) console.log('[SIGMAN] ✅ Dados carregados do Sheets');
}

// ── localStorage ───────────────────────────────────────────────────────
function saveDB() {
  try {
    localStorage.setItem('sigvarejo_v4', JSON.stringify({
      lojas: db.lojas, lojasTag: db.lojasTag, areas: db.areas,
      ordens: db.ordens, planejadas: db.planejadas,
      solicitacoes: db.solicitacoes,
      osC: db.osC, plC: db.plC, solC: db.solC,
      historico: db.historico,
      configuracoes: db.configuracoes
    }));
  } catch(e) {}
}

function loadDB() {
  try {
    const r = localStorage.getItem('sigvarejo_v4');
    if (r) Object.assign(db, JSON.parse(r));
  } catch(e) {}
}
