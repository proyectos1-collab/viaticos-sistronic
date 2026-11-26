/* Exporta usando el Excel original como plantilla: conserva hojas, estilos, logo, tabla, listas desplegables y fórmulas.
   Solo se escriben las celdas de ingreso manual; Excel recalcula todo al abrir. */
function cargarScript(src, glob) {
  if (window[glob]) return Promise.resolve(window[glob]);
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(window[glob]); s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
}
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const colNum = c => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const serial = iso => { const d = parseISO(iso); return d ? Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000) : ''; };
function hojaXML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const sd = doc.getElementsByTagNameNS(NS_MAIN, 'sheetData')[0];
  const filas = new Map(); for (const r of sd.getElementsByTagNameNS(NS_MAIN, 'row')) filas.set(r.getAttribute('r'), r);
  const celdas = new Map(); for (const c of sd.getElementsByTagNameNS(NS_MAIN, 'c')) celdas.set(c.getAttribute('r'), c);
  function celda(ref) {
    let c = celdas.get(ref); if (c) return c;
    const [, col, row] = ref.match(/^([A-Z]+)(\d+)$/);
    let r = filas.get(row);
    if (!r) {
      r = doc.createElementNS(NS_MAIN, 'row'); r.setAttribute('r', row);
      const sig = [...filas.values()].find(x => Number(x.getAttribute('r')) > Number(row));
      sd.insertBefore(r, sig || null); filas.set(row, r);
    }
    c = doc.createElementNS(NS_MAIN, 'c'); c.setAttribute('r', ref);
    const sig = [...r.getElementsByTagNameNS(NS_MAIN, 'c')].find(x => colNum(x.getAttribute('r').replace(/\d+/g, '')) > colNum(col));
    r.insertBefore(c, sig || null); celdas.set(ref, c);
    return c;
  }
  function set(ref, val, keepFormula) {
    const c = celda(ref);
    const f = keepFormula ? c.getElementsByTagNameNS(NS_MAIN, 'f')[0] : null;
    while (c.firstChild) c.removeChild(c.firstChild);
    c.removeAttribute('t');
    if (f) c.appendChild(f);
    if (val === '' || val == null) { if (f) { c.setAttribute('t', 'str'); c.appendChild(doc.createElementNS(NS_MAIN, 'v')); } return; }
    if (typeof val === 'number') { const v = doc.createElementNS(NS_MAIN, 'v'); v.textContent = String(val); c.appendChild(v); return; }
    if (f) { c.setAttribute('t', 'str'); const v = doc.createElementNS(NS_MAIN, 'v'); v.textContent = String(val); c.appendChild(v); return; }
    c.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(NS_MAIN, 'is'), t = doc.createElementNS(NS_MAIN, 't');
    t.setAttribute('xml:space', 'preserve'); t.textContent = String(val); is.appendChild(t); c.appendChild(is);
  }
  return { set, xml: () => new XMLSerializer().serializeToString(doc) };
}
async function exportarExcel() {
  const JSZip = await cargarScript('vendor/jszip.min.js', 'JSZip');
  const resp = await fetch('vendor/plantilla.xlsx');
  if (!resp.ok) throw new Error('No se encontró la plantilla de Excel');
  const zip = await JSZip.loadAsync(await resp.arrayBuffer());
  const v = viaje();
  const FILAS = 499; // tblGastos va de la fila 14 a la 512
  if (v.gastos.length > FILAS) toast(`Solo caben ${FILAS} gastos en la plantilla; se exportan los primeros ${FILAS}`);

  // Hoja 1: Control de Gastos
  const p1 = 'xl/worksheets/sheet1.xml', h1 = hojaXML(await zip.file(p1).async('string'));
  const num = x => (x === '' || x == null || isNaN(Number(x))) ? x : Number(x);
  h1.set('C2', v.trabajador); h1.set('C3', v.cedula); h1.set('C4', v.cliente); h1.set('C5', v.servicio);
  h1.set('C6', v.cot); h1.set('C7', v.os); h1.set('C8', v.ciudad);
  h1.set('I2', serial(v.inicio)); h1.set('I3', serial(v.fin)); h1.set('I4', Number(v.anticipo) || 0);
  const gs = [...v.gastos].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).slice(0, FILAS);
  let acc = 0;
  for (let i = 0; i < FILAS; i++) {
    const r = 14 + i, g = gs[i];
    if (g) acc += Number(g.valor) || 0;
    h1.set('B' + r, g ? serial(g.fecha) : ''); h1.set('C' + r, g ? g.concepto : ''); h1.set('D' + r, g ? g.sub : '');
    h1.set('E' + r, g ? g.proveedor : ''); h1.set('F' + r, g ? g.desc : ''); h1.set('G' + r, g ? num(g.valor) : '');
    h1.set('H' + r, g ? g.pagadoPor : ''); h1.set('I' + r, g ? g.factura : ''); h1.set('J' + r, g ? g.soporte : '');
    h1.set('K' + r, g ? estado(g) : '', true); h1.set('L' + r, g ? acc : '', true); h1.set('M' + r, g ? g.obs : '');
  }
  zip.file(p1, h1.xml());

  // Hoja Legalización FO-AD-03 (sheet4.xml)
  const p4 = 'xl/worksheets/sheet4.xml', h4 = hojaXML(await zip.file(p4).async('string'));
  const fl = parseISO(v.fechaLeg);
  h4.set('B10', v.lugar); h4.set('C10', fl ? fl.getDate() : ''); h4.set('D10', fl ? fl.getMonth() + 1 : ''); h4.set('E10', fl ? fl.getFullYear() % 100 : '');
  h4.set('G7', num(v.consecutivo)); h4.set('F18', v.efectivo === '' || v.efectivo == null ? '' : Number(v.efectivo));
  zip.file(p4, h4.xml());

  // Hoja Listas (sheet5.xml): subconceptos A–D, filas 2 a 40
  const p5 = 'xl/worksheets/sheet5.xml', h5 = hojaXML(await zip.file(p5).async('string'));
  ['Transporte', 'Alimentación', 'Alojamiento', 'Otros gastos'].forEach((k, i) => {
    const col = 'ABCD'[i], arr = S.listas[k] || [];
    for (let r = 2; r <= 40; r++) h5.set(col + r, arr[r - 2] || '');
  });
  zip.file(p5, h5.xml());

  // Forzar recálculo completo al abrir
  const pw = 'xl/workbook.xml';
  let wb = await zip.file(pw).async('string');
  wb = wb.replace(/<calcPr([^>]*?)\/>/, (m, a) => '<calcPr' + a.replace(/\s*fullCalcOnLoad="[^"]*"/, '') + ' fullCalcOnLoad="1"/>');
  zip.file(pw, wb);

  const nombre = `COT_${(v.cot || 'sin-cot').replace(/[^\w.-]+/g, '_')} ${v.cliente || ''} - ${v.servicio || 'viaticos'}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.xlsx';
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await entregarArchivo(blob, nombre);
}
