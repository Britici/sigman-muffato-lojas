/**
 * SIGMAN VAREJO — fotos.js
 * Seletor de múltiplas fotos com redimensionamento client-side via Canvas,
 * usando o MESMO algoritmo do industrial (abertura-os.js: previewSolPhoto):
 * limita a 1920x1080 e ~1MB, reduzindo qualidade JPEG em loop até caber.
 *
 * Widget reutilizável — usado tanto na abertura da O.S. (gerente) quanto
 * na conclusão (manutentor). widgetId precisa ter 3 elementos no HTML:
 *   #{widgetId}-drop    → área clicável/arrastável
 *   #{widgetId}-input   → <input type="file" multiple accept="image/*">
 *   #{widgetId}-preview → onde as miniaturas aparecem
 */

const _fotosState = {};

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Arquivo não é imagem')); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1920, MAX_H = 1080, MAX_BYTES = 1 * 1024 * 1024;
        let w = img.width, h = img.height;
        if (w > MAX_W || h > MAX_H) {
          const ratio = Math.min(MAX_W / w, MAX_H / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let quality = 0.92;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length * 0.75 > MAX_BYTES && quality > 0.4) {
          quality -= 0.06;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve({
          name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          mime: 'image/jpeg',
          b64: dataUrl.split(',')[1],
          dataUrl,
          kb: Math.round(dataUrl.length * 0.75 / 1024)
        });
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function initFotoPicker(widgetId) {
  _fotosState[widgetId] = [];
  _renderFotoPreview(widgetId);
}

function wireFotoDropzone(widgetId) {
  initFotoPicker(widgetId);
  const drop = document.getElementById(widgetId + '-drop');
  const input = document.getElementById(widgetId + '-input');
  if (!drop || !input) return;
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('drag');
    adicionarFotos(widgetId, e.dataTransfer.files);
  });
  input.addEventListener('change', () => { adicionarFotos(widgetId, input.files); input.value = ''; });
}

async function adicionarFotos(widgetId, fileList) {
  if (!_fotosState[widgetId]) _fotosState[widgetId] = [];
  const arquivos = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  for (const f of arquivos) {
    try {
      const resized = await resizeImageFile(f);
      _fotosState[widgetId].push(resized);
      _renderFotoPreview(widgetId); // renderiza incremental, não espera todas
    } catch (err) {
      showToast('Falha ao processar ' + f.name, 'er');
    }
  }
}

function removerFoto(widgetId, idx) {
  _fotosState[widgetId].splice(idx, 1);
  _renderFotoPreview(widgetId);
}

function _renderFotoPreview(widgetId) {
  const cont = document.getElementById(widgetId + '-preview');
  if (!cont) return;
  const fotos = _fotosState[widgetId] || [];
  cont.innerHTML = fotos.map((f, i) => `
    <div style="position:relative;display:inline-block;margin:0 8px 8px 0">
      <img class="photo-thumb" src="${f.dataUrl}" alt="${escapeHtml(f.name)}">
      <button type="button" onclick="removerFoto('${widgetId}', ${i})"
        style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;
               background:var(--red);color:#fff;border:none;cursor:pointer;font-size:12px;line-height:1">✕</button>
    </div>
  `).join('') + (fotos.length ? `<div style="font-size:12px;color:var(--txt3);width:100%">${fotos.length} foto(s) — ${fotos.reduce((s, f) => s + f.kb, 0)} KB total (redimensionadas)</div>` : '');
}

function getFotosPicker(widgetId) {
  return _fotosState[widgetId] || [];
}

// Envia todas as fotos do widget pro Drive (uma ação uploadFoto por foto,
// sequencial pra não sobrecarregar o Apps Script) e devolve array de URLs.
async function enviarFotosPicker(widgetId, loginUsuario) {
  const fotos = getFotosPicker(widgetId);
  const urls = [];
  for (const f of fotos) {
    const res = await apiPost({ action: 'uploadFoto', login: loginUsuario, fileName: f.name, mimeType: f.mime, base64: f.b64 });
    if (res && res.ok && res.fileUrl) urls.push(res.fileUrl);
    else showToast(`Falha ao enviar foto ${f.name} — chamado será salvo sem ela`, 'war');
  }
  return urls;
}
