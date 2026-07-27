/**
 * SIGMAN VAREJO — sites.js
 * Cadastro de lojas. Sites vem do readAll (não é sensível como Usuarios,
 * pode ficar no boot público).
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
      <thead><tr><th>Código</th><th>Nome</th><th>Status</th></tr></thead>
      <tbody>
        ${sites.map(s => `
          <tr>
            <td>${escapeHtml(s.Codigo)}</td>
            <td>${escapeHtml(s.Nome)}</td>
            <td>${s.Ativo === 'sim' ? '<span class="badge b-con">Ativa</span>' : '<span class="badge">Inativa</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

function abrirNovoSite() {
  sv('ns-codigo', '');
  sv('ns-nome', '');
  openM('m-novo-site');
}

async function salvarNovoSite() {
  const Codigo = v('ns-codigo').trim(), Nome = v('ns-nome').trim();
  if (!Codigo || !Nome) {
    showToast('Preencha Código e Nome.', 'er');
    return;
  }
  const res = await apiPost({ action: 'site_criar', loginAdmin: STATE.sessao.login, Codigo, Nome });
  if (res && res.ok) {
    showToast('Loja cadastrada.', 'ok');
    closeM('m-novo-site');
    // Sites vem do readAll com cache de 3min — força novo boot pra não
    // esperar o TTL vencer e a loja não aparecer na hora.
    localStorage.removeItem('sigman_boot_ts');
    await boot();
  }
}
