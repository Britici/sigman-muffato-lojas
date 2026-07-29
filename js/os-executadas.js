/* ══════════════════════════════════════════════════════════════════
   SIGMAN — O.S. EXECUTADAS
   Muffato Foods
   ══════════════════════════════════════════════════════════════════ */
var execSort = { col: 'numero', dir: 'desc' };

function sortExec(col) {
  if (execSort.col === col) {
    execSort.dir = execSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    execSort.col = col;
    execSort.dir = col === 'data' ? 'desc' : 'asc';
  }
  renderExec();
}

function renderExec() {
  populateLojaFilter('fe-sl');
  const mnSel = document.getElementById('fe-mn');
  if (mnSel) {
    const cur = mnSel.value;
    const manuts = [...new Set(db.ordens.map(o=>o.manut).filter(Boolean))].sort();
    mnSel.innerHTML = '<option value="">Todos os Manut.</option>' + manuts.map(m=>`<option value="${m}">${m}</option>`).join('');
    if (cur) mnSel.value = cur;
  }

  const tx = v('fe-tx').toLowerCase();
  const tp = v('fe-tp');
  const sl = v('fe-sl');
  const mn = v('fe-mn');
  const dtI = v('fe-dt-ini');
  const dtF = v('fe-dt-fim');

  let data = [...db.ordens];
  if (tx) data = data.filter(o => [o.numero,o.loja,o.maq,o.manut,o.tipo].some(x=>x&&x.toLowerCase().includes(tx)));
  if (tp) data = data.filter(o => o.tipo === tp);
  if (sl) data = data.filter(o => o.loja === sl);
  if (mn) data = data.filter(o => o.manut === mn);
  if (dtI) data = data.filter(o => o.data >= dtI);
  if (dtF) data = data.filter(o => o.data <= dtF);

  // Ordenação
  const { col, dir } = execSort;
  const prioMap = { 'Urgente':1, 'Alta':2, 'Média':3, 'Baixa':4 };
  data.sort((a, b) => {
    let va = a[col] || '', vb = b[col] || '';
    if (col === 'prioridade') { va = prioMap[va] || 9; vb = prioMap[vb] || 9; return dir === 'asc' ? va - vb : vb - va; }
    const cmp = va.localeCompare(vb, 'pt-BR', { numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });

  // Atualiza ícones dos cabeçalhos
  ['numero','data','loja','maq','tipo','prioridade','manut'].forEach(c => {
    const el = document.getElementById('sh-' + c);
    if (!el) return;
    el.classList.remove('asc','desc');
    if (c === col) el.classList.add(dir);
  });

  const tb = document.getElementById('tb-exec');
  if (!data.length) { tb.innerHTML = `<tr><td colspan="10"><div class="empty"><div class="ei">📋</div><p>Nenhuma ordem encontrada.</p></div></td></tr>`; return; }

  tb.innerHTML = data.map(o => `<tr>
    <td style="white-space:nowrap;width:110px">
      <span style="display:flex;align-items:center;gap:4px;justify-content:flex-start">
        <span class="osn">${o.numero}</span>
      </span>
      ${(o.origem==='plan'||o.origem==='sol')&&o.origemNum?`<div style="text-align:left;font-size:11px;color:var(--txt2);margin-top:1px">(${o.origemNum})</div>`:''}
    </td>
    <td style="font-size:14px">${fd(o.data)}</td>
    <td>${o.loja}</td>
    <td>${o.maq}</td>
    <td>${tipoBadge(o.tipo)}</td>
    <td>${prio(o.prioridade)}</td>
    <td style="font-size:14px">${o.manut}</td>
    <td style="font-family:var(--fm);font-size:13px">${o.ini&&o.fim?o.ini+' – '+o.fim:'—'}${o.durMin?' ('+o.durMin+'min)':''}</td>
    <td style="width:52px;text-align:center">
      ${o.fotoUrl
        ? `<div class="foto-wrap" style="display:inline-block">
             <img src="${driveThumb(o.fotoUrl)}"
               style="width:44px;height:44px;object-fit:cover;border-radius:6px;
               border:1px solid var(--bord);cursor:zoom-in;display:block"
               alt="Foto" onclick="abrirFotoLightbox('${o.fotoUrl}')" onerror="this.style.display='none'">
           </div>`
        : `<span style="font-size:13px;color:var(--txt3)">—</span>`}
    </td>
    <td><div style="display:flex;gap:4px">
      <button class="btn btn-sm btn-gh" onclick="verDet('${o.numero}','os')">Ver</button>
      <button class="btn btn-d" onclick="delOS('${o.numero}')">✕</button>
    </div></td>
  </tr>`).join('');
}



function delOS(id) {
  if (!confirm('Excluir esta O.S.?')) return;
  const os = db.ordens.find(o => o.numero === id);
  if (os) logEdit('Excluiu OS', os.numero, os.loja + ' · ' + os.maq);
  db.ordens = db.ordens.filter(o => o.numero !== id);
  saveDB(); renderExec(); updStats();
  if (os) apiDelete('ordens', os.numero, 'OS_Numero');
}

function exportCSV() {
  const tx = v('fe-tx').toLowerCase();
  const tp = v('fe-tp');
  const sl = v('fe-sl');
  const mn = v('fe-mn');
  const dtI = v('fe-dt-ini');
  const dtF = v('fe-dt-fim');

  let data = [...db.ordens];
  if (tx) data = data.filter(o => [o.numero,o.loja,o.maq,o.manut,o.tipo].some(x=>x&&x.toLowerCase().includes(tx)));
  if (tp) data = data.filter(o => o.tipo === tp);
  if (sl) data = data.filter(o => o.loja === sl);
  if (mn) data = data.filter(o => o.manut === mn);
  if (dtI) data = data.filter(o => o.data >= dtI);
  if (dtF) data = data.filter(o => o.data <= dtF);

  if (!data.length) { showToast('Sem dados para exportar com os filtros selecionados.'); return; }

  const h = ['OS_Numero','Data','Loja','Area','Tipo','Prioridade','Manutentor','Hora_Inicio','Hora_Fim','Duracao_Min','Tempo_Parada_Min','Problema','Acao_Executada','Origem'];
  const rows = data.map(o => [
    o.numero, o.data, o.loja, o.maq, o.tipo, o.prioridade||'', o.manut,
    o.ini||'', o.fim||'', o.durMin||'', o.paradaMin||'',
    (o.prob||'').replace(/,/g,'|'), (o.acao||'').replace(/,/g,'|'), o.origem
  ]);
  const csv = [h,...rows].map(r=>r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download = `SIGMAN_OS_${today()}${tp?'_'+tp:''}${sl?'_'+sl:''}.csv`;
  a.click();
}
