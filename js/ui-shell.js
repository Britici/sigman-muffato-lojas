/**
 * SIGMAN VAREJO — ui-shell.js
 * Menu lateral + troca de página visível + tema + colapso de sidebar.
 * Estrutura de classes e ids IDÊNTICOS ao SIGMAN industrial (Muffato)
 * de propósito — mesmo tema visual, só o conteúdo de negócio muda.
 */

const LABELS_MENU = {
  dashboard: 'Dashboard',
  'fila-chamados': 'Fila de Chamados',
  sites: 'Lojas',
  usuarios: 'Usuários',
  solicitacao: 'Nova Solicitação',
  'minhas-solicitacoes': 'Minhas Solicitações'
};

// Resolvidos pelo NOME (string) e não pela referência direta à função —
// de propósito: mostrarPagina só chama isso depois que todos os <script>
// carregaram, então não importa a ordem dos <script src="..."> no HTML
// (bug real que já apareceu aqui: "renderDashboard is not defined").
const RENDER_POR_PAGINA = {
  dashboard: 'renderDashboard',
  'fila-chamados': 'renderFilaChamados',
  sites: 'renderSites',
  usuarios: 'renderUsuarios',
  solicitacao: 'renderSolicitacao',
  'minhas-solicitacoes': 'renderMinhasSolicitacoes'
};

function renderShell() {
  document.getElementById('app').classList.add('on');
  document.getElementById('login-screen').style.display = 'none';

  const iniciais = (STATE.sessao.nome || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('u-av').textContent = iniciais;
  document.getElementById('u-nm').textContent = STATE.sessao.nome;
  document.getElementById('u-rl').textContent = (ROLES[STATE.sessao.tipo] && ROLES[STATE.sessao.tipo].label) || STATE.sessao.tipo;

  const nav = document.getElementById('sb-nav');
  nav.innerHTML = STATE.sessao.menus.map(m =>
    `<a href="#${m}" class="nv-item" data-label="${LABELS_MENU[m] || m}">
       <span class="nv-lbl">${LABELS_MENU[m] || m}</span>
     </a>`
  ).join('');
}

function mostrarPagina(hash) {
  document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.nv-item').forEach(el =>
    el.classList.toggle('act', el.getAttribute('href') === '#' + hash)
  );
  const pg = document.getElementById('pg-' + hash);
  if (!pg) { console.warn('Página não implementada:', hash); return; }
  pg.classList.add('on');
  document.getElementById('tb-t').textContent = LABELS_MENU[hash] || 'SIGMAN Varejo';

  const nomeFn = RENDER_POR_PAGINA[hash];
  if (nomeFn && typeof window[nomeFn] === 'function') window[nomeFn]();

  closeSB(); // no mobile, trocar de página fecha o menu lateral
}

function mostrarTelaLogin() {
  document.getElementById('app').classList.remove('on');
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('lf-login').style.display = 'block';
}

async function tentarLogin() {
  const loginStr = v('l-u').trim(), senha = v('l-p').trim();
  if (!loginStr || !senha) { lAlert('Preencha usuário e senha.'); return; }
  const ok = await login(loginStr, senha);
  if (!ok) return; // login() já mostrou o erro via lAlert
}

function fazerLogout() {
  logout();
}

// ── ALERT DA TELA DE LOGIN ── (componente próprio, .lalert — igual ao
// industrial, propositalmente diferente de showAlert()/.alert usados no
// resto do app, que é a tela de dentro do sistema)
function lAlert(msg, tipo = 'err') {
  const el = document.getElementById('l-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = 'lalert ' + tipo + ' show';
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── SIDEBAR COLAPSÁVEL / MOBILE ──
function toggleSB() {
  const sb = document.getElementById('sb');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mob');
    document.getElementById('sb-ov').style.display = sb.classList.contains('mob') ? 'block' : 'none';
  } else {
    sb.classList.toggle('col');
  }
}
function closeSB() {
  const sb = document.getElementById('sb');
  if (sb) sb.classList.remove('mob');
  const ov = document.getElementById('sb-ov');
  if (ov) ov.style.display = 'none';
}

// ── TEMA CLARO/ESCURO ──
function toggleTheme() {
  const h = document.documentElement;
  const escuro = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', escuro ? 'light' : 'dark');
  document.getElementById('th-btn').textContent = escuro ? '☀️' : '🌙';
  localStorage.setItem('sigman_theme', escuro ? 'light' : 'dark');
}
function loadTheme() {
  const t = localStorage.getItem('sigman_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const b = document.getElementById('th-btn');
  if (b) b.textContent = t === 'dark' ? '🌙' : '☀️';
}
