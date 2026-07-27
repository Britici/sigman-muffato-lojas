/**
 * SIGMAN VAREJO — modais-helpers.js
 * Padrão: modal é .mb, classe .on adiciona pra abrir, conteúdo real
 * fica em .modal dentro do .mb.
 *
 * m-troca-senha-obrigatoria é intencionalmente excluído do fechamento
 * genérico (ESC / clique fora) — a troca de senha no primeiro login é
 * obrigatória, não pode ser escapada. Ver usuarios.js.
 */
const MODAIS_NAO_FECHAVEIS = ['m-troca-senha-obrigatoria'];

function openM(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn('Modal não encontrado:', id); return; }
  el.classList.add('on');
}

function closeM(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('on');
}

function closeAllModals() {
  document.querySelectorAll('.mb.on').forEach(el => {
    if (!MODAIS_NAO_FECHAVEIS.includes(el.id)) el.classList.remove('on');
  });
}

// ESC fecha qualquer modal aberto (exceto os não-fecháveis)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// Clique fora do conteúdo do modal fecha (assumindo .mb > .modal)
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('mb') && !MODAIS_NAO_FECHAVEIS.includes(e.target.id)) {
    e.target.classList.remove('on');
  }
});
