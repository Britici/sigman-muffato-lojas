/**
 * SIGMAN VAREJO — planejadas.js
 * Cadastro de manutenção preventiva (PCM), padrão do industrial: admin
 * cria um plano por loja/área com periodicidade; manutentor e admin veem
 * a lista como checklist. Neste MVP não há geração automática de O.S. na
 * data prevista (ficaria pra uma segunda etapa com um trigger de tempo
 * no Apps Script) — é cadastro + visibilidade, servindo de lembrete.
 */

async function renderPlanejadas() {
  await carregarPlanejadas();
}

function _renderPlanejadasList() {
  const pg = document.getElementById('pg-planejadas');
  if (!pg) return;
  const lista = STATE.planejadas.slice().sort((a, b) => (a.Proxima_Data || '').localeCompare(b.Proxima_Data || ''));
  const ehAdmin = STATE.sessao.tipo === 'admin';

  const hoje = today();
  pg.innerHTML = `
    <div class="ph">
      <div class="pt">Planejadas (PCM)</div>
      ${ehAdmin ? '<button class="btn btn-p btn-sm" onclick="abrirNovaPlanejada()">+ Nova Planejada</button>' : ''}
    </div>
    ${lista.length === 0 ? '<div class="empty"><div class="ei">🗓️</div><p>Nenhuma manutenção planejada cadastrada.</p></div>' : `
    <div class="tw"><table>
      <thead><tr><th>Próxima Data</th><th>Site</th><th>Área</th><th>Tipo</th><th>Descrição</th><th>Periodicidade</th>${ehAdmin ? '<th></th>' : ''}</tr></thead>
      <tbody>
        ${lista.map(p => `
          <tr style="${p.Proxima_Data && p.Proxima_Data < hoje ? 'color:#ff4d65' : ''}">
            <td>${escapeHtml(p.Proxima_Data || '—')}</td>
            <td>${nomeSite(p.Site)}</td>
            <td>${escapeHtml(p.Area)}</td>
            <td>${escapeHtml(p.Tipo)}</td>
            <td>${escapeHtml(p.Descricao)}</td>
            <td>${escapeHtml(p.Periodicidade)}</td>
            ${ehAdmin ? `<td><button class="btn btn-sm btn-gh" onclick="abrirEditarPlanejada('${escapeHtml(p.ID)}')">Editar</button></td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table></div>`}
  `;
}

function abrirNovaPlanejada() {
  document.getElementById('mp-titulo').textContent = 'Nova Planejada';
  const sites = (STATE.boot && STATE.boot.Sites) || [];
  document.getElementById('pl-site').innerHTML = '<option value="">Selecione...</option>' +
    sites.map(s => `<option value="${s.Codigo}">${s.Codigo} - ${s.Nome}</option>`).join('');
  sv('pl-area', ''); sv('pl-tipo', ''); sv('pl-descricao', '');
  sv('pl-periodicidade', ''); sv('pl-data', today());
  document.getElementById('m-nova-planejada').dataset.modo = 'criar';
  document.getElementById('m-nova-planejada').dataset.id = '';
  openM('m-nova-planejada');
}

function abrirEditarPlanejada(id) {
  const p = STATE.planejadas.find(x => x.ID === id);
  if (!p) { showToast('Planejada não encontrada.', 'er'); return; }
  document.getElementById('mp-titulo').textContent = 'Editar Planejada';
  const sites = (STATE.boot && STATE.boot.Sites) || [];
  document.getElementById('pl-site').innerHTML = sites.map(s =>
    `<option value="${s.Codigo}" ${s.Codigo == p.Site ? 'selected' : ''}>${s.Codigo} - ${s.Nome}</option>`
  ).join('');
  sv('pl-area', p.Area); sv('pl-tipo', p.Tipo); sv('pl-descricao', p.Descricao);
  sv('pl-periodicidade', p.Periodicidade); sv('pl-data', p.Proxima_Data);
  document.getElementById('m-nova-planejada').dataset.modo = 'editar';
  document.getElementById('m-nova-planejada').dataset.id = id;
  openM('m-nova-planejada');
}

async function salvarPlanejada() {
  const modal = document.getElementById('m-nova-planejada');
  const modo = modal.dataset.modo;
  const Site = v('pl-site'), Area = v('pl-area').trim(), Tipo = v('pl-tipo').trim(),
        Descricao = v('pl-descricao').trim(), Periodicidade = v('pl-periodicidade'),
        Proxima_Data = v('pl-data');

  if (!Site || !Area || !Tipo || !Descricao || !Periodicidade || !Proxima_Data) {
    showToast('Preencha todos os campos.', 'er');
    return;
  }

  const body = modo === 'editar'
    ? { action: 'planejada_editar', login: STATE.sessao.login, ID: modal.dataset.id, Site, Area, Tipo, Descricao, Periodicidade, Proxima_Data }
    : { action: 'planejada_criar', login: STATE.sessao.login, Site, Area, Tipo, Descricao, Periodicidade, Proxima_Data };

  const res = await apiPost(body);
  if (res && res.ok) {
    showToast(modo === 'editar' ? 'Planejada atualizada.' : 'Planejada criada.', 'ok');
    closeM('m-nova-planejada');
    await carregarPlanejadas();
  }
}

async function carregarPlanejadas() {
  const res = await apiGet({ action: 'planejadas_list', login: STATE.sessao.login });
  if (res && res.ok) {
    STATE.planejadas = res.planejadas;
  } else {
    showToast((res && res.error) || 'Falha ao carregar planejadas', 'er');
  }
  _renderPlanejadasList();
}
