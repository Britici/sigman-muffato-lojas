/* ══════════════════════════════════════════════════════════════════
   SIGMAN Varejo — DASHBOARD
   KPIs operacionais de manutenção de lojas (sem OEE/MTBF/RAC — fora
   do escopo do varejo). Fonte única das categorias de Tipo de Serviço:
   TIPOS_SERVICO, usado também pelos dropdowns em os-planejadas.js e
   demais módulos.
   ══════════════════════════════════════════════════════════════════ */

const TIPOS_SERVICO = ['Predial', 'Refrigeração', 'Elétrico', 'Equipamento', 'Outros'];

function renderDash() {
  updStats();
  const t = today();

  // Filtro de período
  const sel = document.getElementById('dash-periodo');
  const per = sel ? sel.value : 'mes';
  const customDatesDiv = document.getElementById('dash-custom-dates');
  if (customDatesDiv) customDatesDiv.style.display = per === 'custom' ? 'flex' : 'none';

  let startDate;
  if (per === 'dia') {
    startDate = t;
  } else if (per === 'semana') {
    const d = new Date(); d.setDate(d.getDate()-7);
    startDate = d.toISOString().slice(0,10);
  } else if (per === 'ano') {
    startDate = t.slice(0,4) + '-01-01';
  } else if (per === 'custom') {
    startDate = document.getElementById('dash-dt-ini')?.value || t;
  } else {
    startDate = t.slice(0,7) + '-01';
  }

  let endDate = t;
  if (per === 'custom') {
    endDate = document.getElementById('dash-dt-fim')?.value || t;
  }

  const ordPer = db.ordens.filter(o => o.data && o.data >= startDate && o.data <= endDate);
  const total  = ordPer.length;
  const hj     = db.ordens.filter(o => o.data === t).length;

  const plOpen   = db.planejadas.filter(p => p.status !== 'Concluída').length;
  const plAtras  = db.planejadas.filter(p => p.status === 'Atrasada').length;
  const solPend  = db.solicitacoes.filter(s => s.status === 'Não Executada').length;

  // Tempo médio de atendimento (min) — OS do período com duração registrada
  const ordComTempo = ordPer.filter(o => o.durMin > 0);
  const tma = ordComTempo.length
    ? Math.round(ordComTempo.reduce((s,o) => s + o.durMin, 0) / ordComTempo.length)
    : 0;

  // Banner de alertas — OS planejadas vencendo hoje/amanhã
  const banner = document.getElementById('dash-banner');
  if (banner) {
    const amanhaDt = new Date(); amanhaDt.setDate(amanhaDt.getDate()+1);
    const amanha = amanhaDt.toISOString().slice(0,10);
    const venceHoje   = db.planejadas.filter(p => p.prazo === t && p.status !== 'Concluída');
    const venceAmanha = db.planejadas.filter(p => p.prazo === amanha && p.status !== 'Concluída');
    if (venceHoje.length || venceAmanha.length) {
      banner.style.display = 'block';
      banner.innerHTML = `<div style="background:rgba(196,18,48,.12);border:1px solid rgba(196,18,48,.4);border-radius:var(--rs);padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">⚠️</span>
        <div style="font-size:15px;line-height:1.5">
          ${venceHoje.length ? `<strong style="color:#ff2244">${venceHoje.length} OS vence hoje!</strong><br>` : ''}
          ${venceAmanha.length ? `<span style="color:var(--org)">${venceAmanha.length} OS vence amanhã.</span>` : ''}
        </div>
      </div>`;
    } else { banner.style.display = 'none'; }
  }

  // KPI Cards
  document.getElementById('d-stats').innerHTML = `
    <div class="sc-card c-go" onclick="irParaCard('executadas')" style="cursor:pointer">
      <div class="sc-lbl">OS Hoje</div>
      <div class="sc-val">${hj}</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:4px">Período: ${total}</div>
    </div>
    <div class="sc-card c-p">
      <div class="sc-lbl">Tempo Médio de Atendimento</div>
      <div class="sc-val">${tma > 0 ? tma+'min' : '—'}</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:4px">Baseado em ${ordComTempo.length} OS</div>
    </div>
    <div class="sc-card ${plAtras > 0 ? 'c-r' : 'c-o'}" onclick="irParaCard('planejadas')" style="cursor:pointer">
      <div class="sc-lbl">Backlog Planejadas</div>
      <div class="sc-val">${plOpen}</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:4px">${plAtras} atrasadas</div>
    </div>
    <div class="sc-card ${solPend > 0 ? 'c-r' : 'c-o'}" onclick="irParaCard('solicitacao')" style="cursor:pointer">
      <div class="sc-lbl">Solicitações Pendentes</div>
      <div class="sc-val">${solPend}</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:4px">Aguardando execução</div>
    </div>`;

  // Cards por Tipo de Serviço (5 categorias)
  document.getElementById('d-tipos').innerHTML = TIPOS_SERVICO.map(tp => {
    const n = ordPer.filter(o => o.tipo === tp).length;
    const pct = total ? Math.round(n/total*100) : 0;
    return `
      <div class="sc-card c-r">
        <div class="sc-lbl">${tp}</div>
        <div class="sc-val">${n}</div>
        <div style="font-size:11px;color:var(--txt3);margin-top:4px">${pct}% do total</div>
      </div>`;
  }).join('');

  renderDistTipo('d-dist-tipo', ordPer);
  renderTrend('d-trend');
  renderProximas('d-proximas');
  renderTopAreas('d-top-maq', ordPer);

  // Últimas 5 OS executadas
  const rec = [...db.ordens].reverse().slice(0,5);
  document.getElementById('d-rec').innerHTML = rec.length === 0
    ? '<div class="empty"><div class="ei">📋</div><p>Nenhuma O.S. ainda.</p></div>'
    : rec.map(o => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--bord);gap:8px">
        <div>
          <span class="osn">${o.numero}</span>
          <div style="font-size:15px;font-weight:500;margin-top:2px">${o.loja} · ${o.maq}</div>
          <div style="font-size:13px;color:var(--txt3)">${o.manut} · ${fd(o.data)}${o.ini?' · '+o.ini+'-'+o.fim:''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${tipoBadge(o.tipo)}${prio(o.prioridade)}
          ${o.durMin ? `<span style="font-size:11px;color:var(--txt3)">${o.durMin}min</span>` : ''}
        </div>
      </div>`).join('');

  // Planejadas abertas
  const plA = [...db.planejadas].filter(p => p.status !== 'Concluída').slice(0,5);
  document.getElementById('d-plan').innerHTML = plA.length === 0
    ? '<div class="empty"><div class="ei">📅</div><p>Sem O.S. planejadas abertas.</p></div>'
    : plA.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--bord);gap:8px">
        <div>
          <span class="osn">${p.numero}</span>
          <div style="font-size:15px;font-weight:500;margin-top:2px">${p.loja} · ${p.maq}</div>
          <div style="font-size:13px;color:var(--txt3)">${(()=>{
            if (!p.prazo) return 'Sem prazo';
            const dias = Math.ceil((new Date(p.prazo) - new Date(today())) / 86400000);
            if (dias < 0)  return `<span style="color:#ff2244;font-weight:700">⚠ ${Math.abs(dias)}d atrasada</span>`;
            if (dias === 0) return `<span style="color:#ff2244;font-weight:700">⚠ Vence hoje</span>`;
            if (dias <= 3)  return `<span style="color:var(--org);font-weight:600">🕐 Vence em ${dias}d</span>`;
            return `Prazo: ${fd(p.prazo)} (${dias}d)`;
})()}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${prio(p.prioridade)}${stBadge(p.status)}
          ${CU&&CU.tipo!=='gerente'?`<button class="btn btn-sm btn-g" onclick="abrirConcluir('${p.numero}','plan')">Concluir</button>`:''}
        </div>
      </div>`).join('');

  // Solicitações pendentes
  const spL = db.solicitacoes.filter(s => s.status === 'Não Executada').slice(0,5);
  document.getElementById('d-sol').innerHTML = spL.length === 0
    ? '<div class="empty"><div class="ei">📣</div><p>Sem solicitações pendentes.</p></div>'
    : spL.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--bord);gap:8px">
        <div>
          <span class="osn">${s.numero}</span>
          <div style="font-size:15px;font-weight:500;margin-top:2px">${s.loja} · ${s.maq}</div>
          <div style="font-size:13px;color:var(--txt3)">${s.solicitante} · ${fd(s.criadoEm.slice(0,10))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${prio(s.prioridade)}
          ${CU && CU.tipo !== 'gerente'
            ? `<button class="btn btn-sm btn-g" onclick="abrirConcluir('${s.numero}','sol')">✓ Executar</button>`
            : stBadge(s.status)}
        </div>
      </div>`).join('');

  // Ranking lojas — mais chamados no período (qualquer tipo, não só corretiva)
  const byLoja = {};
  ordPer.forEach(o => { byLoja[o.loja] = (byLoja[o.loja] || 0) + 1; });
  const topLojas = Object.entries(byLoja).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxLoja  = topLojas[0]?.[1] || 1;
  const dTL = document.getElementById('d-top-lojas');
  if (dTL) dTL.innerHTML = topLojas.length === 0
    ? '<div class="empty"><div class="ei">🏭</div><p>Sem chamados no período.</p></div>'
    : topLojas.map(([loja,n], i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bord)">
          <span style="font-family:var(--fm);font-size:13px;color:var(--txt3);min-width:14px">${i+1}</span>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:500">${loja}</div>
            <div style="height:5px;background:var(--surf3);border-radius:3px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${Math.round(n/maxLoja*100)}%;background:var(--red);border-radius:3px"></div>
            </div>
          </div>
          <span style="font-family:var(--fw);font-size:20px;font-weight:800;color:var(--red)">${n}</span>
        </div>`).join('');

  // Histórico
  const dH = document.getElementById('d-historico');
  if (dH) dH.innerHTML = db.historico.length === 0
    ? '<div class="empty"><div class="ei">📝</div><p>Nenhuma ação ainda.</p></div>'
    : db.historico.slice(0, 10).map(h => {
        const ts   = new Date(h.ts);
        const hora = ts.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        const dia  = ts.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
        const cor  = h.acao.includes('Excluiu') ? 'var(--red)'
                   : h.acao.includes('Criou')   ? 'var(--grn)'
                   : 'var(--blu)';
        return `
          <div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--bord);align-items:flex-start">
            <div style="width:7px;height:7px;border-radius:50%;background:${cor};flex-shrink:0;margin-top:4px"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600">
                ${h.acao}
                <span style="font-family:var(--fm);color:var(--red);font-size:13px">${h.numero}</span>
              </div>
              <div style="font-size:13px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.detalhe}</div>
              <div style="font-size:11px;color:var(--txt3);margin-top:2px">${h.user} · ${dia} ${hora}</div>
            </div>
          </div>`;
      }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// Distribuição por Tipo de Serviço — barras horizontais simples (sem lib)
// ══════════════════════════════════════════════════════════════════════
function renderDistTipo(containerId, ordPer) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const total = ordPer.length;
  if (total === 0) {
    el.innerHTML = '<div class="empty"><div class="ei">📊</div><p>Sem OS no período.</p></div>';
    return;
  }
  const cores = { Predial:'var(--grn)', 'Refrigeração':'#5aa8ff', 'Elétrico':'var(--pur)', Equipamento:'#ff4d65', Outros:'#94a3b8' };
  el.innerHTML = TIPOS_SERVICO.map(tp => {
    const n = ordPer.filter(o => o.tipo === tp).length;
    const pct = Math.round(n/total*100);
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
          <span>${tp}</span><span style="color:var(--txt3)">${n} (${pct}%)</span>
        </div>
        <div style="height:8px;background:var(--surf3);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cores[tp]||'var(--txt3)'};border-radius:4px"></div>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// Tendência — OS por mês (últimos 6 meses)
// ══════════════════════════════════════════════════════════════════════
function renderTrend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const meses = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(d.toISOString().slice(0,7));
  }
  const counts = meses.map(m => db.ordens.filter(o => (o.data||'').slice(0,7) === m).length);
  const max = Math.max(1, ...counts);
  const lbls = { };
  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding-top:8px">
    ${meses.map((m,i) => {
      const h = Math.round(counts[i]/max*100);
      const [ano,mes] = m.split('-');
      const nomeMes = new Date(ano, mes-1, 1).toLocaleDateString('pt-BR', {month:'short'});
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
          <span style="font-size:12px;font-weight:700;color:var(--txt)">${counts[i]}</span>
          <div style="width:100%;max-width:28px;height:${Math.max(4,h)}%;background:var(--red);border-radius:3px 3px 0 0"></div>
          <span style="font-size:11px;color:var(--txt3);text-transform:capitalize">${nomeMes}</span>
        </div>`;
    }).join('')}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
// Próximas manutenções planejadas (ordenadas por prazo)
// ══════════════════════════════════════════════════════════════════════
function renderProximas(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const prox = db.planejadas
    .filter(p => p.status !== 'Concluída' && p.prazo)
    .sort((a,b) => a.prazo.localeCompare(b.prazo))
    .slice(0,5);
  el.innerHTML = prox.length === 0
    ? '<div class="empty"><div class="ei">🔔</div><p>Sem manutenções planejadas.</p></div>'
    : prox.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--bord);gap:8px">
        <div>
          <span class="osn">${p.numero}</span>
          <div style="font-size:15px;font-weight:500;margin-top:2px">${p.loja} · ${p.maq}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${tipoBadge(p.tipo)}
          <span style="font-size:12px;color:var(--txt3)">Prazo: ${fd(p.prazo)}</span>
        </div>
      </div>`).join('');
}

// ══════════════════════════════════════════════════════════════════════
// Ranking de Áreas com mais chamados no período
// ══════════════════════════════════════════════════════════════════════
function renderTopAreas(containerId, ordPer) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const byArea = {};
  ordPer.forEach(o => {
    const k = o.maq + '||' + o.loja;
    byArea[k] = byArea[k] || { maq: o.maq, loja: o.loja, n: 0 };
    byArea[k].n++;
  });
  const top = Object.values(byArea).sort((a,b) => b.n - a.n).slice(0,5);
  const max = top[0]?.n || 1;
  el.innerHTML = top.length === 0
    ? '<div class="empty"><div class="ei">🔧</div><p>Sem chamados no período.</p></div>'
    : top.map((a,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bord)">
          <span style="font-family:var(--fm);font-size:13px;color:var(--txt3);min-width:14px">${i+1}</span>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:500">${a.maq}</div>
            <div style="font-size:12px;color:var(--txt3)">${a.loja}</div>
            <div style="height:5px;background:var(--surf3);border-radius:3px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${Math.round(a.n/max*100)}%;background:var(--red);border-radius:3px"></div>
            </div>
          </div>
          <span style="font-family:var(--fw);font-size:20px;font-weight:800;color:var(--red)">${a.n}</span>
        </div>`).join('');
}

// ══════════════════════════════════════════════════════════════════════
// Export PDF simplificado — imprime a página atual do dashboard
// ══════════════════════════════════════════════════════════════════════
async function exportDashPDF() {
  window.print();
}
