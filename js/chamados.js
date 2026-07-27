/**
 * SIGMAN VAREJO — chamados.js
 * Único módulo de negócio do MVP: solicitação (gerente) + atendimento
 * (manutentor). Site sempre vem do STATE.sessao.sites — nunca de um
 * <select> aberto com todas as lojas (ver decisão da spec: gerente pode
 * ser multiloja, mas só escolhe entre as lojas vinculadas a ele).
 */

const AREAS = ['PADARIA', 'AÇOUGUE', 'DEPÓSITO', 'PORTARIA', 'ESTACIONAMENTO', 'CÂMARAS FRIAS', 'INTERIOR LOJA', 'SALA MÁQUINAS'];
const TIPOS = ['PREDIAL', 'REFRIGERAÇÃO', 'ELÉTRICO', 'EQUIPAMENTO', 'OUTROS'];
const PRIORIDADES = ['CRITICO', 'EMERGENCIAL', 'MELHORIA', 'PLANEJADO'];

// ============================================================
// TELA: SOLICITAÇÃO (gerente de loja)
// ============================================================
function renderSolicitacao() {
  const pg = document.getElementById('pg-solicitacao');
  if (!pg) return;

  const sites = STATE.sessao.sites || [];
  const siteOptions = sites.length === 1
    ? `<option value="${sites[0]}" selected>${nomeSite(sites[0])}</option>`
    : `<option value="">Selecione...</option>` +
      sites.map(s => `<option value="${s}">${nomeSite(s)}</option>`).join('');

  pg.innerHTML = `
    <div class="ph"><div class="pt">Solicitação de O.S.</div></div>
    <div class="card">
      <div class="card-t">Nova Solicitação</div>
      <div id="al-sol" class="alert"></div>

      <label>Site</label>
      <select id="sol-site" ${sites.length === 1 ? 'disabled' : ''}>${siteOptions}</select>

      <label>Área</label>
      <select id="sol-area">
        <option value="">Selecione</option>
        ${AREAS.map(a => `<option value="${a}">${a}</option>`).join('')}
      </select>

      <label>Tipo</label>
      <select id="sol-tipo">
        <option value="">Selecione...</option>
        ${TIPOS.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>

      <label>Prioridade</label>
      <select id="sol-prioridade">
        <option value="">Selecione...</option>
        ${PRIORIDADES.map(p => `<option value="${p}">${p}</option>`).join('')}
      </select>

      <label>Descrição do Problema</label>
      <textarea id="sol-descricao" placeholder="Descreva o problema..."></textarea>

      <label>Foto do Problema (opcional)</label>
      <div class="photo-zone" id="sol-photo-preview" onclick="document.getElementById('sol-photo-input').click()">
        <span style="color:var(--txt3)">📷 Clique para anexar foto</span>
      </div>
      <input type="file" id="sol-photo-input" accept="image/*" style="display:none" onchange="_prepararFotoSolicitacao(this)">

      <button class="btn btn-p btn-fl" style="margin-top:12px" onclick="salvarSolicitacao()">Enviar Solicitação</button>
    </div>
  `;

  // Se for mono-loja (caso comum), trava o select e nem mostra escolha —
  // já vem selecionado, sem chance de o gerente forjar outra loja na UI.
}

function nomeSite(codigo) {
  const s = (STATE.boot && STATE.boot.Sites || []).find(x => String(x.Codigo) === String(codigo));
  return s ? `${s.Codigo} - ${s.Nome}` : codigo;
}

let _solFotoBase64 = null;
function _prepararFotoSolicitacao(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    _solFotoBase64 = e.target.result;
    document.getElementById('sol-photo-preview').innerHTML =
      `<img src="${_solFotoBase64}" style="max-height:120px;border-radius:6px">`;
  };
  reader.readAsDataURL(file);
}

async function salvarSolicitacao() {
  const site = v('sol-site'), area = v('sol-area'), tipo = v('sol-tipo'),
        prioridade = v('sol-prioridade'), descricao = v('sol-descricao').trim();

  if (!site || !area || !tipo || !prioridade || !descricao) {
    showAlert('al-sol', 'Preencha todos os campos obrigatórios.', 'er');
    return;
  }

  const body = {
    action: 'chamado_abrir',
    login: STATE.sessao.login,
    Site: site, Area: area, Tipo: tipo, Prioridade: prioridade,
    Descricao: descricao,
    Foto_URL: '' // upload de foto fica pra uma segunda etapa (ver TODO abaixo)
  };

  const res = await apiPost(body);
  if (res && res.ok) {
    showAlert('al-sol', `Solicitação registrada com sucesso!`, 'ok');
    renderSolicitacao(); // limpa o form
  } else if (res === null) {
    // apiPost já enfileirou e avisou via toast — não some com o form,
    // usuário pode continuar preenchendo outras solicitações offline.
    showAlert('al-sol', 'Sem conexão. A solicitação será enviada assim que a rede voltar.', 'war');
  } else {
    showAlert('al-sol', (res && res.error) || 'Erro ao enviar solicitação.', 'er');
  }
  // TODO: upload de foto — SIGMAN industrial faz isso em duas etapas
  // (grava o registro, depois faz upload assíncrono e faz um chamado_atualizar_foto).
  // Reaproveitar esse padrão aqui quando o módulo de fotos for implementado.
}

