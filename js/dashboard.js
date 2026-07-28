/**
 * SIGMAN VAREJO — dashboard.js
 * KPIs simples pro MVP: nada de OEE/MTBF (isso é do industrial). Aqui o
 * que importa é SLA de atendimento — o que o mockup do industrial nem
 * tinha, porque lá o KPI é de máquina, não de chamado.
 */

async function renderDashboard() {
  await carregarChamados(); // reaproveita o mesmo lazy-load, sem duplicar chamada
}

function _renderDashboardKpis() {
  const pg = document.getElementById('pg-dashboard');
  if (!pg) return;
  const chamados = STATE.chamados;

  const abertos = chamados.filter(c => c.Status === 'Aguardando').length;
  const emAtendimento = chamados.filter(c => c.Status === 'Em_Andamento').length;
  const concluidos = chamados.filter(c => c.Status === 'Concluida');

  const temposFechamento = concluidos
    .map(c => diffHoras(c.Data_Abertura, c.Data_Conclusao))
    .filter(h => h !== null);
  const mediaHoras = temposFechamento.length
    ? Math.round((temposFechamento.reduce((a, b) => a + b, 0) / temposFechamento.length) * 10) / 10
    : null;

  const criticosAbertos = chamados.filter(c => c.Prioridade === 'CRITICO' && c.Status !== 'Concluida' && c.Status !== 'Cancelada').length;

  const porLoja = {};
  chamados.filter(c => c.Status !== 'Concluida' && c.Status !== 'Cancelada').forEach(c => {
    porLoja[c.Site] = (porLoja[c.Site] || 0) + 1;
  });
  const rankingLojas = Object.entries(porLoja).sort((a, b) => b[1] - a[1]).slice(0, 5);

  pg.innerHTML = `
    <div class="ph"><div class="pt">Dashboard</div></div>
    <div class="stats">
      <div class="sc-card"><div class="sc-lbl">Aguardando</div><div class="sc-val">${abertos}</div></div>
      <div class="sc-card"><div class="sc-lbl">Em Atendimento</div><div class="sc-val c-b">${emAtendimento}</div></div>
      <div class="sc-card"><div class="sc-lbl">Críticos em Aberto</div><div class="sc-val ${criticosAbertos ? 'c-r' : ''}">${criticosAbertos}</div></div>
      <div class="sc-card"><div class="sc-lbl">Tempo Médio de Atendimento</div><div class="sc-val">${mediaHoras !== null ? mediaHoras + 'h' : '—'}</div></div>
    </div>

    <div class="card">
      <div class="card-t">Lojas com mais chamados em aberto</div>
      ${rankingLojas.length === 0 ? '<div class="empty"><div class="ei">✅</div><p>Nenhum chamado em aberto.</p></div>' : `
      <div class="tw"><table>
        <thead><tr><th>Loja</th><th>Chamados abertos</th></tr></thead>
        <tbody>
          ${rankingLojas.map(([site, qtd]) => `<tr><td>${nomeSite(site)}</td><td>${qtd}</td></tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>
  `;
}
