/* ---------- Lectura de facturas con Gemini ---------- */
let IA = { key: '', modelo: 'gemini-2.5-flash', auto: true };
async function cargarIA() { try { const x = await DB.get('ia'); if (x) IA = Object.assign(IA, x); } catch {} }
function guardarIA() { return DB.set('ia', IA); }
const iaLista = () => !!(IA.key && IA.key.trim());
let iaLeyendo = false;

async function leerFacturaIA(dataUrl) {
  const conceptos = Object.keys(S.listas);
  const subs = conceptos.map(c => `${c}: ${S.listas[c].join(', ')}`).join('\n');
  const prompt = `Eres un asistente contable en Colombia. Lee la factura, recibo o comprobante de la imagen y devuelve SOLO un JSON con:
- proveedor: nombre comercial del establecimiento o empresa que emite el documento (ej. "Rappi", "Hotel Casa Rueda", "Uber").
- nit: NIT o documento del proveedor si aparece, si no "".
- fecha: fecha del documento en formato AAAA-MM-DD, si no aparece "".
- factura: número de factura, recibo, comprobante o ticket (incluya prefijo si lo hay), si no "".
- valor: valor TOTAL pagado en pesos colombianos como número entero sin puntos ni símbolos (incluye impuestos y propina si está en el total).
- concepto: uno de: ${conceptos.join(', ')}.
- subconcepto: uno de la lista del concepto elegido:
${subs}
- descripcion: descripción corta del gasto (máx. 8 palabras), en español.
Si un dato no se puede leer, deje "" (o 0 en valor). No invente datos.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      proveedor: { type: 'STRING' }, nit: { type: 'STRING' }, fecha: { type: 'STRING' }, factura: { type: 'STRING' },
      valor: { type: 'NUMBER' }, concepto: { type: 'STRING', enum: conceptos }, subconcepto: { type: 'STRING' }, descripcion: { type: 'STRING' }
    },
    required: ['proveedor', 'fecha', 'factura', 'valor', 'concepto', 'subconcepto', 'descripcion']
  };
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(IA.modelo || 'gemini-2.5-flash')}:generateContent`;
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 45000);
  let r;
  try {
    r = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': IA.key.trim() },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema }
      })
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Gemini tardó demasiado en responder' : 'Sin conexión a internet');
  } finally { clearTimeout(to); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || ('Error ' + r.status);
    if (r.status === 400 && /API key/i.test(msg)) throw new Error('La clave de Gemini no es válida');
    if (r.status === 403) throw new Error('La clave de Gemini no tiene permiso');
    if (r.status === 429) throw new Error('Se alcanzó el límite gratuito de Gemini; intente más tarde');
    throw new Error('Gemini: ' + msg);
  }
  const txt = (j?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Gemini no devolvió datos de la factura');
  return normalizarIA(JSON.parse(m[0]));
}
function normalizarIA(d) {
  const out = {};
  const s = x => (x == null ? '' : String(x)).trim();
  out.proveedor = s(d.proveedor); out.nit = s(d.nit); out.factura = s(d.factura); out.descripcion = s(d.descripcion);
  const f = s(d.fecha); let iso = '';
  let mm = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (mm) iso = `${mm[1]}-${pad(mm[2])}-${pad(mm[3])}`;
  else if ((mm = f.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) iso = `${mm[3].length === 2 ? '20' + mm[3] : mm[3]}-${pad(mm[2])}-${pad(mm[1])}`;
  out.fecha = /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(parseISO(iso)) ? iso : '';
  const v = typeof d.valor === 'number' ? d.valor : parseValor(d.valor);
  out.valor = v > 0 ? Math.round(v) : '';
  const conceptos = Object.keys(S.listas);
  out.concepto = conceptos.find(c => c.toLowerCase() === s(d.concepto).toLowerCase()) || '';
  const lista = out.concepto ? S.listas[out.concepto] : [];
  out.sub = lista.find(x => x.toLowerCase() === s(d.subconcepto).toLowerCase()) || '';
  return out;
}
async function aplicarIA(dataUrl) {
  if (!iaLista() || iaLeyendo || !editando) return;
  if (!navigator.onLine) { toast('Sin internet: llene los datos a mano'); return; }
  iaLeyendo = true; const id = editando.id;
  leerFormGasto(); pintarGasto();
  try {
    const d = await leerFacturaIA(dataUrl);
    if (!editando || editando.id !== id) return;
    leerFormGasto();
    const g = editando, llenos = [];
    const set = (k, val, label) => { if (val !== '' && val != null && (g[k] === '' || g[k] == null)) { g[k] = val; llenos.push(label); } };
    set('valor', d.valor, 'valor'); set('proveedor', d.proveedor, 'proveedor'); set('factura', d.factura, 'N° factura'); set('desc', d.descripcion, 'descripción');
    if (d.fecha && (g._nuevo || !g.fecha)) { g.fecha = d.fecha; llenos.push('fecha'); }
    if (d.concepto && (g._nuevo || !g.sub)) { if (g.concepto !== d.concepto || !g.sub) { g.concepto = d.concepto; g.sub = d.sub; llenos.push('concepto'); } }
    if (d.nit && !/NIT/i.test(g.obs || '')) { g.obs = (g.obs ? g.obs + ' · ' : '') + 'NIT ' + d.nit; llenos.push('NIT'); }
    g._ia = llenos;
    toast(llenos.length ? 'Datos leídos con IA. Revíselos antes de guardar.' : 'La IA no encontró datos nuevos');
  } catch (e) {
    toast(e.message || 'No se pudo leer la factura');
  } finally {
    iaLeyendo = false;
    if (editando && editando.id === id) pintarGasto();
  }
}
function vIA() {
  return `<h2>Lectura de facturas con IA (Gemini)</h2>
  <div class="card form">
    <p class="hint" style="margin:0">Al tomar la foto de una factura, la app la envía a Gemini de Google y llena sola el valor, la fecha, el proveedor, el N° de factura y el concepto. Usted revisa y guarda. Sin internet o sin clave, todo sigue funcionando a mano.</p>
    <label class="field"><span>Clave de API de Gemini</span>
      <div class="row" style="flex-wrap:nowrap"><input id="ia-key" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(IA.key)}" style="flex:1;min-width:0"><button class="btn" type="button" data-act="ia-ver" style="flex:0 0 auto">Ver</button></div></label>
    <label class="field"><span>Modelo</span><input id="ia-modelo" value="${esc(IA.modelo)}" spellcheck="false"></label>
    <label class="row" style="align-items:center;gap:10px"><input id="ia-auto" type="checkbox" ${IA.auto ? 'checked' : ''} style="width:22px;height:22px"> <span>Leer la factura automáticamente al tomar la foto</span></label>
    <div class="row"><button class="btn primary" data-act="ia-probar">Probar clave</button>${IA.key ? '<button class="btn" data-act="ia-borrar">Borrar clave</button>' : ''}</div>
    <div id="ia-estado" class="hint">${iaLista() ? 'Clave guardada en este celular.' : 'Sin clave: la lectura automática está apagada.'}</div>
    <details><summary style="cursor:pointer;font-weight:600">Cómo sacar la clave gratis (2 minutos)</summary>
      <ol class="hint" style="padding-left:18px;margin:8px 0 0">
        <li>Entre a <b>aistudio.google.com/apikey</b> con su cuenta de Google (Gmail).</li>
        <li>Toque <b>Create API key</b> (Crear clave de API) y acepte.</li>
        <li>Copie la clave (empieza por <b>AIza</b>) y péguela arriba.</li>
        <li>Toque <b>Probar clave</b>.</li>
      </ol>
      <p class="hint">La clave se guarda solo en este celular y no se incluye en las copias de seguridad. Las fotos se envían a Google para leerlas. El plan gratuito de Gemini tiene un límite diario de lecturas y Google puede usar esos datos para mejorar sus productos; para evitarlo, active la facturación en Google AI Studio.</p>
    </details>
  </div>`;
}
async function probarIA() {
  const st = $('#ia-estado'); if (!iaLista()) { st.textContent = 'Primero pegue la clave.'; return; }
  st.textContent = 'Probando…';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(IA.modelo || 'gemini-2.5-flash')}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': IA.key.trim() },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Responda solo: OK' }] }] })
    });
    const j = await r.json().catch(() => ({}));
    st.textContent = r.ok ? '✔ La clave funciona. Ya puede tomar fotos de facturas.' : '✖ ' + (j?.error?.message || ('Error ' + r.status));
  } catch { st.textContent = '✖ Sin conexión a internet.'; }
}
