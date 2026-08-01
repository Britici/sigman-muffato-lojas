/* ══════════════════════════════════════════════════════════════════
   SIGMAN — USUÁRIOS (aba dedicada, só admin)
   Super Muffato
   ══════════════════════════════════════════════════════════════════ */

var usrSort = { col: 'nome', dir: 'asc' };

function sortUsr(col) {
  if (usrSort.col === col) {
    usrSort.dir = usrSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    usrSort.col = col;
    usrSort.dir = 'asc';
  }
  renderUsuarios();
}

function _usrRoleLabel(t) {
  return (ROLES[t] && ROLES[t].label) || t || '';
}

function _usrRowHtml(u) {
  const podeMexer = CU && CU.tipo === 'administracao';
  const acoes = podeMexer ? `
      <div style="display:flex;gap:6px;flex-wrap:wrap">
       <button class="btn btn-sm btn-gh" onclick="abrirEditarUsuario('${u.login}')">✏️ Editar</button>
       <button class="btn btn-sm btn-gh" onclick="resetarSenhaUsuario('${u.login}')">🔑 Resetar</button>
       ${u.ativo
         ? `<button class="btn btn-sm btn-gh" onclick="toggleAtivoUsuario('${u.login}', false)">🚫 Desativar</button>`
         : `<button class="btn btn-sm btn-p"  onclick="toggleAtivoUsuario('${u.login}', true)">✅ Reativar</button>`}
      </div>` : '—';

  return `
    <tr>
     <td>${u.nome || ''}</td>
     <td>${u.cargo || '–'}</td>
     <td>${u.login}</td>
     <td>${roleBadge(u.tipo)}</td>
     <td>${acoes}</td>
    </tr>`;
}

function renderUsuarios() {
  const tbA = document.getElementById('tb-usr-ativos');
  const tbI = document.getElementById('tb-usr-inativos');
  if (!tbA || !tbI) return;

  const { col, dir } = usrSort;
  const withPerfil = u => ({ ...u, perfil: _usrRoleLabel(u.tipo) });
  const norm = col === 'perfil' ? withPerfil : (u => u);
  const cmp = (a, b) => {
    const va = (a[col] || '').toString().toLowerCase();
    const vb = (b[col] || '').toString().toLowerCase();
    const r = va.localeCompare(vb);
    return dir === 'asc' ? r : -r;
  };

  ['nome', 'cargo', 'login', 'perfil'].forEach(c => {
    const el = document.getElementById('uh-' + c);
    if (!el) return;
    el.classList.remove('asc', 'desc');
    if (c === col) el.classList.add(dir);
  });

  const ativos   = db.usuarios.filter(u => u.ativo !== false).map(norm).sort(cmp);
  const inativos = db.usuarios.filter(u => u.ativo === false).map(norm).sort(cmp);

  document.getElementById('usr-tit-ativos').textContent   = `Usuários Ativos (${ativos.length})`;
  document.getElementById('usr-tit-inativos').textContent = `Usuários Desativados (${inativos.length})`;

  tbA.innerHTML = ativos.length
    ? ativos.map(_usrRowHtml).join('')
    : '<tr><td colspan="5" class="empty" style="padding:20px 0">Nenhum usuário ativo.</td></tr>';

  tbI.innerHTML = inativos.length
    ? inativos.map(_usrRowHtml).join('')
    : '<tr><td colspan="5" class="empty" style="padding:20px 0">Nenhum usuário desativado.</td></tr>';
}

// ══════════════════════════════════════════════════════════════════════
// MODAL: NOVO / EDITAR
// ══════════════════════════════════════════════════════════════════════
function _usrPopulatePerfil() {
  const sel = document.getElementById('usr-perfil');
  sel.innerHTML = Object.keys(ROLES).map(k => `<option value="${k}">${ROLES[k].label}</option>`).join('');
}

// ── Checkbox visual [ ]/[X] — não depende de cor, só de forma/texto ────────
// (padrão pedido pra não depender de percepção de cor em nenhuma tela).
function _toggleChk(el) {
  const marcado = el.dataset.checked === '1';
  el.dataset.checked = marcado ? '0' : '1';
  el.querySelector('.chk-box').textContent = marcado ? '[ ]' : '[X]';
}
function _setChk(el, marcado) {
  el.dataset.checked = marcado ? '1' : '0';
  el.querySelector('.chk-box').textContent = marcado ? '[X]' : '[ ]';
}
function _chkRowHtml(cls, value, label) {
  return `<div class="chk-row ${cls}" data-value="${value}" data-checked="0" onclick="_toggleChk(this)" style="display:flex;align-items:center;gap:8px;padding:3px 2px;cursor:pointer;user-select:none">
    <span class="chk-box" style="font-family:monospace;font-size:15px;min-width:26px">[ ]</span>
    <span>${label}</span>
  </div>`;
}