// ============================================================
// TELA: MINHAS SOLICITAÇÕES (gerente de loja)
// ============================================================
async function renderMinhasSolicitacoes() {
  await carregarChamados();
}

function _renderMinhasSolicitacoesList() {
  const pg = document.getElementById('pg-minhas-solicitacoes');
  if (!pg) return;
  const lista = STATE.chamados; // backend já filtra por sites da sessão

  pg.innerHTML = `
    <div class="ph"><div class="pt">Minhas Solicitações</div></div>
    ${lista.length === 0 ? '<div class="empty"><div class="ei">📋</div><p>Nenhuma solicitação encontrada.</p></div>' : `
    <div class="tw"><table>
      <thead><tr><th>Data</th><th>Site</th><th>Área</th><th>Prioridade</th><th>Status</th><th>Manutentor</th></tr></thead>
      <tbody>
        ${lista.map(c => `
          <tr>
            <td>${formatarData(c.Data_Abertura)}</td>
            <td>${nomeSite(c.Site)}</td>
            <td>${v_(c.Area)}</td>
            <td>${prioridadeBadge(c.Prioridade)}</td>
            <td>${statusBadge(c.Status)}</td>
            <td>${v_(c.Manutentor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>`}
  `;
}

// ============================================================
// TELA: FILA DE CHAMADOS (manutentor / admin)
// ============================================================
async function renderFilaChamados() {
  await carregarChamados();
}

function _renderFilaChamadosList() {
  const pg = document.getElementById('pg-fila-chamados');
  if (!pg) return;
  const abertos = STATE.chamados.filter(c => c.Status === 'Aberta');
  const emAndamento = STATE.chamados.filter(c => c.Status === 'Em_Atendimento');

  pg.innerHTML = `
    <div class="ph"><div class="pt">Fila de Chamados</div></div>
    <div class="card">
      <div class="card-t">Abertos (${abertos.length})</div>
      ${_tabelaFila(abertos, 'assumir')}
    </div>
    <div class="card">
      <div class="card-t">Em Atendimento (${emAndamento.length})</div>
      ${_tabelaFila(emAndamento, 'fechar')}
    </div>
  `;
}

function _tabelaFila(lista, acao) {
  if (!lista.length) return '<div class="empty"><div class="ei">✅</div><p>Nenhum chamado.</p></div>';
  return `
    <div class="tw"><table>
      <thead><tr><th>Data</th><th>Site</th><th>Área</th><th>Tipo</th><th>Prioridade</th><th>Descrição</th><th></th></tr></thead>
      <tbody>
        ${lista.map(c => `
          <tr>
            <td>${formatarData(c.Data_Abertura)}</td>
            <td>${nomeSite(c.Site)}</td>
            <td>${v_(c.Area)}</td>
            <td>${v_(c.Tipo)}</td>
            <td>${prioridadeBadge(c.Prioridade)}</td>
            <td>${v_(c.Descricao)}</td>
            <td>
              ${acao === 'assumir'
                ? `<button class="btn btn-sm btn-p" onclick="assumirChamado('${c.ID}')">Assumir</button>`
                : `<button class="btn btn-sm btn-p" onclick="abrirModalFechar('${c.ID}')">Concluir</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

async function assumirChamado(id) {
  const res = await apiPost({ action: 'chamado_assumir', login: STATE.sessao.login, ID: id });
  if (res && res.ok) {
    showToast('Chamado assumido.', 'ok');
    await carregarChamados();
  }
  // apiPost já mostra toast de erro/offline sozinho.
}

function abrirModalFechar(id) {
  document.getElementById('fch-id').value = id;
  document.getElementById('fch-descricao').value = '';
  openM('m-fechar-chamado');
}

async function salvarFechamentoChamado() {
  const id = document.getElementById('fch-id').value;
  const descricaoExecucao = document.getElementById('fch-descricao').value.trim();
  if (!descricaoExecucao) {
    showToast('Descreva o que foi feito antes de concluir.', 'er');
    return;
  }
  const res = await apiPost({
    action: 'chamado_fechar',
    login: STATE.sessao.login,
    ID: id,
    Descricao_Execucao: descricaoExecucao
  });
  if (res && res.ok) {
    showToast('Chamado concluído.', 'ok');
    closeM('m-fechar-chamado');
    await carregarChamados();
  }
}

// util local — v() em helpers.js lê de <input id>, aqui precisamos só
// escapar/normalizar um valor de célula de tabela.
function v_(x) { return escapeHtml(x || '—'); }

// Depois que STATE.chamados é atualizado (carregarChamados em core.js),
// core.js chama renderChamados() genérico — cada tela decide o que
// realmente precisa re-renderizar olhando a página ativa.
function renderChamados() {
  const hash = location.hash.replace('#', '');
  if (hash === 'minhas-solicitacoes') _renderMinhasSolicitacoesList();
  if (hash === 'fila-chamados') _renderFilaChamadosList();
  if (hash === 'dashboard') _renderDashboardKpis();
}
