/**
 * SIGMAN VAREJO — utils-offline.js
 * Toast + alert inline + banner offline. Vocabulário de tipo idêntico ao
 * industrial: 'ok' | 'er' | 'inf' | 'war' — NÃO usar 'erro'/'sucesso'/
 * 'aviso' em nenhum lugar, essas strings não batem com o CSS (.toast.ok,
 * .toast.er, .toast.inf, .toast.war / .alert.ok, .alert.er).
 */

// ── TOAST ──
function showToast(msg, type = 'ok', dur = 3500) {
  let cont = document.getElementById('toast-cont');
  if (!cont) { cont = document.createElement('div'); cont.id = 'toast-cont'; document.body.appendChild(cont); }
  const icons = { ok: '✅', er: '❌', inf: 'ℹ️', war: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  cont.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, dur);
}

// ── ALERT INLINE (dentro de formulário/página) ──
function showAlert(id, msg, type = 'ok') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'alert ' + type + ' on';
  setTimeout(() => el.classList.remove('on'), 4000);
}

function lAlert(msg) {
  showToast(msg, 'er');
}

// ── BANNER OFFLINE ──
function setOffline(on) {
  const b = document.getElementById('offline-banner');
  if (!b) return;
  b.classList.toggle('on', on);
  const filaLen = JSON.parse(localStorage.getItem('sigman_fila') || '[]').length;
  if (on) {
    b.textContent = `⚠️ Sem conexão${filaLen ? ` — ${filaLen} pendente(s) na fila` : ''}`;
  }
}

window.addEventListener('online', () => setOffline(false));
window.addEventListener('offline', () => setOffline(true));
window.addEventListener('DOMContentLoaded', () => setOffline(!navigator.onLine));

// ── INDICADOR DE FILA PENDENTE (topbar) ──
function atualizarStatusFila() {
  const el = document.getElementById('tb-stat');
  if (!el) return;
  const filaLen = JSON.parse(localStorage.getItem('sigman_fila') || '[]').length;
  el.textContent = filaLen ? `⏳ ${filaLen} pendente(s)` : '';
  el.style.display = filaLen ? 'flex' : 'none';
}
setInterval(atualizarStatusFila, 3000);
window.addEventListener('DOMContentLoaded', atualizarStatusFila);
