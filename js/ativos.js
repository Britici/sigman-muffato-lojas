/* ══════════════════════════════════════════════════════════════════
   SIGMAN — ATIVOS
   Muffato Foods
   ══════════════════════════════════════════════════════════════════ */
let _editType=null,_editIdx=null;

function toggleAtFold(id) {
  document.getElementById(id).classList.toggle('open');
}

function renderAtivos() {
  populateAtMaqLoja();

  // Lojas em ordem alfabética
  document.getElementById('at-sl').innerHTML = db.lojas.length===0
    ? '<div class="empty"><p>Nenhuma loja.</p></div>'
    : [...db.lojas].sort().map((s,i)=>`
      <div class="edit-row">
        <span style="font-size:15px;font-weight:500">${s}</span>
        <div class="edit-acts">
          <button class="btn btn-edit btn-sm" onclick="openEdit('loja',${db.lojas.indexOf(s)})">✎</button>
          <button class="btn btn-d" onclick="delLoja('${s}')">✕</button>
        </div>
      </div>`).join('');

  // Popula e aplica filtro de loja nas áreas
  const filSel = document.getElementById('at-ml-fil');
  if (filSel) {
    const curFil = filSel.value;
    filSel.innerHTML = '<option value="">Todas as Lojas</option>' + [...db.lojas].sort().map(s=>`<option value="${s}">${s}</option>`).join('');
    if (curFil) filSel.value = curFil;
  }
  const filLoja = filSel ? filSel.value : '';
  const buscaEl = document.getElementById('at-ml-busca');
  const busca = buscaEl ? buscaEl.value.trim().toUpperCase() : '';

  // Áreas agrupadas por loja e em ordem alfabética
  const byLoja = {};
  [...db.areas]
    .filter(m => !filLoja || m.loja === filLoja)
    .filter(m => !busca || m.nome.toUpperCase().includes(busca) || (m.tag||'').toUpperCase().includes(busca))
    .sort((a,b)=>(a.loja+a.nome).localeCompare(b.loja+b.nome)).forEach(m=>{
      if(!byLoja[m.loja])byLoja[m.loja]=[];byLoja[m.loja].push(m);
    });

  document.getElementById('at-ml').innerHTML = Object.keys(byLoja).length===0
    ? '<div class="empty"><p>Nenhuma área encontrada.</p></div>'
    : Object.keys(byLoja).sort().map(loja=>`
    <div style="margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:1px;padding:6px 0;border-bottom:1px solid var(--bord);margin-bottom:4px;display:flex;justify-content:space-between">
        <span>${loja}</span><span style="color:var(--txt3);font-weight:400">${byLoja[loja].length}</span>
      </div>
      ${byLoja[loja].map((m,_i)=>{
        const gi=db.areas.indexOf(m);
        return `<div class="edit-row">
          <div>
            <div style="font-size:15px;font-weight:500">${m.nome}${m.tag?` <span style="font-size:11px;color:var(--txt3)">${m.tag}</span>`:''}</div>
          </div>
          <div class="edit-acts">
            <button class="btn btn-edit btn-sm" onclick="openEdit('maq',${gi})">✎</button>
            <button class="btn btn-d" onclick="delMaq(${gi})">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

async function popularModeloPadraoSelect() { /* removido — módulo Preventiva fora do escopo do varejo */ }

function addLoja() {
  const nome = v('at-sn').trim().toUpperCase();
  if (!nome) { showToast('Informe o nome da loja.'); return; }
  if (db.lojas.includes(nome)) { showToast('Loja já existe.'); return; }
  db.lojas.push(nome);
  db.lojas.sort();

  // Cria automaticamente as áreas padrão para a loja nova.
  // Se alguma já existir com o mesmo id (mesma loja+nome), pula — evita
  // duplicar em caso de reenvio/retry.
  const agora = new Date().toISOString();
  AREAS_PADRAO.forEach(areaNome => {
    const id = (nome + '_' + areaNome).replace(/\s+/g, '_');
    if (db.areas.some(a => a.id === id)) return;
    db.areas.push({ id, nome: areaNome, loja: nome, tag: '' });
    apiAppend('areas', { ID_Area: id, Loja: nome, Nome: areaNome, Tag: '', Descricao: '', Ativo: 'sim', Criado_Em: agora });
  });
  db.areas.sort((a, b) => (a.loja + a.nome).localeCompare(b.loja + b.nome));

  saveDB();
  sv('at-sn', '');
  populateAll();
  renderAtivos();
  apiAppend('lojas', { Nome: nome, Ativo: 'sim', Criado_Em: agora });
  showToast(`Loja criada com as ${AREAS_PADRAO.length} áreas padrão.`);
}

function addMaq() {
  const loja=v('at-ms'), nome=v('at-mn').trim().toUpperCase(),
  tag=v('at-mt').trim().toUpperCase();
  if(!loja||!nome){showToast('Selecione loja e informe o nome.');return;}
  const id=(loja+'_'+nome).replace(/\s+/g,'_');
  db.areas.push({id,nome,loja,tag});
  db.areas.sort((a,b)=>(a.loja+a.nome).localeCompare(b.loja+b.nome));
  saveDB(); sv('at-mn',''); sv('at-mt',''); populateAll(); renderAtivos();
  apiAppend('areas',{ID_Area:id,Loja:loja,Nome:nome,Tag:tag,Descricao:'',Ativo:'sim',Criado_Em:new Date().toISOString()});
}

function delLoja(nome) {
  if(!confirm(`Remover loja "${nome}" e suas áreas?`))return;
  db.lojas=db.lojas.filter(s=>s!==nome);
  db.areas=db.areas.filter(m=>m.loja!==nome);
  saveDB();populateAll();renderAtivos();
  apiDelete('lojas',nome,'Nome');
}

function delMaq(i) {
  if(!confirm('Remover área?'))return;
  const m=db.areas[i];
  db.areas.splice(i,1);saveDB();populateAll();renderAtivos();
  if(m)apiDelete('areas',m.id,'ID_Area');
}

// Editar loja/área
function openEdit(type,idx) {
  _editType=type;_editIdx=idx;
  if(type==='loja'){
    document.getElementById('me-t').textContent='Editar Loja';
    document.getElementById('me-b').innerHTML=`<div class="fg"><label>Nome da Loja</label><input type="text" id="me-v" value="${db.lojas[idx]}"></div>`;
  } else if(type==='maq') {
    const m=db.areas[idx];
    document.getElementById('me-t').textContent='Editar Área';
    document.getElementById('me-b').innerHTML=`
      <div class="fg"><label>Loja</label>
        <select id="me-sl">${db.lojas.sort().map(s=>`<option${s===m.loja?' selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="fg"><label>Nome</label><input type="text" id="me-nm" value="${m.nome}"></div>
      <div class="fg"><label>Tag</label><input type="text" id="me-tg" value="${m.tag||''}"></div>`;
  } else if(type==='plan') {
    // editarPlan já preenche me-b antes de abrir
  }
  openM('m-edit');
}

function salvarEdit() {
  if(_editType==='loja'){
    const nv=v('me-v').trim().toUpperCase();if(!nv)return;
    const old=db.lojas[_editIdx];
    db.lojas[_editIdx]=nv;db.areas.forEach(m=>{if(m.loja===old)m.loja=nv;});
    saveDB();populateAll();renderAtivos();closeM('m-edit');
    apiUpdate('lojas',old,'Nome',{Nome:nv});
  } else if(_editType==='maq') {
    const old=db.areas[_editIdx];
    const nv={id:old.id,nome:v('me-nm').trim().toUpperCase(),loja:v('me-sl'),tag:v('me-tg').trim().toUpperCase()};
    db.areas[_editIdx]=nv;
    db.areas.sort((a,b)=>(a.loja+a.nome).localeCompare(b.loja+b.nome));
    saveDB();populateAll();renderAtivos();closeM('m-edit');
    apiUpdate('areas',old.id,'ID_Area',{Loja:nv.loja,Nome:nv.nome,Tag:nv.tag});
  } else if(_editType==='plan') {
    const p = db.planejadas.find(x => x.numero === _editIdx);
    if (!p) return;
    p.loja = v('ep-loja') || p.loja;
    p.maq = v('ep-maq') || p.maq;
    p.tipo = v('ep-tipo') || p.tipo;
    p.prioridade = v('ep-prio') || p.prioridade;
    p.prazo = v('ep-prazo') || p.prazo;
    p.status = v('ep-status') || p.status;
    p.desc = v('ep-desc');
    logEdit('Editou Planejada', p.numero,
      `${p.loja} · ${p.maq} · Status: ${p.status} · Prazo: ${p.prazo}`);
    saveDB(); renderPlan(); closeM('m-edit');
    apiUpdate('planejadas', p.numero, 'PL_Numero', {
      Loja: p.loja,
      Area: p.maq,
      Tipo: p.tipo,
      Prioridade: p.prioridade,
      Prazo_Limite: p.prazo,
      Status: p.status,
      Descricao_Planejada:p.desc
    });
  }
}
