/**
 * SIGMAN VAREJO — sites.js
 * Cadastro de lojas: criar, editar nome, ativar/desativar.
 * Sites vem do readAll (não é sensível como Usuarios, pode ficar no
 * boot público).
 */

function renderSites() {
  const pg = document.getElementById('pg-sites');
  if (!pg) return;
  const sites = (STATE.boot && STATE.boot.Sites) || [];

  pg.innerHTML = `
    <div class="ph">
      <div class="pt">Lojas</div>
      <button class="btn btn-p btn-sm" onclick="abrirNovoSite()">+ Nova Loja</button>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Código</th><th>Nome</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${sites.map(s => `
          <tr>
            <td>${escapeHtml(s.Codigo)}</td>
            <td>${escapeHtml(s.Nome)}</td>
            <td>${s.Ativo === 'sim' ? '<span class="badge b-con">Ativa</span>' : '<span class="badge">Inativa</span>'}</td>
            <td style="white-space:nowrap;display:flex;gap:6px">
              <button class="btn btn-sm btn-gh" onclick="abrirEditarSite('${escapeHtml(s.Codigo)}')">Editar</button>
              <button class="btn btn-sm btn-gh" onclick="alternarAtivoSite('${escapeHtml(s.Codigo)}', '${s.Ativo === 'sim' ? 'nao' : 'sim'}')">
                ${s.Ativo === 'sim' ? 'Desativar' : 'Ativar'}
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

function abrirNovoSite() {
  document.getElementById('ms-titulo').textContent = 'Nova Loja';
  document.getElementById('ns-codigo').disabled = false;
  sv('ns-codigo', ''); sv('ns-nome', '');
  document.getElementById('m-novo-site').dataset.modo = 'criar';
  openM('m-novo-site');
}

function abrirEditarSite(codigo) {
  const s = ((STATE.boot && STATE.boot.Sites) || []).find(x => String(x.Codigo) === String(codigo));
  if (!s) { showToast('Loja não encontrada.', 'er'); return; }
  document.getElementById('ms-titulo').textContent = `Editar ${s.Nome}`;
  sv('ns-codigo', s.Codigo);
  document.getElementById('ns-codigo').disabled = true; // código é a chave, não muda depois de criado
  sv('ns-nome', s.Nome);
  document.getElementById('m-novo-site').dataset.modo = 'editar';
  openM('m-novo-site');
}

async function salvarSite() {
  const modo = document.getElementById('m-novo-site').dataset.modo;
  const Codigo = v('ns-codigo').trim(), Nome = v('ns-nome').trim();
  if (!Codigo || !Nome) { showToast('Preencha Código e Nome.', 'er'); return; }

  const body = modo === 'editar'
    ? { action: 'site_editar', loginAdmin: STATE.sessao.login, Codigo, Nome }
    : { action: 'site_criar', loginAdmin: STATE.sessao.login, Codigo, Nome };

  const res = await apiPost(body);
  if (res && res.ok) {
    showToast(modo === 'editar' ? 'Loja atualizada.' : 'Loja cadastrada.', 'ok');
    closeM('m-novo-site');
    localStorage.removeItem('sigman_boot_ts'); // força recarregar Sites no boot
    await boot();
  }
}

async function alternarAtivoSite(codigo, novoStatus) {
  const acao = novoStatus === 'nao' ? 'desativar' : 'ativar';
  if (!confirm(`Confirma ${acao} a loja ${codigo}?`)) return;
  const res = await apiPost({ action: 'site_editar', loginAdmin: STATE.sessao.login, Codigo: codigo, Ativo: novoStatus });
  if (res && res.ok) {
    showToast(`Loja ${novoStatus === 'nao' ? 'desativada' : 'ativada'}.`, 'ok');
    localStorage.removeItem('sigman_boot_ts');
    await boot();
  }
}