// Renderiza a lista de lojas. `lojasSelecionadas` = array de nomes já
// marcados; `todas` = true marca o toggle "Todas as lojas" e desabilita a
// lista individual (visualmente esmaecida + clique ignorado).
function _usrPopulateLojas(lojasSelecionadas, todas) {
  const wrap = document.getElementById('usr-lojas-lista');
  const rowTodas = document.getElementById('usr-lojas-todas-row');
  _setChk(rowTodas, !!todas);
  wrap.innerHTML = [...db.lojas].sort().map(l =>
    _chkRowHtml('usr-loja-chk', l, l + (tagDaLoja(l) ? ` <span style="color:var(--txt3);font-size:11px">[${tagDaLoja(l)}]</span>` : ''))
  ).join('') || '<div style="color:var(--txt3);font-size:13px">Nenhuma loja cadastrada.</div>';
  [...wrap.querySelectorAll('.usr-loja-chk')].forEach(row => {
    if ((lojasSelecionadas || []).includes(row.dataset.value)) _setChk(row, true);
  });
  _usrAplicarDisabledLojas();
}

// Indexadores disponíveis = valores distintos de índex já usados em alguma loja.
function _usrPopulateIndexadores(indexSelecionados) {
  const wrap = document.getElementById('usr-index-lista');
  const valores = [...new Set(Object.values(db.lojasTag || {}).filter(Boolean))].sort();
  wrap.innerHTML = valores.length
    ? valores.map(t => _chkRowHtml('usr-index-chk', t, t)).join('')
    : '<div style="color:var(--txt3);font-size:13px">Nenhum índex cadastrado ainda (defina em Ativos → Lojas).</div>';
  [...wrap.querySelectorAll('.usr-index-chk')].forEach(row => {
    if ((indexSelecionados || []).includes(row.dataset.value)) _setChk(row, true);
  });
}

function _usrToggleTodasLojas() {
  const rowTodas = document.getElementById('usr-lojas-todas-row');
  _toggleChk(rowTodas);
  _usrAplicarDisabledLojas();
}

function _usrAplicarDisabledLojas() {
  const todas = document.getElementById('usr-lojas-todas-row').dataset.checked === '1';
  document.querySelectorAll('.usr-loja-chk').forEach(row => {
    row.style.opacity = todas ? '0.4' : '1';
    row.style.pointerEvents = todas ? 'none' : 'auto';
  });
}

// Perfil "administracao" enxerga tudo por definição — os blocos de lojas
// e indexadores não se aplicam e ficam ocultos pra não confundir.
function _usrOnPerfilChange() {
  const perfil = v('usr-perfil');
  const display = perfil === 'administracao' ? 'none' : 'block';
  document.getElementById('usr-lojas-fg').style.display = display;
  document.getElementById('usr-index-fg').style.display = display;
}

function _usrLojasSelecionadas() {
  return [...document.querySelectorAll('.usr-loja-chk')].filter(r => r.dataset.checked === '1').map(r => r.dataset.value);
}

function _usrIndexadoresSelecionados() {
  return [...document.querySelectorAll('.usr-index-chk')].filter(r => r.dataset.checked === '1').map(r => r.dataset.value);
}

function abrirNovoUsuario() {
  _usrPopulatePerfil();
  document.getElementById('usr-m-t').textContent = 'Novo Usuário';
  document.getElementById('usr-login-orig').value = '';
  document.getElementById('usr-nome').value = '';
  document.getElementById('usr-cargo').value = '';
  document.getElementById('usr-login').value = '';
  document.getElementById('usr-login').disabled = false;
  document.getElementById('usr-perfil').value = 'manutencao';
  document.getElementById('usr-senha-info').style.display = 'block';
  _usrPopulateLojas([], false);
  _usrPopulateIndexadores([]);
  _usrOnPerfilChange();
  openM('m-usr');
}

function abrirEditarUsuario(login) {
  const u = db.usuarios.find(x => x.login === login);
  if (!u) return;
  _usrPopulatePerfil();
  document.getElementById('usr-m-t').textContent = 'Editar Usuário';
  document.getElementById('usr-login-orig').value = u.login;
  document.getElementById('usr-nome').value = u.nome || '';
  document.getElementById('usr-cargo').value = u.cargo || '';
  document.getElementById('usr-login').value = u.login;
  document.getElementById('usr-login').disabled = true; // login é a chave — não muda por aqui
  document.getElementById('usr-perfil').value = u.tipo;
  document.getElementById('usr-senha-info').style.display = 'none';
  _usrPopulateLojas(u.lojas || [], !!u.todasLojas);
  _usrPopulateIndexadores(u.indexadores || []);
  _usrOnPerfilChange();
  openM('m-usr');
}

