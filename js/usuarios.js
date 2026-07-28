/**
 * SIGMAN VAREJO — usuarios.js
 * CRUD de usuários (admin): criar, editar, resetar senha, ativar/desativar.
 * + fluxo de troca de senha obrigatória no primeiro login (mudar123).
 */

// Entry point chamado pelo roteador. Sempre busca dados frescos — NÃO
// decide com base em STATE.usuarios.length (já causou loop infinito real
// quando a lista vinha vazia: ver comentário em carregarUsuarios/core.js).
async function renderUsuarios() {
  await carregarUsuarios();
}

function _renderUsuariosList() {
  const pg = document.getElementById('pg-usuarios');
  if (!pg) return;

  pg.innerHTML = `
    <div class="ph">
      <div class="pt">Usuários</div>
      <button class="btn btn-p btn-sm" onclick="abrirNovoUsuario()">+ Novo Usuário</button>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Sites</th><th>Cargo</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${STATE.usuarios.map(u => `
          <tr>
            <td>${escapeHtml(u.Nome)}</td>
            <td>${escapeHtml(u.Login)}</td>
            <td>${roleBadge(u.Tipo)}</td>
            <td>${escapeHtml(u.Sites || '—')}</td>
            <td>${escapeHtml(u.Cargo || '—')}</td>
            <td>${u.Ativo === 'sim' ? '<span class="badge b-con">Ativo</span>' : '<span class="badge">Inativo</span>'}</td>
            <td style="white-space:nowrap;display:flex;gap:6px">
              <button class="btn btn-sm btn-gh" onclick="abrirEditarUsuario('${escapeHtml(u.Login)}')">Editar</button>
              <button class="btn btn-sm btn-gh" onclick="resetarSenhaUsuario('${u.Login}')">Resetar senha</button>
              ${u.Login !== STATE.sessao.login ? `
                <button class="btn btn-sm btn-gh" onclick="alternarAtivoUsuario('${u.Login}', '${u.Ativo === 'sim' ? 'nao' : 'sim'}')">
                  ${u.Ativo === 'sim' ? 'Desativar' : 'Ativar'}
                </button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

// ── CRIAR ──
function abrirNovoUsuario() {
  document.getElementById('mu-titulo').textContent = 'Novo Usuário';
  document.getElementById('mu-login-field').style.display = 'block'; // login só é editável na criação
  sv('nu-login', ''); sv('nu-nome', ''); sv('nu-tipo', ''); sv('nu-sites', ''); sv('nu-cargo', '');
  document.getElementById('m-novo-usuario').dataset.modo = 'criar';
  openM('m-novo-usuario');
}

// ── EDITAR ── (recebe o objeto usuário já carregado, sem precisar de
// outro round-trip ao servidor)
function abrirEditarUsuario(loginAlvo) {
  const u = STATE.usuarios.find(x => x.Login === loginAlvo);
  if (!u) { showToast('Usuário não encontrado na lista carregada.', 'er'); return; }
  document.getElementById('mu-titulo').textContent = `Editar ${u.Nome}`;
  document.getElementById('mu-login-field').style.display = 'none'; // login não muda depois de criado
  sv('nu-login', u.Login); sv('nu-nome', u.Nome); sv('nu-tipo', u.Tipo);
  sv('nu-sites', u.Sites || ''); sv('nu-cargo', u.Cargo || '');
  document.getElementById('m-novo-usuario').dataset.modo = 'editar';
  openM('m-novo-usuario');
}

// Botão único do modal decide entre criar/editar pelo dataset.modo —
// evita duplicar o formulário inteiro só pra trocar a ação de destino.
async function salvarUsuario() {
  const modo = document.getElementById('m-novo-usuario').dataset.modo;
  const Login = v('nu-login').trim(), Nome = v('nu-nome').trim(),
        Tipo = v('nu-tipo'), Sites = v('nu-sites').trim(), Cargo = v('nu-cargo').trim();

  if (!Login || !Nome || !Tipo) {
    showToast('Preencha Login, Nome e Perfil.', 'er');
    return;
  }
  if (Tipo === 'gerente_loja' && !Sites) {
    showToast('Gerente de loja precisa de ao menos um Site (ex: 1004 ou 1004,1017).', 'er');
    return;
  }

  const body = modo === 'editar'
    ? { action: 'usuario_editar', loginAdmin: STATE.sessao.login, Login, Nome, Tipo, Sites, Cargo }
    : { action: 'usuario_criar', loginAdmin: STATE.sessao.login, Login, Nome, Tipo, Sites, Cargo };

  const res = await apiPost(body);
  if (res && res.ok) {
    showToast(modo === 'editar' ? 'Usuário atualizado.' : 'Usuário criado. Senha inicial: mudar123', 'ok');
    closeM('m-novo-usuario');
    await carregarUsuarios();
  }
}

async function alternarAtivoUsuario(loginAlvo, novoStatus) {
  const acao = novoStatus === 'nao' ? 'desativar' : 'ativar';
  if (!confirm(`Confirma ${acao} o usuário ${loginAlvo}?`)) return;
  const res = await apiPost({
    action: 'usuario_editar',
    loginAdmin: STATE.sessao.login,
    Login: loginAlvo,
    Ativo: novoStatus
  });
  if (res && res.ok) {
    showToast(`Usuário ${novoStatus === 'nao' ? 'desativado' : 'ativado'}.`, 'ok');
    await carregarUsuarios();
  }
}

async function resetarSenhaUsuario(loginAlvo) {
  if (!confirm(`Resetar a senha de ${loginAlvo} para 'mudar123'?`)) return;
  const res = await apiPost({
    action: 'usuario_reset_senha',
    loginAdmin: STATE.sessao.login,
    loginAlvo
  });
  if (res && res.ok) {
    showToast('Senha resetada para mudar123.', 'ok');
  }
}

// ============================================================
// TROCA DE SENHA OBRIGATÓRIA (primeiro login com mudar123)
// ============================================================
function abrirModalTrocaSenhaObrigatoria() {
  sv('tso-nova', '');
  sv('tso-confirma', '');
  openM('m-troca-senha-obrigatoria');
  // Este modal não tem botão de fechar/ESC — trocar a senha é obrigatório
  // antes de liberar o resto do app (ver modais-helpers.js: MODAIS_NAO_FECHAVEIS).
}

async function confirmarTrocaSenhaObrigatoria() {
  const nova = v('tso-nova'), confirma = v('tso-confirma');
  if (!nova || nova.length < 4) { showToast('Senha muito curta.', 'er'); return; }
  if (nova !== confirma) { showToast('As senhas não conferem.', 'er'); return; }
  if (nova === 'mudar123') { showToast('Escolha uma senha diferente da padrão.', 'er'); return; }

  const res = await apiPost({
    action: 'usuario_trocar_senha',
    login: STATE.sessao.login,
    senhaAtual: 'mudar123',
    senhaNova: nova
  });
  if (res && res.ok) {
    showToast('Senha atualizada!', 'ok');
    closeM('m-troca-senha-obrigatoria');
    STATE.sessao.precisaTrocarSenha = false;
    localStorage.setItem('sigman_sess', JSON.stringify(STATE.sessao));
    await boot();
  } else {
    showToast((res && res.error) || 'Erro ao trocar senha.', 'er');
  }
}

async function carregarUsuarios() {
  const res = await apiGet({ action: 'usuarios_list', login: STATE.sessao.login });
  if (res && res.ok) {
    STATE.usuarios = res.usuarios;
  } else {
    showToast((res && res.error) || 'Falha ao carregar usuários', 'er');
  }
  _renderUsuariosList();
}
