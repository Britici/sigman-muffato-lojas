/**
 * SIGMAN VAREJO — chamados.js
 * Solicitação de O.S. (gerente) + fila do manutentor, no padrão visual
 * do SIGMAN industrial: cards de O.S. numeradas (não tabela crua), 3
 * abas de status (Aguardando / Em Andamento / Concluído), fotos múltiplas
 * redimensionadas tanto na abertura quanto na conclusão.
 */

const AREAS = ['PADARIA', 'AÇOUGUE', 'DEPÓSITO', 'PORTARIA', 'ESTACIONAMENTO', 'CÂMARAS FRIAS', 'INTERIOR LOJA', 'SALA MÁQUINAS'];
const TIPOS = ['PREDIAL', 'REFRIGERAÇÃO', 'ELÉTRICO', 'EQUIPAMENTO', 'OUTROS'];
const PRIORIDADES = ['CRITICO', 'EMERGENCIAL', 'MELHORIA', 'PLANEJADO'];
const ABAS_STATUS = [
  { status: 'Aguardando', label: 'Aguardando' },
  { status: 'Em_Andamento', label: 'Em Andamento' },
  { status: 'Concluida', label: 'Concluído' }
];

// ============================================================
// TELA: SOLICITAÇÃO (gerente de loja) — abertura de O.S.
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

      <div class="fg">
        <label>Site</label>
        <select id="sol-site" ${sites.length === 1 ? 'disabled' : ''}>${siteOptions}</select>
      </div>
      <div class="fg">
        <label>Área</label>
        <select id="sol-area">
          <option value="">Selecione</option>
          ${AREAS.map(a => `<option value="${a}">${a}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label>Tipo</label>
        <select id="sol-tipo">
          <option value="">Selecione...</option>
          ${TIPOS.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label>Prioridade</label>
        <select id="sol-prioridade">
          <option value="">Selecione...</option>
          ${PRIORIDADES.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label>Descrição do Problema</label>
        <textarea id="sol-descricao" placeholder="Descreva o problema..."></textarea>
      </div>
      <div class="fg">
        <label>Fotos do Problema (opcional)</label>
        <div class="photo-zone" id="sol-fotos-drop">
          <span style="color:var(--txt3)">📷 Clique ou arraste fotos aqui (pode escolher várias)</span>
          <input type="file" id="sol-fotos-input" accept="image/*" multiple style="display:none">
        </div>
        <div id="sol-fotos-preview" style="margin-top:8px;display:flex;flex-wrap:wrap"></div>
      </div>

      <button class="btn btn-p btn-fl" style="margin-top:12px" id="sol-btn-enviar" onclick="salvarSolicitacao()">Enviar Solicitação</button>
    </div>
  `;
  wireFotoDropzone('sol-fotos');
}

function nomeSite(codigo) {
  const s = (STATE.boot && STATE.boot.Sites || []).find(x => String(x.Codigo) === String(codigo));
  return s ? `${s.Codigo} - ${s.Nome}` : codigo;
}

async function salvarSolicitacao() {
  const site = v('sol-site'), area = v('sol-area'), tipo = v('sol-tipo'),
        prioridade = v('sol-prioridade'), descricao = v('sol-descricao').trim();

  if (!site || !area || !tipo || !prioridade || !descricao) {
    showAlert('al-sol', 'Preencha todos os campos obrigatórios.', 'er');
    return;
  }

  const btn = document.getElementById('sol-btn-enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando fotos...';

  const urlsFotos = await enviarFotosPicker('sol-fotos', STATE.sessao.login);

  btn.textContent = 'Enviando...';
  const res = await apiPost({
    action: 'chamado_abrir',
    login: STATE.sessao.login,
    Site: site, Area: area, Tipo: tipo, Prioridade: prioridade,
    Descricao: descricao,
    Fotos: urlsFotos
  });

  btn.disabled = false;
  btn.textContent = 'Enviar Solicitação';

  if (res && res.ok) {
    showAlert('al-sol', `Solicitação ${res.chamado.Numero} registrada com sucesso!`, 'ok');
    renderSolicitacao(); // limpa o form
  } else if (res === null) {
    showAlert('al-sol', 'Sem conexão. A solicitação será enviada assim que a rede voltar (as fotos precisarão ser reanexadas).', 'war');
  } else {
    showAlert('al-sol', (res && res.error) || 'Erro ao enviar solicitação.', 'er');
  }
}

// ============================================================
// TELA: MINHAS SOLICITAÇÕES (gerente de loja) — mesmas 3 abas, sem
// botão de assumir/concluir, com opção de cancelar enquanto Aguardando.
// ============================================================
let _abaMinhas = 'Aguardando';

async function renderMinhasSolicitacoes() {
  await carregarChamados();
}

function _renderMinhasSolicitacoesList() {
  const pg = document.getElementById('pg-minhas-solicitacoes');
  if (!pg) return;
  const lista = STATE.chamados; // backend já filtra por sites da sessão

  pg.innerHTML = `
    <div class="ph"><div class="pt">Minhas Solicitações</div></div>
    ${_tabsHtml(lista, _abaMinhas, 'setAbaMinhas')}
    <div id="minhas-lista"></div>
  `;
  _renderCardsOS(lista.filter(c => c.Status === _abaMinhas), 'minhas-lista', 'gerente');
}

function setAbaMinhas(status) {
  _abaMinhas = status;
  _renderMinhasSolicitacoesList();
}

// ============================================================
// TELA: FILA DE O.S. (manutentor / admin)
// ============================================================
let _abaFila = 'Aguardando';

async function renderFilaChamados() {
  await carregarChamados();
}

function _renderFilaChamadosList() {
  const pg = document.getElementById('pg-fila-chamados');
  if (!pg) return;
  const lista = STATE.chamados;

  pg.innerHTML = `
    <div class="ph"><div class="pt">Ordens de Serviço</div></div>
    ${_tabsHtml(lista, _abaFila, 'setAbaFila')}
    <div id="fila-lista"></div>
  `;
  _renderCardsOS(lista.filter(c => c.Status === _abaFila), 'fila-lista', 'manutentor');
}

function setAbaFila(status) {
  _abaFila = status;
  _renderFilaChamadosList();
}

// ── ABAS (reaproveitadas pelas duas telas) ──
function _tabsHtml(lista, abaAtiva, fnNome) {
  return `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${ABAS_STATUS.map(a => {
        const qtd = lista.filter(c => c.Status === a.status).length;
        const ativo = a.status === abaAtiva;
        return `<button class="btn btn-sm ${ativo ? 'btn-p' : 'btn-gh'}" onclick="${fnNome}('${a.status}')">${a.label} (${qtd})</button>`;
      }).join('')}
    </div>
  `;
}

// ── CARDS DE O.S. (substitui a tabela crua — cada chamado vira um card
// no estilo do industrial, com número, badges e ação conforme o papel) ──
function _renderCardsOS(lista, containerId, papel) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  if (!lista.length) {
    cont.innerHTML = '<div class="empty"><div class="ei">📋</div><p>Nenhuma O.S. nesta aba.</p></div>';
    return;
  }
  cont.innerHTML = lista.map(c => _cardOS(c, papel)).join('');
}

function _cardOS(c, papel) {
  const fotosAbertura = _parseFotos(c.Fotos_URLs);
  const fotosExec = _parseFotos(c.Fotos_Execucao_URLs);

  let acoes = '';
  if (papel === 'manutentor' && c.Status === 'Aguardando') {
    acoes = `<button class="btn btn-sm btn-p" onclick="assumirChamado('${c.ID}')">Assumir</button>`;
  } else if (papel === 'manutentor' && c.Status === 'Em_Andamento') {
    acoes = `<button class="btn btn-sm btn-p" onclick="abrirModalFechar('${c.ID}')">Concluir</button>`;
  } else if (papel === 'gerente' && c.Status === 'Aguardando') {
    acoes = `<button class="btn btn-sm btn-gh" onclick="cancelarChamado('${c.ID}')">Cancelar</button>`;
  }

  return `
    <div class="card">
      <div class="card-t">
        <span class="osn">${escapeHtml(c.Numero || c.ID)}</span>
        ${statusBadge(c.Status)}${prioridadeBadge(c.Prioridade)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:14px;margin-bottom:8px">
        <div><strong>${nomeSite(c.Site)}</strong></div>
        <div>${v_(c.Area)} · ${v_(c.Tipo)}</div>
        <div style="color:var(--txt3)">${formatarData(c.Data_Abertura)}</div>
      </div>
      <div style="margin-bottom:8px">${v_(c.Descricao)}</div>
      ${fotosAbertura.length ? _fotosThumbsHtml(fotosAbertura) : ''}
      ${c.Manutentor ? `<div style="font-size:13px;color:var(--txt3);margin-top:6px">Manutentor: ${v_(c.Manutentor)}</div>` : ''}
      ${c.Status === 'Concluida' ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bord)">
          <div style="font-size:13px;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Execução</div>
          <div>${v_(c.Descricao_Execucao)}</div>
          ${fotosExec.length ? _fotosThumbsHtml(fotosExec) : ''}
          <div style="font-size:13px;color:var(--txt3);margin-top:6px">Concluído em ${formatarData(c.Data_Conclusao)}</div>
        </div>` : ''}
      ${acoes ? `<div style="margin-top:10px">${acoes}</div>` : ''}
    </div>
  `;
}

function _fotosThumbsHtml(urls) {
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
    ${urls.map(u => `<a href="${u}" target="_blank" rel="noopener"><img class="photo-thumb" src="${u}" style="max-width:80px;max-height:80px" alt="Foto"></a>`).join('')}
  </div>`;
}