async function salvarUsuario() {
  const origLogin = v('usr-login-orig');
  const nome   = v('usr-nome').trim();
  const cargo  = v('usr-cargo').trim();
  const login  = v('usr-login').trim().toLowerCase();
  const perfil = v('usr-perfil');
  const isNovo = !origLogin;

  if (!nome || !login) { showAlert('al-usr', 'Nome e Login são obrigatórios.', 'err'); return; }

  // Administração sempre tem acesso total — não depende do que está marcado
  // nos blocos de lojas/indexadores (que ficam ocultos pra esse perfil).
  const todasLojas = perfil === 'administracao' || document.getElementById('usr-lojas-todas-row').dataset.checked === '1';
  const lojasSel   = todasLojas ? [] : _usrLojasSelecionadas();
  const indexSel   = todasLojas ? [] : _usrIndexadoresSelecionados();
  if (!todasLojas && !lojasSel.length && !indexSel.length) {
    showAlert('al-usr', 'Selecione ao menos 1 loja ou 1 indexador, ou marque "Todas as lojas".', 'err'); return;
  }
  const lojasStr = todasLojas ? '*' : lojasSel.join(',');
  const indexStr = todasLojas ? '' : indexSel.join(',');

  if (isNovo) {
    const existe = db.usuarios.some(u => u.login.toLowerCase() === login);
    if (existe) { showAlert('al-usr', 'Já existe um usuário com esse login.', 'err'); return; }

    const res = await apiAppend('usuarios', {
      Login: login, Nome: nome, Cargo: cargo, Tipo_Acesso: perfil, Lojas: lojasStr, Indexadores: indexStr,
      Senha_Hash: 'mudar123', Ativo: 'sim', Criado_Em: new Date().toISOString()
    });
    if (!res || !res.ok) { showAlert('al-usr', 'Erro ao criar usuário: ' + (res && res.error || 'sem conexão'), 'err'); return; }
    db.usuarios.push({ login, nome, cargo, tipo: perfil, senha: 'mudar123', ativo: true, todasLojas, lojas: lojasSel, indexadores: indexSel });
    showAlert('al-usr', 'Usuário criado. Senha inicial: mudar123', 'ok');
  } else {
    const res = await apiUpdate('usuarios', origLogin, 'Login', { Nome: nome, Cargo: cargo, Tipo_Acesso: perfil, Lojas: lojasStr, Indexadores: indexStr });
    if (!res || !res.ok) { showAlert('al-usr', 'Erro ao salvar: ' + (res && res.error || 'sem conexão'), 'err'); return; }
    const u = db.usuarios.find(x => x.login === origLogin);
    if (u) { u.nome = nome; u.cargo = cargo; u.tipo = perfil; u.todasLojas = todasLojas; u.lojas = lojasSel; u.indexadores = indexSel; }
    showAlert('al-usr', 'Usuário atualizado.', 'ok');
  }

  closeM('m-usr');
  renderUsuarios();
}

// ══════════════════════════════════════════════════════════════════════
// RESETAR SENHA / ATIVAR / DESATIVAR
// ══════════════════════════════════════════════════════════════════════
async function resetarSenhaUsuario(login) {
  if (!confirm(`Resetar a senha de "${login}" para mudar123?`)) return;
  const res = await apiUpdate('usuarios', login, 'Login', { Senha_Hash: 'mudar123' });
  if (!res || !res.ok) { showAlert('al-usr', 'Erro ao resetar senha: ' + (res && res.error || 'sem conexão'), 'err'); return; }
  const u = db.usuarios.find(x => x.login === login);
  if (u) u.senha = 'mudar123';
  showAlert('al-usr', `Senha de ${login} resetada para mudar123.`, 'ok');
  renderUsuarios();
}

async function toggleAtivoUsuario(login, ativar) {
  if (!ativar && CU && CU.login === login) {
    showAlert('al-usr', 'Você não pode desativar o próprio usuário.', 'err');
    return;
  }
  const msg = ativar
    ? `Reativar o acesso de "${login}"?`
    : `Desativar o acesso de "${login}"? O usuário não poderá mais entrar no sistema (o cadastro não é excluído).`;
  if (!confirm(msg)) return;

  const res = await apiUpdate('usuarios', login, 'Login', { Ativo: ativar ? 'sim' : 'nao' });
  if (!res || !res.ok) { showAlert('al-usr', 'Erro ao atualizar status: ' + (res && res.error || 'sem conexão'), 'err'); return; }
  const u = db.usuarios.find(x => x.login === login);
  if (u) u.ativo = ativar;
  showAlert('al-usr', ativar ? 'Usuário reativado.' : 'Usuário desativado.', 'ok');
  renderUsuarios();
}
