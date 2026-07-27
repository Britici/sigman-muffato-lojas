/**
 * SIGMAN VAREJO — usuarios.js
 * CRUD de usuários (admin) + fluxo de troca de senha obrigatória no
 * primeiro login com a senha padrão de reset ('mudar123').
 */

// Entry point chamado pelo roteador (ui-shell.js). Sempre busca dados
// frescos — mesmo padrão de renderDashboard/renderFilaChamados em
// dashboard.js/chamados.js. NÃO decide com base em STATE.usuarios.length:
// isso já causou um loop infinito real quando a lista vinha vazia
// (carregarUsuarios chamava renderUsuarios, que via array vazio e
// chamava carregarUsuarios de novo, indefinidamente).
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
      <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Sites</th><th>Cargo</th><th></th></tr></thead>
      <tbody>
        ${STATE.usuarios.map(u => `
          <tr>
            <td>${escapeHtml(u.Nome)}</td>
            <td>${escapeHtml(u.Login)}</td>
            <td>${roleBadge(u.Tipo)}</td>
            <td>${escapeHtml(u.Sites || '—')}</td>
            <td>${escapeHtml(u.Cargo || '—')}</td>
            <td>
              <button class="btn btn-sm btn-gh" onclick="resetarSenhaUsuario('${u.Login}')">Resetar senha</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

function abrirNovoUsuario() {
  ['nu-login', 'nu-nome', 'nu-tipo', 'nu-sites', 'nu-cargo'].forEach(id => sv(id, ''));
  openM('m-novo-usuario');
}

async function salvarNovoUsuario() {
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

  const res = await apiPost({
    action: 'usuario_criar',
    loginAdmin: STATE.sessao.login,
    Login, Nome, Tipo, Sites, Cargo
  });
  if (res && res.ok) {
    showToast(`Usuário criado. Senha inicial: mudar123`, 'ok');
    closeM('m-novo-usuario');
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
  // antes de liberar o resto do app (ver core.js: login() não chama boot()
  // quando precisaTrocarSenha é true).
}

async function confirmarTrocaSenhaObrigatoria() {
  const nova = v('tso-nova'), confirma = v('tso-confirma');
  if (!nova || nova.length < 4) {
    showToast('Senha muito curta.', 'er');
    return;
  }
  if (nova !== confirma) {
    showToast('As senhas não conferem.', 'er');
    return;
  }
  if (nova === 'mudar123') {
    showToast('Escolha uma senha diferente da padrão.', 'er');
    return;
  }
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