function _parseFotos(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ── AÇÕES ──
async function assumirChamado(id) {
  const res = await apiPost({ action: 'chamado_assumir', login: STATE.sessao.login, ID: id });
  if (res && res.ok) {
    showToast('Chamado assumido.', 'ok');
    await carregarChamados();
  }
}

async function cancelarChamado(id) {
  if (!confirm('Cancelar esta solicitação?')) return;
  const res = await apiPost({ action: 'chamado_cancelar', login: STATE.sessao.login, ID: id });
  if (res && res.ok) {
    showToast('Solicitação cancelada.', 'ok');
    await carregarChamados();
  }
}

function abrirModalFechar(id) {
  document.getElementById('fch-id').value = id;
  document.getElementById('fch-descricao').value = '';
  initFotoPicker('fch-fotos');
  openM('m-fechar-chamado');
  // wireFotoDropzone precisa rodar depois que o modal (que já existe fixo
  // no index.html) está no DOM — como ele é fixo, só religamos 1x por
  // abertura pra garantir que o listener não fique duplicado.
  if (!window._fchDropWired) { wireFotoDropzone('fch-fotos'); window._fchDropWired = true; }
}

async function salvarFechamentoChamado() {
  const id = document.getElementById('fch-id').value;
  const descricaoExecucao = document.getElementById('fch-descricao').value.trim();
  if (!descricaoExecucao) {
    showToast('Descreva o que foi feito antes de concluir.', 'er');
    return;
  }

  showToast('Enviando fotos...', 'inf');
  const urlsFotos = await enviarFotosPicker('fch-fotos', STATE.sessao.login);

  const res = await apiPost({
    action: 'chamado_fechar',
    login: STATE.sessao.login,
    ID: id,
    Descricao_Execucao: descricaoExecucao,
    Fotos_Execucao: urlsFotos
  });
  if (res && res.ok) {
    showToast('Chamado concluído.', 'ok');
    closeM('m-fechar-chamado');
    await carregarChamados();
  }
}

// util local — escapa/normaliza um valor de célula pra exibição
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
