/**
 * SIGMAN VAREJO — helpers.js
 */

// v(id) — lê valor de um <input>/<select>/<textarea> pelo id (convenção
// idêntica ao SIGMAN industrial — usado em todo o código de formulário).
const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };

// sv(id, val) — seta valor de um campo pelo id.
const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

const today = () => new Date().toISOString().slice(0, 10);

// vf(x) — formata um VALOR já em mãos pra exibição (não lê DOM). Nome
// diferente de v() de propósito: são funções com contratos opostos
// (v() lê id→valor, vf() formata valor→string) e usar o mesmo nome já
// causou um bug real nesta base de código (chamados.js/usuarios.js
// chamavam v('algum-id') esperando ler do DOM, mas v() fazia vf()).
function vf(x) {
  return (x === undefined || x === null || x === '') ? '—' : x;
}

function roleBadge(tipo) {
  const c = { admin: 'b-adm', manutentor: 'b-man', gerente_loja: 'b-pro' };
  const l = { admin: 'Administração', manutentor: 'Manutenção', gerente_loja: 'Gerente de Loja' };
  return `<span class="badge ${c[tipo] || ''}">${l[tipo] || tipo}</span>`;
}

function statusBadge(status) {
  const c = { Aberta: 'b-pen', Em_Atendimento: 'b-pre', Concluida: 'b-con', Cancelada: '' };
  const l = { Aberta: 'Aberta', Em_Atendimento: 'Em Atendimento', Concluida: 'Concluída', Cancelada: 'Cancelada' };
  return `<span class="badge ${c[status] || ''}">${l[status] || status}</span>`;
}

function prioridadeBadge(p) {
  const c = { CRITICO: 'b-urg', EMERGENCIAL: 'b-med', MELHORIA: 'b-mel', PLANEJADO: '' };
  return `<span class="badge ${c[p] || ''}">${p}</span>`;
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

// Diferença em horas entre duas datas ISO — usado no dashboard (tempo de atendimento)
function diffHoras(inicioIso, fimIso) {
  if (!inicioIso || !fimIso) return null;
  const ms = new Date(fimIso).getTime() - new Date(inicioIso).getTime();
  return Math.round((ms / 3600000) * 10) / 10;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str == null ? '' : str);
  return div.innerHTML;
}
