/**
 * SIGMAN VAREJO — ui-shell.js
 * Menu lateral + troca de página visível. Estrutura de classes idêntica
 * ao SIGMAN industrial: #app, .sb (sidebar), .nv-item (item de menu,
 * classe .act quando ativo), .main/.tb/.cont (área de conteúdo), .pg/.on
 * (página visível). Roteamento de fato (hash, checagem de permissão)
 * fica em core.js — aqui só é responsabilidade de DOM.
 */

const LABELS_MENU = {
  dashboard: 'Dashboard',
  'fila-chamados': 'Fila de Chamados',
  sites: 'Lojas',
  usuarios: 'Usuários',
  solicitacao: 'Nova Solicitação',
  'minhas-solicitacoes': 'Minhas Solicitações'
};

const RENDER_POR_PAGINA = {
  dashboard: renderDashboard,
  'fila-chamados': renderFilaChamados,
  sites: renderSites,
  usuarios: renderUsuarios,
  solicitacao: renderSolicitacao,
  'minhas-solicitacoes': renderMinhasSolicitacoes
};

function renderShell() {
  document.getElementById('app').classList.add('on');
  document.getElementById('login-screen').style.display = 'none';

  document.getElementById('u-nm').textContent = STATE.sessao.nome;
  document.getElementById('u-rl').textContent = (ROLES[STATE.sessao.tipo] && ROLES[STATE.sessao.tipo].label) || STATE.sessao.tipo;
  document.getElementById('u-av').textContent = (STATE.sessao.nome || '?').charAt(0).toUpperCase();

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

  const renderFn = RENDER_POR_PAGINA[hash];
  if (renderFn) renderFn();
}

function mostrarTelaLogin() {
  document.getElementById('app').classList.remove('on');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('loading-screen').style.display = 'none';
}

async function tentarLogin() {
  const loginStr = v('lg-login').trim(), senha = v('lg-senha');
  if (!loginStr || !senha) {
    showAlert('al-login', 'Preencha login e senha.', 'er');
    return;
  }
  const ok = await login(loginStr, senha);
  if (!ok) return; // login() já mostrou o toast de erro
}

function fazerLogout() {
  logout();
}
