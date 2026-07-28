/**
 * SIGMAN VAREJO — core.js
 * Base de API, sessão e boot. Mesmo padrão do SIGMAN industrial:
 * apiPost nunca rejeita a Promise; sempre checar res && res.ok.
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwrc-9m92rJSIN-Mi-_4tV6yqgG5jXO6Hs9EVT_w9z3ow3FwxjZW7VEkCFKG6cs9WH9/exec';
const CACHE_TTL_MS = 3 * 60 * 1000;
const SESSION_REVALIDATE_MS = 3 * 60 * 1000;

const ROLES = {
  admin:        { label: 'Administração', menus: ['dashboard', 'fila-chamados', 'planejadas', 'sites', 'usuarios'] },
  gerente_loja: { label: 'Gerente de Loja', menus: ['solicitacao', 'minhas-solicitacoes'] },
  manutentor:   { label: 'Manutenção',      menus: ['fila-chamados', 'planejadas'] }
};

const STATE = {
  sessao: null,     // { login, nome, tipo, cargo, sites, menus }
  boot: null,        // resultado do readAll (Sites) — NUNCA inclui Usuarios
  chamados: [],       // carregado sob demanda (lazy)
  usuarios: [],        // carregado sob demanda (lazy), admin-only, sem senha
  planejadas: []        // carregado sob demanda (lazy)
};

// ============================================================
// API — leitura
// ============================================================
async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_URL}?${qs}`);
    return await res.json();
  } catch (err) {
    console.error('apiGet falhou', err);
    return null;
  }
}

// ============================================================
// API — escrita. NUNCA rejeita a Promise. Falha de rede resolve
// com null e enfileira em localStorage para reenvio.
// ============================================================
async function apiPost(body) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!(json && json.ok)) {
      // Falha lógica (validação, permissão) — não reenfileira, é definitiva.
      showToast(json && json.error ? json.error : 'Erro ao salvar', 'er');
    }
    return json;
  } catch (err) {
    enfileirar(body);
    showToast('Sem conexão — operação será reenviada', 'war');
    return null;
  }
}

function enfileirar(body) {
  const fila = JSON.parse(localStorage.getItem('sigman_fila') || '[]');
  fila.push({ body, ts: Date.now() });
  localStorage.setItem('sigman_fila', JSON.stringify(fila));
}

async function reenviarFila() {
  const fila = JSON.parse(localStorage.getItem('sigman_fila') || '[]');
  if (!fila.length) return;
  const restante = [];
  for (const item of fila) {
    const res = await apiPost(item.body);
    if (!(res && res.ok)) restante.push(item); // mantém na fila se falhar de novo
  }
  localStorage.setItem('sigman_fila', JSON.stringify(restante));
  if (restante.length < fila.length) {
    renderChamados();
  }
}

window.addEventListener('online', reenviarFila);

// ============================================================
// SESSÃO
// ============================================================
async function login(loginStr, senha) {
  const res = await apiGet({ action: 'login', login: loginStr, senha });
  if (!(res && res.ok)) {
    lAlert((res && res.error) || 'Usuário ou senha incorretos.');
    return false;
  }
  STATE.sessao = res.usuario;
  localStorage.setItem('sigman_sess', JSON.stringify(res.usuario));

  if (res.usuario.precisaTrocarSenha) {
    abrirModalTrocaSenhaObrigatoria();
    return true; // sessão criada, mas UI deve travar até trocar senha
  }

  await boot();
  return true;
}

// Ao reabrir o app: entra direto com a sessão em cache (rápido) e
// revalida contra a planilha em seguida e a cada 3 min.
async function bootSessao() {
  loadTheme();
  const cached = localStorage.getItem('sigman_sess');
  if (!cached) {
    mostrarTelaLogin();
    return;
  }
  STATE.sessao = JSON.parse(cached);
  await boot();
  revalidarSessao();
  setInterval(revalidarSessao, SESSION_REVALIDATE_MS);
}

async function revalidarSessao() {
  if (!STATE.sessao) return;
  const res = await apiGet({ action: 'revalidarSessao', login: STATE.sessao.login });
  if (!(res && res.ok && res.ativo)) {
    logout();
    showToast('Sessão encerrada — usuário desativado ou inválido', 'er');
    return;
  }
  // Atualiza sites/tipo caso admin tenha alterado o vínculo do usuário
  // enquanto a sessão estava aberta.
  STATE.sessao.sites = res.sites;
  STATE.sessao.tipo = res.tipo;
  localStorage.setItem('sigman_sess', JSON.stringify(STATE.sessao));
}

function logout() {
  STATE.sessao = null;
  localStorage.removeItem('sigman_sess');
  mostrarTelaLogin();
}

// ============================================================
// BOOT — readAll com cache TTL
// ============================================================
async function boot() {
  const cacheTs = Number(localStorage.getItem('sigman_boot_ts') || 0);
  const cacheData = localStorage.getItem('sigman_boot_data');
  const dentroDoTTL = cacheData && (Date.now() - cacheTs) < CACHE_TTL_MS;

  if (dentroDoTTL) {
    STATE.boot = JSON.parse(cacheData);
  } else {
    const res = await apiGet({ action: 'readAll' });
    if (res && res.ok) {
      STATE.boot = res.data;
      localStorage.setItem('sigman_boot_data', JSON.stringify(res.data));
      localStorage.setItem('sigman_boot_ts', String(Date.now()));
    } else {
      showToast('Falha ao carregar dados iniciais', 'er');
      return;
    }
  }
  renderShell();
  roteador();
}

// ============================================================
// CHAMADOS — lazy load (fora do readAll), filtro por site é feito
// no SERVIDOR (ver Code.gs), aqui só exibimos o que veio.
// ============================================================
async function carregarChamados() {
  const res = await apiGet({ action: 'chamados_list', login: STATE.sessao.login });
  if (res && res.ok) {
    STATE.chamados = res.chamados;
  } else {
    showToast('Falha ao carregar chamados', 'er');
  }
  renderChamados();
}

// carregarUsuarios() mora em usuarios.js — é lógica de negócio do módulo
// de usuários, não pertence ao core genérico (mesmo padrão de
// carregarChamados ficar em core.js só porque chamados.js reusa muito
// dele; usuarios.js já tinha peso próprio suficiente pra hospedar a sua).

// ============================================================
// ROTEAMENTO — filtra por menus liberados no perfil
// ============================================================
function roteador() {
  const hash = location.hash.replace('#', '') || primeiraPaginaPermitida();
  if (STATE.sessao.menus.indexOf(hash) === -1) {
    location.hash = primeiraPaginaPermitida();
    return;
  }
  mostrarPagina(hash);
}

function primeiraPaginaPermitida() {
  return STATE.sessao.menus[0] || 'sem-acesso';
}

window.addEventListener('hashchange', roteador);
window.addEventListener('DOMContentLoaded', bootSessao);
