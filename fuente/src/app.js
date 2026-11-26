'use strict';
/* ===== Viáticos: replica el libro "Control de Gastos y Viáticos" =====
   Hojas del Excel -> pantallas:
   Control de Gastos -> Gastos  |  Resumen -> Resumen  |  Control Facturas -> Facturas
   Legalización FO-AD-03 -> Legalización  |  Listas -> Ajustes (Viaje) */

const LISTAS_DEF = {
  'Transporte': ['Taxi','Uber','DiDi','InDrive','Bus','Transporte público','Transporte intermunicipal','Transporte municipal','Transporte aeropuerto','Combustible','Peajes','Parqueadero','Otros transportes'],
  'Alimentación': ['Desayuno','Almuerzo','Cena','Refrigerio','Bebidas','Otros alimentos'],
  'Alojamiento': ['Hotel','Hostal','Airbnb','Apartamento','Otros alojamientos'],
  'Otros gastos': ['Lavandería','Papelería','Materiales','Herramientas','Mensajería','Internet','Imprevistos','Otros']
};
const PAGADORES = ['Empleado','Sistronic'];
const SOPORTES = ['Sí','No','Excepción'];
const ESTADOS = ['LEGALIZADO','PENDIENTE','NO REQUIERE SOPORTE','PAGADO POR SISTRONIC'];
const MAX_LINEAS_FO = 18;

/* La app empieza vacía: no trae datos de ejemplo */
/* Huellas (SHA-256) del viaje de ejemplo que traían versiones anteriores, para borrarlo de las cuentas de otras personas sin guardar esos datos en el código */
const EJEMPLO_HUELLAS = { ced: '6946094a2a6855f9f482a99b6198792686b83ce3932a996e690030437afbf9b0', nom: 'a27b53c4c6e142204d2a641755c9e82f207b6a1d755e5491d538c9a7bc260fdf', gastos: ['605fac686ebb2e11f5a1b6d2c77b8a6420a12db0dbc8152758e7e69ec4fde4ea', '3aa6f4bfe2dd206c9b95f2b92af1b6515fadf0adf5f7b1cb81e849c5c839715c', '5fe274a1102f967c61fdc992f42c49628207b7b4a8be0e30eea28f3664288955', 'dc1ec53d95c6739c8bc7b51823158a503c23272600eb4e77aa0018cb2338873e', '345a90e85fbcf98defd2c7cc545523d869b72fb65cb50444a81b2dccaace80bc', '7cf005b49596011bc678bc33cd1977f59b32c329cf234bcd837e8168443059d9', '7f10ce78464f4a16bca28d1515ff0385eb66da2c32e29f960c55fb16b37b564e', '2b2280530121b60f7a91e9924f543c1e4f78ef7daa5d8aec162b00e8c011dd61', '6212cec6b506c7b7d26612ccfcd86cb8f47a1e558bb3a5a97c3dad160a9d2bd3', '5ef547daeb41660e74ecf044c41456b616706fcc1c720e3230a822f14fda3e95', '764026e67ce50512c7428f38ffb2a2ee73c75e3839670b030f5b8fd584f0716d', 'cbd1deb9e9367b045504dcbe1b3746b57636413788333cfd22a1a4ea7a4d11b9', '986b35858f51c28fe72df65c50fddd2e4960a84912eb22b89e023b5c2a9f9b22', '9eaff817e9a7bab60771ed0e85bb296834b827704189a3136a8e7b07e16862f1', 'aa3ce6a9f6479e8a12a3a743cfbccfe62f5e458e5d31ec0f04fbafbfbd0bbf7b', '95ee926ee2a019370a992451bc7a13c6365dc03a8f628520cc1033e4a8e3c43e', '2a2123f193c2b8b2f098673f60ea42c15c74e7f77d1c6b9eff595e508e8996db'], prov: ['a4b5077a6387715b54f5509931b6e752a4d8e171a98cd82a6a8714575aa9b110', 'b0937c3c0cbe685e209a7ad6dde70b0f1a9f04d9e15decd8cd68a4ead9e55c2e', 'de664eb733e455c4f125f6efa0760573154036a259d24e792dd28ab921d544f2', '9736e81a08ac536ce059c5e5a634fd582d6f979186da7e819e0f12027c7257d4', '462d0a63335dd37ce8c9c055ca60bf00c288f5da30fa98b6a64a3f78c46e4784', 'e7a29de61184fb9289a53e9e178500e217fcb954b4ebd554ef57b498a0bb24ba'] };

/* ---------- Utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtCOP = n => { const x = Math.round(Number(n) || 0); return (x < 0 ? '-$ ' : '$ ') + Math.abs(x).toLocaleString('es-CO'); };
const fmtPct = n => (Number.isFinite(n) ? (n * 100).toFixed(1).replace('.', ',') : '0') + '%';
const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parseISO = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtFecha = s => { const d = parseISO(s); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''; };
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fmtDia = s => { const d = parseISO(s); return d ? `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : 'Sin fecha'; };
const parseValor = v => { const n = Number(String(v).replace(/[^\d-]/g, '')); return Number.isFinite(n) ? n : 0; };
const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();

/* ---------- Almacenamiento (IndexedDB con respaldo en localStorage) ---------- */
const DB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('viaticos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  async function get(k) {
    try {
      const db = await open();
      return await new Promise((res, rej) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
    } catch { try { const v = localStorage.getItem('viaticos:' + k); return v ? JSON.parse(v) : undefined; } catch { return undefined; } }
  }
  async function set(k, v) {
    try {
      const db = await open();
      await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch { try { localStorage.setItem('viaticos:' + k, JSON.stringify(v)); } catch {} }
  }
  async function del(k) {
    try { const db = await open(); await new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; }); }
    catch { try { localStorage.removeItem('viaticos:' + k); } catch {} }
  }
  return { get, set, del };
})();

/* ---------- Estado ---------- */
let S = null;          // { viajes:[], activo, listas, perfil }
let tab = 'gastos';
let filtroFact = 'Todos';

function nuevoGasto(arr) {
  const [fecha, concepto, sub, proveedor, desc, valor, pagadoPor, factura, soporte, obs] = arr;
  return { id: uid(), fecha, concepto, sub, proveedor, desc, valor, pagadoPor, factura, soporte, obs, foto: false };
}
function nuevoViaje(base = {}) {
  return Object.assign({ id: uid(), trabajador: S?.perfil?.trabajador || '', cedula: S?.perfil?.cedula || '', cliente: '', servicio: '', cot: '', os: '', ciudad: '', inicio: todayISO(), fin: todayISO(), anticipo: 0, lugar: S?.perfil?.lugar || 'Yumbo', fechaLeg: '', consecutivo: '', efectivo: '', gastos: [] }, base);
}
async function cargar() {
  S = await DB.get('state');
  if (!S || !Array.isArray(S.viajes)) {
    S = { viajes: [], activo: '', listas: JSON.parse(JSON.stringify(LISTAS_DEF)), perfil: { trabajador: '', cedula: '', lugar: 'Yumbo' } };
    const v = nuevoViaje(); S.viajes.push(v); S.activo = v.id;
    await guardar();
  }
  if (!S.listas) S.listas = JSON.parse(JSON.stringify(LISTAS_DEF));
  try { sincronizarProveedores(); } catch (e) { console.error(e); }
}
let saveTimer = null;
let saveRes = [];
function guardar() { clearTimeout(saveTimer); return new Promise(r => { saveRes.push(r); saveTimer = setTimeout(guardarYa, 60); }); }
async function guardarYa() {
  clearTimeout(saveTimer); const rs = saveRes; saveRes = [];
  await DB.set('state', S);
  try { await sellar(); if (sellar.cambio) programarSync(); } catch (e) { console.error(e); }
  rs.forEach(r => r());
}
const viaje = () => S.viajes.find(v => v.id === S.activo) || S.viajes[0];

/* ---------- Cálculos (equivalentes a las fórmulas del Excel) ---------- */
function estado(g) {
  if (g.valor === '' || g.valor == null) return '';
  if (g.pagadoPor === 'Sistronic') return 'PAGADO POR SISTRONIC';
  if (g.soporte === 'Excepción') return 'NO REQUIERE SOPORTE';
  if (g.soporte !== 'Sí') return 'PENDIENTE';
  return 'LEGALIZADO';
}
const chipClass = e => e === 'LEGALIZADO' ? 'st-LEGALIZADO' : e === 'PENDIENTE' ? 'st-PENDIENTE' : e === 'PAGADO POR SISTRONIC' ? 'st-SIS' : 'st-NO';
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const conValor = v => v.gastos.filter(g => g.valor !== '' && g.valor != null);

function diasServicio(v) {
  const a = parseISO(v.inicio), b = parseISO(v.fin);
  return a && b ? Math.round((b - a) / 86400000) + 1 : '';
}
function indicadores(v) {
  const gs = conValor(v);
  const emp = gs.filter(g => g.pagadoPor !== 'Sistronic');
  const anticipo = Number(v.anticipo) || 0;
  const gastado = sum(emp, g => g.valor);
  return {
    anticipo, gastado, saldo: anticipo - gastado,
    sistronic: sum(gs.filter(g => g.pagadoPor === 'Sistronic'), g => g.valor),
    conSoporte: sum(emp.filter(g => g.soporte === 'Sí'), g => g.valor),
    pendiente: sum(gs.filter(g => estado(g) === 'PENDIENTE'), g => g.valor),
    total: sum(gs, g => g.valor),
    ejecutado: anticipo ? gastado / anticipo : 0
  };
}
function resumen(v) {
  const gs = conValor(v), I = indicadores(v);
  const conceptos = Object.keys(S.listas);
  const porConcepto = conceptos.map(c => ({ c, t: sum(gs.filter(g => g.concepto === c), g => g.valor) }));
  // otros conceptos no listados
  [...new Set(gs.map(g => g.concepto).filter(c => c && !conceptos.includes(c)))].forEach(c => porConcepto.push({ c, t: sum(gs.filter(g => g.concepto === c), g => g.valor) }));
  const totalConc = sum(porConcepto, x => x.t);
  // concepto + subconcepto, ordenado por orden de concepto y luego total desc
  const m = new Map();
  gs.filter(g => g.concepto).forEach(g => { const k = g.concepto + '\u0000' + (g.sub || ''); const o = m.get(k) || { c: g.concepto, s: g.sub || '', n: 0, t: 0 }; o.n++; o.t += Number(g.valor) || 0; m.set(k, o); });
  const ord = c => { const i = conceptos.indexOf(c); return i < 0 ? 99 : i; };
  const porSub = [...m.values()].sort((a, b) => ord(a.c) - ord(b.c) || b.t - a.t);
  // por día (inicio -> fin, máx 31)
  const dias = [];
  const a = parseISO(v.inicio), b = parseISO(v.fin);
  if (a) for (let d = new Date(a), i = 0; i < 31 && (!b || d <= b); i++, d.setDate(d.getDate() + 1)) {
    const iso = toISO(d), del = gs.filter(g => g.fecha === iso);
    dias.push({ f: iso, t: sum(del, g => g.valor), n: del.length });
  }
  const totDias = sum(dias, x => x.t);
  const fuera = I.total - totDias;
  const mayor = dias.reduce((m, x) => x.t > (m?.t || 0) ? x : m, null);
  // por proveedor
  const pm = new Map();
  gs.forEach(g => { const k = g.proveedor || '(sin proveedor)'; const o = pm.get(k) || { p: k, t: 0, n: 0 }; o.t += Number(g.valor) || 0; o.n++; pm.set(k, o); });
  const porProv = [...pm.values()].sort((x, y) => y.t - x.t);
  return { I, porConcepto, totalConc, porSub, dias, totDias, fuera, mayor, porProv };
}
function facturas(v) {
  const gs = conValor(v);
  const por = {};
  ESTADOS.forEach(e => { const x = gs.filter(g => estado(g) === e); por[e] = { t: sum(x, g => g.valor), n: x.length }; });
  return {
    por,
    total: { t: sum(gs, g => g.valor), n: gs.length },
    aLegalizar: { t: por['LEGALIZADO'].t + por['PENDIENTE'].t + por['NO REQUIERE SOPORTE'].t, n: por['LEGALIZADO'].n + por['PENDIENTE'].n + por['NO REQUIERE SOPORTE'].n },
    faltantes: por['PENDIENTE'].n
  };
}
function legalizacion(v) {
  const gs = conValor(v).filter(g => g.pagadoPor !== 'Sistronic');
  const m = new Map();
  gs.forEach(g => {
    const k = (g.sub || g.concepto || '').trim();
    const o = m.get(k) || { d: k, n: 0, t: 0, f: new Set() };
    o.n++; o.t += Number(g.valor) || 0; if (g.factura) o.f.add(g.factura); m.set(k, o);
  });
  const lineas = [...m.values()].sort((a, b) => a.d.localeCompare(b.d, 'es')).map(o => ({
    d: o.d, n: o.n, t: o.t, unit: o.n ? o.t / o.n : 0,
    f: o.f.size === 0 ? 'Sin factura' : o.f.size === 1 ? [...o.f][0] : `${o.f.size} facturas`
  }));
  const total = sum(lineas.slice(0, MAX_LINEAS_FO), l => l.t);
  const I = indicadores(v);
  let aviso, ok = false;
  if (lineas.length > MAX_LINEAS_FO) aviso = `⚠ ${lineas.length} conceptos: el formato tiene ${MAX_LINEAS_FO} líneas`;
  else if (total !== I.gastado) aviso = '⚠ Total no cuadra con Control de Gastos';
  else { aviso = '✔ Cuadra con Control de Gastos'; ok = true; }
  return { lineas, total, aviso, ok, anticipo: I.anticipo, diferencia: I.anticipo - total };
}

/* ---------- Iconos ---------- */
const ICON = {
  gastos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  resumen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  facturas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
  legal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  viaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};
const TABS = [['gastos', 'Gastos', ICON.gastos], ['resumen', 'Resumen', ICON.resumen], ['facturas', 'Facturas', ICON.facturas], ['legal', 'Legalización', ICON.legal], ['viaje', 'Viaje', ICON.viaje]];

/* ---------- Render ---------- */
function render() {
  const v = viaje();
  $('#trip-name').textContent = [v.cliente || 'Viaje sin nombre', v.cot ? 'COT ' + v.cot : ''].filter(Boolean).join(' · ');
  $('#trip-sub').textContent = `${v.servicio || ''}${v.ciudad ? ' — ' + v.ciudad : ''} · ${fmtFecha(v.inicio)} a ${fmtFecha(v.fin)}`;
  $('#tabs').innerHTML = TABS.map(([k, l, i]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${i}<span>${l}</span></button>`).join('');
  $('#fab').hidden = !(tab === 'gastos' || tab === 'facturas');
  const main = $('#main');
  main.innerHTML = `<div id="sync-chip">${syncChipHTML()}</div>` + ({ gastos: vGastos, resumen: vResumen, facturas: vFacturas, legal: vLegal, viaje: vViaje, config: vConfig, conceptos: vConceptos })[tab](v);
  pintarAvatar();
  main.focus({ preventScroll: true });
}

function vGastos(v) {
  const I = indicadores(v);
  const pct = Math.min(100, Math.max(0, I.ejecutado * 100));
  const nDup = gruposDuplicados().filter(gr => gr.some(x => x.v.id === v.id)).length;
  let h = `${nDup ? `<div class="note dup" style="margin-bottom:12px">⛔ <b>${nDup === 1 ? 'Hay una factura registrada más de una vez' : `Hay ${nDup} facturas registradas más de una vez`}</b> en este viaje.<div class="row" style="margin-top:8px"><button class="btn dup-btn" data-act="dup-abrir">Revisar y eliminar repetidas</button></div></div>` : ''}<h2>Control de gastos</h2>
  <div class="kpis">
    <div class="kpi hero ${I.saldo < 0 ? 'neg' : ''}"><div><div class="l">Saldo disponible</div><div class="v num">${fmtCOP(I.saldo)}</div></div>
      <div style="text-align:right"><div class="l">Anticipo</div><div class="num" style="font-weight:700">${fmtCOP(I.anticipo)}</div></div>
      <div class="meter" title="Anticipo ejecutado"><i style="width:${pct}%"></i></div>
      <div class="l" style="flex-basis:100%">${fmtPct(I.ejecutado)} del anticipo ejecutado · ${diasServicio(v) || 0} días de servicio</div></div>
    <div class="kpi total-kpi"><div class="l">Total de viáticos gastados</div><div class="v num">${fmtCOP(I.total)}</div><div class="s">${conValor(v).length} gastos · empleado + Sistronic</div></div>
    <div class="kpi"><div class="l">Gastado por empleado</div><div class="v num">${fmtCOP(I.gastado)}</div></div>
    <div class="kpi"><div class="l">Pagado por Sistronic</div><div class="v num">${fmtCOP(I.sistronic)}</div></div>
    <div class="kpi"><div class="l">Con soporte (empleado)</div><div class="v num">${fmtCOP(I.conSoporte)}</div></div>
    <div class="kpi ${I.pendiente ? 'warn' : ''}"><div class="l">Pendiente de soporte</div><div class="v num">${fmtCOP(I.pendiente)}</div></div>
  </div>
  <h2>Gastos registrados (${v.gastos.length})</h2>`;
  if (!v.gastos.length) return h + `<div class="empty">Todavía no hay gastos en este viaje.<br>Toque <b>Registrar gasto</b> para agregar el primero.</div>`;
  const orden = [...v.gastos].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  let dia = null;
  h += '<div class="list">';
  for (const g of orden) {
    if (g.fecha !== dia) {
      dia = g.fecha;
      const tot = sum(v.gastos.filter(x => x.fecha === dia), x => x.valor);
      h += `<div class="day"><span>${fmtDia(dia)}</span><span class="num">${fmtCOP(tot)}</span></div>`;
    }
    const e = estado(g);
    h += `<button class="item" data-edit="${g.id}">
      <span class="t">${esc(g.sub || g.concepto)}${g.proveedor ? ' · ' + esc(g.proveedor) : ''}</span><span class="a num">${fmtCOP(g.valor)}</span>
      <span class="s">${esc(g.desc || g.concepto)}${g.factura ? ' · Fact. ' + esc(g.factura) : ''}${g.foto ? ' · 📷' : ''}${g.corte && corteDeGasto(g) ? ' · 🔒 Corte ' + corteDeGasto(g).n : ''}</span><span class="chip ${chipClass(e)}">${e === 'PAGADO POR SISTRONIC' ? 'SISTRONIC' : e}</span>
    </button>`;
  }
  return h + '</div>';
}

/* Estado de revisión del viaje */
const REV = { enviado: ['Enviado a revisión', 'st-SIS'], aprobado: ['Aprobado', 'st-LEGALIZADO'], devuelto: ['Devuelto', 'st-PENDIENTE'] };
const firmaViaje = v0 => { const v = vistaAbierta(v0), gs = conValor(v); return gs.length + ':' + sum(gs, g => g.valor) + ':' + gs.map(g => g.id + (g.factura || '') + g.valor).join('').length; };
const fmtFH = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const chipRev = v => { const r = v.revision; return r && REV[r.estado] ? `<span class="chip ${REV[r.estado][1]}">${REV[r.estado][0].toUpperCase()}</span>` : '<span class="chip st-NO">SIN ENVIAR</span>'; };
function marcarRevision(v, estado, nota = '') {
  const prev = v.revision || {};
  v.revision = { estado, nota, fecha: new Date().toISOString(), firma: estado === 'enviado' ? firmaViaje(v) : (prev.firma || firmaViaje(v)), historial: [...(prev.historial || []), { estado, nota, fecha: new Date().toISOString() }].slice(-20) };
}
let revDevolviendo = false;
function vRevision(v) {
  const r = v.revision;
  const cambio = r && r.estado !== 'aprobado' && r.firma && r.firma !== firmaViaje(v);
  let h = `<div class="card form rev-card">
    <div class="row" style="align-items:center;justify-content:space-between;flex-wrap:nowrap"><b>Estado de revisión</b>${chipRev(v)}</div>`;
  if (r) h += `<div class="hint" style="margin:0">${REV[r.estado][0]} el ${fmtFH(r.fecha)}</div>`;
  if (r && r.nota) h += `<div class="note">${r.estado === 'devuelto' ? '↩ Motivo de devolución: ' : '📝 '}${esc(r.nota)}</div>`;
  if (cambio) h += `<div class="note">⚠ Hubo cambios en los gastos después de enviarlo. Use <b>Enviar a revisión</b> de nuevo para que el revisor reciba la versión actualizada.</div>`;
  if (!r) h += `<div class="hint" style="margin:0">Cuando toque <b>Enviar a revisión</b>, el viaje queda marcado como enviado.</div>`;
  if (revDevolviendo) h += `<label class="field"><span>Motivo de la devolución (opcional)</span><textarea id="rev-nota" rows="2" placeholder="Ej.: falta la factura del hotel"></textarea></label>
    <div class="row"><button class="btn danger" data-act="rev-devuelto-ok">Marcar como devuelto</button><button class="btn" data-act="rev-cancelar">Cancelar</button></div>`;
  else if (r) h += `<div class="row">${r.estado !== 'aprobado' ? '<button class="btn" data-act="rev-aprobado">✔ Marcar aprobado</button>' : ''}${r.estado !== 'devuelto' ? '<button class="btn" data-act="rev-devuelto">↩ Marcar devuelto</button>' : ''}</div>`;
  return h + '</div>';
}

function graficaDias(R) {
  if (!R.dias.length) return `<h2>Gastos por día</h2><div class="empty">Ingrese la fecha de inicio y fin del viaje para ver la gráfica por día.</div>`;
  const max = Math.max(1, ...R.dias.map(d => d.t));
  const corto = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : n ? String(Math.round(n)) : '';
  return `<h2>Gastos por día</h2>
  <div class="card chart-dias">
    <div class="cd-scroll"><div class="cd-bars" style="min-width:${R.dias.length * 46}px">
      ${R.dias.map(d => `<div class="cd-col ${R.mayor && d.f === R.mayor.f ? 'top' : ''}" title="${fmtDia(d.f)}: ${fmtCOP(d.t)} (${d.n} gastos)">
        <span class="cd-v">${corto(d.t)}</span>
        <div class="cd-track"><i style="height:${d.t / max * 100}%"></i></div>
        <span class="cd-d">${fmtDia(d.f).split(' ')[0]}<br>${fmtFecha(d.f).slice(0, 5)}</span></div>`).join('')}
    </div></div>
    <div class="cd-foot"><span>Total del periodo <b class="num">${fmtCOP(R.totDias)}</b></span>${R.mayor ? `<span>Día de mayor gasto <b>${fmtDia(R.mayor.f)} · ${fmtCOP(R.mayor.t)}</b></span>` : ''}${R.fuera ? `<span>Fuera de las fechas del viaje <b class="num">${fmtCOP(R.fuera)}</b></span>` : ''}</div>
  </div>`;
}

function vResumen(v) {
  const R = resumen(v), I = R.I;
  const maxC = Math.max(1, ...R.porConcepto.map(x => x.t));
  let h = `<h2>Resumen general</h2><div class="tbl-wrap"><table>
    <tr><th>Categoría</th><th class="r">Total COP</th><th class="r">% del gasto</th></tr>
    ${R.porConcepto.map(x => `<tr><td>${esc(x.c)}<div class="bar"><i style="width:${x.t / maxC * 100}%"></i></div></td><td class="r">${fmtCOP(x.t)}</td><td class="r">${fmtPct(R.totalConc ? x.t / R.totalConc : 0)}</td></tr>`).join('')}
    <tr class="total"><td>Total general</td><td class="r">${fmtCOP(R.totalConc)}</td><td class="r">${fmtPct(R.totalConc ? 1 : 0)}</td></tr>
  </table></div>

  ${graficaDias(R)}

  <h2>Gastos por proveedor</h2><div class="tbl-wrap"><table>
    <tr><th>Proveedor / Establecimiento</th><th class="r">Total COP</th><th class="r">N°</th><th class="r">%</th></tr>
    <tr class="total"><td>Total</td><td class="r">${fmtCOP(I.total)}</td><td class="r">${conValor(v).length}</td><td class="r">${I.total ? '100,0%' : ''}</td></tr>
    ${R.porProv.map(p => `<tr><td>${esc(p.p)}</td><td class="r">${fmtCOP(p.t)}</td><td class="r">${p.n}</td><td class="r">${fmtPct(I.total ? p.t / I.total : 0)}</td></tr>`).join('')}
  </table></div>`;
  return h;
}

function vFacturas(v) {
  let h = `<h2>Filtrar por estado</h2>
  <div class="seg" role="group">${['Todos', ...ESTADOS].map(e => `<button data-ffilt="${e}" aria-pressed="${filtroFact === e}">${e === 'Todos' ? 'Todos' : e.charAt(0) + e.slice(1).toLowerCase()}</button>`).join('')}</div>
  <h2>Facturas</h2>`;
  const lista = conValor(v).filter(g => filtroFact === 'Todos' || estado(g) === filtroFact).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  if (!lista.length) return h + '<div class="empty">Sin registros para este filtro.</div>' + vProveedores();
  h += `<div class="tbl-wrap"><table><tr><th>Fecha</th><th>Concepto</th><th>Proveedor</th><th class="r">Valor</th><th>N° Factura</th><th>Soporte</th><th>Estado</th><th>Pagado por</th></tr>
    ${lista.map(g => { const e = estado(g); return `<tr data-edit="${g.id}" style="cursor:pointer"><td class="num">${fmtFecha(g.fecha)}</td><td>${esc(g.concepto)}</td><td>${esc(g.proveedor)}</td><td class="r">${fmtCOP(g.valor)}</td><td>${esc(g.factura || '—')}${g.foto ? ' 📷' : ''}</td><td>${esc(g.soporte || 'No')}</td><td><span class="chip ${chipClass(e)}">${e}</span></td><td>${esc(g.pagadoPor)}</td></tr>`; }).join('')}
  </table></div>`;
  return h + vProveedores();
}

function foHTML(v) {
  const L = legalizacion(v);
  const filas = [];
  for (let i = 0; i < MAX_LINEAS_FO; i++) {
    const l = L.lineas[i];
    filas.push(l ? `<tr><td colspan="4">${esc(l.d)}</td><td>${esc(l.f)}</td><td class="r">${l.n}</td><td class="r"></td><td class="r">${fmtCOP(l.t)}</td></tr>` : '<tr><td colspan="4">&nbsp;</td><td></td><td></td><td></td><td></td></tr>');
  }
  return { L, html: `<div class="fo">
    <table class="head"><tr><td rowspan="3" style="width:150px;text-align:center"><img src="${LOGO}" alt="Logo" style="max-height:52px"></td><td rowspan="3" class="title">Legalización de Viáticos</td><td style="width:110px">Página 1/1</td></tr>
      <tr><td>FO-AD-03</td></tr><tr><td>Versión 3</td></tr></table>
    <table style="margin-top:8px"><tr><td class="lbl" style="width:70%;text-align:right">Consecutivo</td><td>${esc(v.consecutivo)}</td></tr></table>
    <table style="margin-top:8px">
      <tr><td class="lbl">Lugar</td><td class="lbl">Fecha legalización</td><td class="lbl">Colaborador</td><td class="lbl">Cédula</td></tr>
      <tr><td>${esc(v.lugar)}</td><td>${fmtFecha(v.fechaLeg)}</td><td>${esc(v.trabajador)}</td><td>${esc(v.cedula)}</td></tr>
      <tr><td class="lbl" colspan="2">Cliente</td><td class="lbl" colspan="2">COT / Orden de compra</td></tr>
      <tr><td colspan="2">${esc(v.cliente)}</td><td colspan="2">${esc(v.cot)}</td></tr>
      <tr><td class="lbl" colspan="2">Descripción del proyecto</td><td class="lbl">Fecha salida</td><td class="lbl">Fecha regreso</td></tr>
      <tr><td colspan="2">${esc(v.servicio)}</td><td>${fmtFecha(v.inicio)}</td><td>${fmtFecha(v.fin)}</td></tr>
      <tr><td class="lbl">OS No.</td><td>${esc(v.os)}</td><td class="lbl">Total anticipos</td><td class="lbl">Total viáticos</td></tr>
      <tr><td class="lbl">Efectivo</td><td>${v.efectivo !== '' && v.efectivo != null ? fmtCOP(v.efectivo) : ''}</td><td class="r">${fmtCOP(L.anticipo)}</td><td class="r"><b>${fmtCOP(L.total)}</b></td></tr>
    </table>
    <table style="margin-top:10px">
      <tr><th colspan="8" style="text-align:center">Relación de gastos</th></tr>
      <tr><th colspan="4">Detalle</th><th>Factura</th><th class="r">Cant</th><th class="r">V/Unitario</th><th class="r">V/R Total</th></tr>
      ${filas.join('')}
      <tr class="total"><td colspan="7" style="text-align:right;font-weight:700">TOTAL VIÁTICOS</td><td class="r"><b>${fmtCOP(L.total)}</b></td></tr>
    </table>
    <table class="sign" style="margin-top:14px"><tr><td>Solicitado por</td><td>Revisado</td><td>Aprobado</td></tr></table>
  </div>` };
}
/* ---------- Cortes: legalización parcial por cierre de mes ---------- */
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const cortesDe = v => (v.cortes = v.cortes || []);
const nombreCorte = c => { const d = parseISO(c.hasta); return `Corte ${c.n} - ${d ? MESES_L[d.getMonth()] + ' ' + d.getFullYear() : ''}`.trim(); };
const gastosCorte = (v, c) => v.gastos.filter(g => g.corte === c.id);
const empleadoTotal = gs => sum(gs.filter(g => g.valor !== '' && g.valor != null && g.pagadoPor !== 'Sistronic'), g => g.valor);
/* Anticipo y saldo de cada corte, en orden: el saldo de un corte pasa como anticipo al siguiente */
function cadenaCortes(v) {
  let disp = Number(v.anticipo) || 0; const out = [];
  for (const c of cortesDe(v)) {
    const anticipo = disp + (Number(c.adicional) || 0), gastado = empleadoTotal(gastosCorte(v, c));
    out.push({ c, anticipo, gastado, saldo: anticipo - gastado });
    disp = anticipo - gastado;
  }
  return { filas: out, saldoFinal: disp };
}
/* Vista de un corte como si fuera un viaje: solo sus gastos, sus fechas y su anticipo */
function vistaCorte(v, c) {
  const f = cadenaCortes(v).filas.find(x => x.c.id === c.id);
  return { ...v, gastos: gastosCorte(v, c), anticipo: f ? f.anticipo : 0, inicio: c.desde, fin: c.hasta, revision: c.revision, _corte: c };
}
/* Vista de lo que falta por legalizar (gastos sin corte). Sin cortes, es el viaje completo. */
function vistaAbierta(v) {
  const cs = cortesDe(v); if (!cs.length) return v;
  const ult = cs[cs.length - 1], resto = v.gastos.filter(g => !g.corte);
  const d = parseISO(ult.hasta), sig = d ? toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) : v.inicio;
  return { ...v, gastos: resto, anticipo: cadenaCortes(v).saldoFinal, inicio: sig > v.fin ? v.fin : sig, _final: true };
}
const corteDeGasto = g => { if (!g.corte) return null; for (const v of S.viajes) { const c = (v.cortes || []).find(x => x.id === g.corte); if (c) return c; } return null; };
const bloqueado = g => { const c = corteDeGasto(g); return !!(c && (!c.revision || c.revision.estado !== 'devuelto')); };
const estadoCorteTxt = c => c.revision && REV[c.revision.estado] ? REV[c.revision.estado][0] : 'Sin enviar';
function sugerirRango(v) {
  const cs = cortesDe(v), ult = cs[cs.length - 1];
  let desde = v.inicio || todayISO();
  if (ult) { const d = parseISO(ult.hasta); desde = toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)); }
  const d0 = parseISO(desde) || new Date(), finMes = toISO(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
  const hoy = todayISO(), hasta = [finMes, hoy < desde ? desde : hoy].sort()[0];
  return { desde, hasta: v.fin && v.fin < hasta ? v.fin : hasta };
}
let corteForm = null, corteDevolviendo = null;
function vCortes(v) {
  const cs = cortesDe(v), cad = cadenaCortes(v).filas;
  let h = `<h2 class="no-print">Cortes de mes (legalización parcial)</h2><div class="no-print card form" style="margin-bottom:12px">`;
  if (!cs.length) h += `<p class="hint" style="margin:0">Si el proyecto sigue pero necesita legalizar por cierre de mes, haga un <b>corte</b>: elija las fechas y se envían solo esos gastos. El saldo del anticipo pasa al siguiente corte.</p>`;
  cad.forEach(({ c, anticipo, gastado, saldo }) => {
    const n = gastosCorte(v, c).length, r = c.revision;
    h += `<div class="corte-row">
      <div class="row" style="align-items:center;justify-content:space-between;flex-wrap:nowrap"><b>${esc(nombreCorte(c))}</b>${r && REV[r.estado] ? `<span class="chip ${REV[r.estado][1]}">${REV[r.estado][0].toUpperCase()}</span>` : '<span class="chip st-NO">SIN ENVIAR</span>'}</div>
      <div class="hint" style="margin:2px 0 0">${fmtFecha(c.desde)} a ${fmtFecha(c.hasta)} · ${n} gastos · Anticipo ${fmtCOP(anticipo)} · Legalizado ${fmtCOP(gastado)} · Saldo <b>${fmtCOP(saldo)}</b>${r ? ` · ${REV[r.estado][0]} el ${fmtFH(r.fecha)}` : ''}</div>
      ${r && r.nota ? `<div class="note" style="margin-top:6px">${r.estado === 'devuelto' ? '↩ ' : '📝 '}${esc(r.nota)}</div>` : ''}
      ${corteDevolviendo === c.id ? `<label class="field"><span>Motivo de la devolución (opcional)</span><textarea id="corte-nota" rows="2"></textarea></label><div class="row"><button class="btn danger" data-act="corte-dev-ok" data-corte="${c.id}">Marcar devuelto</button><button class="btn" data-act="corte-dev-no">Cancelar</button></div>`
      : `<div class="row" style="margin-top:6px">
        <button class="btn" data-act="corte-enviar" data-corte="${c.id}" ${driveSubiendo ? 'disabled' : ''}>${r ? 'Reenviar' : 'Enviar a revisión'}</button>
        <button class="btn" data-act="corte-xlsx" data-corte="${c.id}">Excel</button>
        ${r && r.estado !== 'aprobado' ? `<button class="btn" data-act="corte-aprobar" data-corte="${c.id}">✔ Aprobado</button>` : ''}
        ${r && r.estado !== 'devuelto' ? `<button class="btn" data-act="corte-devolver" data-corte="${c.id}">↩ Devuelto</button>` : ''}
        ${c === cs[cs.length - 1] && !(r && r.estado === 'aprobado') ? `<button class="btn" data-act="corte-deshacer" data-corte="${c.id}">Deshacer corte</button>` : ''}
      </div>`}
      ${r && r.estado === 'devuelto' ? '<div class="hint">Los gastos de este corte se pueden corregir. Luego toque <b>Reenviar</b>.</div>' : ''}
    </div>`;
  });
  if (corteForm) {
    const sinCorte = v.gastos.filter(g => !g.corte && g.valor !== '' && g.valor != null), enRango = sinCorte.filter(g => g.fecha >= corteForm.desde && g.fecha <= corteForm.hasta);
    const fuera = sinCorte.filter(g => g.fecha < corteForm.desde).length;
    h += `<div class="corte-row nuevo"><b>Nuevo corte ${cs.length + 1}</b>
      <div class="grid2"><label class="field"><span>Desde</span><input id="ct-desde" type="date" value="${esc(corteForm.desde)}"></label><label class="field"><span>Hasta</span><input id="ct-hasta" type="date" value="${esc(corteForm.hasta)}"></label></div>
      <label class="field"><span>Anticipo adicional recibido en este periodo (opcional)</span><input id="ct-adic" inputmode="numeric" data-money value="${corteForm.adicional ? Number(corteForm.adicional).toLocaleString('es-CO') : ''}" placeholder="$ 0"></label>
      <div class="note ${enRango.length ? 'ok' : ''}">${enRango.length ? `Entran <b>${enRango.length} gastos</b> por <b>${fmtCOP(sum(enRango, g => g.valor))}</b> (empleado: ${fmtCOP(empleadoTotal(enRango))}).` : 'No hay gastos sin cortar en esas fechas.'}${fuera ? `<br>⚠ Hay ${fuera} gasto(s) sin cortar con fecha anterior a "Desde"; amplíe el rango para incluirlos.` : ''}</div>
      <div class="row"><button class="btn primary" data-act="corte-crear" ${enRango.length && !driveSubiendo ? '' : 'disabled'}>Enviar corte a revisión</button><button class="btn" data-act="corte-cancelar">Cancelar</button></div>
      <p class="hint" style="margin:0">Los gastos del corte quedan bloqueados. Si se lo devuelven, podrá corregirlos y reenviarlo.</p></div>`;
  } else h += `<div class="row"><button class="btn" data-act="corte-nuevo">✂ Hacer corte de mes</button></div>`;
  if (cs.length) h += `<div class="row"><button class="btn" data-act="cortes-resumen">Excel resumen de cortes</button></div>`;
  if (cs.length) h += `<p class="hint" style="margin:0">Los gastos nuevos van al siguiente corte. Al terminar el proyecto, use <b>Enviar legalización final</b> (abajo): lo que falte se envía como el último corte, junto con un Excel de resumen con el total de todos los cortes. Todo queda en una sola carpeta del proyecto en Drive.</p>`;
  return h + '</div>';
}
async function crearCorte() {
  const v = viaje(), f = corteForm; if (!f) return;
  f.desde = $('#ct-desde').value; f.hasta = $('#ct-hasta').value; f.adicional = parseValor($('#ct-adic').value) || 0;
  if (!f.desde || !f.hasta || f.hasta < f.desde) { toast('Revise las fechas del corte'); return; }
  const gs = v.gastos.filter(g => !g.corte && g.valor !== '' && g.valor != null && g.fecha >= f.desde && g.fecha <= f.hasta);
  if (!gs.length) { toast('No hay gastos en esas fechas'); return; }
  const c = { id: uid(), n: cortesDe(v).length + 1, desde: f.desde, hasta: f.hasta, adicional: f.adicional, creado: new Date().toISOString() };
  v.cortes.push(c); gs.forEach(g => { g.corte = c.id; });
  corteForm = null; await guardar(); render();
  subirDrive('corte', c.id);
}
/* Protección contra cambios: todas las celdas bloqueadas, cada hoja y la estructura del libro con clave (hash SHA-512 precalculado; la clave no está en la app) */
const PROT_XLSX = 'algorithmName="SHA-512" hashValue="jzhfSIMhJo9w98uA2l8y3Y8kqsYqzfkRuf6HiUG18NsQDj59Anz8Qbu1C1xsFRm1zMC6xQ/8uox64jxC7LyvIQ==" saltValue="N5Sgp5+fkgRqJlgrcE8SVA==" spinCount="100000"';
async function protegerLibro(zip) {
  const ps = 'xl/styles.xml';
  if (zip.file(ps)) zip.file(ps, (await zip.file(ps).async('string')).replace(/<protection\b[^>]*\/>/g, '<protection locked="1" hidden="0"/>').replace(/<protection\b[^>]*>\s*<\/protection>/g, '<protection locked="1" hidden="0"/>'));
  const hojas = Object.keys(zip.files).filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  for (const n of hojas) {
    let x = (await zip.file(n).async('string')).replace(/<sheetProtection\b[^>]*\/>/g, '');
    const tag = `<sheetProtection ${PROT_XLSX} sheet="1" objects="1" scenarios="1"/>`;
    if (/<sheetCalcPr\b[^>]*\/>/.test(x)) x = x.replace(/(<sheetCalcPr\b[^>]*\/>)/, '$1' + tag);
    else if (x.includes('</sheetData>')) x = x.replace('</sheetData>', '</sheetData>' + tag);
    else x = x.replace(/<sheetData\s*\/>/, m => m + tag);
    zip.file(n, x);
  }
  const pw = 'xl/workbook.xml';
  let wb = (await zip.file(pw).async('string')).replace(/<workbookProtection\b[^>]*\/>/g, '').replace(/<fileSharing\b[^>]*\/>/g, '');
  const wp = `<workbookProtection ${PROT_XLSX.replace(/(algorithmName|hashValue|saltValue|spinCount)=/g, (m, k) => 'workbook' + k.charAt(0).toUpperCase() + k.slice(1) + '=')} lockStructure="1"/>`;
  const fs = '<fileSharing readOnlyRecommended="1"/>';
  if (/<workbookPr\b/.test(wb)) wb = wb.replace(/<workbookPr\b/, fs + '<workbookPr');
  else wb = wb.replace(/<bookViews\b/, fs + '<bookViews');
  wb = wb.replace(/<bookViews\b/, wp + '<bookViews');
  zip.file(pw, wb);
}
/* Resumen de cortes: filas de la tabla (también se usa como libro aparte en la legalización final) */
function filasResumenCortes(v) {
  const cad = cadenaCortes(v), ab = vistaAbierta(v), finG = empleadoTotal(ab.gastos), sis = gs => sum(gs.filter(g => g.pagadoPor === 'Sistronic'), g => g.valor);
  const out = cad.filas.map(({ c: k, anticipo, gastado, saldo }) => { const gs = gastosCorte(v, k); return [nombreCorte(k), serial(k.desde), serial(k.hasta), gs.length, anticipo, Number(k.adicional) || 0, gastado, sis(gs), saldo, estadoCorteTxt(k), k.revision ? fmtFH(k.revision.fecha) : '']; });
  if (ab.gastos.length) out.push(['Pendiente por cortar', serial(ab.inicio), serial(v.fin), ab.gastos.length, ab.anticipo, 0, finG, sis(ab.gastos), ab.anticipo - finG, 'Sin enviar', '']);
  const adic = sum(cortesDe(v), k => Number(k.adicional) || 0), totG = sum(cad.filas, x => x.gastado) + finG;
  return { filas: out, total: ['TOTAL DEL PROYECTO', '', '', v.gastos.length, Number(v.anticipo) || 0, adic, totG, sis(v.gastos), (Number(v.anticipo) || 0) + adic - totG, '', ''] };
}
const HEADS_CORTES = ['Corte', 'Desde', 'Hasta', 'N° gastos', 'Anticipo', 'Anticipo adicional', 'Legalizado (empleado)', 'Pagado por Sistronic', 'Saldo', 'Estado', 'Fecha de estado'];
/* XML de la hoja de resumen. st = estilos {h: encabezado, d: fecha, t: texto, m: dinero, tm: total dinero, tt: total texto, ti: título} */
function xmlHojaResumen(v, st, conTitulo) {
  const c = (ref, s, x) => x === '' || x == null ? `<c r="${ref}" s="${s}"/>` : typeof x === 'number' ? `<c r="${ref}" s="${s}"><v>${x}</v></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(x)}</t></is></c>`;
  const sty = i => i === 1 || i === 2 ? st.d : i >= 4 && i <= 8 ? st.m : st.t;
  let rows = '', r = 1;
  if (conTitulo) {
    rows += `<row r="1" ht="24" customHeight="1">${c('A1', st.ti, 'Resumen de legalización de viáticos por cortes')}</row>`;
    const info = [['Trabajador', v.trabajador], ['Cédula', v.cedula], ['Cliente', v.cliente], ['Servicio / Proyecto', v.servicio], ['COT / OS', [v.cot, v.os].filter(Boolean).join(' / ')], ['Fechas del proyecto', `${fmtFecha(v.inicio)} a ${fmtFecha(v.fin)}`]];
    r = 2; for (const [k, x] of info) { rows += `<row r="${r}">${c('A' + r, st.tt, k)}${c('B' + r, st.t, x || '')}</row>`; r++; }
    r++;
  }
  const { filas, total } = filasResumenCortes(v);
  rows += `<row r="${r}" ht="30" customHeight="1">${HEADS_CORTES.map((h, i) => c(colLetra(i) + r, st.h, h)).join('')}</row>`; r++;
  for (const f of filas) { rows += `<row r="${r}">${f.map((x, i) => c(colLetra(i) + r, sty(i), x)).join('')}</row>`; r++; }
  rows += `<row r="${r}">${total.map((x, i) => c(colLetra(i) + r, i >= 3 && i <= 8 ? (i === 3 ? st.tt : st.tm) : st.tt, x)).join('')}</row>`;
  const widths = [28, 13, 13, 10, 18, 17, 21, 19, 16, 20, 18];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="FFF2A900"/><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="${conTitulo ? 0 : 1}"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
async function agregarHojaCortes(zip, v) {
  zip.file('xl/worksheets/sheetCortes.xml', xmlHojaResumen(v, { h: 23, d: 170, t: 171, m: 172, tm: 172, tt: 23, ti: 23 }, false));
  const types = await zip.file('[Content_Types].xml').async('string');
  zip.file('[Content_Types].xml', types.replace('</Types>', '<Override PartName="/xl/worksheets/sheetCortes.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
  const wrels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  zip.file('xl/_rels/workbook.xml.rels', wrels.replace('</Relationships>', '<Relationship Id="rIdCortes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheetCortes.xml"/></Relationships>'));
}
const nombreArchivoViaje = v => `COT_${(v.cot || 'sin-cot').replace(/[^\w.-]+/g, '_')} ${v.cliente || ''} - ${v.servicio || 'viaticos'}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
/* Libro aparte, solo con el resumen de todos los cortes y el total del proyecto */
async function excelResumenCortes(v, soloGenerar) {
  const JSZip = await cargarScript('vendor/jszip.min.js', 'JSZip'), z = new JSZip();
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS_MAIN}" xmlns:r="${R}"><bookViews><workbookView/></bookViews><sheets><sheet name="Resumen de cortes" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>`);
  const bd = '<border><left style="thin"><color rgb="FFB7C3D6"/></left><right style="thin"><color rgb="FFB7C3D6"/></right><top style="thin"><color rgb="FFB7C3D6"/></top><bottom style="thin"><color rgb="FFB7C3D6"/></bottom><diagonal/></border>';
  // 0 normal · 1 encabezado · 2 fecha · 3 texto · 4 dinero · 5 total texto · 6 total dinero · 7 título
  z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS_MAIN}"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF082759"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF082759"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE3EE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${bd}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  z.file('xl/worksheets/sheet1.xml', xmlHojaResumen(v, { h: 1, d: 2, t: 3, m: 4, tt: 5, tm: 6, ti: 7 }, true));
  const nombre = 'Resumen de cortes - ' + nombreArchivoViaje(v) + '.xlsx';
  await protegerLibro(z);
  const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (soloGenerar) return { blob, nombre };
  await entregarArchivo(blob, nombre);
}
/* Carpeta del proyecto en Drive: siempre se usa cuando el viaje tiene cortes (sin subcarpetas) */
const carpetaProyecto = v => `COT ${v.cot || 'sin COT'} ${v.cliente || ''}${v.servicio ? ' - ' + v.servicio : ''}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
/* Legalización final con cortes: lo que falta se vuelve el último corte, y se sube un Excel aparte con el resumen */
async function enviarFinalCortes() {
  if (!enAndroidGoogle()) { toast('Subir a Drive requiere iniciar sesión con Google'); return; }
  if (driveSubiendo) return;
  const v = viaje(), cs = cortesDe(v), resto = v.gastos.filter(g => !g.corte && g.valor !== '' && g.valor != null);
  let k = null;
  if (resto.length) {
    const ult = cs[cs.length - 1], d = parseISO(ult.hasta), desde = toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    const ultG = resto.map(g => g.fecha).filter(Boolean).sort().pop() || desde, hasta = [ultG, desde].sort().pop();
    k = { id: uid(), n: cs.length + 1, desde: [desde, resto.map(g => g.fecha).filter(Boolean).sort()[0] || desde].sort()[0], hasta, adicional: 0, creado: new Date().toISOString(), final: true };
    cs.push(k); resto.forEach(g => { g.corte = k.id; }); await guardar();
  }
  driveSubiendo = true; driveTipo = 'xlsx'; driveViaje = S.activo; driveCtx = { tipo: 'final', viajeId: S.activo, corteId: k ? k.id : '' }; correoEstado = null; driveUltimo = { estado: 'subiendo' }; render();
  try {
    const cfg = driveCfg(), sub = carpetaProyecto(v), mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const subir = async ({ blob, nombre }) => { const bytes = await zipCrcFix(new Uint8Array(await blob.arrayBuffer())); return { ...(await GW.subir(bytes, nombre, mime, cfg.carpetaId ? cfg.carpetaNombre || 'Carpeta compartida' : cfg.carpeta || 'Viáticos Sistronic', cfg.carpetaId || '', sub)), nombre }; };
    const dest = [cfg.carpetaId ? cfg.carpetaNombre || 'Carpeta compartida' : cfg.carpeta || 'Viáticos Sistronic', cfg.carpetaId || '', sub], avisoPDF = t => { driveUltimo = { estado: 'subiendo', txt: t }; render(); };
    // PDF de facturas del último corte y de los cortes anteriores que aún no lo tengan
    for (const kk of cortesDe(v)) if (kk === k || !kk.pdfFacturas) await subirFacturasPDF(vistaCorte(v, kk), ...dest, avisoPDF);
    await guardar();
    driveUltimo = { estado: 'subiendo' }; render();
    const archivos = [];
    if (k) { archivos.push(await subir(await exportarExcel(true, vistaCorte(v, k)))); k.revision = { estado: 'enviado', nota: '', fecha: new Date().toISOString() }; }
    marcarRevision(v, 'enviado'); await guardar();
    const res = await subir(await excelResumenCortes(v, true)); archivos.push(res);
    driveSubiendo = false; driveUltimo = { estado: 'ok', link: res.link, ruta: res.ruta, nombre: archivos.map(a => a.nombre).join(' y '), carpetaLink: res.carpetaLink, tipo: 'xlsx', ctx: { ...driveCtx }, archivos };
    toast('Legalización final enviada a revisión');
    if (cfg.avisar && correosAviso().length) enviarAviso(); else render();
  } catch (e) { window.onDriveError(e.message || 'No se pudo subir la legalización final'); }
}

function vLegal(v0) {
  const v = vistaAbierta(v0), hayCortes = cortesDe(v0).length > 0;
  const { L, html } = foHTML(v);
  const dif = L.diferencia;
  return `${vCortes(v0)}<h2 class="no-print">${hayCortes ? 'Legalización final (gastos sin cortar)' : 'Formato FO-AD-03'}</h2>
  ${hayCortes ? `<div class="no-print note" style="margin-bottom:8px">Incluye ${v.gastos.length} gastos desde el ${fmtFecha(v.inicio)} · Anticipo disponible (saldo de los cortes): <b>${fmtCOP(v.anticipo)}</b></div>` : ''}
  <div class="no-print form card" style="margin-bottom:12px">
    <div class="grid2">
      <label class="field"><span>Lugar</span><input id="lg-lugar" data-vf="lugar" value="${esc(v.lugar)}"></label>
      <label class="field"><span>Fecha de legalización</span><input id="lg-fecha" type="date" data-vf="fechaLeg" value="${esc(v.fechaLeg)}"></label>
      <label class="field"><span>Consecutivo</span><input id="lg-cons" data-vf="consecutivo" value="${esc(v.consecutivo)}"></label>
      <label class="field"><span>Efectivo</span><input id="lg-efec" inputmode="numeric" data-vf="efectivo" data-money value="${v.efectivo === '' || v.efectivo == null ? '' : Number(v.efectivo).toLocaleString('es-CO')}"></label>
    </div>
    <div class="note ${L.ok ? 'ok' : ''}">${L.aviso}</div>
    <div class="hint">Agrupa los gastos pagados por el empleado por subconcepto (o concepto si no tiene). ${dif >= 0 ? `Saldo a favor de la empresa: <b>${fmtCOP(dif)}</b>` : `Saldo a favor del colaborador: <b>${fmtCOP(-dif)}</b>`} (anticipo − total viáticos).</div>
    <div class="row"><button class="btn" data-act="print">Imprimir / Guardar PDF</button><button class="btn" data-act="xlsx">Exportar Excel</button>${enAndroidGoogle() ? `<button class="btn primary" data-act="drive-xlsx" ${driveSubiendo ? 'disabled' : ''}>${hayCortes ? 'Enviar legalización final' : 'Enviar a revisión'}</button>` : ''}</div>${tab === 'legal' ? vDriveEstado() : ''}
  </div>
  <div class="no-print" style="margin-bottom:12px">${vRevision(v0)}</div>
  <div class="fo-wrap">${html}</div>`;
}

/* ---------- Conceptos de gasto: ícono, color, subconceptos, orden y activar/desactivar sin perder el historial ----------
   S.listas = conceptos activos { concepto: [subconceptos activos] } (el orden de las llaves es el orden en pantalla).
   S.conceptosCfg = { concepto: { icono, color, subsOff: [] } }   S.conceptosOff = { concepto: [subconceptos] } (desactivados) */
const CP_ICONOS = ['🚕', '✈️', '🚌', '⛽', '🅿️', '🍽️', '☕', '🏨', '🛏️', '🧺', '📦', '🧰', '📎', '📡', '💊', '🎫', '🧾', '🏷️'];
const CP_COLORES = ['#3b6fd8', '#e8892c', '#1f9d63', '#8a5cd6', '#e20214', '#0f8fa6', '#b8860b', '#6b7280'];
const CP_DEF = { 'Transporte': ['🚕', '#3b6fd8'], 'Alimentación': ['🍽️', '#e8892c'], 'Alojamiento': ['🏨', '#1f9d63'], 'Otros gastos': ['📦', '#8a5cd6'] };
const cpCfg = c => { S.conceptosCfg = S.conceptosCfg || {}; const d = CP_DEF[c] || ['🏷️', CP_COLORES[Object.keys(S.listas).concat(Object.keys(S.conceptosOff || {})).indexOf(c) % CP_COLORES.length] || '#6b7280']; return Object.assign({ icono: d[0], color: d[1], subsOff: [] }, S.conceptosCfg[c] || {}); };
const cpIcono = c => cpCfg(c).icono;
const usoConcepto = (c, sub) => { let n = 0; for (const v of S.viajes) for (const g of v.gastos) if (g.concepto === c && (sub == null || g.sub === sub)) n++; return n; };
let cpBuscar = '', cpAgregando = null, cpEdit = null;
function vConceptos() {
  if (!cfgAbierta) { tab = 'gastos'; return vGastos(viaje()); }
  const q = normFact(cpBuscar), off = S.conceptosOff || {};
  const coincide = (c, subs) => !q || normFact(c).includes(q) || subs.some(x => normFact(x).includes(q));
  const tarjeta = (c, subs, activo) => {
    const k = cpCfg(c), n = usoConcepto(c), so = k.subsOff || [];
    return `<div class="cp-card ${activo ? '' : 'cp-off'}">
      <button class="cp-head" data-act="cp-editar" data-c="${esc(c)}"><span class="cp-ic" style="background:${k.color}1f;color:${k.color}">${k.icono}</span><span class="cp-t"><b>${esc(c)}</b><small>${subs.length} subconcepto${subs.length === 1 ? '' : 's'} · ${n} gasto${n === 1 ? '' : 's'}</small></span>${activo ? '<span class="cp-more">Editar ›</span>' : ''}</button>
      ${activo ? `<div class="cp-subs">${subs.map(x => `<span class="cp-chip">${esc(x)}</span>`).join('')}${so.map(x => `<span class="cp-chip off" title="Desactivado">${esc(x)}</span>`).join('')}
        ${cpAgregando === c ? `<span class="cp-add-in"><input id="cp-nuevo-sub" placeholder="Nuevo subconcepto" autocomplete="off"><button class="btn primary" data-act="cp-sub-ok" data-c="${esc(c)}">Agregar</button></span>` : `<button class="cp-chip add" data-act="cp-sub-add" data-c="${esc(c)}">+ Agregar</button>`}</div>`
      : `<div class="cp-subs"><button class="btn" data-act="cp-activar" data-c="${esc(c)}">Activar</button></div>`}
    </div>`;
  };
  const act = Object.entries(S.listas).filter(([c, x]) => coincide(c, x)), ina = Object.entries(off).filter(([c, x]) => coincide(c, x));
  return `<div class="row" style="margin:0 0 6px"><button class="btn" data-act="cp-volver">‹ Configuración</button></div>
  <h2>Conceptos de gasto</h2>
  <div class="cp-bar"><input id="cp-buscar" placeholder="Buscar concepto o subconcepto…" value="${esc(cpBuscar)}" autocomplete="off"><button class="btn primary" data-act="cp-nuevo">+ Concepto</button></div>
  ${act.map(([c, x]) => tarjeta(c, x, true)).join('') || '<div class="empty">No hay conceptos que coincidan.</div>'}
  ${ina.length ? `<h2>Desactivados <span style="text-transform:none;letter-spacing:0;font-weight:500">· no salen al registrar, los gastos viejos los conservan</span></h2>${ina.map(([c, x]) => tarjeta(c, x, false)).join('')}` : ''}
  <p class="hint">Toque un concepto para cambiarle el nombre, el ícono o el color, ordenar o desactivar sus subconceptos. Si cambia un nombre, también se actualiza en los gastos que ya lo usan.</p>
  <div class="row"><button class="btn" data-act="reset-listas">Restaurar la lista original</button></div>`;
}
function abrirConcepto(c) {
  const activo = !c || c in S.listas, k = c ? cpCfg(c) : { icono: '🏷️', color: CP_COLORES[Object.keys(S.listas).length % CP_COLORES.length], subsOff: [] };
  const subs = c ? (activo ? S.listas[c] : (S.conceptosOff || {})[c] || []) : [];
  cpEdit = { orig: c || null, nombre: c || '', icono: k.icono, color: k.color, activo, subs: [...subs.map(n => ({ n, orig: n, on: true })), ...(k.subsOff || []).map(n => ({ n, orig: n, on: false }))] };
  pintarConcepto(true);
}
function pintarConcepto(anim) {
  const e = cpEdit, n = e.orig ? usoConcepto(e.orig) : 0;
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><form class="sheet ${anim ? 'anim' : ''}" id="cp-form" autocomplete="off"><div class="sheet-head"><h3>${e.orig ? 'Editar concepto' : 'Nuevo concepto'}</h3><button type="button" class="x" data-close="1" aria-label="Cerrar">×</button></div><div class="form">
    <label class="field"><span>Nombre</span><input id="cp-nombre" value="${esc(e.nombre)}" required></label>
    <div class="field"><span>Ícono</span><div class="cp-iconos">${CP_ICONOS.map(i => `<button type="button" data-act="cp-icono" data-v="${i}" aria-pressed="${i === e.icono}">${i}</button>`).join('')}</div></div>
    <div class="field"><span>Color</span><div class="cp-colores">${CP_COLORES.map(x => `<button type="button" data-act="cp-color" data-v="${x}" aria-pressed="${x === e.color}" style="background:${x}" aria-label="Color"></button>`).join('')}</div></div>
    <div class="field"><span>Subconceptos (ordene con las flechas; el ojo los activa o desactiva)</span>
      <div class="cp-lista">${e.subs.map((x, i) => `<div class="cp-sub ${x.on ? '' : 'off'}">
        <input data-cpsub="${i}" value="${esc(x.n)}" aria-label="Subconcepto">
        <button type="button" class="ib" data-act="cp-sub-up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Subir">↑</button>
        <button type="button" class="ib" data-act="cp-sub-down" data-i="${i}" ${i < e.subs.length - 1 ? '' : 'disabled'} aria-label="Bajar">↓</button>
        <button type="button" class="ib" data-act="cp-sub-on" data-i="${i}" aria-label="${x.on ? 'Desactivar' : 'Activar'}" title="${x.on ? 'Activo' : 'Desactivado'}">${x.on ? '👁' : '🚫'}</button>
        ${x.orig && usoConcepto(e.orig, x.orig) ? '<span class="ib" style="visibility:hidden"></span>' : `<button type="button" class="ib" data-act="cp-sub-del" data-i="${i}" aria-label="Quitar">✕</button>`}
      </div>`).join('') || '<div class="hint">Sin subconceptos todavía.</div>'}</div>
      <div class="cp-add-in" style="margin-top:8px"><input id="cp-sub-txt" placeholder="Agregar subconcepto" autocomplete="off"><button type="button" class="btn" data-act="cp-sub-mas">Agregar</button></div>
    </div>
    <div class="note" id="cp-err" hidden></div>
    <div class="row"><button class="btn primary" type="submit">Guardar</button>${e.orig ? (e.activo ? '<button type="button" class="btn" data-act="cp-desactivar">Desactivar concepto</button>' : '<button type="button" class="btn" data-act="cp-activar-ed">Activar concepto</button>') : ''}</div>
    ${e.orig && !n ? '<div class="row"><button type="button" class="btn danger" data-act="cp-eliminar">Eliminar concepto (no tiene gastos)</button></div>' : e.orig ? `<p class="hint">Tiene ${n} gasto(s): en lugar de eliminarlo, desactívelo.</p>` : ''}
  </div></form></div>`;
}
function leerConcepto() { const e = cpEdit; if (!e) return; const n = $('#cp-nombre'); if (n) e.nombre = n.value; document.querySelectorAll('[data-cpsub]').forEach(el => { const x = e.subs[+el.dataset.cpsub]; if (x) x.n = el.value; }); }
async function guardarConcepto(forzarActivo) {
  leerConcepto(); const e = cpEdit, nom = e.nombre.trim().replace(/\s+/g, ' ');
  const err = m => { const b = $('#cp-err'); if (b) { b.hidden = false; b.textContent = '⚠ ' + m; } };
  if (!nom) return err('Escriba el nombre del concepto');
  const todos = [...Object.keys(S.listas), ...Object.keys(S.conceptosOff || {})];
  if (todos.some(c => c !== e.orig && normFact(c) === normFact(nom))) return err('Ya existe un concepto con ese nombre');
  const subs = e.subs.map(x => ({ ...x, n: x.n.trim().replace(/\s+/g, ' ') })).filter(x => x.n);
  const vistos = new Set(); for (const x of subs) { const k = normFact(x.n); if (vistos.has(k)) return err(`El subconcepto "${x.n}" está repetido`); vistos.add(k); }
  const activo = forzarActivo != null ? forzarActivo : e.activo;
  if (!activo && Object.keys(S.listas).filter(c => c !== e.orig).length === 0) return err('Debe quedar al menos un concepto activo');
  // Renombrar en los gastos existentes
  for (const v of S.viajes) for (const g of v.gastos) {
    if (!e.orig || g.concepto !== e.orig) continue;
    const x = subs.find(y => y.orig && y.orig === g.sub); if (x && x.n !== x.orig) g.sub = x.n;
    if (nom !== e.orig) g.concepto = nom;
  }
  // Reconstruir listas conservando la posición del concepto
  S.conceptosOff = S.conceptosOff || {}; S.conceptosCfg = S.conceptosCfg || {};
  const on = subs.filter(x => x.on).map(x => x.n), offs = subs.filter(x => !x.on).map(x => x.n);
  const reemplazar = (obj, val) => { const out = {}; let puesto = false; for (const [c, x] of Object.entries(obj)) { if (c === e.orig) { if (val !== undefined) { out[nom] = val; puesto = true; } } else out[c] = x; } if (val !== undefined && !puesto) out[nom] = val; return out; };
  if (activo) { S.listas = reemplazar(S.listas, on); S.conceptosOff = reemplazar(S.conceptosOff, undefined); }
  else { S.conceptosOff = reemplazar(S.conceptosOff, [...on, ...offs]); S.listas = reemplazar(S.listas, undefined); }
  if (e.orig && e.orig !== nom) delete S.conceptosCfg[e.orig];
  S.conceptosCfg[nom] = { icono: e.icono, color: e.color, subsOff: activo ? offs : [] };
  await guardar(); cpEdit = null; cerrarSheet(); render(); toast(activo ? 'Concepto guardado' : 'Concepto desactivado');
}
function vViaje(v) {
  const f = (k, l, t = 'text', extra = '') => `<label class="field"><span>${l}</span><input id="vj-${k}" type="${t}" data-vf="${k}" value="${esc(v[k])}" ${extra}></label>`;
  return `<h2>Datos del viaje</h2>
  <div class="form card">
    ${f('trabajador', 'Trabajador')}
    <div class="grid2">${f('cedula', 'Cédula', 'text', 'inputmode="numeric"')}${f('ciudad', 'Ciudad')}</div>
    ${f('cliente', 'Cliente / Empresa')}
    ${f('servicio', 'Servicio / Proyecto')}
    <div class="grid2">${f('cot', 'COT / Orden de compra')}${f('os', 'OS No.')}</div>
    <div class="grid2">${f('inicio', 'Fecha inicio', 'date')}${f('fin', 'Fecha fin', 'date')}</div>
    <div class="grid2">
      <label class="field"><span>Anticipo recibido</span><input id="vj-anticipo" inputmode="numeric" data-vf="anticipo" data-money value="${Number(v.anticipo || 0).toLocaleString('es-CO')}"></label>
      <div class="field"><span>Días del servicio</span><div class="num" style="padding:10px 2px;font-weight:700">${diasServicio(v)}</div></div>
    </div>
  </div>
  <h2>Archivos</h2>
  <div class="card form">
    ${inIframe ? '<div class="note">En esta vista previa no se pueden descargar archivos ni imprimir. Hágalo desde la app instalada.</div>' : ''}
    <div class="row"><button class="btn primary" data-act="xlsx">Exportar a Excel</button><button class="btn" data-act="print-go">Formato PDF</button></div>
    <div class="row"><button class="btn" data-act="import">Importar Excel de viáticos</button></div>
    <div class="row"><button class="btn" data-act="backup">Copia de seguridad</button><button class="btn" data-act="restore">Restaurar copia</button></div>
    <p class="hint">Importar Excel lee un archivo con el mismo formato (hoja "Control de Gastos") y lo agrega como viaje nuevo. La copia de seguridad guarda todos los viajes en un archivo .json.</p>
  </div>
  <h2>Viajes</h2>
  <div class="row"><button class="btn" data-act="trips">Cambiar de viaje / nuevo viaje</button></div>
  <h2>Conceptos de gasto</h2>
  <div class="card form"><p class="hint" style="margin:0">${Object.keys(S.listas).map(c => cpIcono(c) + ' ' + esc(c)).join(' · ')}</p><div class="row"><button class="btn" data-act="cp-abrir">Administrar conceptos</button></div></div>
  <h2>Zona de cuidado</h2>
  <div class="card form" id="danger"><button class="btn danger" data-act="del-trip">Eliminar este viaje</button></div>`;
}

/* ---------- Lectura de facturas con Gemini ---------- */
let IA = { key: '', modelo: 'gemini-flash-latest', auto: true };
const IA_MODELOS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const espera = ms => new Promise(r => setTimeout(r, ms));
function iaProgreso(t) { const el = document.querySelector('.ia-busy .txt'); if (el) el.textContent = t; }
/* Llama a Gemini con reintentos: si un modelo está saturado (503/500/429) espera y reintenta, y luego pasa al siguiente modelo.
   Cada llamada tiene su propio tiempo límite y hay un tope total, para que nunca se quede esperando. */
async function iaFetch(body, opt = {}) {
  const { intentos = 2, maxModelos = IA_MODELOS.length, porLlamada = 30000, total = 100000, progreso = iaProgreso } = opt;
  const fin = Date.now() + total;
  const lista = [IA.modelo || IA_MODELOS[0], ...IA_MODELOS.filter(m => m !== IA.modelo)].slice(0, maxModelos);
  const payload = JSON.stringify(body);
  let ultimo = null;
  for (const m of lista) {
    for (let intento = 1; intento <= intentos; intento++) {
      const resta = fin - Date.now();
      if (resta < 3000) { const e = new Error('tiempo'); e.name = 'Tiempo'; throw e; }
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), Math.min(porLlamada, resta));
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': IA.key.trim() }, body: payload });
      } catch (e) {
        clearTimeout(t);
        ultimo = { red: e.name !== 'AbortError', lento: e.name === 'AbortError' };
        progreso(e.name === 'AbortError' ? `Gemini (${m}) tarda en responder. Probando de nuevo…` : 'Sin señal. Reintentando…');
        if (ultimo.red) await espera(1500);
        continue;
      }
      clearTimeout(t);
      if (r.ok) { if (m !== IA.modelo) { IA.modelo = m; guardarIA(); } return r; }
      const j = await r.clone().json().catch(() => ({}));
      ultimo = { r, j };
      if (r.status === 404) break;
      if (r.status === 400 || r.status === 401 || r.status === 403) return r;
      if (r.status === 429 || r.status >= 500) {
        if (intento < intentos) { progreso(`Gemini está ocupado. Reintentando… (${m})`); await espera(Math.min(2000 * intento, Math.max(0, fin - Date.now() - 3000))); continue; }
        progreso('Probando con otro modelo de Gemini…');
        break;
      }
      return r;
    }
  }
  if (ultimo && ultimo.r) return ultimo.r;
  const e = new Error(ultimo && ultimo.lento ? 'tiempo' : 'red'); e.name = ultimo && ultimo.lento ? 'Tiempo' : 'Red'; throw e;
}
function iaErrorExc(e) {
  if (e && e.name === 'Tiempo') return 'Gemini no respondió a tiempo. Revise su internet e intente de nuevo.';
  return 'Sin conexión a internet o Gemini no está disponible. Intente de nuevo.';
}
function iaErrorES(status, msg) {
  msg = msg || '';
  if (/API key not valid|API_KEY_INVALID/i.test(msg) || status === 401) return 'La clave de Gemini no es válida. Revísela en la pestaña Viaje.';
  if (status === 403) return 'La clave de Gemini no tiene permiso para usar este servicio.';
  if (status === 429) return /quota/i.test(msg) ? 'Se acabó el cupo gratuito de Gemini por hoy. Llene los datos a mano o intente mañana.' : 'Gemini recibió demasiadas solicitudes. Espere un minuto e intente de nuevo con "Leer con IA".';
  if (status === 503 || status === 500 || /high demand|overloaded|unavailable/i.test(msg)) return 'Gemini está saturado en este momento. Intente de nuevo en unos minutos con "Leer con IA", o llene los datos a mano.';
  if (status === 404) return 'No se encontró un modelo de Gemini disponible. Revise el campo Modelo en la pestaña Viaje.';
  if (status === 400) return 'Gemini no pudo procesar la foto. Intente con una foto más clara.';
  return 'Gemini no respondió (error ' + status + '). Intente de nuevo.';
}
async function cargarIA() { try { const x = await DB.get('ia'); if (x) IA = Object.assign(IA, x); } catch {} }
async function guardarIA() { await DB.set('ia', IA); try { if (S) { await sellar(); if (sellar.cambio) programarSync(); } } catch (e) { console.error(e); } }
const iaLista = () => !!(IA.key && IA.key.trim());
let iaLeyendo = false;

async function leerFacturaIA(dataUrl, textoPDF) {
  const conceptos = Object.keys(S.listas);
  const subs = conceptos.map(c => `${c}: ${S.listas[c].join(', ')}`).join('\n');
  const prompt = `Eres un asistente contable en Colombia. Lee la factura, recibo o comprobante de la imagen y devuelve SOLO un JSON con:
- proveedor: nombre comercial del establecimiento o empresa que emite el documento (ej. "Rappi", "Hotel Casa Rueda", "Uber").
  El proveedor es SIEMPRE quien VENDE y emite la factura, NUNCA el cliente/comprador. El comprador casi siempre es la empresa del trabajador: SISTRONIC (razón social SISTEMAS ELECTRONICOS S.A.S.)${soloDig((S.empresa || {}).nit) ? ', NIT ' + soloDig((S.empresa || {}).nit) : ''}; si ve ese nombre o ese NIT, es el CLIENTE, no el proveedor. En facturas electrónicas el emisor está en el encabezado (logo, su NIT, resolución DIAN, "Responsable de IVA") y el cliente aparece como "Cliente", "Señor(es)", "Adquiriente", "Facturar a" o "Comprador".
  Si el nombre NO está escrito como texto y solo aparece en el LOGO (imagen, marca o dibujo), identifique la empresa por su logo (ej. el logo de Rappi, Crepes & Waffles, Éxito, D1, Terpel, Uber, Avianca). Si hay NIT, el proveedor debe corresponder a ese NIT.
- nit: NIT o documento del proveedor si aparece, si no "".
- fecha: fecha del documento en formato AAAA-MM-DD, si no aparece "".
- factura: número de factura, recibo, comprobante o ticket (incluya prefijo si lo hay), si no "".
- valor: valor TOTAL pagado en pesos colombianos como número entero sin puntos ni símbolos (incluye impuestos y propina si está en el total).
- concepto: uno de: ${conceptos.join(', ')}.
- subconcepto: uno de la lista del concepto elegido:
${subs}
- descripcion: descripción general y corta del gasto (máx. 5 palabras), en español, según el tipo de gasto y el momento, por ejemplo "Almuerzo", "Cena", "Desayuno", "Hospedaje", "Transporte al aeropuerto". NUNCA mencione los productos, platos, bebidas ni artículos comprados.
- tipo_documento_factura: uno de: ${TIPOS_DOC.join(', ')}.
- hora: hora del documento HH:MM (24 h) si aparece, si no "".
- cufe: código CUFE/CUDE completo si aparece en texto, si no "".
- comprador_nombre y comprador_nit: a nombre de quién se facturó (ej. "CONSUMIDOR FINAL", "222222222222"), si aparecen.
- subtotal: valor antes de impuestos (subtotal neto o base), número entero, 0 si no aparece.
- iva_porcentaje e iva_valor: tarifa de IVA (ej. 19) y su valor en pesos; 0 si no hay IVA.
- inc_porcentaje e inc_valor: tarifa del impuesto al consumo/impoconsumo (INC, ej. 8) y su valor; 0 si no hay.
- propina: propina o servicio voluntario incluido en el total, 0 si no hay.
- descuento: descuentos aplicados, 0 si no hay.
- forma_pago: uno de: ${FORMAS_PAGO.join(', ')} o "".
- medio_pago: uno de: ${MEDIOS_PAGO.join(', ')} o "" (ej. "Tarjeta DB" = Tarjeta débito, "Tarjeta CR" = Tarjeta crédito).
- tercero: datos del EMISOR (vendedor) tal como están impresos en el documento, NO del cliente/comprador:
  - tipo_documento: "NIT", "CC", "CE", "PASAPORTE" o "".
  - numero_documento: solo dígitos, SIN dígito de verificación (ej. "900123456" si dice "NIT 900.123.456-7").
  - digito_verificacion: el dígito después del guion si aparece, si no "".
  - razon_social: razón social o nombre legal completo del emisor.
  - nombre_comercial: nombre comercial si es distinto, si no "".
  - persona: "juridica" si es empresa (S.A.S., S.A., Ltda., etc.) o "natural" si es una persona.
  - direccion, ciudad, departamento, telefono, correo: del emisor, si aparecen.
  - responsable_iva: "si" si dice responsable de IVA / régimen común / cobra IVA, "no" si dice no responsable de IVA / régimen simplificado, si no "".
Si un dato no se puede leer, deje "" (o 0 en valor). No invente datos.`;
  const schema = {
    type: 'OBJECT',
    properties: {
      proveedor: { type: 'STRING' }, nit: { type: 'STRING' }, fecha: { type: 'STRING' }, factura: { type: 'STRING' },
      valor: { type: 'NUMBER' }, concepto: { type: 'STRING', enum: conceptos }, subconcepto: { type: 'STRING' }, descripcion: { type: 'STRING' },
      tipo_documento_factura: { type: 'STRING' }, hora: { type: 'STRING' }, cufe: { type: 'STRING' }, comprador_nombre: { type: 'STRING' }, comprador_nit: { type: 'STRING' },
      subtotal: { type: 'NUMBER' }, iva_porcentaje: { type: 'NUMBER' }, iva_valor: { type: 'NUMBER' }, inc_porcentaje: { type: 'NUMBER' }, inc_valor: { type: 'NUMBER' },
      propina: { type: 'NUMBER' }, descuento: { type: 'NUMBER' }, forma_pago: { type: 'STRING' }, medio_pago: { type: 'STRING' },
      tercero: { type: 'OBJECT', properties: Object.fromEntries(['tipo_documento', 'numero_documento', 'digito_verificacion', 'razon_social', 'nombre_comercial', 'persona', 'direccion', 'ciudad', 'departamento', 'telefono', 'correo', 'responsable_iva'].map(k => [k, { type: 'STRING' }])) }
    },
    required: ['proveedor', 'fecha', 'factura', 'valor', 'concepto', 'subconcepto', 'descripcion']
  };
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  let r;
  try {
    r = await iaFetch({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt + (textoPDF ? '\n\nLa factura vino en PDF. Este es el texto que trae el PDF; úselo para leer números, NIT, CUFE y valores exactos (el nombre del proveedor puede estar solo en el logo de la imagen):\n' + textoPDF.slice(0, 8000) : '') }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema }
    }, { intentos: 2, porLlamada: 35000, total: 100000 });
  } catch (e) { throw new Error(iaErrorExc(e)); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(iaErrorES(r.status, j?.error?.message));
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
  out.tercero = terceroDeIA(d.tercero, out.nit, out.proveedor);
  const num = x => { const n = typeof x === 'number' ? x : parseValor(x); return n > 0 ? Math.round(n) : ''; };
  const pct = x => { const n = Number(x); return n > 0 && n <= 100 ? n : ''; };
  const una = (x, opts) => opts.find(o => o.toLowerCase() === s(x).toLowerCase()) || '';
  const hm = s(d.hora).match(/(\d{1,2}):(\d{2})/);
  out.fx = { tipoDoc: una(d.tipo_documento_factura, TIPOS_DOC), hora: hm ? pad(hm[1]) + ':' + hm[2] : '', cufe: s(d.cufe).replace(/\s+/g, ''), compradorNombre: s(d.comprador_nombre), compradorNit: soloDig(d.comprador_nit),
    subtotal: num(d.subtotal), ivaPct: pct(d.iva_porcentaje), iva: num(d.iva_valor), incPct: pct(d.inc_porcentaje), inc: num(d.inc_valor), propina: num(d.propina), descuento: num(d.descuento),
    formaPago: una(d.forma_pago, FORMAS_PAGO), medioPago: una(d.medio_pago, MEDIOS_PAGO) };
  // Si la IA confundió al comprador (Sistronic) con el proveedor, se descarta ese dato
  const emp = soloDig((S.empresa || {}).nit), cNom = normFact(d.comprador_nombre), cNit = soloDig(d.comprador_nit);
  const nomComprador = x => { const n = normFact(x); return !!n && (/sistronic|sistemaselectronicos/.test(n) || (cNom.length > 3 && n === cNom)); };
  const nitComprador = x => { const n = soloDig(x); return !!n && ((emp && n.slice(0, emp.length) === emp) || (cNit.length > 5 && n.slice(0, 9) === cNit.slice(0, 9))); };
  if (nomComprador(out.proveedor)) out.proveedor = '';
  if (out.tercero && (nitComprador(out.tercero.nit) || nomComprador(out.tercero.razon))) out.tercero = null;
  if (nitComprador(out.nit)) out.nit = '';
  if (out.fx.iva === '' && out.fx.subtotal !== '') out.fx.iva = 0;
  if (out.fx.inc === '' && out.fx.subtotal !== '') out.fx.inc = 0;
  return out;
}
async function aplicarIA(dataUrl) {
  if (!iaLista() || iaLeyendo || !editando) return;
  if (!navigator.onLine) { toast('Sin internet: llene los datos a mano'); return; }
  iaLeyendo = true; const id = editando.id; delete editando._iaErr;
  leerFormGasto(); pintarGasto();
  try {
    const d = await leerFacturaIA(dataUrl, pdfTextoTmp && pdfTextoTmp.id === id && dataUrl === fotoTmp ? pdfTextoTmp.t : '');
    if (!editando || editando.id !== id) return;
    leerFormGasto();
    const g = editando, llenos = [];
    const set = (k, val, label) => { if (val !== '' && val != null && (g[k] === '' || g[k] == null)) { g[k] = val; llenos.push(label); } };
    set('valor', d.valor, 'valor'); set('proveedor', d.proveedor, 'proveedor'); set('factura', d.factura, 'N° factura'); set('desc', d.descripcion, 'descripción');
    if (d.fecha && (g._nuevo || !g.fecha)) { g.fecha = d.fecha; llenos.push('fecha'); }
    if (d.concepto && (g._nuevo || !g.sub)) { if (g.concepto !== d.concepto || !g.sub) { g.concepto = d.concepto; g.sub = d.sub; llenos.push('concepto'); } }
    if (d.tercero && d.tercero.nit) {
      g._tercero = d.tercero;
      if (!g.nit) { g.nit = d.tercero.nit; llenos.push('NIT'); }
      if (!g.razon && d.tercero.razon) { g.razon = d.tercero.razon; llenos.push('razón social'); }
      if (!g.dvImpreso && d.tercero.dvImpreso) g.dvImpreso = d.tercero.dvImpreso;
    }
    let nfx = 0; for (const [k] of FX_CAMPOS) { const val = d.fx[k]; if (val !== '' && val != null && (g[k] === '' || g[k] == null)) { g[k] = val; nfx++; } }
    if (nfx) llenos.push('impuestos y datos de la factura');
    if (!g.proveedor && g.nit) {
      const p = Object.values(S.proveedores || {}).find(p => soloDig(p.nit) === soloDig(g.nit) && (p.comercial || p.razon));
      if (p) { g.proveedor = p.comercial || p.razon; llenos.push('proveedor (por el NIT)'); }
      else { try { const r = await consultarRUES(soloDig(g.nit)); if (r && r.razon && editando === g) { g.proveedor = r.razon; if (!g.razon) g.razon = r.razon; llenos.push('proveedor (por el NIT, en el RUES)'); } } catch {} }
    }
    g._ia = llenos; delete g._iaErr;
    toast(llenos.length ? 'Datos leídos con IA. Revíselos antes de guardar.' : 'La IA no encontró datos nuevos');
  } catch (e) {
    if (editando && editando.id === id) editando._iaErr = e.message || 'No se pudo leer la factura';
    toast(e.message || 'No se pudo leer la factura');
  } finally {
    iaLeyendo = false;
    if (editando && editando.id === id) { pintarGasto(); avisoDupVivo(); }
  }
}
function vIA() {
  return `<h2>Lectura de facturas con IA (Gemini)</h2>
  <div class="card form">
    <p class="hint" style="margin:0">Al tomar la foto de una factura, la app la envía a Gemini de Google y llena sola el valor, la fecha, el proveedor, el N° de factura y el concepto. Usted revisa y guarda. Sin internet o sin clave, todo sigue funcionando a mano.</p>
    <label class="field"><span>Clave de API de Gemini</span>
      <div class="row" style="flex-wrap:nowrap"><input id="ia-key" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" value="${esc(IA.key)}" style="flex:1;min-width:0"><button class="btn" type="button" data-act="ia-ver" style="flex:0 0 auto">Ver</button></div></label>
    <label class="field"><span>Modelo</span><input id="ia-modelo" value="${esc(IA.modelo)}" spellcheck="false"></label>
    <label class="row" style="align-items:center;gap:10px;flex-wrap:nowrap"><input id="ia-auto" type="checkbox" ${IA.auto ? 'checked' : ''} style="width:22px;height:22px;flex:0 0 22px;min-width:0"> <span style="flex:1">Leer la factura automáticamente al tomar la foto</span></label>
    <div class="row"><button class="btn primary" data-act="ia-probar">Probar clave</button>${IA.key ? '<button class="btn" data-act="ia-borrar">Borrar clave</button>' : ''}</div>
    <div id="ia-estado" class="hint">${iaLista() ? 'Clave guardada en este celular.' : 'Sin clave: la lectura automática está apagada.'}</div>
    <details><summary style="cursor:pointer;font-weight:600">Cómo sacar la clave gratis (2 minutos)</summary>
      <ol class="hint" style="padding-left:18px;margin:8px 0 0">
        <li>Entre a <b>aistudio.google.com/apikey</b> con su cuenta de Google (Gmail).</li>
        <li>Toque <b>Create API key</b> (Crear clave de API) y acepte.</li>
        <li>Copie la clave (empieza por <b>AIza</b>) y péguela arriba.</li>
        <li>Toque <b>Probar clave</b>.</li>
      </ol>
      <p class="hint">La clave se guarda en este equipo y en la carpeta privada de la app en su Google Drive (para usarla en sus otros equipos); no se incluye en las copias de seguridad. Las fotos se envían a Google para leerlas. El plan gratuito de Gemini tiene un límite diario de lecturas y Google puede usar esos datos para mejorar sus productos; para evitarlo, active la facturación en Google AI Studio.</p>
    </details>
  </div>`;
}
async function probarIA() {
  const st = $('#ia-estado'); if (!iaLista()) { st.textContent = 'Primero pegue la clave.'; return; }
  const btn = document.querySelector('[data-act="ia-probar"]'); if (btn) btn.disabled = true;
  st.textContent = 'Probando…';
  const prog = t => { const x = $('#ia-estado'); if (x) x.textContent = t; };
  try {
    const r = await iaFetch({ contents: [{ parts: [{ text: 'Responda solo: OK' }] }], generationConfig: { maxOutputTokens: 5 } },
      { intentos: 1, maxModelos: 3, porLlamada: 15000, total: 35000, progreso: prog });
    const j = await r.json().catch(() => ({}));
    prog(r.ok ? `✔ La clave funciona (modelo ${IA.modelo}). Ya puede tomar fotos de facturas.` : '✖ ' + iaErrorES(r.status, j?.error?.message));
  } catch (e) {
    prog('✖ ' + iaErrorExc(e));
  } finally { const b2 = document.querySelector('[data-act="ia-probar"]'); if (b2) b2.disabled = false; }
}

/* ---------- Hoja de gasto ---------- */
let editando = null, fotoTmp = undefined;
function abrirGasto(id) {
  const v = viaje();
  const g = id ? v.gastos.find(x => x.id === id) : null;
  const ult = v.gastos[v.gastos.length - 1];
  editando = g ? { ...g } : { id: uid(), fecha: hoyEnRango(v), concepto: ult?.concepto || 'Transporte', sub: '', proveedor: '', desc: '', valor: '', pagadoPor: 'Empleado', factura: '', soporte: 'Sí', obs: '', foto: false, _nuevo: true };
  fotoTmp = undefined;
  pintarGasto(true);
  if (g?.foto) DB.get('foto:' + g.id).then(src => { if (src && editando?.id === g.id) { const im = $('#g-foto-prev'); if (im) { im.src = src; im.hidden = false; } } });
}
function hoyEnRango(v) { const t = todayISO(); if (v.inicio && t < v.inicio) return v.inicio; if (v.fin && t > v.fin) return v.fin; return t; }
function pintarGasto(anim) {
  const g = editando, v = viaje();
  const subs = S.listas[g.concepto] || (S.conceptosOff || {})[g.concepto] || [];
  const provs = [...new Set(S.viajes.flatMap(x => x.gastos.map(y => y.proveedor)).filter(Boolean))].sort();
  const seg = (name, opts, cur) => `<div class="seg" role="group" data-seg="${name}">${opts.map(o => `<button type="button" data-val="${esc(o)}" aria-pressed="${cur === o}">${esc(o)}</button>`).join('')}</div>`;
  const e = estado({ ...g, valor: 1 });
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><form class="sheet ${anim ? 'anim' : ''}" id="g-form" autocomplete="off">
    <div class="sheet-head"><h3>${g._nuevo ? 'Registrar gasto' : 'Editar gasto'}</h3><button type="button" class="x" data-close="1" aria-label="Cerrar">×</button></div>
    <div class="form">
      <div class="field"><span>Foto de la factura${iaLista() ? ' · se llena sola con IA' : ' (opcional)'}</span>
        <input id="g-file" type="file" accept="image/*" capture="environment" hidden>
        <input id="g-galeria" type="file" accept="image/*,application/pdf,.pdf" hidden>
        <div class="row"><button type="button" class="btn ${g._nuevo && !g.foto ? 'primary' : ''}" data-act="foto" ${iaLeyendo ? 'disabled' : ''}>📷 ${g.foto ? 'Tomar otra' : 'Tomar foto'}</button><button type="button" class="btn" data-act="galeria" ${iaLeyendo ? 'disabled' : ''}>🖼️ ${g.foto ? 'Otra imagen o PDF' : 'Galería o PDF'}</button></div>
        <div class="row">${g.foto && iaLista() ? `<button type="button" class="btn" data-act="ia-leer" ${iaLeyendo ? 'disabled' : ''}>✨ Leer con IA</button>` : ''}${g.foto ? '<button type="button" class="btn" data-act="foto-del">Quitar foto</button>' : ''}</div>
        ${iaLeyendo ? '<div class="note ia-busy"><span class="spin"></span> <span class="txt">Leyendo la factura con IA…</span></div>' : ''}
        ${g._iaErr && !iaLeyendo ? `<div class="note">⚠ ${esc(g._iaErr)}</div>` : ''}
        ${g._ia && g._ia.length && !iaLeyendo ? `<div class="note ok">✨ Llenado con IA: ${esc(g._ia.join(', '))}. Revise antes de guardar.</div>` : ''}
        <img id="g-foto-prev" class="photo-prev" alt="Foto de la factura" hidden>
      </div>
      <label class="field"><span>Valor total COP</span><input id="g-valor" class="val-input num" inputmode="numeric" required data-money placeholder="$ 0" value="${g.valor === '' ? '' : Number(g.valor).toLocaleString('es-CO')}"></label>
      <div class="field"><span>Concepto</span><div class="seg" role="group" data-seg="concepto">${[...Object.keys(S.listas), ...(g.concepto && !(g.concepto in S.listas) ? [g.concepto] : [])].map(o => `<button type="button" data-val="${esc(o)}" aria-pressed="${g.concepto === o}">${cpIcono(o)} ${esc(o)}</button>`).join('')}</div></div>
      <label class="field"><span>Subconcepto</span><select id="g-sub"><option value="">— Sin subconcepto —</option>${subs.map(s => `<option ${s === g.sub ? 'selected' : ''}>${esc(s)}</option>`).join('')}${g.sub && !subs.includes(g.sub) ? `<option selected>${esc(g.sub)}</option>` : ''}</select></label>
      <div class="grid2">
        <label class="field"><span>Fecha</span><input id="g-fecha" type="date" required value="${esc(g.fecha)}"></label>
        <label class="field"><span>N° Factura / Comprobante</span><input id="g-factura" value="${esc(g.factura)}"></label>
      </div>
      <label class="field"><span>Proveedor (nombre comercial)</span><input id="g-prov" list="provs" value="${esc(g.proveedor)}"><datalist id="provs">${provs.map(p => `<option value="${esc(p)}">`).join('')}</datalist></label>
      <label class="field"><span>Razón social</span><input id="g-razon" value="${esc(g.razon || '')}"></label>
      <div class="grid2">
        <label class="field"><span>NIT / documento (sin DV)</span><input id="g-nit" inputmode="numeric" value="${esc(g.nit || '')}"></label>
        <label class="field"><span>DV impreso</span><input id="g-dv" inputmode="numeric" maxlength="1" value="${esc(g.dvImpreso || '')}" placeholder="${esc(dvNIT(g.nit) || '')}"></label>
      </div>
      <div id="g-nitchk">${nitAviso(g)}</div>
      ${vDatosFactura(g)}
      <label class="field"><span>Descripción</span><input id="g-desc" value="${esc(g.desc)}"></label>
      <div class="field"><span>Pagado por</span>${seg('pagadoPor', PAGADORES, g.pagadoPor)}</div>
      <div class="field"><span>¿Tiene soporte?</span>${seg('soporte', SOPORTES, g.soporte)}</div>
      <div class="hint">Estado de legalización: <span class="chip ${chipClass(e)}" id="g-estado">${e || '—'}</span></div>
      <label class="field"><span>Observaciones</span><textarea id="g-obs" rows="2">${esc(g.obs)}</textarea></label>
      <div id="g-dup"></div>
      ${bloqueado(g) ? `<div class="note">🔒 Este gasto está en el <b>${esc(nombreCorte(corteDeGasto(g)))}</b> (${esc(estadoCorteTxt(corteDeGasto(g)))}). Solo se puede cambiar si el corte se marca como Devuelto.</div>`
      : `<div class="row"><button class="btn primary" type="submit">Guardar</button>${g._nuevo ? '<button class="btn" type="submit" data-otro="1">Guardar y agregar otro</button>' : ''}</div>
      ${g._nuevo ? '' : '<div id="g-del"><button type="button" class="btn danger block" data-act="g-del">Eliminar gasto</button></div>'}`}
    </div></form></div>`;
  if (!anim && pintarGasto._y) $('#g-form').scrollTop = pintarGasto._y;
  if (fotoTmp) { const im = $('#g-foto-prev'); im.src = fotoTmp; im.hidden = false; }
  if (g._nuevo && anim && !iaLista()) setTimeout(() => $('#g-valor')?.focus(), 50);
}
function leerFormGasto() {
  const g = editando;
  g.valor = $('#g-valor').value.trim() === '' ? '' : parseValor($('#g-valor').value);
  g.sub = $('#g-sub').value; g.fecha = $('#g-fecha').value; g.factura = $('#g-factura').value.trim();
  g.proveedor = $('#g-prov').value.trim(); g.desc = $('#g-desc').value.trim(); g.obs = $('#g-obs').value.trim();
  g.razon = $('#g-razon').value.trim(); g.nit = soloDig($('#g-nit').value); g.dvImpreso = soloDig($('#g-dv').value).slice(0, 1);
  for (const [k, tipo] of FX_CAMPOS) { const el = $('#gx-' + k); if (!el) continue; g[k] = tipo === 'm' ? (el.value.trim() === '' ? '' : parseValor(el.value)) : tipo === 'p' ? (el.value.trim() === '' ? '' : Number(String(el.value).replace(',', '.')) || 0) : el.value.trim(); }
}
/* ---------- Datos completos de la factura ---------- */
const TIPOS_DOC = ['Factura electrónica de venta', 'Factura POS / tiquete', 'Recibo', 'Cuenta de cobro', 'Documento soporte', 'Otro'];
const FORMAS_PAGO = ['Contado', 'Crédito'];
const MEDIOS_PAGO = ['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia', 'Otro'];
// [campo, tipo]: t = texto, m = dinero, p = porcentaje
const FX_CAMPOS = [['tipoDoc', 't'], ['hora', 't'], ['cufe', 't'], ['compradorNombre', 't'], ['compradorNit', 't'], ['subtotal', 'm'], ['ivaPct', 'p'], ['iva', 'm'], ['incPct', 'p'], ['inc', 'm'], ['propina', 'm'], ['descuento', 'm'], ['formaPago', 't'], ['medioPago', 't']];
const nOr0 = x => Number(x) || 0;
function cuadreFactura(g) {
  if (g.subtotal === '' || g.subtotal == null || g.valor === '' || g.valor == null) return null;
  const calc = nOr0(g.subtotal) + nOr0(g.iva) + nOr0(g.inc) + nOr0(g.propina) - nOr0(g.descuento);
  return { calc, ok: Math.abs(calc - nOr0(g.valor)) <= 2 };
}
function nitAviso(g) {
  const out = [];
  if (g.nit && g.dvImpreso !== '' && g.dvImpreso != null && String(g.dvImpreso) !== dvNIT(g.nit)) out.push(`⚠ El dígito de verificación impreso (${esc(g.dvImpreso)}) no coincide con el calculado para el NIT ${esc(g.nit)} (${dvNIT(g.nit)}). Revise el número.`);
  return out.length ? `<div class="note">${out.join('<br>')}</div>` : '';
}
function avisoComprador(g) {
  const emp = soloDig((S.empresa || {}).nit), cn = soloDig(g.compradorNit), nom = (g.compradorNombre || '').toLowerCase();
  if (!cn && !nom) return '';
  if (/consumidor\s*final/.test(nom) || /^2{6,}$/.test(cn)) return `<div class="note">⚠ La factura está a nombre de <b>Consumidor final</b>, no de Sistronic.</div>`;
  if (emp && cn && cn.slice(0, emp.length) !== emp) return `<div class="note">⚠ La factura está a nombre de otro comprador (NIT ${esc(cn)}), no de Sistronic.</div>`;
  if (emp && cn) return `<div class="note ok">✔ Facturada a Sistronic.</div>`;
  return '';
}
function vCuadre(g) {
  const c = cuadreFactura(g); if (!c) return '';
  return c.ok ? `<div class="note ok">✔ Cuadra: subtotal + impuestos + propina − descuentos = ${fmtCOP(c.calc)}</div>`
    : `<div class="note">⚠ No cuadra: subtotal + impuestos + propina − descuentos = <b>${fmtCOP(c.calc)}</b>, pero el total es <b>${fmtCOP(g.valor)}</b>.</div>`;
}
function vDatosFactura(g) {
  const m = (k, l) => `<label class="field"><span>${l}</span><input id="gx-${k}" inputmode="numeric" data-money data-fx value="${g[k] === '' || g[k] == null ? '' : Number(g[k]).toLocaleString('es-CO')}" placeholder="$ 0"></label>`;
  const pc = (k, l) => `<label class="field"><span>${l}</span><input id="gx-${k}" inputmode="decimal" data-fx value="${g[k] === '' || g[k] == null ? '' : esc(g[k])}" placeholder="%"></label>`;
  const t = (k, l, extra = '') => `<label class="field"><span>${l}</span><input id="gx-${k}" value="${esc(g[k] || '')}" ${extra}></label>`;
  const sel = (k, l, opts) => `<label class="field"><span>${l}</span><select id="gx-${k}"><option value="">—</option>${opts.map(o => `<option ${g[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}${g[k] && !opts.includes(g[k]) ? `<option selected>${esc(g[k])}</option>` : ''}</select></label>`;
  const lleno = FX_CAMPOS.some(([k]) => g[k] !== '' && g[k] != null);
  return `<details class="fx-box" ${lleno || g._ia ? 'open' : ''}><summary>Datos de la factura (documento, impuestos y pago)</summary>
    <div class="fx-sec">Documento</div>
    ${sel('tipoDoc', 'Tipo de documento', TIPOS_DOC)}
    <div class="grid2">${t('hora', 'Hora', 'type="time"')}${t('compradorNit', 'NIT / CC del comprador', 'inputmode="numeric"')}</div>
    ${t('compradorNombre', 'Facturada a (nombre del comprador)')}
    <div id="g-comprador">${avisoComprador(g)}</div>
    ${t('cufe', 'CUFE (factura electrónica)', 'spellcheck="false" autocapitalize="off"')}
    <div class="fx-sec">Valores</div>
    ${m('subtotal', 'Subtotal sin impuestos')}
    <div class="grid2">${pc('ivaPct', 'IVA %')}${m('iva', 'Valor IVA')}</div>
    <div class="grid2">${pc('incPct', 'Impoconsumo (INC) %')}${m('inc', 'Valor INC')}</div>
    <div class="grid2">${m('propina', 'Propina / servicio')}${m('descuento', 'Descuentos')}</div>
    <div id="g-cuadre">${vCuadre(g)}</div>
    <div class="fx-sec">Pago</div>
    <div class="grid2">${sel('formaPago', 'Forma de pago', FORMAS_PAGO)}${sel('medioPago', 'Medio de pago', MEDIOS_PAGO)}</div>
  </details>`;
}
const normFact = x => String(x || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').replace(/^0+/, '');
/* Busca la misma factura (N° y proveedor) en todos los viajes */
/* Factura repetida en cualquier viaje: mismo CUFE, o mismo número de factura (sin importar prefijos, espacios o ceros) del mismo emisor.
   El emisor se compara por NIT; si alguno no tiene NIT, por nombre o razón social parecidos. Sin número: mismo emisor, fecha y valor. */
const numFact = x => { const n = normFact(x); const d = (n.match(/\d+/g) || []).pop() || ''; return { n, d: d.replace(/^0+/, '') }; };
const nombresDe = g => [g.proveedor, g.razon].map(normFact).filter(Boolean);
function mismoEmisor(a, b) {
  const na = soloDig(a.nit), nb = soloDig(b.nit);
  if (na && nb) return na === nb;
  const A = nombresDe(a), B = nombresDe(b);
  if (!A.length || !B.length) return true;
  return A.some(x => B.some(y => x === y || (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)))));
}
// ¿b es la misma factura que a? Devuelve 'cufe' | 'numero' | 'valor' | null
function esDuplicado(g, x) {
  const cufe = normFact(g.cufe), f = numFact(g.factura);
  if (cufe && cufe.length > 20 && normFact(x.cufe) === cufe) return 'cufe';
  const mismoDiaValor = g.fecha && x.fecha === g.fecha && Number(x.valor) === Number(g.valor) && Number(g.valor) > 0;
  if (f.n) {
    const xf = numFact(x.factura); if (!xf.n) return null;
    const igual = xf.n === f.n || (f.d && f.d.length >= 3 && xf.d === f.d);
    // Mismo número y mismo emisor; o mismo número, día y valor aunque el NIT se haya escrito distinto
    if (igual && (mismoEmisor(g, x) || (xf.n === f.n && mismoDiaValor))) return 'numero';
    return null;
  }
  if (!normFact(x.factura) && mismoDiaValor && nombresDe(g).length && mismoEmisor(g, x)) return 'valor';
  return null;
}
function facturaRepetida(g) {
  for (const vj of S.viajes) for (const x of vj.gastos) {
    if (x.id === g.id) continue;
    const por = esDuplicado(g, x); if (por) return { g: x, v: vj, por };
  }
  return null;
}
// Grupos de gastos ya guardados que son la misma factura (solo por CUFE o número; los de "mismo valor" pueden ser compras distintas)
function gruposDuplicados() {
  const todos = []; for (const v of S.viajes) for (const g of v.gastos) todos.push({ g, v });
  const grupos = [], usado = new Set();
  for (let i = 0; i < todos.length; i++) {
    if (usado.has(i)) continue; const gr = [todos[i]];
    for (let j = i + 1; j < todos.length; j++) if (!usado.has(j)) { const por = esDuplicado(todos[i].g, todos[j].g); if (por && por !== 'valor') { gr.push(todos[j]); usado.add(j); } }
    if (gr.length > 1) grupos.push(gr);
  }
  return grupos;
}
function abrirDuplicados() {
  const grupos = gruposDuplicados();
  const fila = ({ g, v }, gr) => {
    const k = gr.filter(x => S.viajes.some(vv => vv.gastos.includes(x.g))).length;
    return `<div class="dup-row"><div class="dup-info"><b>${esc(g.proveedor || g.razon || g.concepto || 'Gasto')}</b><small>${fmtCOP(g.valor)} · ${fmtFecha(g.fecha)} · Fact. ${esc(g.factura || '—')}${g.foto ? ' · 📷' : ''}${v.id !== S.activo ? ' · viaje ' + esc(v.cliente || 'sin nombre') : ''}${g.obs ? ' · ' + esc(g.obs) : ''}</small></div>
      ${bloqueado(g) ? '<span class="hint">En corte enviado</span>' : `<button class="btn danger" data-act="dup-del" data-id="${g.id}" ${k <= 1 ? 'disabled' : ''}>Eliminar</button>`}</div>`;
  };
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><div class="sheet anim"><div class="sheet-head"><h3>Facturas repetidas</h3><button class="x" data-close="1" aria-label="Cerrar">×</button></div>
    ${grupos.length ? `<p class="hint" style="margin-top:0">Cada grupo es la misma factura registrada más de una vez. Deje una y elimine las demás. Revise la foto antes si tiene dudas.</p>
      ${grupos.map((gr, i) => `<div class="card dup-grupo"><div class="dup-tit">Factura ${esc(gr[0].g.factura || gr[0].g.cufe || '')} · ${gr.length} veces</div>${gr.map(x => fila(x, gr)).join('')}</div>`).join('')}`
    : '<div class="empty">No hay facturas repetidas. ✅</div>'}
  </div></div>`;
}
function textoDup(d) {
  const mismo = d.v.id === S.activo, donde = mismo ? 'en este viaje' : `en el viaje ${esc(d.v.cliente || 'sin nombre')}${d.v.cot ? ' · COT ' + esc(d.v.cot) : ''}`;
  const qui = d.g.proveedor || d.g.razon;
  return d.por === 'valor' ? `Ya hay un gasto ${qui ? 'de <b>' + esc(qui) + '</b> ' : ''}del mismo día y por el mismo valor ${donde} (${fmtFecha(d.g.fecha)}, ${fmtCOP(d.g.valor)}).`
    : `La factura N° <b>${esc(d.g.factura)}</b>${qui ? ' de <b>' + esc(qui) + '</b>' : ''} ya está registrada ${donde} (${fmtFecha(d.g.fecha)}, ${fmtCOP(d.g.valor)})${d.por === 'cufe' ? ' — mismo CUFE' : ''}.`;
}
/* Aviso inmediato en el formulario (al escribir el número, el NIT o cuando la IA llena los datos) */
function avisoDupVivo() {
  const box = $('#g-dup'); if (!box || !editando || box.querySelector('[data-act=g-dup-ok]')) return;
  try { leerFormGasto(); } catch {}
  const d = facturaRepetida(editando);
  box.innerHTML = d ? `<div class="note dup">${d.por === 'valor' ? '⚠ <b>Posible gasto repetido.</b>' : '⛔ <b>Factura repetida: no se podrá guardar.</b>'} ${textoDup(d)}</div>` : '';
}
let dupOtro = false;
async function guardarGasto(otro, forzar) {
  leerFormGasto();
  const g = editando;
  if (bloqueado(g)) { toast('Este gasto está en un corte enviado'); return; }
  if (!g.corte) { const k = cortesDe(viaje()).find(c => g.fecha && g.fecha >= c.desde && g.fecha <= c.hasta && (!c.revision || c.revision.estado !== 'devuelto')); if (k && g._nuevo) toast(`Ojo: la fecha cae en el ${nombreCorte(k)}, ya enviado. Este gasto irá al siguiente corte.`); }
  if (g.valor === '' || g.valor <= 0) { toast('Escriba el valor del gasto'); $('#g-valor').focus(); return; }
  if (!g.fecha) { toast('Elija la fecha'); return; }
  if (!forzar) {
    const d = facturaRepetida(g);
    if (d) {
      dupOtro = !!otro;
      const box = $('#g-dup');
      if (d.por !== 'valor') {
        box.innerHTML = `<div class="note dup">⛔ <b>No se puede guardar: factura repetida.</b> ${textoDup(d)} Revise el número${d.por === 'cufe' ? ' o el CUFE' : ' y el NIT'}, o edite la factura original.</div>`;
        box.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Factura repetida: no se guardó'); return;
      }
      box.innerHTML = `<div class="note dup">⚠ <b>Posible gasto repetido.</b> ${textoDup(d)} Si son dos compras distintas (por ejemplo, dos taxis iguales), puede guardarlo.</div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn danger" data-act="g-dup-ok">Sí, es otro gasto</button><button type="button" class="btn" data-act="g-dup-no">Revisar</button></div>`;
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
  }
  const v = viaje();
  if (fotoTmp === null) { await DB.del('foto:' + g.id); g.foto = false; }
  else if (fotoTmp) { await DB.set('foto:' + g.id, fotoTmp); g.foto = true; g.fotoV = Date.now(); (await metaSync()).fv[g.id] = g.fotoV; }
  registrarProveedor(g, g._tercero);
  if (g.nit) { const nitG = g.nit; setTimeout(() => enriquecerProveedores(nitG).catch(() => {}), 500); }
  const limpio = { ...g }; delete limpio._nuevo; delete limpio._ia; delete limpio._iaErr; delete limpio._tercero;
  const i = v.gastos.findIndex(x => x.id === g.id);
  if (i >= 0) v.gastos[i] = limpio; else v.gastos.push(limpio);
  await guardar();
  toast(g._nuevo ? 'Gasto registrado' : 'Gasto actualizado');
  if (otro) { const base = { fecha: g.fecha, concepto: g.concepto, pagadoPor: g.pagadoPor }; abrirGasto(); Object.assign(editando, base); pintarGasto(); }
  else cerrarSheet();
  render();
}
function cerrarSheet() { $('#sheet').innerHTML = ''; editando = null; fotoTmp = undefined; }

/* ---------- Facturas en PDF: se convierten a imagen (y se saca su texto para la IA) ---------- */
let pdfTextoTmp = null;
// Quita el margen blanco de una página (deja un borde pequeño). Devuelve null si la página está vacía.
function recortarBlanco(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4; if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) return null;
  const m = Math.round(W * 0.03); x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W, x1 + m); y1 = Math.min(H, y1 + m);
  const o = lienzo(x1 - x0, y1 - y0); o.getContext('2d').drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0); return o;
}
async function pdfAImagen(file) {
  const pdfjs = await import(new URL('vendor/pdf.min.mjs', location.href).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = Math.min(doc.numPages, 4), lienzos = []; let texto = '';
  for (let i = 1; i <= n; i++) {
    const pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 }), k = Math.min(3, 1400 / v1.width), vp = pg.getViewport({ scale: k });
    const c = lienzo(Math.round(vp.width), Math.round(vp.height)), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise; const rec = recortarBlanco(c); if (rec) lienzos.push(rec);
    try { const tc = await pg.getTextContent(); texto += tc.items.map(t => t.str + (t.hasEOL ? '\n' : ' ')).join('') + '\n'; } catch {}
  }
  // Une las páginas una debajo de otra (máx. 4), sin pasar de un alto razonable
  if (!lienzos.length) throw new Error('El PDF está en blanco');
  const W = Math.max(...lienzos.map(c => c.width)), Htot = lienzos.reduce((s, c) => s + c.height, 0), k = Math.min(1, 5000 / Htot);
  const out = lienzo(Math.round(W * k), Math.round(Htot * k)), ox = out.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, out.width, out.height);
  let y = 0; for (const c of lienzos) { ox.drawImage(c, 0, y, c.width * k, c.height * k); y += c.height * k; if (y < out.height) { ox.fillStyle = '#ccc'; ox.fillRect(0, y - 1, out.width, 2); } }
  return { src: out.toDataURL('image/jpeg', 0.85), texto: texto.replace(/[ \t]+/g, ' ').trim(), paginas: doc.numPages };
}

/* ---------- Soportes en PDF (una factura por archivo) ---------- */
function pdfTexto(t) { let o = ''; const W = { '\u2026': 133, '\u2014': 151, '\u2013': 150, '\u201c': 147, '\u201d': 148, '\u2018': 145, '\u2019': 146, '\u20ac': 128 }; for (let ch of String(t)) { if (W[ch]) ch = String.fromCharCode(W[ch]); const c = ch.charCodeAt(0); o += c > 255 ? '?' : (ch === '(' || ch === ')' || ch === '\\') ? '\\' + ch : c > 126 || c < 32 ? '\\' + c.toString(8).padStart(3, '0') : ch; } return o; }
async function fotoJPEG(src) {
  if (/^data:image\/jpe?g/i.test(src)) return { bytes: b64Bytes(src.split(',')[1]), im: await cargarImagen(src) };
  const im = await cargarImagen(src), c = lienzo(im.width, im.height), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
  const d = c.toDataURL('image/jpeg', 0.85); return { bytes: b64Bytes(d.split(',')[1]), im };
}
// PDF de varias páginas (tamaño carta): índice con todas las facturas y luego una página por factura con su encabezado
function armarPDF(paginas) {
  // paginas: [{ cont: 'operadores', img?: { bytes, w, h } }]
  const partes = [], offs = []; let largo = 0;
  const add = x => { const b = typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) & 255) : x; partes.push(b); largo += b.length; };
  const obj = (n, cuerpo) => { offs[n] = largo; add(`${n} 0 obj\n`); for (const c of [].concat(cuerpo)) add(c); add('\nendobj\n'); };
  const N = paginas.length, base = 5, ids = paginas.map((_, i) => base + i * 3);
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${ids.map(i => i + ' 0 R').join(' ')}] /Count ${N} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  paginas.forEach((pg, i) => {
    const id = ids[i];
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${pg.img ? ` /XObject << /Im1 ${id + 2} 0 R >>` : ''} >> /Contents ${id + 1} 0 R >>`);
    const c = Uint8Array.from(pg.cont, ch => ch.charCodeAt(0) & 255);
    obj(id + 1, [`<< /Length ${c.length} >>\nstream\n`, c, '\nendstream']);
    if (pg.img) obj(id + 2, [`<< /Type /XObject /Subtype /Image /Width ${pg.img.w} /Height ${pg.img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.img.bytes.length} >>\nstream\n`, pg.img.bytes, '\nendstream']);
    else obj(id + 2, '<< >>');
  });
  const total = base + N * 3, xref = largo;
  let tabla = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let n = 1; n < total; n++) tabla += String(offs[n] || 0).padStart(10, '0') + ' 00000 n \n';
  add(tabla + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(largo); let p = 0; for (const b of partes) { out.set(b, p); p += b.length; }
  return out;
}
const pdfT = (f, tam, x, y, t, gris) => `${gris ? '0.4 g ' : '0 g '}BT /${f} ${tam} Tf ${x} ${y} Td (${pdfTexto(t)}) Tj ET\n`;
const pdfDer = (f, tam, xDer, y, t) => pdfT(f, tam, xDer - String(t).length * tam * 0.5, y, t);
// NIT del proveedor con su dígito de verificación (del gasto o, si falta, de la lista de proveedores)
function nitTexto(g) {
  let nit = soloDig(g.nit);
  if (!nit) { const A = nombresDe(g); for (const p of Object.values(S.proveedores || {})) { const B = nombresDe({ proveedor: p.comercial, razon: p.razon }); if (p.nit && A.length && B.length && A.some(x => B.includes(x))) { nit = soloDig(p.nit); break; } } }
  return nit ? nit + '-' + dvNIT(nit) : '';
}
const cortoPDF = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 3) + '...' : t; };
async function pdfFacturas(vx, gastos, aviso) {
  const lista = gastos.filter(g => g.foto).slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const total = lista.reduce((s, g) => s + (Number(g.valor) || 0), 0), m = 40, paginas = [];
  const cab = `${vx.cliente || 'Viaje'}${vx.cot ? ' · COT ' + vx.cot : ''}${vx.servicio ? ' · ' + vx.servicio : ''}`;
  const per = `${vx._corte ? nombreCorte(vx._corte) + ' · ' : ''}${fmtFecha(vx.inicio)} a ${fmtFecha(vx.fin)}${vx.trabajador ? ' · ' + vx.trabajador : ''}`;
  // Índice
  const porPag = 34;
  for (let i = 0; i < Math.max(1, Math.ceil(lista.length / porPag)); i++) {
    let c = pdfT('F1', 16, m, 740, 'Soportes de facturas') + pdfT('F2', 10, m, 722, cab) + pdfT('F2', 10, m, 708, per, true);
    let y = 680; c += pdfT('F1', 9, m, y, 'Pág.') + pdfT('F1', 9, m + 30, y, 'Fecha') + pdfT('F1', 9, m + 84, y, 'Proveedor') + pdfT('F1', 9, m + 248, y, 'NIT') + pdfT('F1', 9, m + 330, y, 'Factura') + pdfDer('F1', 9, 572, y, 'Valor');
    c += `0.75 G 0.5 w ${m} ${y - 6} m 572 ${y - 6} l S\n`; y -= 20;
    lista.slice(i * porPag, (i + 1) * porPag).forEach((g, j) => {
      const n = i * porPag + j;
      c += pdfT('F2', 9, m, y, String(n + 2 + Math.ceil(lista.length / porPag) - 1)) + pdfT('F2', 9, m + 30, y, fmtFecha(g.fecha)) + pdfT('F2', 9, m + 84, y, cortoPDF(g.proveedor || g.razon || g.concepto, 30)) + pdfT('F2', 9, m + 248, y, nitTexto(g) || '-') + pdfT('F2', 9, m + 330, y, cortoPDF(g.factura || '-', 22)) + pdfDer('F2', 9, 572, y, fmtCOP(g.valor).replace(/\s/g, ' '));
      y -= 17;
    });
    if (i === Math.ceil(lista.length / porPag) - 1 || !lista.length) { c += `0.75 G 0.5 w ${m} ${y + 8} m 572 ${y + 8} l S\n` + pdfT('F1', 10, m, y - 8, `${lista.length} factura${lista.length === 1 ? '' : 's'}`) + pdfDer('F1', 10, 572, y - 8, 'Total ' + fmtCOP(total).replace(/\s/g, ' ')); }
    paginas.push({ cont: c });
  }
  // Una página por factura
  for (let i = 0; i < lista.length; i++) {
    const g = lista[i]; aviso && aviso(`Armando el PDF de facturas (${i + 1} de ${lista.length})…`);
    const src = await DB.get('foto:' + g.id); if (!src) continue;
    const { bytes, im } = await fotoJPEG(src), top = 64, mm = 28;
    const k = Math.min((612 - 2 * mm) / im.width, (792 - top - mm) / im.height), iw = im.width * k, ih = im.height * k, ix = (612 - iw) / 2, iy = 792 - top - ih;
    const det = `Fecha ${fmtFecha(g.fecha)} · ${g.concepto || ''}${g.sub ? ' / ' + g.sub : ''}${g.factura ? ' · Factura N° ' + g.factura : ''}${nitTexto(g) ? ' · NIT ' + nitTexto(g) : ''} · Pagado por ${g.pagadoPor || ''}`;
    const c = pdfT('F1', 12, mm, 762, `${i + 1}. ${g.proveedor || g.razon || g.concepto || 'Gasto'} · ${fmtCOP(g.valor)}`) + pdfT('F2', 9, mm, 747, cortoPDF(det, 120), true) + `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im1 Do Q`;
    paginas.push({ cont: c, img: { bytes, w: im.width, h: im.height } });
  }
  return { bytes: armarPDF(paginas), n: lista.length };
}
const nombreFacturasPDF = vx => (vx._corte ? nombreCorte(vx._corte) + ' - ' : vx._final ? 'Pendiente por cortar - ' : '') + nombreArchivoViaje(vx) + ' - Facturas.pdf';
// Sube un solo PDF con todas las facturas (con foto) de lo que se envía. Si no hay fotos, no sube nada.
async function subirFacturasPDF(vx, carpeta, carpetaId, sub, aviso) {
  if (!vx.gastos.some(g => g.foto)) return 0;
  const { bytes, n } = await pdfFacturas(vx, vx.gastos, aviso);
  aviso && aviso('Subiendo el PDF de facturas…');
  await GW.subir(bytes, nombreFacturasPDF(vx), 'application/pdf', carpeta, carpetaId, sub);
  if (vx._corte) vx._corte.pdfFacturas = new Date().toISOString();
  return n;
}

/* ---------- Escáner de facturas (recorte, perspectiva y filtro de documento) ---------- */
function cargarImagen(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
function leerArchivo(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// Umbral de Otsu sobre un histograma de 256 niveles
function otsu(hist, total) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, mejor = 0, t = 127;
  for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > mejor) { mejor = v; t = i; } }
  return t;
}
// Busca el papel (zona clara y poco saturada más grande) y devuelve sus 4 esquinas en coordenadas 0..1
function detectarBordes(im) {
  const k = 320 / Math.max(im.width, im.height), w = Math.max(8, Math.round(im.width * k)), h = Math.max(8, Math.round(im.height * k));
  const c = lienzo(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, n = w * h, s = new Uint8Array(n), hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = Math.max(0, Math.min(255, Math.round((r + g + b) / 3 - (mx - mn) * 0.8))); s[i] = v; hist[v]++; }
  const t = otsu(hist, n), m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = s[i] > t ? 1 : 0;
  // Componente conexa más grande
  const lab = new Int32Array(n), pila = new Int32Array(n); let mejor = 0, mejorTam = 0, id = 0;
  for (let i = 0; i < n; i++) {
    if (!m[i] || lab[i]) continue; id++; let p = 0, tam = 0; pila[p++] = i; lab[i] = id;
    while (p) { const j = pila[--p]; tam++; const jx = j % w; for (const q of [j - w, j + w, jx ? j - 1 : -1, jx < w - 1 ? j + 1 : -1]) if (q >= 0 && q < n && m[q] && !lab[q]) { lab[q] = id; pila[p++] = q; } }
    if (tam > mejorTam) { mejorTam = tam; mejor = id; }
  }
  const completo = [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (mejorTam < n * 0.12) return completo;
  let tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
  for (let i = 0; i < n; i++) if (lab[i] === mejor) { const px = i % w, py = (i / w) | 0, a = px + py, b = px - py; if (a < tl[2]) tl = [px, py, a]; if (a > br[2]) br = [px, py, a]; if (b > tr[2]) tr = [px, py, b]; if (b < bl[2]) bl = [px, py, b]; }
  // Correr las esquinas un poco hacia adentro para no arrastrar la mesa en los bordes
  const cx = (tl[0] + tr[0] + br[0] + bl[0]) / 4, cy = (tl[1] + tr[1] + br[1] + bl[1]) / 4;
  const q = [tl, tr, br, bl].map(([px, py]) => { px += Math.sign(cx - px) * 0.8; py += Math.sign(cy - py) * 0.8; return [Math.min(1, Math.max(0, (px + 0.5) / w)), Math.min(1, Math.max(0, (py + 0.5) / h))]; });
  // Si el papel ocupa casi toda la foto, no recortar
  if (areaQuad(q) > 0.93) return completo;
  return q;
}
function areaQuad(q) { let a = 0; for (let i = 0; i < 4; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
// Homografía que lleva el rectángulo (0..W,0..H) al cuadrilátero q (en píxeles)
function homografia(W, H, q) {
  const src = [[0, 0], [W, 0], [W, H], [0, H]], A = [], B = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = q[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
  return B.map((b, i) => b / A[i][i]);
}
// Endereza el cuadrilátero y aplica el filtro. modo: 'doc' (gris limpio), 'color' (color limpio), 'orig'
function escanear(im, quad, modo) {
  const IW = im.width, IH = im.height, q = quad.map(([x, y]) => [x * IW, y * IH]), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, 1600 / Math.max(W, H)); W = Math.max(16, Math.round(W * k)); H = Math.max(16, Math.round(H * k));
  const sc = lienzo(IW, IH), sx = sc.getContext('2d', { willReadFrequently: true }); sx.drawImage(im, 0, 0);
  const S = sx.getImageData(0, 0, IW, IH).data, out = lienzo(W, H), ox = out.getContext('2d'), O = ox.createImageData(W, H), D = O.data;
  const [a, b, c, d, e, f, g, h] = homografia(W, H, q);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = g * x + h * y + 1, u = (a * x + b * y + c) / z, v = (d * x + e * y + f) / z;
    const x0 = Math.max(0, Math.min(IW - 2, Math.floor(u))), y0 = Math.max(0, Math.min(IH - 2, Math.floor(v))), fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0));
    const i00 = (y0 * IW + x0) * 4, i10 = i00 + 4, i01 = i00 + IW * 4, i11 = i01 + 4, o = (y * W + x) * 4;
    for (let ch = 0; ch < 3; ch++) D[o + ch] = (S[i00 + ch] * (1 - fx) + S[i10 + ch] * fx) * (1 - fy) + (S[i01 + ch] * (1 - fx) + S[i11 + ch] * fx) * fy;
    D[o + 3] = 255;
  }
  if (modo !== 'orig') filtroDocumento(D, W, H, modo === 'color');
  ox.putImageData(O, 0, 0);
  return out;
}
// Quita sombras e iluminación desigual (divide por el fondo estimado) y deja el papel blanco
function filtroDocumento(D, W, H, color) {
  const n = W * H, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = 0.299 * D[i * 4] + 0.587 * D[i * 4 + 1] + 0.114 * D[i * 4 + 2];
  // Fondo: reducir, máximo local (borra el texto) y suavizar
  const f = Math.max(4, Math.round(Math.max(W, H) / 120)), bw = Math.ceil(W / f), bh = Math.ceil(H / f), Bm = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let mx = 0; for (let y = by * f; y < Math.min(H, by * f + f); y++) for (let x = bx * f; x < Math.min(W, bx * f + f); x++) { const v = L[y * W + x]; if (v > mx) mx = v; } Bm[by * bw + bx] = mx; }
  const dil = (A, r) => { const R = new Float32Array(A.length); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let mx = 0; for (let yy = Math.max(0, y - r); yy <= Math.min(bh - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(bw - 1, x + r); xx++) if (A[yy * bw + xx] > mx) mx = A[yy * bw + xx]; R[y * bw + x] = mx; } return R; };
  const blur = (A, r) => { let R = new Float32Array(A.length); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let s = 0, c = 0; for (let xx = Math.max(0, x - r); xx <= Math.min(bw - 1, x + r); xx++) { s += A[y * bw + xx]; c++; } R[y * bw + x] = s / c; } const R2 = new Float32Array(A.length); for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let s = 0, c = 0; for (let yy = Math.max(0, y - r); yy <= Math.min(bh - 1, y + r); yy++) { s += R[yy * bw + x]; c++; } R2[y * bw + x] = s / c; } return R2; };
  const Bg = blur(dil(Bm, 2), 3);
  const fondo = (x, y) => { const gx = Math.min(bw - 1, Math.max(0, x / f - 0.5)), gy = Math.min(bh - 1, Math.max(0, y / f - 0.5)), x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1), fx = gx - x0, fy = gy - y0; return (Bg[y0 * bw + x0] * (1 - fx) + Bg[y0 * bw + x1] * fx) * (1 - fy) + (Bg[y1 * bw + x0] * (1 - fx) + Bg[y1 * bw + x1] * fx) * fy; };
  // Normalizar y fijar el punto negro con el percentil 2 de la tinta
  const N = new Float32Array(n), hist = new Uint32Array(256);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, bgv = Math.max(40, fondo(x, y)), v = Math.min(1, L[i] / bgv); N[i] = v; hist[Math.round(v * 255)]++; }
  let acc = 0, negro = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { negro = i / 255; break; } }
  negro = Math.min(negro, 0.6); const blanco = 0.9;
  const curva = v => { let t = (v - negro) / (blanco - negro); t = Math.min(1, Math.max(0, t)); return Math.pow(t, 1.35); };
  // Color del papel (para que quede blanco y no amarillo)
  const papel = [0, 0, 0]; let np = 0; for (let i = 0; i < n; i += 7) if (N[i] > 0.85) { papel[0] += D[i * 4]; papel[1] += D[i * 4 + 1]; papel[2] += D[i * 4 + 2]; np++; }
  if (np) { const m = (papel[0] + papel[1] + papel[2]) / 3; for (let ch = 0; ch < 3; ch++) papel[ch] = Math.max(1, papel[ch] / m * 255); } else papel.fill(255);
  for (let i = 0; i < n; i++) {
    const t = curva(N[i]), o = i * 4;
    if (color) { for (let ch = 0; ch < 3; ch++) { const cv = D[o + ch] / papel[ch] * 255 / Math.max(40, L[i] / Math.max(N[i], 1e-3)); D[o + ch] = Math.max(0, Math.min(255, (t + (cv - N[i]) * 1.2) * 255)); } }
    else { const v = Math.round(t * 255); D[o] = D[o + 1] = D[o + 2] = v; }
  }
}

// Pantalla para revisar el escaneo, cambiar el filtro o ajustar el recorte. Devuelve el dataURL final o null si se cancela.
function abrirEscaner(file) {
  return new Promise(async (fin, falla) => {
    let src, im;
    try { src = await leerArchivo(file); im = await cargarImagen(src); } catch (e) { return falla(e); }
    let modo = 'doc'; try { modo = localStorage.getItem('scan:modo') || 'doc'; } catch {}
    const auto = detectarBordes(im); let quad = auto.map(p => [...p]), vista = 'res', resultado = null;
    const cont = document.createElement('div'); cont.className = 'scan-back'; document.body.appendChild(cont);
    const cerrar = v => { cont.remove(); fin(v); };
    const exportar = () => {
      if (modo === 'orig') { const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = lienzo(Math.round(im.width * k), Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.75); }
      return escanear(im, quad, modo).toDataURL('image/jpeg', modo === 'doc' ? 0.8 : 0.78);
    };
    const pintar = () => {
      if (vista === 'res') {
        cont.innerHTML = `<div class="scan"><div class="scan-head"><b>Revisar factura</b><button class="x" data-s="cancelar" aria-label="Cancelar">×</button></div>
          <div class="scan-stage"><div class="scan-wait"><span class="spin"></span> Procesando…</div><img id="scan-img" alt="Factura escaneada" hidden></div>
          <div class="seg scan-seg">${[['doc', 'Documento'], ['color', 'Color'], ['orig', 'Original']].map(([k, l]) => `<button data-s="modo" data-v="${k}" aria-pressed="${modo === k}">${l}</button>`).join('')}</div>
          <div class="scan-foot"><button class="btn" data-s="recorte" ${modo === 'orig' ? 'disabled' : ''}>✂️ Ajustar recorte</button><button class="btn primary" data-s="usar">Usar esta foto</button></div></div>`;
        setTimeout(() => { resultado = exportar(); const i = cont.querySelector('#scan-img'); if (!i) return; i.onload = () => { i.hidden = false; const w = cont.querySelector('.scan-wait'); if (w) w.remove(); }; i.src = resultado; }, 30);
      } else {
        cont.innerHTML = `<div class="scan"><div class="scan-head"><b>Ajustar recorte</b><button class="x" data-s="volver" aria-label="Volver">×</button></div>
          <p class="scan-tip">Arrastre las cuatro esquinas a las puntas de la factura.</p>
          <div class="scan-stage"><div class="scan-crop"><img src="${src}" alt="Foto original"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none"><polygon id="scan-poly"/></svg>${[0, 1, 2, 3].map(i => `<span class="scan-h" data-h="${i}"></span>`).join('')}</div></div>
          <div class="scan-foot"><button class="btn" data-s="auto">Automático</button><button class="btn" data-s="toda">Toda la foto</button><button class="btn primary" data-s="aplicar">Aplicar</button></div></div>`;
        const caja = cont.querySelector('.scan-crop'), ar = im.width / im.height, st = cont.querySelector('.scan-stage');
        const ajustar = () => { const W = st.clientWidth, H = st.clientHeight; let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; } caja.style.width = w + 'px'; caja.style.height = h + 'px'; };
        ajustar();
        const dibujar = () => { cont.querySelector('#scan-poly').setAttribute('points', quad.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')); cont.querySelectorAll('.scan-h').forEach(h => { const [x, y] = quad[+h.dataset.h]; h.style.left = x * 100 + '%'; h.style.top = y * 100 + '%'; }); };
        dibujar();
        cont.querySelectorAll('.scan-h').forEach(h => h.addEventListener('pointerdown', ev => {
          ev.preventDefault(); h.setPointerCapture(ev.pointerId); const i = +h.dataset.h;
          const mover = e => { const r = caja.getBoundingClientRect(); quad[i] = [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; dibujar(); };
          const soltar = () => { h.removeEventListener('pointermove', mover); h.removeEventListener('pointerup', soltar); h.removeEventListener('pointercancel', soltar); };
          h.addEventListener('pointermove', mover); h.addEventListener('pointerup', soltar); h.addEventListener('pointercancel', soltar);
        }));
        cont._dibujar = dibujar;
      }
    };
    cont.addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (!b) return; const s = b.dataset.s;
      if (s === 'cancelar') cerrar(null);
      else if (s === 'modo') { modo = b.dataset.v; try { localStorage.setItem('scan:modo', modo); } catch {} pintar(); }
      else if (s === 'usar') cerrar(resultado || exportar());
      else if (s === 'recorte') { vista = 'crop'; pintar(); }
      else if (s === 'volver') { vista = 'res'; pintar(); }
      else if (s === 'auto') { quad = auto.map(p => [...p]); cont._dibujar(); }
      else if (s === 'toda') { quad = [[0, 0], [1, 0], [1, 1], [0, 1]]; cont._dibujar(); }
      else if (s === 'aplicar') { vista = 'res'; if (modo === 'orig') modo = 'doc'; pintar(); }
    });
    pintar();
  });
}

function comprimirFoto(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const max = 1280, k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      im.onerror = rej; im.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------- Viajes ---------- */
function abrirViajes() {
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><div class="sheet anim">
    <div class="sheet-head"><h3>Viajes</h3><button class="x" data-close="1" aria-label="Cerrar">×</button></div>
    <div class="list trip-list">${[...S.viajes].sort((a, b) => (b.inicio || '').localeCompare(a.inicio || '')).map(x => { const I = indicadores(x); return `<button class="item ${x.id === S.activo ? 'on' : ''}" data-trip="${x.id}"><span class="t">${esc(x.cliente || 'Sin nombre')}${x.cot ? ' · COT ' + esc(x.cot) : ''}</span><span class="a num">${fmtCOP(I.gastado)}</span><span class="s">${esc(x.servicio)} · ${fmtFecha(x.inicio)}–${fmtFecha(x.fin)}</span><span class="s" style="text-align:right">${x.gastos.length} gastos</span><span class="s" style="grid-column:1/-1;margin-top:3px">${chipRev(x)}${x.revision ? ' <span style="margin-left:4px">' + fmtFH(x.revision.fecha) + '</span>' : ''}</span></button>`; }).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn primary" data-act="new-trip">Nuevo viaje</button></div>
  </div></div>`;
}

/* ---------- Excel (SheetJS cargado bajo demanda) ---------- */
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('No se pudo cargar el módulo de Excel')); document.head.appendChild(s); });
}
const xDate = s => { const d = parseISO(s); return d || ''; };
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
  const fijadas = new Set(), zonas = [];
  for (const f of sd.getElementsByTagNameNS(NS_MAIN, 'f')) if (f.getAttribute('t') === 'array' && f.getAttribute('ref')) zonas.push(f.getAttribute('ref'));
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
    const arriba = celdas.get(col + (Number(row) - 1)); if (arriba && arriba.getAttribute('s')) c.setAttribute('s', arriba.getAttribute('s')); // hereda el formato de la fila de arriba
    const sig = [...r.getElementsByTagNameNS(NS_MAIN, 'c')].find(x => colNum(x.getAttribute('r').replace(/\d+/g, '')) > colNum(col));
    r.insertBefore(c, sig || null); celdas.set(ref, c);
    return c;
  }
  function set(ref, val, keepFormula) {
    const c = celda(ref); fijadas.add(ref);
    const f = keepFormula && !SOLO_VALORES ? c.getElementsByTagNameNS(NS_MAIN, 'f')[0] : null;
    while (c.firstChild) c.removeChild(c.firstChild);
    c.removeAttribute('t');
    if (f) c.appendChild(f);
    if (val === '' || val == null) { if (f) { c.setAttribute('t', 'str'); c.appendChild(doc.createElementNS(NS_MAIN, 'v')); } return; }
    if (typeof val === 'number') { const v = doc.createElementNS(NS_MAIN, 'v'); v.textContent = String(val); c.appendChild(v); return; }
    if (f) { c.setAttribute('t', 'str'); const v = doc.createElementNS(NS_MAIN, 'v'); v.textContent = String(val); c.appendChild(v); return; }
    c.setAttribute('t', 'inlineStr');
    const is = doc.createElementNS(NS_MAIN, 'is'), t = doc.createElementNS(NS_MAIN, 't');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = String(val); is.appendChild(t); c.appendChild(is);
  }
  /* Quita todas las fórmulas: deja solo valores. Celdas con fórmula o dentro de un rango derramado que no se llenaron quedan vacías. */
  function aplanar() {
    const vaciar = c => { while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t'); };
    for (const z of zonas) {
      const [a, b = a] = z.split(':'), [, ca, ra] = a.match(/^([A-Z]+)(\d+)$/), [, cb, rb] = b.match(/^([A-Z]+)(\d+)$/);
      for (let r = +ra; r <= +rb; r++) for (let k = colNum(ca); k <= colNum(cb); k++) {
        let col = '', n = k; while (n) { col = String.fromCharCode(65 + (n - 1) % 26) + col; n = Math.floor((n - 1) / 26); }
        const c = celdas.get(col + r); if (c && !fijadas.has(col + r)) vaciar(c);
      }
    }
    for (const c of [...sd.getElementsByTagNameNS(NS_MAIN, 'c')]) {
      c.removeAttribute('cm');
      const f = c.getElementsByTagNameNS(NS_MAIN, 'f')[0];
      if (f) { if (fijadas.has(c.getAttribute('r'))) f.remove(); else vaciar(c); }
    }
  }
  return { set, aplanar, xml: () => new XMLSerializer().serializeToString(doc) };
}
const SOLO_VALORES = true; // el Excel exportado lleva solo valores y formato (sin fórmulas)
/* Hoja "Soportes": una fila por gasto con foto, en el mismo orden de Control de Gastos, con la foto al lado. */
const xesc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function medirImagen(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 800, h: 600 }); im.src = src; });
}
async function agregarHojaSoportes(zip, gs, vv) {
  const conFoto = [];
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i];
    if (!g.foto) continue;
    const src = await DB.get('foto:' + g.id);
    if (src && src.startsWith('data:image/')) conFoto.push({ g, fila: 14 + i, src });
  }
  const EMU = 9525, ROW_PT = 230, MAXW = 400, MAXH = 290;
  const c = (ref, s, v) => typeof v === 'number' ? `<c r="${ref}" s="${s}"><v>${v}</v></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
  let rows = `<row r="1" ht="40" customHeight="1">${c('B1', 168, 'SOPORTES FOTOGRÁFICOS DE FACTURAS')}${['C', 'D', 'E', 'F', 'G', 'H'].map(x => `<c r="${x}1" s="168"/>`).join('')}</row>`;
  const v = vv || viaje();
  rows += `<row r="2">${c('B2', 171, `${v.cliente || ''} · COT ${v.cot || ''} · ${v.servicio || ''} · ${v.trabajador || ''}`)}</row>`;
  const heads = ['Fila en Control de Gastos', 'Fecha', 'Concepto / Subconcepto', 'Proveedor', 'Valor COP', 'N° Factura', 'Foto de la factura'];
  rows += `<row r="3" ht="30" customHeight="1">${heads.map((h, i) => c('BCDEFGH'[i] + '3', 23, h)).join('')}</row>`;
  let anchors = '', rels = '', ct = '';
  if (!conFoto.length) rows += `<row r="4">${c('B4', 171, 'No hay fotos de facturas en este viaje.')}</row>`;
  for (let k = 0; k < conFoto.length; k++) {
    const { g, fila, src } = conFoto[k], r = 4 + k;
    rows += `<row r="${r}" ht="${ROW_PT}" customHeight="1">${c('B' + r, 171, fila)}${c('C' + r, 170, serial(g.fecha))}${c('D' + r, 171, [g.concepto, g.sub].filter(Boolean).join(' / '))}${c('E' + r, 171, g.proveedor || '')}${c('F' + r, 172, Number(g.valor) || 0)}${c('G' + r, 171, g.factura || '—')}<c r="H${r}" s="171"/></row>`;
    const { w, h } = await medirImagen(src);
    const k2 = Math.min(MAXW / w, MAXH / h, 1), cx = Math.round(w * k2) * EMU, cy = Math.round(h * k2) * EMU;
    const name = `soporte${k + 1}.jpeg`;
    zip.file('xl/media/' + name, src.split(',')[1], { base64: true });
    rels += `<Relationship Id="rIdF${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`;
    anchors += `<xdr:oneCellAnchor><xdr:from><xdr:col>7</xdr:col><xdr:colOff>${6 * EMU}</xdr:colOff><xdr:row>${r - 1}</xdr:row><xdr:rowOff>${6 * EMU}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${k + 2}" name="Soporte ${k + 1}" descr="${xesc((g.proveedor || '') + ' ' + (g.factura || ''))}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rIdF${k + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  }
  const hayDibujo = conFoto.length > 0;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="FF082759"/><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="2.3" customWidth="1"/><col min="2" max="2" width="13" customWidth="1"/><col min="3" max="3" width="13" customWidth="1"/><col min="4" max="4" width="30" customWidth="1"/><col min="5" max="5" width="24" customWidth="1"/><col min="6" max="6" width="15" customWidth="1"/><col min="7" max="7" width="18" customWidth="1"/><col min="8" max="8" width="60" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="2"><mergeCell ref="B1:H1"/><mergeCell ref="B2:H2"/></mergeCells><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="portrait" fitToHeight="0"/>${hayDibujo ? '<drawing r:id="rIdD1"/>' : ''}</worksheet>`;
  zip.file('xl/worksheets/sheetSoportes.xml', sheet);
  if (hayDibujo) {
    zip.file('xl/worksheets/_rels/sheetSoportes.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdD1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawingSoportes.xml"/></Relationships>`);
    zip.file('xl/drawings/drawingSoportes.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`);
    zip.file('xl/drawings/_rels/drawingSoportes.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
    ct += '<Override PartName="/xl/drawings/drawingSoportes.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
  }
  ct += '<Override PartName="/xl/worksheets/sheetSoportes.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  let types = await zip.file('[Content_Types].xml').async('string');
  if (!/Extension="jpeg"/.test(types)) ct = '<Default Extension="jpeg" ContentType="image/jpeg"/>' + ct;
  types = types.replace('</Types>', ct + '</Types>');
  zip.file('[Content_Types].xml', types);
  let wrels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  wrels = wrels.replace('</Relationships>', '<Relationship Id="rIdSoportes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheetSoportes.xml"/></Relationships>');
  zip.file('xl/_rels/workbook.xml.rels', wrels);
  return conFoto.length;
}

async function exportarExcel(soloGenerar, vx) {
  const JSZip = await cargarScript('vendor/jszip.min.js', 'JSZip');
  const resp = await fetch('vendor/plantilla.xlsx');
  if (!resp.ok) throw new Error('No se encontró la plantilla de Excel');
  const zip = await JSZip.loadAsync(await resp.arrayBuffer());
  const v0 = viaje(), v = vx || vistaAbierta(v0);
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
  // Valores ya calculados (por si se abre en un visor que no recalcula)
  const I = indicadores(v);
  [['I5', diasServicio(v)], ['B10', I.anticipo], ['D10', I.gastado], ['F10', I.saldo], ['H10', I.sistronic], ['J10', I.conSoporte], ['L10', I.pendiente], ['M10', I.pendiente]].forEach(([r, x]) => h1.set(r, x, true));
  if (SOLO_VALORES) h1.aplanar();
  zip.file(p1, h1.xml());

  if (SOLO_VALORES) {
    // Hoja Resumen (sheet2.xml)
    const p2 = 'xl/worksheets/sheet2.xml', h2 = hojaXML(await zip.file(p2).async('string'));
    const cv = gs.filter(g => g.valor !== '' && g.valor != null), tot = sum(cv, g => g.valor);
    const CONC = ['Transporte', 'Alimentación', 'Alojamiento', 'Otros gastos'];
    const porC = CONC.map(c => sum(cv.filter(g => g.concepto === c), g => g.valor)), totC = sum(porC);
    porC.forEach((t, i) => { h2.set('C' + (5 + i), t); h2.set('D' + (5 + i), totC ? t / totC : 0); });
    h2.set('C9', totC); h2.set('D9', totC ? 1 : 0);
    h2.set('C10', I.gastado); h2.set('D10', totC ? I.gastado / totC : 0);
    h2.set('C11', I.sistronic); h2.set('D11', totC ? I.sistronic / totC : 0);
    h2.set('C12', I.anticipo); h2.set('C13', I.anticipo - I.gastado); h2.set('C14', I.anticipo ? I.gastado / I.anticipo : 0); h2.set('C15', I.pendiente);
    // Concepto / subconcepto
    const ordC = c => { const i = CONC.indexOf(c); return i < 0 ? 99 : i; }, msub = new Map();
    cv.filter(g => g.concepto).forEach(g => { const k = g.concepto + '\u0000' + (g.sub || ''); const o = msub.get(k) || { c: g.concepto, s: g.sub || '', n: 0, t: 0 }; o.n++; o.t += Number(g.valor) || 0; msub.set(k, o); });
    const subs = [...msub.values()].sort((a, b) => ordC(a.c) - ordC(b.c) || b.t - a.t);
    if (!subs.length) h2.set('F6', 'Sin registros');
    subs.forEach((o, i) => { const r = 6 + i; h2.set('F' + r, o.c); h2.set('G' + r, o.s); h2.set('H' + r, o.n); h2.set('I' + r, o.t); });
    h2.set('H5', sum(subs, o => o.n)); h2.set('I5', sum(subs, o => o.t));
    // Por día
    const ini = parseISO(v.inicio), fin = parseISO(v.fin); let totD = 0, nD = 0, mayor = null;
    for (let i = 0; i < 31; i++) {
      const r = 5 + i, d = ini ? new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i) : null;
      if (!d || (i > 0 && (!fin || d > fin))) { ['K', 'L', 'M', 'N'].forEach(c => h2.set(c + r, '')); continue; }
      const iso = toISO(d), del = cv.filter(g => g.fecha === iso), t = sum(del, g => g.valor);
      h2.set('K' + r, serial(iso)); h2.set('L' + r, t); h2.set('M' + r, del.length); totD += t; nD += del.length;
      if (t > (mayor ? mayor.t : 0)) mayor = { iso, t };
    }
    for (let i = 0; i < 31; i++) { const r = 5 + i, c = ini ? new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i) : null; if (c && (i === 0 || (fin && c <= fin))) { const t = sum(cv.filter(g => g.fecha === toISO(c)), g => g.valor); h2.set('N' + r, totD ? t / totD : ''); } }
    h2.set('L36', totD); h2.set('M36', nD); h2.set('L37', tot - totD); h2.set('L38', mayor ? serial(mayor.iso) : ''); h2.set('M38', mayor ? mayor.t : 0);
    // Por proveedor
    const mp = new Map(); cv.filter(g => g.proveedor).forEach(g => { const o = mp.get(g.proveedor) || { p: g.proveedor, t: 0, n: 0 }; o.t += Number(g.valor) || 0; o.n++; mp.set(g.proveedor, o); });
    const provs = [...mp.values()].sort((a, b) => b.t - a.t);
    h2.set('Q5', tot); h2.set('R5', cv.length); h2.set('S5', tot ? 1 : '');
    if (!provs.length) h2.set('P6', 'Sin registros');
    provs.forEach((o, i) => { const r = 6 + i; h2.set('P' + r, o.p); h2.set('Q' + r, o.t); h2.set('R' + r, o.n); h2.set('S' + r, tot ? o.t / tot : ''); });
    h2.aplanar(); zip.file(p2, h2.xml());

    // Hoja Control Facturas (sheet3.xml)
    const p3 = 'xl/worksheets/sheet3.xml', h3 = hojaXML(await zip.file(p3).async('string'));
    const F = ESTADOS.map(e => { const x = cv.filter(g => estado(g) === e); return { t: sum(x, g => g.valor), n: x.length }; });
    F.forEach((o, i) => { h3.set('C' + (5 + i), o.t); h3.set('D' + (5 + i), o.n); });
    h3.set('C9', sum(F, o => o.t)); h3.set('D9', sum(F, o => o.n));
    h3.set('C10', F[0].t + F[1].t + F[2].t); h3.set('D10', F[0].n + F[1].n + F[2].n); h3.set('D11', F[1].n);
    if (!cv.length) h3.set('B15', 'Sin registros');
    cv.forEach((g, i) => {
      const r = 15 + i;
      h3.set('B' + r, serial(g.fecha)); h3.set('C' + r, g.concepto || ''); h3.set('D' + r, g.proveedor || '—'); h3.set('E' + r, Number(g.valor) || 0);
      h3.set('F' + r, g.factura || '—'); h3.set('G' + r, g.soporte || 'No'); h3.set('H' + r, estado(g)); h3.set('I' + r, g.pagadoPor || 'Empleado');
    });
    h3.aplanar(); zip.file(p3, h3.xml());
  }

  // Hoja Legalización FO-AD-03 (sheet4.xml)
  const p4 = 'xl/worksheets/sheet4.xml', h4 = hojaXML(await zip.file(p4).async('string'));
  const fl = parseISO(v.fechaLeg);
  h4.set('B10', v.lugar); h4.set('C10', fl ? fl.getDate() : ''); h4.set('D10', fl ? fl.getMonth() + 1 : ''); h4.set('E10', fl ? fl.getFullYear() % 100 : '');
  const L = legalizacion(v);
  for (let i = 0; i < MAX_LINEAS_FO; i++) {
    const l = L.lineas[i], r = 23 + i;
    h4.set('B' + r, l ? l.d : '', true); h4.set('F' + r, l ? l.f : '', true); h4.set('G' + r, l ? l.n : '', true); h4.set('I' + r, l ? l.t : '', true);
  }
  [['F10', v.trabajador], ['H10', v.cedula], ['B13', v.cliente], ['F13', v.cot], ['B15', v.servicio], ['F15', serial(v.inicio)], ['H15', serial(v.fin)], ['C16', v.os], ['F17', L.anticipo], ['H17', L.total], ['K42', L.aviso]].forEach(([r, x]) => h4.set(r, num(x), true));
  h4.set('G7', num(v.consecutivo)); h4.set('F18', v.efectivo === '' || v.efectivo == null ? '' : Number(v.efectivo));
  if (SOLO_VALORES) { L.lineas.forEach((l, i) => h4.set('K' + (22 + i), l.d)); if (!L.lineas.length) h4.set('K22', ''); h4.aplanar(); }
  zip.file(p4, h4.xml());

  // Hoja Listas (sheet5.xml): subconceptos A–D, filas 2 a 40
  const p5 = 'xl/worksheets/sheet5.xml', h5 = hojaXML(await zip.file(p5).async('string'));
  ['Transporte', 'Alimentación', 'Alojamiento', 'Otros gastos'].forEach((k, i) => {
    const col = 'ABCD'[i], arr = S.listas[k] || [];
    for (let r = 2; r <= 40; r++) h5.set(col + r, arr[r - 2] || '');
  });
  zip.file(p5, h5.xml());

  // Hoja adicional con las fotos de las facturas
  const nFotos = await agregarHojaSoportes(zip, gs, v);
  await agregarHojaDetalle(zip, gs);
  await agregarHojaTerceros(zip, gs);

  // Libro final (sin recálculo: solo valores)
  const pw = 'xl/workbook.xml';
  let wb = await zip.file(pw).async('string');
  const conResumen = cortesDe(v0).length && !v._corte;
  if (conResumen) await agregarHojaCortes(zip, v0);
  wb = wb.replace('</sheets>', `<sheet name="Soportes" sheetId="6" r:id="rIdSoportes"/><sheet name="Detalle de facturas" sheetId="8" r:id="rIdDetalle"/><sheet name="Terceros Siigo" sheetId="7" r:id="rIdTerceros"/>${conResumen ? '<sheet name="Resumen de cortes" sheetId="9" r:id="rIdCortes"/>' : ''}</sheets>`);
  wb = wb.replace(/<calcPr([^>]*?)\/>/, (m, a) => '<calcPr' + a.replace(/\s*fullCalcOnLoad="[^"]*"/, '') + (SOLO_VALORES ? '' : ' fullCalcOnLoad="1"') + '/>');
  zip.file(pw, wb);
  if (SOLO_VALORES) {
    // Sin fórmulas: quitar cadena de cálculo y fórmulas de columna de la tabla
    zip.remove('xl/calcChain.xml');
    zip.file('[Content_Types].xml', (await zip.file('[Content_Types].xml').async('string')).replace(/<Override[^>]*calcChain[^>]*\/>/, ''));
    zip.file('xl/_rels/workbook.xml.rels', (await zip.file('xl/_rels/workbook.xml.rels').async('string')).replace(/<Relationship[^>]*calcChain[^>]*\/>/, ''));
    const pt = 'xl/tables/table1.xml';
    if (zip.file(pt)) zip.file(pt, (await zip.file(pt).async('string')).replace(/<calculatedColumnFormula>[\s\S]*?<\/calculatedColumnFormula>/g, ''));
  }

  const pref = v._corte ? nombreCorte(v._corte) + ' - ' : v._final ? 'Pendiente por cortar - ' : '';
  const nombre = pref + nombreArchivoViaje(v) + '.xlsx';
  await protegerLibro(zip);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (soloGenerar) return { blob, nombre };
  await entregarArchivo(blob, nombre);
}

async function entregarArchivo(blob, nombre) {
  if (window.Android && Android.saveFile) {
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
    Android.saveFile(b64, nombre, blob.type || 'application/octet-stream'); return;
  }
  if (/\.xlsx$/i.test(nombre)) blob = new Blob([await zipCrcFix(new Uint8Array(await blob.arrayBuffer()))], { type: blob.type });
  // En Android intenta abrir el menú Compartir (WhatsApp, correo, Drive); si no, descarga.
  try {
    const file = new File([blob], nombre, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nombre }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast('Archivo descargado: ' + nombre);
}
function pedirArchivo(accept) {
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
}
const cellISO = c => {
  if (c == null || c === '') return '';
  if (c instanceof Date) return toISO(new Date(c.getFullYear(), c.getMonth(), c.getDate() + (c.getHours() >= 12 ? 1 : 0)));
  if (typeof c === 'number') { const d = new Date(Math.round((c - 25569) * 86400000)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  const m = String(c).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : '';
};
async function importarExcel() {
  const f = await pedirArchivo('.xlsx,.xlsm,.xls');
  if (!f) return;
  try {
    const X = await cargarXLSX();
    const wb = X.read(await f.arrayBuffer(), { cellDates: true });
    const ws = wb.Sheets['Control de Gastos'];
    if (!ws) { toast('El archivo no tiene la hoja "Control de Gastos"'); return; }
    const c = a => { const x = ws[a]; return x ? (x.v ?? '') : ''; };
    const v = nuevoViaje({
      trabajador: String(c('C2')), cedula: String(c('C3')), cliente: String(c('C4')), servicio: String(c('C5')),
      cot: String(c('C6')), os: String(c('C7')), ciudad: String(c('C8')),
      inicio: cellISO(c('I2')), fin: cellISO(c('I3')), anticipo: Number(c('I4')) || 0
    });
    const lg = wb.Sheets['Legalización FO-AD-03'];
    if (lg && lg.B10) v.lugar = String(lg.B10.v);
    for (let r = 14; r < 1000; r++) {
      const val = c('G' + r), fe = c('B' + r), co = c('C' + r);
      if (val === '' && fe === '' && co === '') { if (c('G' + (r + 1)) === '' && c('B' + (r + 1)) === '') break; else continue; }
      if (val === '') continue;
      v.gastos.push(nuevoGasto([cellISO(fe), String(co), String(c('D' + r)), String(c('E' + r)), String(c('F' + r)).replace(/\s*\n\s*/g, ' '), Number(val) || 0, String(c('H' + r) || 'Empleado'), String(c('I' + r)), String(c('J' + r) || 'No'), String(c('M' + r))]));
    }
    const ls = wb.Sheets['Listas'];
    if (ls) ['A', 'B', 'C', 'D'].forEach(col => {
      const k = ls[col + '1']?.v; if (!k) return;
      const arr = []; for (let r = 2; r <= 40; r++) { const x = ls[col + r]?.v; if (x) arr.push(String(x)); }
      if (arr.length) S.listas[k] = [...new Set([...(S.listas[k] || []), ...arr])];
    });
    S.viajes.push(v); S.activo = v.id; await guardar(); tab = 'gastos'; render();
    toast(`Importado: ${v.gastos.length} gastos de ${v.cliente || 'viaje'}`);
  } catch (e) { console.error(e); toast('No se pudo leer el archivo de Excel'); }
}
async function copiaSeguridad(soloGenerar) {
  const fotos = {};
  for (const v of S.viajes) for (const g of v.gastos) if (g.foto) { const s = await DB.get('foto:' + g.id); if (s) fotos[g.id] = s; }
  const blob = new Blob([JSON.stringify({ app: 'viaticos', version: 1, fecha: new Date().toISOString(), state: S, fotos })], { type: 'application/json' });
  if (soloGenerar) return { blob, nombre: `viaticos-copia-${todayISO()}.json` };
  await entregarArchivo(blob, `viaticos-copia-${todayISO()}.json`);
}
async function restaurar() {
  const f = await pedirArchivo('.json,application/json');
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== 'viaticos' || !d.state?.viajes) throw new Error('formato');
    const ids = new Set(S.viajes.map(v => v.id));
    let n = 0;
    for (const v of d.state.viajes) { if (ids.has(v.id)) S.viajes = S.viajes.filter(x => x.id !== v.id); S.viajes.push(v); n++; }
    for (const [id, src] of Object.entries(d.fotos || {})) await DB.set('foto:' + id, src);
    await guardar(); render(); toast(`Restaurados ${n} viajes`);
  } catch { toast('El archivo no es una copia de seguridad válida'); }
}

function imprimir() {
  const v = viaje(), t = `Legalizacion COT ${v.cot || ''} ${v.cliente || ''}`.trim();
  if (window.Android && Android.print) { if (tab !== 'legal') { tab = 'legal'; render(); } setTimeout(() => Android.print(t), 150); return; }
  if (inIframe) { toast('Para imprimir o guardar PDF use la app instalada'); return; }
  window.print();
}
window.onAndroidBack = () => {
  if ($('#sheet').innerHTML) { cerrarSheet(); return true; }
  if (tab !== 'gastos') { tab = 'gastos'; render(); window.scrollTo(0, 0); return true; }
  return false;
};


/* ---------- Google en la versión web (PWA): inicio de sesión, Drive y Gmail ----------
   Imita el puente nativo window.Android del APK, así el resto de la app funciona igual. */
const GOOGLE_CLIENT_ID = '447548203570-28a4hrclpsfo8h6ng0hq0ctlh9p1aij6.apps.googleusercontent.com'; // ID de cliente OAuth "Aplicación web" de Google Cloud
const G_SCOPES = 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/gmail.send';
const GW = {
  ls(k, v) { try { if (v === undefined) return localStorage.getItem('g:' + k) || ''; if (v === null) localStorage.removeItem('g:' + k); else localStorage.setItem('g:' + k, v); } catch { return ''; } },
  tok: '', exp: 0, pendiente: null,
  init() { try { const [t, e] = JSON.parse(localStorage.getItem('g:tok') || '[]'); if (t && e > Date.now()) { this.tok = t; this.exp = e; } } catch {} },
  cargarGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (this._gis) return this._gis;
    return this._gis = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = res; sc.onerror = () => { this._gis = null; rej(new Error('No se pudo conectar con Google. Revise su conexión a internet.')); }; document.head.appendChild(sc); });
  },
  valido() { return this.tok && Date.now() < this.exp - 120000; },
  /* Pide un token. Llamar dentro de un toque del usuario para que Google pueda abrir su ventana. */
  pedir(forzarCuenta) {
    if (this.valido()) return Promise.resolve(this.tok);
    if (this.pendiente) return this.pendiente;
    if (!GOOGLE_CLIENT_ID) return Promise.reject(Object.assign(new Error('Falta configurar el acceso de la app en Google Cloud (ID de cliente web).'), { config: true }));
    const go = () => new Promise((res, rej) => {
      const c = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: G_SCOPES, include_granted_scopes: true,
        callback: r => {
          if (r && r.access_token) { this.tok = r.access_token; this.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000; try { localStorage.setItem('g:tok', JSON.stringify([this.tok, this.exp])); } catch {} res(this.tok); setTimeout(() => window.programarSync && programarSync(800), 0); }
          else rej(new Error(r && r.error === 'access_denied' ? 'Inicio de sesión cancelado.' : 'Google no entregó el permiso (' + ((r && r.error) || 'sin respuesta') + ').'));
        },
        error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? 'Inicio de sesión cancelado.' : e && e.type === 'popup_failed_to_open' ? 'El navegador bloqueó la ventana de Google. Toque el botón otra vez.' : 'No se pudo abrir el inicio de sesión de Google.'))
      });
      const em = this.ls('email');
      c.requestAccessToken(forzarCuenta || !em ? { prompt: 'select_account' } : { prompt: '', login_hint: em });
    });
    const pr = (window.google && google.accounts && google.accounts.oauth2) ? go() : this.cargarGIS().then(go);
    this.pendiente = pr.finally(() => { this.pendiente = null; });
    return this.pendiente;
  },
  async api(method, url, body, ctype) {
    const t = await this.pedir();
    const r = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + t }, ctype ? { 'Content-Type': ctype } : {}), body });
    const txt = await r.text();
    if (!r.ok) {
      let msg = txt; try { msg = JSON.parse(txt).error.message || txt; } catch {}
      if (r.status === 401) { this.tok = ''; throw new Error('La sesión de Google venció. Toque el botón otra vez.'); }
      if (r.status === 403 && /gmail api/i.test(msg)) throw new Error('Falta activar la API de Gmail en Google Cloud para enviar avisos por correo.');
      if (r.status === 403 && /drive api/i.test(msg)) throw new Error('Falta activar la API de Google Drive en Google Cloud.');
      throw Object.assign(new Error((url.includes('gmail') ? 'Gmail' : 'Drive') + ' respondió ' + r.status + ': ' + msg), { status: r.status });
    }
    return txt ? JSON.parse(txt) : {};
  },
  async perfilLeer() {
    const u = await this.api('GET', 'https://www.googleapis.com/oauth2/v3/userinfo');
    this.ls('email', u.email || ''); this.ls('perfil', JSON.stringify({ email: u.email || '', name: u.name || '', given_name: u.given_name || '', picture: u.picture || '' }));
    return u;
  },
  TODAS: 'supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives',
  q: s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
  async verificar(id) {
    let f;
    try { f = await this.api('GET', `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType,trashed,capabilities(canAddChildren)`); }
    catch (e) { if (e.status === 404) throw new Error('No se encontró la carpeta de Drive. Revise que se la hayan compartido a esta cuenta de Google.'); throw e; }
    if (f.mimeType !== 'application/vnd.google-apps.folder') throw new Error('El enlace no es de una carpeta de Drive.');
    if (f.trashed) throw new Error('Esa carpeta de Drive está en la papelera.');
    if (f.capabilities && f.capabilities.canAddChildren === false) throw new Error(`La carpeta "${f.name}" está compartida solo para ver. Pida permiso de Editor a quien se la compartió.`);
    return f;
  },
  async carpeta(nombre, padre) {
    const key = 'folder:' + padre + ':' + nombre; let id = this.ls(key);
    if (id) { try { const f = await this.api('GET', `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,trashed`); if (!f.trashed) return id; } catch {} }
    const q = `name = '${this.q(nombre)}' and mimeType = 'application/vnd.google-apps.folder' and '${padre}' in parents and trashed = false`;
    const fs = (await this.api('GET', `https://www.googleapis.com/drive/v3/files?${this.TODAS}&fields=files(id)&q=${encodeURIComponent(q)}`)).files || [];
    id = fs.length ? fs[0].id : (await this.api('POST', 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }), 'application/json; charset=UTF-8')).id;
    this.ls(key, id); return id;
  },
  async subir(bytes, nombre, mime, carpeta, carpetaId, sub) {
    const raiz = carpetaId ? (await this.verificar(carpetaId)).id : await this.carpeta(carpeta || 'Viáticos', 'root');
    let destino = raiz; for (const parte of String(sub || '').split('/').map(x => x.trim()).filter(Boolean)) destino = await this.carpeta(parte, destino);
    const q = `name = '${this.q(nombre)}' and '${destino}' in parents and trashed = false`;
    const f = (await this.api('GET', `https://www.googleapis.com/drive/v3/files?${this.TODAS}&fields=files(id)&q=${encodeURIComponent(q)}`)).files || [];
    let res;
    const xlsx = /\.(xlsx|pdf)$/i.test(nombre), restr = ro => this.api('PATCH', `https://www.googleapis.com/drive/v3/files/${f.length ? f[0].id : res.id}?supportsAllDrives=true&fields=id`, JSON.stringify({ contentRestrictions: [ro ? { readOnly: true, reason: 'Legalización enviada desde la app Viáticos Sistronic. No modificar.' } : { readOnly: false }] }), 'application/json; charset=UTF-8').catch(() => {});
    if (f.length && xlsx) await restr(false);
    if (f.length) res = await this.api('PATCH', `https://www.googleapis.com/upload/drive/v3/files/${f[0].id}?uploadType=media&supportsAllDrives=true&fields=id,webViewLink`, new Blob([bytes], { type: mime }), mime);
    else {
      const b = 'viaticos' + Date.now();
      const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [destino] })}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, bytes, `\r\n--${b}--`]);
      res = await this.api('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', body, 'multipart/related; boundary=' + b);
    }
    if (xlsx && res && res.id) await restr(true);
    return { link: res.webViewLink || '', ruta: (carpeta || 'Viáticos') + (sub ? ' / ' + String(sub).split('/').join(' / ') : ''), carpetaLink: 'https://drive.google.com/drive/folders/' + destino };
  }
};
const b64Bytes = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const utf8B64 = t => { const u = new TextEncoder().encode(t); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
/* Recalcula los CRC-32 de un .xlsx generado en el navegador (igual que el APK) para que Excel nunca lo vea dañado. */
async function zipCrcFix(bytes) {
  try {
    if (typeof DecompressionStream === 'undefined') return bytes;
    const z = bytes, out = z.slice(), dv = new DataView(z.buffer, z.byteOffset, z.byteLength), wv = new DataView(out.buffer);
    let eocd = -1; for (let i = z.length - 22; i >= Math.max(0, z.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return bytes;
    const T = zipCrcFix.T || (zipCrcFix.T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
    const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    let cd = dv.getUint32(eocd + 16, true); const count = dv.getUint16(eocd + 10, true);
    for (let e = 0; e < count; e++) {
      if (dv.getUint32(cd, true) !== 0x02014b50) return bytes;
      const method = dv.getUint16(cd + 10, true), csize = dv.getUint32(cd + 20, true), nlen = dv.getUint16(cd + 28, true), xlen = dv.getUint16(cd + 30, true), clen = dv.getUint16(cd + 32, true), loc = dv.getUint32(cd + 42, true);
      const flags = dv.getUint16(loc + 6, true), data = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
      const comp = z.subarray(data, data + csize);
      let raw;
      if (method === 0) raw = comp;
      else if (method === 8) raw = new Uint8Array(await new Response(new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else return bytes;
      const c = crc(raw);
      wv.setUint32(cd + 16, c, true); wv.setUint32(loc + 14, c, true);
      if (flags & 8) { let dd = data + csize; if (dv.getUint32(dd, true) === 0x08074b50) dd += 4; wv.setUint32(dd, c, true); }
      cd += 46 + nlen + xlen + clen;
    }
    return out;
  } catch { return bytes; }
}
function instalarGoogleWeb() {
  if (window.Android || inIframe) return;
  const err = e => (e && e.message) || 'Error desconocido.';
  window.Android = {
    web: true,
    getEmail: () => GW.ls('email'),
    getProfile: () => GW.ls('perfil') || JSON.stringify({ email: GW.ls('email') }),
    calentar() { if (GW.ls('email') && GOOGLE_CLIENT_ID && !GW.valido()) GW.pedir().catch(() => {}); },
    login() {
      GW.pedir(true).then(() => GW.perfilLeer()).then(async u => {
        if (!(await correoPermitido(u.email))) { const e = u.email; Android.logoutSilencioso(); throw new Error(`La cuenta ${e} no tiene acceso. ${textoAcceso()}`); }
        return u;
      }).then(u => window.onLoginOk && onLoginOk(u.email || ''))
        .catch(e => window.onLoginError && onLoginError(err(e), e && e.config ? 'config' : ''));
    },
    refreshProfile() { if (GW.valido()) GW.perfilLeer().then(() => window.onProfile && onProfile()).catch(() => {}); },
    logoutSilencioso() {
      const t = GW.tok; GW.tok = ''; GW.exp = 0;
      try { Object.keys(localStorage).filter(k => k.startsWith('g:')).forEach(k => localStorage.removeItem(k)); } catch {}
      try { if (t && window.google) google.accounts.oauth2.revoke(t, () => {}); } catch {}
    },
    logout() {
      const t = GW.tok; GW.tok = ''; GW.exp = 0; try { localStorage.removeItem('g:tok'); } catch {}
      try { Object.keys(localStorage).filter(k => k.startsWith('g:')).forEach(k => localStorage.removeItem(k)); } catch {}
      try { if (t && window.google) google.accounts.oauth2.revoke(t, () => {}); } catch {}
      setTimeout(() => window.onLogout && onLogout(), 0);
    },
    openUrl: u => { window.open(u, '_blank', 'noopener'); },
    listFolders(id) {
      id = id || '';
      (async () => {
        if (id) { const f = await GW.verificar(id); return [{ id: f.id, name: f.name, owner: '', canAdd: true }]; }
        const q = "mimeType = 'application/vnd.google-apps.folder' and sharedWithMe and trashed = false";
        const fs = (await GW.api('GET', `https://www.googleapis.com/drive/v3/files?pageSize=200&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,owners(displayName),capabilities(canAddChildren))&q=${encodeURIComponent(q)}`)).files || [];
        return fs.map(f => ({ id: f.id, name: f.name, owner: f.owners && f.owners[0] ? f.owners[0].displayName : '', canAdd: !(f.capabilities && f.capabilities.canAddChildren === false) }));
      })().then(l => window.onFolders && onFolders(JSON.stringify(l), id)).catch(e => window.onFoldersError && onFoldersError(err(e), id));
    },
    uploadDrive(b64, n, m, c, s) { this.uploadDrive2(b64, n, m, c, '', s); },
    uploadDrive2(b64, nombre, mime, carpeta, carpetaId, sub) {
      (async () => {
        let bytes = b64Bytes(b64);
        if (/\.xlsx$/i.test(nombre)) bytes = await zipCrcFix(bytes);
        return GW.subir(bytes, nombre, mime, carpeta, carpetaId, sub);
      })().then(r => window.onDriveOk && onDriveOk(r.link, r.ruta, nombre, r.carpetaLink)).catch(e => window.onDriveError && onDriveError(err(e)));
    },
    sendMail(para, asunto, html) {
      const l = String(para).split(/[,;\s]+/).filter(x => x.includes('@'));
      if (!l.length) { setTimeout(() => window.onMailError && onMailError('No hay correos válidos para avisar.'), 0); return; }
      const mime = `To: ${l.join(', ')}\r\nSubject: =?UTF-8?B?${utf8B64(asunto)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${utf8B64(html).replace(/.{76}/g, '$&\r\n')}`;
      const raw = utf8B64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      GW.api('POST', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', JSON.stringify({ raw }), 'application/json; charset=UTF-8')
        .then(() => window.onMailOk && onMailOk(String(l.length))).catch(e => window.onMailError && onMailError(err(e)));
    }
  };
}
GW.init(); instalarGoogleWeb();

/* ---------- Sincronización en la nube: cada usuario guarda sus datos en la carpeta privada de la app en SU Google Drive (appDataFolder) ----------
   Cada viaje, gasto, proveedor y la configuración son registros con fecha de cambio; al sincronizar gana el cambio más reciente.
   Las fotos van como archivos aparte. Sin internet todo sigue funcionando y se sincroniza al volver. */
const SYNC_ARCHIVO = 'viaticos-datos.json';
let SM = null, syncEstado = { estado: 'off', msg: '', fecha: 0 }, syncCorriendo = false, syncOtraVez = false, syncTimer = null;
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '.' + s.length; };
async function metaSync() {
  if (SM) return SM;
  SM = (await DB.get('sync')) || null;
  if (!SM) { SM = { recs: {}, del: {}, fv: {}, primera: true, cuenta: '', ultima: 0, nuevo: true }; }
  return SM;
}
function registros() {
  const R = {};
  for (const v of S.viajes) {
    const { gastos, ...t } = v; R['v:' + v.id] = t;
    (gastos || []).forEach((g, i) => {
      if (g.foto && !g.fotoV) g.fotoV = 1;
      const d = {}; for (const k of Object.keys(g)) if (k[0] !== '_') d[k] = g[k];
      d._viaje = v.id; d._orden = i; R['g:' + g.id] = d;
    });
  }
  for (const [k, p] of Object.entries(S.proveedores || {})) R['p:' + k] = p;
  R.cfg = { listas: S.listas || null, empresa: S.empresa || null, conceptosCfg: S.conceptosCfg || null, conceptosOff: S.conceptosOff || null };
  for (const [k, x] of Object.entries(S.perfil || {})) R.cfg['perfil.' + k] = x;
  for (const [k, x] of Object.entries(S.drive || {})) R.cfg['drive.' + k] = x;
  R.ia = { key: IA.key || '', modelo: IA.modelo || '', auto: IA.auto !== false };
  return R;
}
/* Marca la fecha de cambio de cada registro modificado desde el último guardado */
const camposHash = d => { const o = {}; if (d && typeof d === 'object') for (const [c, x] of Object.entries(d)) if (x !== undefined) o[c] = hashStr(JSON.stringify(x)); return o; };
async function sellar() {
  const M = await metaSync(), R = registros(), now = Date.now();
  // Primera vez en este dispositivo: lo que ya existe queda con fecha antigua, así lo de la nube gana si es el mismo registro
  const base = M.primera ? 1 : now;
  let cambio = false;
  for (const [k, d] of Object.entries(R)) {
    const h = hashStr(JSON.stringify(d)), m = M.recs[k];
    if (!m || m.h !== h) {
      const mod0 = m ? now : k === 'ia' ? (d.key ? now : 1) : base, nf = camposHash(d), f = {};
      for (const [c, hh] of Object.entries(nf)) f[c] = m && m.f && m.f[c] && m.f[c][0] === hh ? m.f[c] : [hh, m && !m.f ? now : mod0];
      if (m && m.f) for (const c of Object.keys(m.f)) if (!(c in nf)) f[c] = m.f[c][0] === '∅' ? m.f[c] : ['∅', now];
      M.recs[k] = { h, mod: mod0, f }; cambio = true;
    }
    if (M.del[k]) delete M.del[k];
  }
  for (const k of Object.keys(M.recs)) if (!R[k]) { M.del[k] = now; delete M.recs[k]; cambio = true; }
  if (M.nuevo) { M.nuevo = false; cambio = true; }
  if (cambio) { M.pendiente = true; await DB.set('sync', M); }
  sellar.cambio = cambio;
  return R;
}
const syncActivo = () => !!(window.Android && Android.web && GW.ls('email'));
function programarSync(ms = 2500) {
  if (!syncActivo()) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => sincronizar(false), ms);
}
/* Archivos en la carpeta privada de la app */
async function syncListar() {
  const out = []; let pt = '';
  do {
    const r = await GW.api('GET', `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,appProperties)${pt ? '&pageToken=' + encodeURIComponent(pt) : ''}`);
    out.push(...(r.files || [])); pt = r.nextPageToken || '';
  } while (pt);
  return out;
}
async function syncDescargar(id) {
  const t = await GW.pedir();
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw Object.assign(new Error('Drive respondió ' + r.status + ' al leer los datos'), { status: r.status });
  return r.text();
}
async function syncEscribir(id, nombre, texto, mime, props) {
  if (id) return GW.api('PATCH', `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart&fields=id`, ...multipart({ appProperties: props || {} }, texto, mime));
  return GW.api('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', ...multipart({ name: nombre, parents: ['appDataFolder'], appProperties: props || {} }, texto, mime));
}
function multipart(meta, texto, mime) {
  const b = 'vsync' + Date.now();
  return [new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, texto, `\r\n--${b}--`]), 'multipart/related; boundary=' + b];
}
/* Un viaje de ejemplo o en blanco que nunca se usó: no se sube si la nube ya tiene viajes */
function viajeDeRelleno(v) {
  if (!v.gastos.length) return !v.cliente && !v.servicio && !v.cot && !(Number(v.anticipo) > 0);
  return false;
}
function aplicarRegistros(F) {
  const orden = S.viajes.map(v => v.id), vs = {}, gs = {};
  for (const [k, x] of Object.entries(F.recs)) {
    if (k.startsWith('v:')) vs[k.slice(2)] = { ...x.d, gastos: [] };
    else if (k.startsWith('g:')) gs[k.slice(2)] = x.d;
  }
  for (const d of Object.values(gs)) { const v = vs[d._viaje]; if (!v) continue; const g = { ...d }; delete g._viaje; delete g._orden; g.__o = d._orden; v.gastos.push(g); }
  for (const v of Object.values(vs)) { v.gastos.sort((a, b) => (a.__o || 0) - (b.__o || 0)); v.gastos.forEach(g => delete g.__o); }
  const ids = Object.keys(vs).sort((a, b) => { const ia = orden.indexOf(a), ib = orden.indexOf(b); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib); });
  S.viajes = ids.map(id => vs[id]);
  const P = {}; for (const [k, x] of Object.entries(F.recs)) if (k.startsWith('p:')) P[k.slice(2)] = x.d;
  S.proveedores = P;
  const c = F.recs.cfg && F.recs.cfg.d;
  const ia = F.recs.ia && F.recs.ia.d;
  if (ia) { IA = Object.assign(IA, ia); DB.set('ia', IA); }
  if (c) {
    if (c.listas) S.listas = c.listas; if (c.empresa) S.empresa = c.empresa; if (c.conceptosCfg) S.conceptosCfg = c.conceptosCfg; if (c.conceptosOff) S.conceptosOff = c.conceptosOff;
    const sub = pre => { const o = {}; let hay = false; for (const [k, x] of Object.entries(c)) if (k.startsWith(pre)) { o[k.slice(pre.length)] = x; hay = true; } return hay ? o : null; };
    const p = sub('perfil.') || c.perfil, d = sub('drive.') || c.drive;
    if (p) S.perfil = p; if (d) S.drive = d;
  }
  if (!S.viajes.length) S.viajes.push(nuevoViaje());
  if (!S.viajes.some(v => v.id === S.activo)) S.activo = S.viajes[0].id;
}
const escribiendo = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#main')); };
const hojaAbierta = () => !!($('#sheet') && $('#sheet').innerHTML.trim()) || !!corteForm;
/* Quita el viaje de ejemplo de versiones anteriores (datos de otra persona) de las cuentas que no son la del dueño de esos datos */
async function limpiarEjemplo() {
  const email = String((window.Android && Android.web && GW.ls('email')) || '').toLowerCase();
  if (!email || EXCEPCIONES_SHA.includes(await sha256Hex(email))) return false;
  // Se hace una sola vez por equipo y cuenta, y solo sobre el viaje de ejemplo original (el que aún tiene sus gastos de ejemplo). Nunca toca lo que el usuario escribe después.
  const hecho = 'limpio:' + email;
  try { if (localStorage.getItem(hecho)) return false; } catch {}
  const E = EJEMPLO_HUELLAS, gset = new Set(E.gastos);
  let cambio = false;
  for (const v of [...S.viajes]) {
    const quedan = []; let deEjemplo = 0;
    for (const g of v.gastos) { if (!g.foto && gset.has(await sha256Hex(`${g.fecha}|${g.valor}|${g.factura || ''}`))) { deEjemplo++; continue; } quedan.push(g); }
    if (deEjemplo < 5) continue; // no es el viaje de ejemplo
    v.gastos = quedan; cambio = true;
    if (v.cedula && await sha256Hex(String(v.cedula).replace(/\D/g, '')) === E.ced) v.cedula = '';
    if (v.trabajador && await sha256Hex(String(v.trabajador).trim().toLowerCase().replace(/\s+/g, ' ')) === E.nom) v.trabajador = '';
    if (!v.gastos.length && !(v.cortes && v.cortes.length) && !v.revision) S.viajes = S.viajes.filter(x => x !== v);
  }
  if (cambio) {
    const p = S.perfil || {};
    if (p.cedula && await sha256Hex(String(p.cedula).replace(/\D/g, '')) === E.ced) p.cedula = '';
    if (p.trabajador && await sha256Hex(String(p.trabajador).trim().toLowerCase().replace(/\s+/g, ' ')) === E.nom) p.trabajador = '';
    const usados = new Set(); for (const v of S.viajes) for (const g of v.gastos) { usados.add(claveProv(g.nit, g.proveedor)); usados.add(claveProv('', g.proveedor)); }
    for (const k of Object.keys(S.proveedores || {})) if (E.prov.includes(await sha256Hex(k)) && !usados.has(k)) delete S.proveedores[k];
    if (!S.viajes.length) S.viajes.push(nuevoViaje());
    if (!S.viajes.some(v => v.id === S.activo)) S.activo = S.viajes[0].id;
    await guardar();
  }
  if (cambio || (SM && SM.ultima)) { try { localStorage.setItem(hecho, '1'); } catch {} }
  return cambio;
}
async function sincronizar(manual) {
  if (!syncActivo()) return;
  if (!GW.valido()) {
    if (manual) { try { await GW.pedir(); } catch (e) { syncEstado = { estado: 'error', msg: e.message, fecha: Date.now() }; render(); return; } }
    else { const M = await metaSync(); syncEstado = { ...syncEstado, estado: M.pendiente ? 'auth' : 'espera' }; pintarSyncChip(); return; }
  }
  if (!navigator.onLine) { syncEstado = { ...syncEstado, estado: 'offline' }; pintarSyncChip(); return; }
  if (syncCorriendo) { syncOtraVez = true; return; }
  if (hojaAbierta()) { programarSync(8000); return; }
  syncCorriendo = true; syncEstado = { ...syncEstado, estado: 'sync' }; pintarSyncChip();
  try {
    await guardarYa();
    let M = await metaSync();
    const email = GW.ls('email');
    // Otra cuenta en este dispositivo: se guarda una copia local de los datos anteriores y se empieza con los de la nueva cuenta
    if (M.cuenta && email && M.cuenta !== email) {
      await DB.set('respaldo:' + M.cuenta, JSON.parse(JSON.stringify(S)));
      const v = nuevoViaje(); S = { viajes: [v], activo: v.id, listas: JSON.parse(JSON.stringify(LISTAS_DEF)), perfil: {} };
      await DB.set('state', S);
      SM = { recs: {}, del: {}, fv: {}, primera: true, cuenta: email, ultima: 0, nuevo: true }; M = SM;
    }
    if (await limpiarEjemplo()) render();
    let R = await sellar();
    const files = await syncListar(), fDatos = files.find(f => f.name === SYNC_ARCHIVO);
    let remoto = { recs: {}, del: {} };
    if (fDatos) { try { remoto = JSON.parse(await syncDescargar(fDatos.id)); remoto.recs = remoto.recs || {}; remoto.del = remoto.del || {}; } catch (e) { if (e.status) throw e; throw new Error('Los datos en la nube están dañados'); } }
    const hayRemoto = Object.keys(remoto.recs).some(k => k.startsWith('v:'));
    // Primera sincronización con viajes en la nube: el viaje de ejemplo o en blanco de este dispositivo no se sube
    if (M.primera && hayRemoto) {
      for (const v of S.viajes.filter(viajeDeRelleno)) { delete M.recs['v:' + v.id]; v.gastos.forEach(g => delete M.recs['g:' + g.id]); S.viajes = S.viajes.filter(x => x !== v); }
      if (!S.viajes.length) { const k = Object.keys(remoto.recs).find(x => x.startsWith('v:')); S.activo = k ? k.slice(2) : S.activo; }
      // Proveedores que solo existen en este dispositivo nuevo (del viaje de ejemplo): se toman los de la nube
      for (const k of Object.keys(S.proveedores || {})) if (!remoto.recs['p:' + k]) { delete S.proveedores[k]; delete M.recs['p:' + k]; }
      R = registros();
    }
    // Huellas de lo que se va a sincronizar: lo que el usuario escriba mientras tanto queda pendiente para la próxima vez
    const H0 = {}, FH0 = {}; for (const [k, d] of Object.entries(R)) { H0[k] = hashStr(JSON.stringify(d)); FH0[k] = camposHash(d); }
    // Fusión campo por campo: en cada dato gana el cambio más reciente (así un equipo no pisa lo que otro escribió en otro campo)
    const F = { recs: {}, del: {} }; let subir = false, bajar = false;
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const claves = new Set([...Object.keys(R), ...Object.keys(M.del), ...Object.keys(remoto.recs), ...Object.keys(remoto.del)]);
    for (const k of claves) {
      const mr = M.recs[k];
      const loc = R[k] && mr ? { mod: mr.mod, d: R[k], f: Object.fromEntries(Object.entries(mr.f || {}).map(([c, x]) => [c, x[1]])) } : M.del[k] ? { mod: M.del[k], x: 1 } : null;
      const rem = remoto.recs[k] ? remoto.recs[k] : remoto.del[k] ? { mod: remoto.del[k], x: 1 } : null;
      let win;
      if (loc && rem && !loc.x && !rem.x && loc.d && rem.d && typeof loc.d === 'object' && typeof rem.d === 'object') {
        const d = {}, f = {}, lf = c => (loc.f[c] != null ? loc.f[c] : loc.mod), rf = c => (rem.f && rem.f[c] != null ? rem.f[c] : rem.mod);
        const cs = new Set([...Object.keys(loc.d), ...Object.keys(loc.f), ...Object.keys(rem.d), ...Object.keys(rem.f || {})]);
        for (const c of cs) {
          const lHas = c in loc.d || c in loc.f, rHas = c in rem.d || (rem.f && c in rem.f);
          const lm = lHas ? lf(c) : -1, rm = rHas ? rf(c) : -1;
          const useR = rm > lm || (rm === lm && M.primera);
          const val = useR ? rem.d[c] : loc.d[c];
          if (val !== undefined) d[c] = val;
          f[c] = useR ? rm : lm;
          if (!igual(val, loc.d[c])) bajar = true;
          if (!igual(val, rem.d[c])) subir = true;
        }
        win = { mod: Math.max(loc.mod, rem.mod), d, f };
        if (win.mod !== rem.mod) subir = true;
      } else {
        win = !rem ? loc : !loc ? rem : rem.mod > loc.mod || (rem.mod === loc.mod && M.primera) ? rem : loc;
        if (!win) continue;
        if (win === loc && (!rem || rem.mod !== loc.mod || !!rem.x !== !!loc.x)) subir = true;
        if (win === rem && (!loc || loc.mod !== rem.mod || !!rem.x !== !!loc.x)) bajar = true;
      }
      if (win.x) F.del[k] = win.mod; else F.recs[k] = { mod: win.mod, d: win.d, f: win.f || {} };
    }
    // Borrados de más de 120 días ya no hacen falta
    const lim = Date.now() - 120 * 864e5; for (const k of Object.keys(F.del)) if (F.del[k] < lim) delete F.del[k];
    if (bajar) {
      if (hojaAbierta() || escribiendo()) { syncOtraVez = true; throw Object.assign(new Error('espera'), { espera: true }); }
      aplicarRegistros(F); for (const [k, d] of Object.entries(registros())) { H0[k] = hashStr(JSON.stringify(d)); FH0[k] = camposHash(d); } await DB.set('state', S);
      if (await limpiarEjemplo()) { syncOtraVez = true; }
    }
    // Fotos de las facturas
    const fotosR = {}; for (const f of files) { const m = /^foto-(.+)\.txt$/.exec(f.name); if (m) fotosR[m[1]] = { id: f.id, v: Number(f.appProperties && f.appProperties.v) || 0 }; }
    const vivos = new Set();
    for (const v of S.viajes) for (const g of v.gastos) {
      vivos.add(g.id);
      if (!g.foto) { if (M.fv[g.id] != null) { await DB.del('foto:' + g.id); delete M.fv[g.id]; } continue; }
      const fv = Number(g.fotoV) || 1;
      if (M.fv[g.id] == null && fv === 1 && await DB.get('foto:' + g.id)) M.fv[g.id] = 1;
      const r = fotosR[g.id];
      if (M.fv[g.id] === fv && (!r || r.v !== fv)) { const src = await DB.get('foto:' + g.id); if (src) await syncEscribir(r && r.id, 'foto-' + g.id + '.txt', src, 'text/plain', { v: String(fv) }); }
      else if (M.fv[g.id] !== fv && r && r.v === fv) { await DB.set('foto:' + g.id, await syncDescargar(r.id)); M.fv[g.id] = fv; }
    }
    for (const [gid, r] of Object.entries(fotosR)) if (!vivos.has(gid) && F.del['g:' + gid]) { try { await GW.api('DELETE', `https://www.googleapis.com/drive/v3/files/${r.id}`); } catch {} }
    if (subir || !fDatos) await syncEscribir(fDatos && fDatos.id, SYNC_ARCHIVO, JSON.stringify({ app: 'viaticos', version: 1, fecha: new Date().toISOString(), recs: F.recs, del: F.del }), 'application/json', {});
    // El estado local queda igual a lo fusionado
    M.recs = {};
    for (const [k, x] of Object.entries(F.recs)) {
      const fh = FH0[k] || camposHash(x.d), f = {};
      for (const c of new Set([...Object.keys(fh), ...Object.keys(x.f || {})])) f[c] = [fh[c] || '∅', x.f && x.f[c] != null ? x.f[c] : x.mod];
      M.recs[k] = { h: H0[k] || hashStr(JSON.stringify(x.d)), mod: x.mod, f };
    }
    M.del = F.del; M.primera = false; M.cuenta = email; M.ultima = Date.now(); M.pendiente = false;
    await DB.set('sync', M);
    await sellar(); if (sellar.cambio) syncOtraVez = true;
    syncEstado = { estado: 'ok', msg: '', fecha: Date.now() };
    if (bajar) { toast('Datos actualizados desde su cuenta de Google'); render(); } else pintarSyncChip();
  } catch (e) {
    if (e.espera) syncEstado = { ...syncEstado, estado: 'ok' };
    else if (e.status === 401 || e.status === 403 || /venció/.test(e.message)) { GW.tok = ''; GW.exp = 0; syncEstado = { estado: 'auth', msg: e.message, fecha: Date.now() }; }
    else syncEstado = { estado: navigator.onLine ? 'error' : 'offline', msg: e.message, fecha: Date.now() };
    pintarSyncChip(); if (manual) render();
  } finally {
    syncCorriendo = false;
    if (syncOtraVez) { syncOtraVez = false; programarSync(hojaAbierta() ? 8000 : 1500); }
  }
}
const SYNC_TXT = { ok: '☁ Sincronizado', sync: '☁ Sincronizando…', auth: '☁ Toque para sincronizar', espera: '☁ Toque para sincronizar', offline: '☁ Sin conexión: se sincroniza al volver', error: '☁ Error al sincronizar · reintentar', off: '' };
function syncChipHTML() {
  if (!syncActivo()) return '';
  const e = syncEstado.estado, t = SYNC_TXT[e] || '';
  if (!t || e === 'off') return '';
  return `<button class="sync-chip s-${e}" data-act="sync-ahora" ${e === 'sync' ? 'disabled' : ''}>${t}</button>`;
}
function pintarSyncChip() { const el = $('#sync-chip'); if (el) el.innerHTML = syncChipHTML(); const c = $('#sync-cfg'); if (c) c.innerHTML = vSyncCfg(); }
function vSyncCfg() {
  const e = syncEstado, M = SM || {};
  return `<b>Datos en su cuenta de Google</b><div class="hint" style="margin:4px 0 8px">Sus viajes, gastos y fotos se guardan en una carpeta privada de la app dentro de <b>su</b> Google Drive (no se ve en Mi unidad). Entre con el mismo Gmail en otro celular o computador y verá lo mismo.</div>
    <div>${SYNC_TXT[e.estado] || '☁ Sin sincronizar todavía'}${M.ultima ? ` · última vez ${fmtFH(new Date(M.ultima).toISOString())}` : ''}</div>${e.msg && e.estado !== 'ok' ? `<div class="hint">${esc(e.msg)}</div>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn" data-act="sync-ahora" ${e.estado === 'sync' ? 'disabled' : ''}>Sincronizar ahora</button></div>`;
}

/* ---------- Cuenta de Google y Google Drive (solo en la app Android) ---------- */
const enAndroidGoogle = () => !!(window.Android && Android.getEmail);
let driveSubiendo = false, driveUltimo = null, driveTipo = '', correoEstado = null, driveViaje = null;
const driveCfg = () => (S.drive = Object.assign({ carpeta: 'Viáticos Sistronic', porViaje: true, carpetaId: '', carpetaNombre: '', avisar: true, correos: '' }, S.drive || {}));
const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
let driveCtx = {};
async function subirDrive(tipo, corteId) {
  if (!enAndroidGoogle()) { toast('Subir a Drive solo funciona en la app instalada'); return; }
  if (driveSubiendo) return;
  const v0 = viaje(), corte = corteId ? cortesDe(v0).find(x => x.id === corteId) : null;
  driveSubiendo = true; driveTipo = tipo === 'corte' ? 'xlsx' : tipo; driveViaje = S.activo; driveCtx = { tipo, viajeId: S.activo, corteId: corte ? corte.id : '' }; correoEstado = null; driveUltimo = { estado: 'subiendo' }; render();
  try {
    const vx = corte ? vistaCorte(v0, corte) : vistaAbierta(v0);
    const { blob, nombre } = tipo === 'backup' ? await copiaSeguridad(true) : await exportarExcel(true, vx);
    const v = v0, c = driveCfg();
    const base = c.porViaje ? carpetaProyecto(v) : '';
    const sub = tipo === 'backup' ? 'Copias de seguridad' : cortesDe(v0).length ? carpetaProyecto(v0) : base;
    if (tipo !== 'backup') await subirFacturasPDF(vx, c.carpetaId ? c.carpetaNombre || 'Carpeta compartida' : c.carpeta || 'Viáticos Sistronic', c.carpetaId || '', sub, t => { driveUltimo = { estado: 'subiendo', txt: t }; render(); });
    driveUltimo = { estado: 'subiendo' }; render();
    const b64 = await blobB64(blob), mime = blob.type || 'application/octet-stream';
    if (c.carpetaId && Android.uploadDrive2) Android.uploadDrive2(b64, nombre, mime, c.carpetaNombre || 'Carpeta compartida', c.carpetaId, sub);
    else Android.uploadDrive(b64, nombre, mime, c.carpeta || 'Viáticos Sistronic', sub);
  } catch (e) { window.onDriveError(e.message || 'No se pudo preparar el archivo'); }
}
window.onDriveOk = (link, ruta, nombre, carpetaLink) => {
  driveSubiendo = false; driveUltimo = { estado: 'ok', link, ruta, nombre, carpetaLink, tipo: driveTipo }; toast(driveTipo === 'xlsx' ? 'Enviado a revisión' : 'Subido a Google Drive');
  const c = driveCfg();
  driveUltimo.ctx = { ...driveCtx };
  if (driveTipo === 'xlsx') {
    const vj = S.viajes.find(x => x.id === driveCtx.viajeId), k = vj && driveCtx.corteId ? cortesDe(vj).find(x => x.id === driveCtx.corteId) : null;
    if (k) { k.revision = { estado: 'enviado', nota: '', fecha: new Date().toISOString() }; guardar(); }
    else if (vj) { marcarRevision(vj, 'enviado'); guardar(); }
  }
  if (driveTipo === 'xlsx' && c.avisar && correosAviso().length) enviarAviso(); else render();
};
const correosAviso = () => (driveCfg().correos || '').split(/[\s,;]+/).map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
function enviarAviso() {
  const d = driveUltimo, ctx = (d && d.ctx) || {}, v0 = S.viajes.find(x => x.id === ctx.viajeId) || viaje(), k = ctx.corteId ? cortesDe(v0).find(x => x.id === ctx.corteId) : null;
  const fin = ctx.tipo === 'final', T = fin ? filasResumenCortes(v0).total : null;
  const v = fin ? v0 : k ? vistaCorte(v0, k) : vistaAbierta(v0), L = fin ? { total: T[6], anticipo: T[4] + T[5] } : legalizacion(v), para = correosAviso();
  const tipoLeg = fin ? `legalización final (${cortesDe(v0).length} cortes)` : k ? `legalización parcial (${nombreCorte(k)})` : v._final ? 'legalización final' : 'legalización de viáticos';
  if (!d || d.estado !== 'ok' || !para.length || !Android.sendMail) return;
  const quien = v.trabajador || Android.getEmail(), viajeTxt = `${v.cliente || 'Viaje'}${v.cot ? ' · COT ' + v.cot : ''}`;
  const asunto = `${tipoLeg.charAt(0).toUpperCase() + tipoLeg.slice(1)} lista para revisión: ${viajeTxt} (${quien})`;
  const fila = (k, x) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${esc(k)}</td><td style="padding:4px 0"><b>${esc(x)}</b></td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p><b>${esc(quien)}</b> subió la <b>${esc(tipoLeg)}</b> a la carpeta de Google Drive y está <b>lista para su revisión</b>.</p>
<table style="border-collapse:collapse;margin:10px 0">${fila('Cliente', v.cliente || '—')}${fila('COT', v.cot || '—')}${fila('Servicio', v.servicio || '—')}${fila('Fechas', `${fmtFecha(v.inicio)} a ${fmtFecha(v.fin)}`)}${fila(fin ? 'Total del proyecto' : 'Total legalizado', fmtCOP(L.total))}${fila('Anticipo', fmtCOP(L.anticipo))}${fila(fin ? 'Archivos' : 'Archivo', d.nombre)}${fila('Carpeta', d.ruta)}</table>
<p>${d.link ? `<a href="${esc(d.link)}" style="background:#082759;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none;display:inline-block">Abrir el archivo</a>` : ''}${d.carpetaLink ? ` &nbsp; <a href="${esc(d.carpetaLink)}">Abrir la carpeta</a>` : ''}</p>
<p style="color:#777;font-size:12px">Enviado desde la app de Control de Viáticos de Sistronic por ${esc(Android.getEmail())}.</p></div>`;
  correoEstado = { estado: 'enviando', n: para.length }; render();
  Android.sendMail(para.join(','), asunto, html);
}
window.onMailOk = n => { correoEstado = { estado: 'ok', n: Number(n) }; toast('Aviso enviado por correo'); render(); };
window.onMailError = msg => { correoEstado = { estado: 'error', msg }; toast(msg); render(); };
window.onDriveError = msg => { driveSubiendo = false; driveUltimo = { estado: 'error', msg }; toast(msg); render(); };
function vDriveEstado() {
  const d = driveUltimo; if (!d) return '';
  if (d.estado === 'subiendo') return `<div class="note ia-busy"><span class="spin"></span> <span class="txt">${d.txt ? esc(d.txt) : driveTipo === 'xlsx' ? 'Enviando a revisión (subiendo a Google Drive)…' : 'Subiendo a Google Drive…'}</span></div>`;
  if (d.estado === 'ok') {
    const m = correoEstado, para = correosAviso();
    const aviso = !m ? (d.tipo === 'xlsx' && para.length && Android.sendMail ? `<button class="btn" data-act="mail-enviar" style="margin-top:6px">Enviar aviso por correo</button>` : '')
      : m.estado === 'enviando' ? `<div class="ia-busy" style="margin-top:6px"><span class="spin"></span> <span class="txt">Enviando aviso a ${m.n} correo${m.n === 1 ? '' : 's'}…</span></div>`
      : m.estado === 'ok' ? `<div style="margin-top:6px">✉ Aviso enviado a ${m.n} correo${m.n === 1 ? '' : 's'}.</div>`
      : `<div style="margin-top:6px">⚠ No se envió el aviso: ${esc(m.msg)}</div><button class="btn" data-act="mail-enviar" style="margin-top:6px">Reintentar aviso</button>`;
    return `<div class="note ok">✔ ${esc(d.nombre)} quedó en Drive › ${esc(d.ruta)}${d.link ? ` <button class="btn" data-act="drive-abrir" style="margin-top:6px">Abrir en Drive</button>` : ''}${aviso}</div>`;
  }
  return `<div class="note">⚠ ${esc(d.msg)}</div>`;
}
/* Clave para entrar a Configuración (se guarda solo su huella SHA-256) */
const CLAVE_CFG = 'dbff5341acad5e2a58db4efd5e72e2d9a0a843a28e02b1183c68162d0a3a3de6';
let cfgAbierta = false;
let cpPendiente = false;
async function sha256(t) {
  if (window.crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  throw new Error('Este dispositivo no puede verificar la clave');
}
const APP_VERSION = '43 (26/11/2026)';
function abrirConfig() {
  if (cfgAbierta) { tab = 'config'; render(); window.scrollTo(0, 0); return; }
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><form class="sheet anim" id="cfg-form" autocomplete="off">
    <div class="sheet-head"><h3>Configuración</h3><button type="button" class="x" data-close="1" aria-label="Cerrar">×</button></div>
    <p class="hint" style="margin-top:0">Escriba la clave de administración para entrar.</p>
    <label class="field"><span>Clave</span><div class="row" style="flex-wrap:nowrap"><input id="cfg-clave" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" style="flex:1;min-width:0"><button class="btn" type="button" data-act="cfg-ver" style="flex:0 0 auto">Ver</button></div></label>
    <div id="cfg-err"></div>
    <div class="row"><button class="btn primary" type="submit">Entrar</button></div>
    <p class="hint" style="margin:8px 0 0;text-align:center">Versión de la app: ${APP_VERSION}</p>
  </form></div>`;
  setTimeout(() => { const i = $('#cfg-clave'); if (i) i.focus(); }, 250);
}
async function probarClaveCfg() {
  const i = $('#cfg-clave'); if (!i) return;
  let ok = false; try { ok = (await sha256(i.value)) === CLAVE_CFG; } catch (e) { $('#cfg-err').innerHTML = `<div class="note">⚠ ${esc(e.message)}</div>`; return; }
  if (!ok) { $('#cfg-err').innerHTML = '<div class="note">⚠ Clave incorrecta.</div>'; i.select(); return; }
  cfgAbierta = true; cerrarSheet(); tab = cpPendiente ? 'conceptos' : 'config'; cpPendiente = false; render(); window.scrollTo(0, 0);
}

/* Perfil de Google (nombre y foto) */
function perfil() {
  if (!enAndroidGoogle()) return null;
  let p = {}; try { p = Android.getProfile ? JSON.parse(Android.getProfile() || '{}') : {}; } catch {}
  p.email = p.email || Android.getEmail(); if (!p.email) return null;
  p.nombre = p.name || p.email.split('@')[0];
  // En las cuentas de Sistronic el nombre suele empezar por "Sistronic": se usa el nombre de la persona
  const partes = (p.name || '').split(/\s+/).filter(w => w && !/^sistronic$/i.test(w));
  p.corto = partes[0] || (p.given_name && !/^sistronic$/i.test(p.given_name) ? p.given_name : '') || p.email.split('@')[0];
  p.iniciales = (partes.length ? partes.slice(0, 2).map(x => x[0]) : [p.corto[0]]).join('').toUpperCase();
  return p;
}
function avatarHTML(p, cls = '') {
  const ini = `<span class="ini">${esc(p ? p.iniciales : '')}</span>`;
  if (!p) return `<span class="avatar ${cls} gear">${ICON.gear}</span>`;
  return `<span class="avatar ${cls}">${ini}${p.picture ? `<img src="${esc(p.picture)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}
function pintarAvatar() {
  const b = $('#avatar-btn'); if (!b) return;
  const p = perfil();
  b.innerHTML = avatarHTML(p) + `<span class="who"><b>${esc(p ? p.corto : 'Ajustes')}</b></span>`;
  b.title = p ? `${p.nombre} · ${p.email}` : 'Configuración';
}
window.onProfile = () => { pintarAvatar(); if (tab === 'config') render(); };

function vConfig() {
  const p = perfil(), c = driveCfg();
  let h = `<h2>Configuración</h2>`;
  if (enAndroidGoogle()) {
    h += `<div class="card perfil-card">
      ${avatarHTML(p, 'xl')}
      <div class="pc-txt"><b>${esc(p ? p.nombre : 'Sin sesión')}</b><span>${esc(p ? p.email : '')}</span></div>
      <button class="btn" data-act="logout" style="flex:0 0 auto">Cerrar sesión</button>
    </div>
    <div class="card" id="sync-cfg" style="margin-top:12px">${vSyncCfg()}</div>
    <h2>Conceptos de gasto</h2>
    <div class="card form"><div class="row"><button class="btn" data-act="cp-abrir">Administrar conceptos y subconceptos</button></div></div>
    <h2>Facturas repetidas</h2>
    <div class="card form"><div class="row"><button class="btn" data-act="dup-abrir">Buscar facturas repetidas en todos los viajes</button></div></div>
    <h2>Google Drive</h2>
    <div class="card form">
    ${c.carpetaId ? `<div class="field"><span>Carpeta de destino en Google Drive</span>
      <div class="note ok" style="margin:0">📁 <b>${esc(c.carpetaNombre || 'Carpeta compartida')}</b> (compartida)</div></div>
      <div class="row"><button class="btn" data-act="drive-elegir">Cambiar carpeta</button><button class="btn" data-act="drive-propia">Usar una carpeta de mi Drive</button></div>`
    : `<label class="field"><span>Carpeta en mi Google Drive</span><input id="dr-carpeta" value="${esc(c.carpeta)}"></label>
      <button class="btn block" data-act="drive-elegir">📁 Elegir una carpeta que me compartieron</button>`}
    <label class="row" style="align-items:center;gap:10px;flex-wrap:nowrap"><input id="dr-porviaje" type="checkbox" ${c.porViaje ? 'checked' : ''} style="width:22px;height:22px;flex:0 0 22px;min-width:0"> <span style="flex:1">Crear una carpeta por proyecto (ej. "COT 12-3 Cliente - Proyecto")</span></label>
    <div class="row"><button class="btn primary" data-act="drive-xlsx" ${driveSubiendo ? 'disabled' : ''}>Subir Excel a Drive</button><button class="btn" data-act="drive-backup" ${driveSubiendo ? 'disabled' : ''}>Copia de seguridad a Drive</button></div>
    ${vDriveEstado()}
    <p class="hint" style="margin:0">Si el archivo ya existe en esa carpeta, se reemplaza por la versión nueva. Para subir a una carpeta compartida, la persona que la compartió debe darle permiso de Editor.</p>
    </div>
    <h2>Aviso por correo (Gmail)</h2>
    <div class="card form">
    <label class="field"><span>Avisar a (separe los correos con comas)</span><textarea id="dr-correos" rows="2" placeholder="revisor@sistronic.com.co, contabilidad@sistronic.com.co" inputmode="email" autocapitalize="off">${esc(c.correos)}</textarea></label>
    <label class="row" style="align-items:center;gap:10px;flex-wrap:nowrap"><input id="dr-avisar" type="checkbox" ${c.avisar ? 'checked' : ''} style="width:22px;height:22px;flex:0 0 22px;min-width:0"> <span style="flex:1">Enviar el aviso automáticamente al subir la legalización a Drive</span></label>
    <p class="hint" style="margin:0">El aviso sale desde su Gmail${p ? ' (' + esc(p.email) + ')' : ''} con el enlace al archivo y a la carpeta.</p>
    </div>`;
  }
  h += `<h2>Empresa</h2>
  <div class="card form">
    <label class="field"><span>NIT de Sistronic (sin dígito de verificación)</span><input id="emp-nit" inputmode="numeric" value="${esc((S.empresa || {}).nit || '')}" placeholder="Ej. 900123456"></label>
    <p class="hint" style="margin:0">Con este NIT la app le avisa cuando una factura no está a nombre de Sistronic (por ejemplo, "Consumidor final").</p>
  </div>`;
  h += vIA();
  h += `<p class="hint" style="text-align:center">Versión de la app: ${APP_VERSION}</p>`;
  return h;
}
/* Elegir carpeta compartida de Drive */
let carpetasDrive = null;
const idDeEnlace = t => { t = (t || '').trim(); const m = t.match(/folders\/([\w-]{10,})/) || t.match(/[?&]id=([\w-]{10,})/) || t.match(/^([\w-]{20,})$/); return m ? m[1] : ''; };
function pintarCarpetas() {
  const d = carpetasDrive || { cargando: true };
  const lista = d.cargando ? '<div class="note ia-busy"><span class="spin"></span> <span class="txt">Buscando carpetas compartidas con usted…</span></div>'
    : d.error ? `<div class="note">⚠ ${esc(d.error)}</div>`
    : !d.lista.length ? '<div class="note">No hay carpetas compartidas con esta cuenta. Pegue abajo el enlace de la carpeta.</div>'
    : `<div class="list">${d.lista.map(f => `<button class="item" data-act="drive-sel" data-id="${esc(f.id)}" data-name="${esc(f.name)}" ${f.canAdd ? '' : 'disabled style="opacity:.55"'}><span class="t">📁 ${esc(f.name)}</span><span class="a"></span><span class="s">${esc(f.owner ? 'De ' + f.owner : '')}${f.canAdd ? '' : ' · solo lectura'}</span></button>`).join('')}</div>`;
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><div class="sheet anim">
    <div class="sheet-head"><h3>Carpeta compartida</h3><button class="x" data-close="1" aria-label="Cerrar">×</button></div>
    <p class="hint" style="margin-top:0">Toque la carpeta donde quiere guardar los archivos.</p>
    ${lista}
    <label class="field" style="margin-top:14px"><span>O pegue el enlace de la carpeta</span><input id="dr-enlace" placeholder="https://drive.google.com/drive/folders/…" value="${esc(d.enlace || '')}"></label>
    ${d.errEnlace ? `<div class="note">⚠ ${esc(d.errEnlace)}</div>` : ''}
    <div class="row"><button class="btn primary" data-act="drive-enlace" ${d.probando ? 'disabled' : ''}>${d.probando ? '<span class="spin"></span> Comprobando…' : 'Usar este enlace'}</button></div>
  </div></div>`;
}
function abrirCarpetas() {
  if (!enAndroidGoogle() || !Android.listFolders) { toast('Actualice la app para elegir carpetas compartidas'); return; }
  carpetasDrive = { cargando: true }; pintarCarpetas(); Android.listFolders('');
}
function elegirCarpeta(id, nombre) {
  const c = driveCfg(); c.carpetaId = id; c.carpetaNombre = nombre; guardar();
  carpetasDrive = null; cerrarSheet(); driveUltimo = null; render(); toast('Los archivos se subirán a "' + nombre + '"');
}
window.onFolders = (json, id) => {
  if (!carpetasDrive || !$('#sheet').innerHTML) return;
  let l = []; try { l = JSON.parse(json); } catch {}
  if (id) { if (l[0]) elegirCarpeta(l[0].id, l[0].name); return; }
  carpetasDrive = Object.assign(carpetasDrive, { cargando: false, lista: l }); pintarCarpetas();
};
window.onFoldersError = (msg, id) => {
  if (!carpetasDrive || !$('#sheet').innerHTML) return;
  if (id) Object.assign(carpetasDrive, { probando: false, errEnlace: msg }); else Object.assign(carpetasDrive, { cargando: false, error: msg, lista: [] });
  pintarCarpetas();
};

/* Pantalla de inicio de sesión obligatoria */
/* ---------- Quién puede entrar ----------
   DOMINIOS_PERMITIDOS vacío = cualquier cuenta de Google. Con dominios, solo esos correos y las excepciones
   (las excepciones se guardan como huella SHA-256 del correo, para no publicar correos personales). */
const DOMINIOS_PERMITIDOS = ['sistronic.com.co'];
const EXCEPCIONES_SHA = ['5d771deaa52eeeec61b4deafafb5f5491ef6fc2ff4f995258a3ed333c62e86f5'];
const sha256Hex = async t => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, '0')).join('');
async function correoPermitido(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!DOMINIOS_PERMITIDOS.length) return true;
  if (!e) return false;
  if (DOMINIOS_PERMITIDOS.some(d => e.endsWith('@' + d))) return true;
  return EXCEPCIONES_SHA.includes(await sha256Hex(e));
}
const textoAcceso = () => DOMINIOS_PERMITIDOS.length ? `Esta app es solo para el personal de Sistronic: entre con su correo ${DOMINIOS_PERMITIDOS.map(d => '@' + d).join(' o ')}.` : '';
let loginEstado = { cargando: false, msg: '', config: false };
function pintarLogin() {
  let el = $('#login');
  if (!enAndroidGoogle() || Android.getEmail()) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'login'; el.className = 'login'; document.body.appendChild(el); }
  el.innerHTML = `<div class="login-in">
    <img src="${LOGO}" alt="Sistronic" class="login-logo">
    <h1>Viáticos Sistronic</h1>
    <p>${DOMINIOS_PERMITIDOS.length ? `Inicie sesión con su correo de Sistronic (${DOMINIOS_PERMITIDOS.map(d => '@' + d).join(', ')}).` : 'Inicie sesión con su cuenta de Google (Gmail) para usar la app y guardar sus archivos en Google Drive.'}</p>
    <button class="btn primary block login-btn" data-act="login" ${loginEstado.cargando ? 'disabled' : ''}>${loginEstado.cargando ? '<span class="spin"></span> Conectando…' : '<span class="g">G</span> Iniciar sesión con Google'}</button>
    ${loginEstado.msg ? `<div class="note">⚠ ${esc(loginEstado.msg)}</div>` : ''}
    ${loginEstado.config ? '<button class="btn block" data-act="login-saltar">Usar sin cuenta por ahora</button>' : ''}
    <p class="hint">Sus gastos se guardan en este equipo y en una carpeta privada de la app en su Google Drive, para verlos desde cualquier equipo con la misma cuenta.</p>
  </div>`;
}
window.onLoginOk = email => { programarSync(300); loginEstado = { cargando: false, msg: '', config: false }; const p = perfil(); toast('Bienvenido, ' + (p ? p.corto : email)); pintarLogin(); render(); };
window.onLoginError = (msg, config) => { loginEstado = { cargando: false, msg, config: config === 'config' }; pintarLogin(); };
window.onLogout = () => { pintarLogin(); render(); };

/* ---------- Proveedores (terceros) y archivo para Siigo ---------- */
const soloDig = x => String(x || '').replace(/\D/g, '');
function dvNIT(n) {
  const d = soloDig(n); if (!d) return '';
  const W = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let t = 0; for (let i = 0; i < d.length && i < W.length; i++) t += Number(d[d.length - 1 - i]) * W[i];
  const r = t % 11; return String(r > 1 ? 11 - r : r);
}
/* Códigos DANE de ciudades frecuentes (departamento 2 dígitos + municipio 3 dígitos). Editables en cada proveedor. */
const DANE = { 'bogota': '11001', 'medellin': '05001', 'cali': '76001', 'santiago de cali': '76001', 'barranquilla': '08001', 'cartagena': '13001', 'cucuta': '54001', 'bucaramanga': '68001', 'pereira': '66001', 'manizales': '17001', 'armenia': '63001', 'ibague': '73001', 'santa marta': '47001', 'villavicencio': '50001', 'pasto': '52001', 'monteria': '23001', 'neiva': '41001', 'valledupar': '20001', 'popayan': '19001', 'sincelejo': '70001', 'tunja': '15001', 'riohacha': '44001', 'yopal': '85001', 'quibdo': '27001', 'florencia': '18001', 'arauca': '81001', 'mocoa': '86001', 'leticia': '91001', 'san andres': '88001', 'yumbo': '76892', 'palmira': '76520', 'jamundi': '76364', 'buenaventura': '76109', 'tulua': '76834', 'cartago': '76147', 'buga': '76111', 'guadalajara de buga': '76111', 'candelaria': '76130', 'soledad': '08758', 'malambo': '08433', 'puerto colombia': '08573', 'galapa': '08296', 'bello': '05088', 'itagui': '05360', 'envigado': '05266', 'sabaneta': '05631', 'rionegro': '05615', 'la estrella': '05380', 'copacabana': '05212', 'apartado': '05045', 'soacha': '25754', 'chia': '25175', 'funza': '25286', 'mosquera': '25473', 'madrid': '25430', 'cajica': '25126', 'zipaquira': '25899', 'facatativa': '25269', 'fusagasuga': '25290', 'girardot': '25307', 'tocancipa': '25817', 'floridablanca': '68276', 'giron': '68307', 'piedecuesta': '68547', 'barrancabermeja': '68081', 'dosquebradas': '66170', 'sogamoso': '15759', 'duitama': '15238', 'turbaco': '13836', 'magangue': '13430', 'cienaga': '47189', 'maicao': '44430', 'ocana': '54498', 'villa del rosario': '54874', 'los patios': '54405', 'ipiales': '52356', 'tumaco': '52835', 'pitalito': '41551', 'espinal': '73268', 'la dorada': '17380' };
const sinTilde = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const daneDe = ciudad => { const c = sinTilde(ciudad).replace(/ d\.? ?c$| dc$/, '').trim(); return DANE[c] || ''; };
const TIPOS_ID = { NIT: '31', CC: '13', CE: '22', PASAPORTE: '41' };
function terceroDeIA(t, nitSuelto, proveedor) {
  t = t || {}; const S2 = x => (x == null ? '' : String(x)).trim();
  let num = soloDig(t.numero_documento), dv = soloDig(t.digito_verificacion);
  if (!num && nitSuelto) { const m = String(nitSuelto).match(/([\d.\s]+)(?:-\s*(\d))?/); if (m) { num = soloDig(m[1]); dv = dv || (m[2] || ''); } }
  if (!num) return null;
  if (!dv && num.length === 10 && /^[89]/.test(num) && dvNIT(num.slice(0, 9)) === num[9]) { dv = num[9]; num = num.slice(0, 9); }
  const tipoDoc = (S2(t.tipo_documento).toUpperCase().replace(/\./g, '')) || 'NIT';
  const juridica = S2(t.persona) ? S2(t.persona).toLowerCase().startsWith('j') : /^[89]\d{8}$/.test(num);
  const iva = S2(t.responsable_iva).toLowerCase();
  const ciudad = S2(t.ciudad);
  return { nit: num, dvImpreso: dv, tipoId: TIPOS_ID[tipoDoc] || '31', tipo: juridica ? 'Empresa' : 'Es persona', razon: S2(t.razon_social) || S2(proveedor), comercial: S2(t.nombre_comercial) || (S2(proveedor) !== S2(t.razon_social) ? S2(proveedor) : ''),
    direccion: S2(t.direccion), ciudad, depto: S2(t.departamento), dane: daneDe(ciudad), telefono: soloDig(t.telefono).slice(-10), correo: S2(t.correo).toLowerCase(),
    regimen: iva === 'si' ? '2 - Responsable de IVA' : iva === 'no' ? '0 - No responsable de IVA' : '' };
}
const provs = () => (S.proveedores = S.proveedores || {});
const claveProv = (nit, nombre) => nit ? 'nit:' + soloDig(nit) : 'n:' + normFact(nombre);
function buscarProv(nombre, nit) {
  const P = provs();
  if (nit && P[claveProv(nit)]) return P[claveProv(nit)];
  const n = normFact(nombre); if (!n) return null;
  return Object.values(P).find(p => normFact(p.comercial) === n || normFact(p.razon) === n || (p.alias || []).includes(n)) || null;
}
/* Crea o completa el proveedor de un gasto. t = datos leídos por la IA (opcional). */
/* ---------- Consulta de empresas en el RUES (datos abiertos de las Cámaras de Comercio en datos.gov.co, gratis y sin clave) ---------- */
const RUES_URL = 'https://www.datos.gov.co/resource/c82u-588k.json';
const ruesCache = {};
const tituloCiudad = t => String(t || '').toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
async function consultarRUES(nit) {
  nit = soloDig(nit); if (nit.length < 6) return null;
  if (nit in ruesCache) return ruesCache[nit];
  const w = `nit='${nit}' OR numero_identificacion='${nit}'`;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${RUES_URL}?$where=${encodeURIComponent(w)}&$limit=20`, { signal: ctl.signal });
    if (!r.ok) throw new Error('El RUES respondió ' + r.status);
    const l = await r.json();
    const peso = x => (x.estado_matricula === 'ACTIVA' ? 4 : 0) + (/^0[01]$/.test(x.codigo_categoria_matricula || '') ? 2 : 0);
    l.sort((a, b) => peso(b) - peso(a) || String(b.fecha_renovacion || b.fecha_matricula || '').localeCompare(String(a.fecha_renovacion || a.fecha_matricula || '')));
    const x = l[0];
    if (!x) return (ruesCache[nit] = false);
    const camara = tituloCiudad(x.camara_comercio), dane = daneDe(camara);
    const persona = /PERSONA NATURAL/i.test(x.organizacion_juridica || '');
    return (ruesCache[nit] = {
      razon: (x.razon_social || '').trim(), dv: x.digito_verificacion || '', estado: x.estado_matricula || '', camara,
      ciudad: dane ? camara : '', dane: dane || '', ciiu: x.cod_ciiu_act_econ_pri || '', persona,
      tipo: persona ? 'Es persona' : 'Empresa', tipoId: persona ? '13' : '31', renovado: x.ultimo_ano_renovado || '', organizacion: tituloCiudad(x.organizacion_juridica)
    });
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'El RUES no respondió a tiempo' : 'No se pudo consultar el RUES (revise su conexión)'); }
  finally { clearTimeout(to); }
}
const ruesResumen = d => `<b>${esc(d.razon)}</b> · ${d.estado === 'ACTIVA' ? '✔ Matrícula activa' : '⚠ Matrícula ' + esc((d.estado || 'sin estado').toLowerCase())}${d.renovado && d.renovado !== '0' ? ' (renovada ' + esc(d.renovado) + ')' : ''} · Cámara de Comercio de ${esc(d.camara)}${d.ciiu ? ' · CIIU ' + esc(d.ciiu) : ''}`;
/* Completa un proveedor con los datos del RUES sin pisar lo que el usuario escribió a mano */
function aplicarRUES(p, d) {
  if (!d) return;
  const manual = p.origen === 'manual';
  if (d.razon && (!manual || !p.razon)) { if (!p.comercial && p.razon && normFact(p.razon) !== normFact(d.razon)) p.comercial = p.razon; p.razon = d.razon; }
  if (d.ciudad && !p.ciudad) p.ciudad = d.ciudad;
  if (d.dane && !p.dane) p.dane = d.dane;
  if (!manual) { p.tipo = d.tipo; p.tipoId = d.tipoId; }
  p.rues = { estado: d.estado, camara: d.camara, ciiu: d.ciiu, renovado: d.renovado, fecha: todayISO() };
}
async function enriquecerProveedores(soloNit) {
  const P = provs(); let n = 0;
  for (const p of Object.values(P)) {
    if (!p.nit || (soloNit && p.nit !== soloDig(soloNit)) || (p.rues && !soloNit)) continue;
    try { const d = await consultarRUES(p.nit); if (d) { aplicarRUES(p, d); n++; } else if (d === false) p.rues = { estado: 'NO ENCONTRADO', fecha: todayISO() }; } catch { break; }
  }
  if (n) await guardar();
  return n;
}
function registrarProveedor(g, t) {
  const P = provs(), nombre = (g.proveedor || '').trim();
  if (!nombre && !(t && t.nit)) return;
  if (!t && !g.nit) { const m = String(g.obs || '').match(/NIT\s*([\d.\s]{5,})(?:-\s*(\d))?/i); if (m) t = terceroDeIA({ numero_documento: m[1], digito_verificacion: m[2] || '' }, '', nombre); }
  const nit = (t && t.nit) || soloDig(g.nit);
  let p = buscarProv(nombre, nit);
  if (p && nit && !p.nit) { delete P[claveProv('', p.comercial || p.razon)]; p.nit = nit; }
  if (!p) { p = { nit: nit || '', tipoId: '31', tipo: 'Empresa', razon: g.razon || nombre, comercial: g.razon && nombre && normFact(g.razon) !== normFact(nombre) ? nombre : '', direccion: '', ciudad: '', depto: '', dane: '', telefono: '', correo: '', regimen: '', resp: 'R-99-PN', alias: [], origen: t ? 'ia' : 'auto', creado: new Date().toISOString() }; }
  if (t) for (const k of ['tipoId', 'tipo', 'razon', 'comercial', 'direccion', 'ciudad', 'depto', 'dane', 'telefono', 'correo', 'regimen']) if (t[k] && (!p[k] || p.origen !== 'manual')) p[k] = t[k];
  const n = normFact(nombre); if (n && !(p.alias || []).includes(n)) (p.alias = p.alias || []).push(n);
  if (g.razon && (!p.razon || p.razon === nombre) && p.origen !== 'manual') p.razon = g.razon;
  p.ultimo = g.fecha || p.ultimo || '';
  P[claveProv(p.nit, p.comercial || p.razon)] = p;
  if (p.nit) g.nit = p.nit;
}
function sincronizarProveedores() {
  for (const v of S.viajes) for (const g of v.gastos) {
    if (!g.nit && /NIT/i.test(g.obs || '')) { const m = g.obs.match(/(?:\s*·\s*)?NIT\s*([\d.\s]{5,})(?:-\s*(\d))?/i); if (m) { g.nit = soloDig(m[1]); if (m[2]) g.dvImpreso = m[2]; g.obs = g.obs.replace(m[0], '').trim(); } }
    if (g.proveedor || g.nit) registrarProveedor(g);
  }
}
function listaProveedores() { return Object.entries(provs()).map(([k, p]) => ({ k, ...p })).sort((a, b) => (a.comercial || a.razon).localeCompare(b.comercial || b.razon, 'es')); }
function vProveedores() {
  const L = listaProveedores(), sinNit = L.filter(p => !p.nit).length;
  return `<h2>Proveedores (${L.length})</h2>
  <div class="card form">
    <p class="hint" style="margin:0">Se crean solos con cada factura. Cuando Gemini lee la factura, llena el NIT, la dirección, la ciudad y el régimen. Toque un proveedor para revisarlo.${sinNit ? ` <b>${sinNit} sin NIT</b> (no se incluyen en el archivo de Siigo hasta completarlos).` : ''}</p>
    <div class="row"><button class="btn primary" data-act="siigo-xlsx">Descargar terceros para Siigo</button><button class="btn" data-act="prov-nuevo">Agregar proveedor</button></div>
    ${L.some(p => p.nit && !p.rues) ? `<div class="row"><button class="btn" data-act="rues-todos">🔎 Completar con el RUES (${L.filter(p => p.nit && !p.rues).length})</button></div>` : ''}
  </div>
  ${L.length ? `<div class="list" style="margin-top:8px">${L.map(p => `<button class="item" data-act="prov-edit" data-k="${esc(p.k)}"><span class="t">${esc(p.comercial || p.razon || '—')}</span><span class="a">${p.nit ? '<span class="chip st-LEGALIZADO">NIT ' + esc(p.nit) + '-' + dvNIT(p.nit) + '</span>' : '<span class="chip st-PENDIENTE">FALTA NIT</span>'}</span><span class="s">${esc([p.comercial && p.razon !== p.comercial ? p.razon : '', p.ciudad, p.regimen ? (p.regimen[0] === '2' ? 'Responsable de IVA' : 'No responsable de IVA') : ''].filter(Boolean).join(' · ') || 'Sin datos adicionales')}</span></button>`).join('')}</div>` : '<div class="empty">Todavía no hay proveedores.</div>'}`;
}
let provEdit = null;
function abrirProveedor(k) {
  const P = provs(); provEdit = k ? { k, ...P[k] } : { k: '', nit: '', tipoId: '31', tipo: 'Empresa', razon: '', comercial: '', direccion: '', ciudad: '', depto: '', dane: '', telefono: '', correo: '', regimen: '', resp: 'R-99-PN', alias: [] };
  const p = provEdit, f = (id, l, v, extra = '') => `<label class="field"><span>${l}</span><input id="pv-${id}" value="${esc(v || '')}" ${extra}></label>`;
  const sel = (id, l, opts, v) => `<label class="field"><span>${l}</span><select id="pv-${id}">${opts.map(([val, t]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  $('#sheet').innerHTML = `<div class="sheet-back" data-close="1"><form class="sheet anim" id="pv-form" autocomplete="off"><div class="sheet-head"><h3>${k ? 'Proveedor' : 'Nuevo proveedor'}</h3><button type="button" class="x" data-close="1" aria-label="Cerrar">×</button></div><div class="form">
    <div class="grid2">${sel('tipoId', 'Tipo de documento', [['31', 'NIT'], ['13', 'Cédula'], ['22', 'Cédula de extranjería'], ['41', 'Pasaporte']], p.tipoId)}${sel('tipo', 'Tipo', [['Empresa', 'Empresa'], ['Es persona', 'Persona']], p.tipo)}</div>
    <div class="grid2">${f('nit', 'Número (sin dígito de verificación)', p.nit, 'inputmode="numeric"')}<div class="field"><span>Dígito de verificación</span><div class="num" id="pv-dv" style="padding:10px 2px;font-weight:700">${dvNIT(p.nit) || '—'}</div></div></div>
    ${f('razon', 'Razón social / Nombre completo', p.razon)}
    ${f('comercial', 'Nombre comercial', p.comercial)}
    ${f('direccion', 'Dirección', p.direccion)}
    <div class="grid2">${f('ciudad', 'Ciudad', p.ciudad)}${f('dane', 'Código DANE ciudad (5 dígitos)', p.dane, 'inputmode="numeric" maxlength="5"')}</div>
    <div class="grid2">${f('telefono', 'Teléfono', p.telefono, 'inputmode="tel"')}${f('correo', 'Correo', p.correo, 'inputmode="email" autocapitalize="off"')}</div>
    <div class="grid2">${sel('regimen', 'Régimen de IVA', [['', '—'], ['0 - No responsable de IVA', 'No responsable de IVA'], ['2 - Responsable de IVA', 'Responsable de IVA']], p.regimen)}${sel('resp', 'Responsabilidad fiscal', ['O-13', 'O-15', 'O-23', 'O-47', 'R-99-PN'].map(x => [x, x]), p.resp || 'R-99-PN')}</div>
    <div id="pv-rues">${p.rues && p.rues.estado ? `<div class="note ${p.rues.estado === 'ACTIVA' ? 'ok' : ''}">RUES: ${p.rues.estado === 'NO ENCONTRADO' ? 'no aparece en el registro de las Cámaras de Comercio' : `${p.rues.estado === 'ACTIVA' ? '✔ matrícula activa' : '⚠ matrícula ' + esc(p.rues.estado.toLowerCase())} · Cámara de ${esc(p.rues.camara || '')}${p.rues.ciiu ? ' · CIIU ' + esc(p.rues.ciiu) : ''}`} (consultado ${fmtFecha(p.rues.fecha)})</div>` : ''}</div>
    <div class="row"><button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-act="rues-pv">🔎 Buscar en el RUES</button><button class="btn" type="button" data-act="dian">Verificar en la DIAN</button></div>
    ${k ? '<div id="pv-del"><button type="button" class="btn danger block" data-act="prov-del">Eliminar proveedor</button></div>' : ''}
  </div></form></div>`;
}
async function buscarRUESProveedor(avisar) {
  const nit = soloDig(($('#pv-nit') || {}).value), box = $('#pv-rues'); if (!box) return;
  if (nit.length < 6) { if (avisar) box.innerHTML = '<div class="note">Escriba el NIT o la cédula para buscar.</div>'; return; }
  box.innerHTML = '<div class="note ia-busy"><span class="spin"></span> <span class="txt">Buscando en el RUES…</span></div>';
  try {
    const d = await consultarRUES(nit);
    if (soloDig(($('#pv-nit') || {}).value) !== nit) return;
    if (!d) { box.innerHTML = '<div class="note">No aparece en el RUES (registro de las Cámaras de Comercio). Si es persona natural sin matrícula mercantil, llénelo a mano o verifique en la DIAN.</div>'; return; }
    const put = (id, v, siempre) => { const el = $('#pv-' + id); if (el && v && (siempre || !el.value.trim())) el.value = v; };
    const r = $('#pv-razon'), com = $('#pv-comercial');
    if (r && r.value.trim() && normFact(r.value) !== normFact(d.razon) && com && !com.value.trim()) com.value = r.value.trim();
    put('razon', d.razon, true); put('ciudad', d.ciudad); put('dane', d.dane); put('tipo', d.tipo, true); put('tipoId', d.tipoId, true);
    provEdit.rues = { estado: d.estado, camara: d.camara, ciiu: d.ciiu, renovado: d.renovado, fecha: todayISO() };
    box.innerHTML = `<div class="note ${d.estado === 'ACTIVA' ? 'ok' : ''}">RUES: ${ruesResumen(d)}.<br>Se llenaron la razón social${d.ciudad ? ', la ciudad' : ''} y el tipo. La dirección y el teléfono no vienen en el RUES: los toma la IA de la factura.</div>`;
  } catch (e) { box.innerHTML = `<div class="note">⚠ ${esc(e.message)}</div>`; }
}
/* En el formulario del gasto: al escribir el NIT, trae la razón social del RUES si está vacía */
async function ruesEnGasto() {
  const nit = soloDig(($('#g-nit') || {}).value), box = $('#g-nitchk'); if (!box || nit.length < 8) return;
  try {
    const d = await consultarRUES(nit); if (!d || soloDig(($('#g-nit') || {}).value) !== nit) return;
    const r = $('#g-razon'); if (r && !r.value.trim()) { r.value = d.razon; if (editando) editando.razon = d.razon; }
    box.insertAdjacentHTML('beforeend', `<div class="hint" style="margin-top:4px">RUES: ${ruesResumen(d)}</div>`);
  } catch {}
}
async function guardarProveedor() {
  const P = provs(), p = provEdit, val = id => ($('#pv-' + id) || {}).value || '';
  Object.assign(p, { tipoId: val('tipoId'), tipo: val('tipo'), nit: soloDig(val('nit')), razon: val('razon').trim(), comercial: val('comercial').trim(), direccion: val('direccion').trim(), ciudad: val('ciudad').trim(), dane: soloDig(val('dane')).slice(0, 5), telefono: soloDig(val('telefono')), correo: val('correo').trim(), regimen: val('regimen'), resp: val('resp'), origen: 'manual' });
  if (!p.dane && p.ciudad) p.dane = daneDe(p.ciudad);
  if (!p.razon && !p.comercial) { toast('Escriba la razón social o el nombre'); return; }
  const k0 = p.k; delete p.k; if (k0) delete P[k0];
  const k = claveProv(p.nit, p.comercial || p.razon);
  if (P[k] && k !== k0) { p.alias = [...new Set([...(P[k].alias || []), ...(p.alias || [])])]; }
  P[k] = p; await guardar(); provEdit = null; cerrarSheet(); render(); toast('Proveedor guardado');
}
const SIIGO_COLS = ['Identificación (Obligatorio)', 'Dígito de verificación', 'Código Sucursal', 'Tipo identificación (Obligatorio)', 'Tipo (Obligatorio)', 'Razón social (Obligatorio)', 'Nombres del tercero (Obligatorio)', 'Apellidos del tercero (Obligatorio)', 'Nombre Comercial', 'Dirección', 'Código país', 'Código departamento/estado', 'Código ciudad', 'Indicativo teléfono principal', 'Teléfono principal', 'Extensión teléfono principal', 'Tipo de régimen IVA', 'Código Responsabilidad fiscal', 'Código Postal', 'Nombres contacto principal', 'Apellidos contacto principal', 'Indicativo teléfono contacto principal', 'Teléfono contacto principal', 'Extensión teléfono contacto principal', '# Celular', 'Correo electrónico contacto principal', 'Identificación del cobrador', 'Identificación del vendedor', 'Otros', 'Clientes', 'Proveedor', 'Estado'];
/* Filas en el formato de la plantilla "Subir Terceros desde Excel - Siigo Nube". Solo proveedores con número de documento. */
function filasSiigo(soloEstos) {
  return listaProveedores().filter(p => p.nit && (!soloEstos || soloEstos.has(p.nit))).map(p => {
    const persona = p.tipo === 'Es persona', partes = (p.razon || '').split(/\s+/).filter(Boolean);
    const nombres = persona ? partes.slice(0, Math.max(1, partes.length - 2)).join(' ') : '', apellidos = persona ? partes.slice(Math.max(1, partes.length - 2)).join(' ') : '';
    const cel = /^3\d{9}$/.test(p.telefono) ? p.telefono : '', tel = cel ? '' : p.telefono;
    return [Number(p.nit), p.tipoId === '31' ? Number(dvNIT(p.nit)) : '', '', Number(p.tipoId), p.tipo, persona ? '' : p.razon, nombres, apellidos, p.comercial || '', p.direccion || '', p.dane ? 'Co' : '', p.dane ? p.dane.slice(0, 2) : '', p.dane ? p.dane.slice(2) : '', '', tel ? Number(tel) || tel : '', '', p.regimen || '', p.resp || 'R-99-PN', '', '', '', '', '', '', cel ? Number(cel) : '', p.correo || '', '', '', 'NO', 'NO', 'SI', 'Activo'];
  });
}
function colLetra(i) { let s = '', n = i + 1; while (n) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; }
/* Hoja "Terceros Siigo" dentro del Excel exportado (solo proveedores del viaje) */
async function agregarHojaTerceros(zip, gs) {
  const nits = new Set(gs.map(g => { if (g.proveedor && !g.nit) registrarProveedor(g); return soloDig(g.nit) || (buscarProv(g.proveedor) || {}).nit; }).filter(Boolean));
  const filas = filasSiigo(nits);
  const c = (ref, s, v) => v === '' || v == null ? `<c r="${ref}" s="${s}"/>` : typeof v === 'number' ? `<c r="${ref}" s="${s}"><v>${v}</v></c>` : `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
  let rows = `<row r="1" ht="45" customHeight="1">${SIIGO_COLS.map((h, i) => c(colLetra(i) + '1', 23, h)).join('')}</row>`;
  filas.forEach((f, k) => { rows += `<row r="${k + 2}">${f.map((v, i) => c(colLetra(i) + (k + 2), 171, v)).join('')}</row>`; });
  if (!filas.length) rows += `<row r="2">${c('A2', 171, 'Sin proveedores con NIT en este viaje. Complete el NIT en Facturas › Proveedores.')}</row>`;
  const widths = [16, 8, 9, 11, 12, 34, 22, 22, 26, 30, 8, 11, 9, 10, 14, 10, 24, 14, 10, 18, 18, 10, 14, 10, 13, 28, 14, 14, 7, 8, 9, 9];
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="FFE20214"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>`;
  zip.file('xl/worksheets/sheetTerceros.xml', sheet);
  let types = await zip.file('[Content_Types].xml').async('string');
  zip.file('[Content_Types].xml', types.replace('</Types>', '<Override PartName="/xl/worksheets/sheetTerceros.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
  let wrels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  zip.file('xl/_rels/workbook.xml.rels', wrels.replace('</Relationships>', '<Relationship Id="rIdTerceros" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheetTerceros.xml"/></Relationships>'));
  return filas.length;
}
/* Hoja "Detalle de facturas": una fila por gasto con todos los datos de la factura */
async function agregarHojaDetalle(zip, gs) {
  const cols = [['Fila en Control de Gastos', 12], ['Fecha', 12], ['Hora', 8], ['Tipo de documento', 22], ['N° factura', 16], ['CUFE', 30], ['Proveedor', 24], ['Razón social', 30], ['NIT', 13], ['DV', 5], ['Facturada a', 22], ['NIT comprador', 14], ['Concepto', 14], ['Subconcepto', 20], ['Descripción', 26], ['Subtotal', 13], ['IVA %', 7], ['IVA', 12], ['INC %', 7], ['INC', 12], ['Propina', 11], ['Descuentos', 11], ['Total', 13], ['¿Cuadra?', 9], ['Forma de pago', 12], ['Medio de pago', 15], ['Pagado por', 11], ['Soporte', 9], ['Estado', 22], ['Observaciones', 30]];
  const c = (ref, st, v) => v === '' || v == null ? `<c r="${ref}" s="${st}"/>` : typeof v === 'number' ? `<c r="${ref}" s="${st}"><v>${v}</v></c>` : `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`;
  const MONEY = new Set([15, 17, 19, 20, 21, 22]);
  let rows = `<row r="1" ht="32" customHeight="1">${cols.map(([h], i) => c(colLetra(i) + '1', 23, h)).join('')}</row>`;
  gs.forEach((g, k) => {
    const r = k + 2, cq = cuadreFactura(g), num = x => x === '' || x == null ? '' : Number(x);
    const vals = [14 + k, serial(g.fecha), g.hora || '', g.tipoDoc || '', g.factura || '', g.cufe || '', g.proveedor || '', g.razon || '', g.nit ? Number(g.nit) : '', g.nit ? Number(dvNIT(g.nit)) : '', g.compradorNombre || '', g.compradorNit || '', g.concepto || '', g.sub || '', g.desc || '',
      num(g.subtotal), num(g.ivaPct), num(g.iva), num(g.incPct), num(g.inc), num(g.propina), num(g.descuento), num(g.valor), cq ? (cq.ok ? 'Sí' : 'No') : '', g.formaPago || '', g.medioPago || '', g.pagadoPor || '', g.soporte || '', estado(g), g.obs || ''];
    rows += `<row r="${r}">${vals.map((v, i) => c(colLetra(i) + r, i === 1 ? 170 : MONEY.has(i) ? 172 : 171, v)).join('')}</row>`;
  });
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="FF082759"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols.map(([, w], i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${gs.length ? `<autoFilter ref="A1:${colLetra(cols.length - 1)}${gs.length + 1}"/>` : ''}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>`;
  zip.file('xl/worksheets/sheetDetalle.xml', sheet);
  const types = await zip.file('[Content_Types].xml').async('string');
  zip.file('[Content_Types].xml', types.replace('</Types>', '<Override PartName="/xl/worksheets/sheetDetalle.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
  const wrels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  zip.file('xl/_rels/workbook.xml.rels', wrels.replace('</Relationships>', '<Relationship Id="rIdDetalle" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheetDetalle.xml"/></Relationships>'));
}
/* Archivo aparte, listo para "Subir Terceros desde Excel\" en Siigo Nube (todos los proveedores con NIT) */
async function exportarSiigo() {
  const XLSX = await cargarXLSX();
  sincronizarProveedores();
  const filas = filasSiigo();
  if (!filas.length) { toast('No hay proveedores con NIT. Complete el NIT de al menos uno.'); return; }
  const ws = XLSX.utils.aoa_to_sheet([SIIGO_COLS, ...filas]);
  ws['!cols'] = SIIGO_COLS.map((h, i) => ({ wch: i === 5 || i === 9 || i === 25 ? 30 : 14 }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hoja 1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  await entregarArchivo(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Terceros Siigo ${todayISO()}.xlsx`);
}

/* ---------- Toast ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

/* ---------- Eventos ---------- */
function moneyFormat(el) {
  const raw = el.value.replace(/[^\d]/g, '');
  el.value = raw ? Number(raw).toLocaleString('es-CO') : '';
}
document.addEventListener('click', async e => {
  const t = e.target.closest('button, [data-edit], [data-close], tr[data-edit]');
  if (!t) return;
  if (t.dataset.close && e.target === t) { cerrarSheet(); return; }
  if (t.dataset.close && t.tagName === 'BUTTON') { cerrarSheet(); return; }
  if (t.dataset.tab) { tab = t.dataset.tab; cfgAbierta = false; revDevolviendo = false; corteDevolviendo = null; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.edit) { abrirGasto(t.dataset.edit); return; }
  if (t.dataset.trip) { S.activo = t.dataset.trip; await guardar(); cerrarSheet(); render(); return; }
  if (t.dataset.ffilt) { filtroFact = t.dataset.ffilt; render(); return; }
  if (t.closest('[data-seg]') && editando) {
    leerFormGasto(); pintarGasto._y = $('#g-form').scrollTop;
    const k = t.closest('[data-seg]').dataset.seg; editando[k] = t.dataset.val;
    if (k === 'concepto') editando.sub = '';
    pintarGasto(); return;
  }
  if (window.Android && Android.web && /^(drive-(xlsx|backup|elegir|enlace|sel)|mail-enviar)$/.test(t.dataset.act || '')) Android.calentar();
  switch (t.dataset.act) {
    case 'foto': $('#g-file').click(); break;
    case 'galeria': $('#g-galeria').click(); break;
    case 'ia-leer': { const src = fotoTmp || (editando && await DB.get('foto:' + editando.id)); if (src) aplicarIA(src); break; }
    case 'ia-ver': { const k = $('#ia-key'); k.type = k.type === 'password' ? 'text' : 'password'; break; }
    case 'ia-probar': probarIA(); break;
    case 'ia-borrar': IA.key = ''; await guardarIA(); render(); toast('Clave borrada'); break;
    case 'foto-del': fotoTmp = null; leerFormGasto(); editando.foto = false; pintarGasto(); break;
    case 'g-del': $('#g-del').innerHTML = '<div class="note">¿Eliminar este gasto? No se puede deshacer.</div><div class="row" style="margin-top:8px"><button type="button" class="btn danger" data-act="g-del-ok">Sí, eliminar</button><button type="button" class="btn" data-act="g-del-no">Cancelar</button></div>'; break;
    case 'g-del-no': pintarGasto(); break;
    case 'dup-abrir': abrirDuplicados(); break;
    case 'dup-del': { const id = t.dataset.id, v = S.viajes.find(vv => vv.gastos.some(x => x.id === id)); const g = v && v.gastos.find(x => x.id === id); if (!g) break; if (bloqueado(g)) { toast('Este gasto está en un corte enviado'); break; }
      if (t.dataset.ok !== '1') { t.dataset.ok = '1'; t.textContent = '¿Seguro? Eliminar'; break; }
      v.gastos = v.gastos.filter(x => x.id !== id); await DB.del('foto:' + id); await guardar(); render(); abrirDuplicados(); toast('Gasto repetido eliminado'); break; }
    case 'g-dup-ok': { leerFormGasto(); const d = facturaRepetida(editando); if (d && d.por !== 'valor') { guardarGasto(dupOtro); break; } guardarGasto(dupOtro, true); break; }
    case 'rev-aprobado': marcarRevision(viaje(), 'aprobado'); await guardar(); render(); toast('Viaje marcado como aprobado'); break;
    case 'rev-devuelto': revDevolviendo = true; render(); setTimeout(() => $('#rev-nota')?.focus(), 50); break;
    case 'rev-cancelar': revDevolviendo = false; render(); break;
    case 'rev-devuelto-ok': { const n = ($('#rev-nota')?.value || '').trim(); revDevolviendo = false; marcarRevision(viaje(), 'devuelto', n); await guardar(); render(); toast('Viaje marcado como devuelto'); break; }
    case 'g-dup-no': $('#g-dup').innerHTML = ''; $('#g-factura')?.focus(); break;
    case 'g-del-ok': { if (bloqueado(editando)) { toast('Este gasto está en un corte enviado'); break; } const v = viaje(); v.gastos = v.gastos.filter(x => x.id !== editando.id); await DB.del('foto:' + editando.id); await guardar(); cerrarSheet(); render(); toast('Gasto eliminado'); break; }
    case 'print': imprimir(); break;
    case 'print-go': tab = 'legal'; render(); setTimeout(imprimir, 150); break;
    case 'xlsx': try { await exportarExcel(); } catch (err) { console.error(err); toast('No se pudo exportar: ' + err.message); } break;
    case 'import': importarExcel(); break;
    case 'backup': copiaSeguridad(); break;
    case 'drive-xlsx': if (cortesDe(viaje()).length) enviarFinalCortes(); else subirDrive('xlsx'); break;
    case 'cortes-resumen': try { await excelResumenCortes(viaje()); } catch (err) { toast('No se pudo exportar: ' + err.message); } break;
    case 'drive-backup': subirDrive('backup'); break;
    case 'drive-abrir': if (driveUltimo && driveUltimo.link) Android.openUrl(driveUltimo.link); break;
    case 'login': loginEstado = { cargando: true, msg: '', config: false }; pintarLogin(); Android.login(); break;
    case 'login-saltar': { const el = $('#login'); if (el) el.remove(); toast('Configure el acceso a Google para activar el inicio de sesión'); break; }
    case 'logout': Android.logout(); break;
    case 'sync-ahora': sincronizar(true); break;
    case 'drive-elegir': abrirCarpetas(); break;
    case 'mail-enviar': enviarAviso(); break;
    case 'corte-nuevo': corteForm = { ...sugerirRango(viaje()), adicional: 0 }; render(); break;
    case 'corte-cancelar': corteForm = null; render(); break;
    case 'corte-crear': crearCorte(); break;
    case 'corte-enviar': subirDrive('corte', t.dataset.corte); break;
    case 'corte-xlsx': { const v = viaje(), k = cortesDe(v).find(x => x.id === t.dataset.corte); try { await exportarExcel(false, vistaCorte(v, k)); } catch (err) { toast('No se pudo exportar: ' + err.message); } break; }
    case 'corte-aprobar': { const k = cortesDe(viaje()).find(x => x.id === t.dataset.corte); k.revision = { estado: 'aprobado', nota: '', fecha: new Date().toISOString() }; await guardar(); render(); toast(nombreCorte(k) + ' aprobado'); break; }
    case 'corte-devolver': corteDevolviendo = t.dataset.corte; render(); setTimeout(() => $('#corte-nota')?.focus(), 50); break;
    case 'corte-dev-no': corteDevolviendo = null; render(); break;
    case 'corte-dev-ok': { const k = cortesDe(viaje()).find(x => x.id === t.dataset.corte); k.revision = { estado: 'devuelto', nota: ($('#corte-nota')?.value || '').trim(), fecha: new Date().toISOString() }; corteDevolviendo = null; await guardar(); render(); toast(nombreCorte(k) + ' devuelto: ya puede corregir sus gastos'); break; }
    case 'corte-deshacer': {
      if (!t.dataset.ok) { t.dataset.ok = '1'; t.textContent = '¿Seguro? Toque otra vez'; t.classList.add('danger'); break; }
      const v = viaje(), k = cortesDe(v).find(x => x.id === t.dataset.corte); v.gastos.forEach(g => { if (g.corte === k.id) delete g.corte; }); v.cortes = v.cortes.filter(x => x.id !== k.id); await guardar(); render(); toast('Corte deshecho: sus gastos vuelven a quedar abiertos'); break;
    }
    case 'rues-pv': buscarRUESProveedor(true); break;
    case 'rues-todos': { t.disabled = true; t.textContent = 'Consultando el RUES…'; const n = await enriquecerProveedores(); toast(n ? `${n} proveedor(es) completados con el RUES` : 'No hubo proveedores nuevos para completar'); render(); break; }
    case 'siigo-xlsx': try { await exportarSiigo(); } catch (err) { toast('No se pudo generar el archivo: ' + err.message); } break;
    case 'prov-nuevo': abrirProveedor(''); break;
    case 'prov-edit': abrirProveedor(t.dataset.k); break;
    case 'prov-del': $('#pv-del').innerHTML = '<div class="note">¿Eliminar este proveedor del directorio? Los gastos no se borran.</div><div class="row" style="margin-top:8px"><button type="button" class="btn danger" data-act="prov-del-ok">Sí, eliminar</button></div>'; break;
    case 'prov-del-ok': { delete provs()[provEdit.k]; provEdit = null; await guardar(); cerrarSheet(); render(); toast('Proveedor eliminado'); break; }
    case 'dian': { const u = 'https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces'; const n = soloDig(($('#pv-nit') || {}).value); try { if (n && navigator.clipboard) navigator.clipboard.writeText(n); } catch {} toast(n ? 'NIT copiado: péguelo en la consulta de la DIAN' : 'Abriendo la consulta de la DIAN'); if (window.Android && Android.openUrl) Android.openUrl(u); else window.open(u, '_blank', 'noopener'); break; }
    case 'config': abrirConfig(); break;
    case 'cfg-entrar': probarClaveCfg(); break;
    case 'cfg-ver': { const k = $('#cfg-clave'); k.type = k.type === 'password' ? 'text' : 'password'; break; }
    case 'drive-sel': elegirCarpeta(t.dataset.id, t.dataset.name); break;
    case 'drive-propia': { const c = driveCfg(); c.carpetaId = ''; c.carpetaNombre = ''; await guardar(); driveUltimo = null; render(); toast('Los archivos se subirán a "' + c.carpeta + '" en su Drive'); break; }
    case 'drive-enlace': {
      const enl = ($('#dr-enlace') || {}).value || '', id = idDeEnlace(enl);
      carpetasDrive = Object.assign(carpetasDrive || { cargando: false, lista: [] }, { enlace: enl, errEnlace: id ? '' : 'Ese enlace no parece de una carpeta de Drive. Cópielo desde Drive con "Compartir › Copiar enlace".', probando: !!id });
      pintarCarpetas(); if (id) Android.listFolders(id); break;
    }
    case 'restore': restaurar(); break;
    case 'trips': abrirViajes(); break;
    case 'new-trip': { const v = nuevoViaje(); S.viajes.push(v); S.activo = v.id; await guardar(); cerrarSheet(); tab = 'viaje'; render(); toast('Viaje creado: complete los datos'); break; }
    case 'cp-abrir': if (!cfgAbierta) { cpPendiente = true; abrirConfig(); break; } tab = 'conceptos'; cpBuscar = ''; cpAgregando = null; render(); window.scrollTo(0, 0); break;
    case 'cp-volver': tab = 'config'; render(); window.scrollTo(0, 0); break;
    case 'cp-nuevo': abrirConcepto(null); break;
    case 'cp-editar': abrirConcepto(t.dataset.c); break;
    case 'cp-sub-add': cpAgregando = t.dataset.c; render(); setTimeout(() => $('#cp-nuevo-sub')?.focus(), 30); break;
    case 'cp-sub-ok': { const c = t.dataset.c, x = (($('#cp-nuevo-sub') || {}).value || '').trim().replace(/\s+/g, ' '); if (!x) { cpAgregando = null; render(); break; } const k = cpCfg(c); if ([...(S.listas[c] || []), ...(k.subsOff || [])].some(y => normFact(y) === normFact(x))) { toast('Ese subconcepto ya existe'); break; } S.listas[c] = [...(S.listas[c] || []), x]; cpAgregando = null; await guardar(); render(); toast('Subconcepto agregado'); break; }
    case 'cp-activar': { const c = t.dataset.c, off = S.conceptosOff || {}; S.listas[c] = off[c] || []; delete off[c]; await guardar(); render(); toast('Concepto activado'); break; }
    case 'cp-icono': leerConcepto(); cpEdit.icono = t.dataset.v; pintarConcepto(); break;
    case 'cp-color': leerConcepto(); cpEdit.color = t.dataset.v; pintarConcepto(); break;
    case 'cp-sub-up': case 'cp-sub-down': { leerConcepto(); const i = +t.dataset.i, j = t.dataset.act === 'cp-sub-up' ? i - 1 : i + 1, a = cpEdit.subs; if (a[j]) [a[i], a[j]] = [a[j], a[i]]; pintarConcepto(); break; }
    case 'cp-sub-on': { leerConcepto(); const x = cpEdit.subs[+t.dataset.i]; x.on = !x.on; pintarConcepto(); break; }
    case 'cp-sub-del': { leerConcepto(); cpEdit.subs.splice(+t.dataset.i, 1); pintarConcepto(); break; }
    case 'cp-sub-mas': { leerConcepto(); const x = (($('#cp-sub-txt') || {}).value || '').trim(); if (x) { cpEdit.subs.push({ n: x, orig: null, on: true }); pintarConcepto(); setTimeout(() => $('#cp-sub-txt')?.focus(), 30); } break; }
    case 'cp-desactivar': guardarConcepto(false); break;
    case 'cp-activar-ed': guardarConcepto(true); break;
    case 'cp-eliminar': { const c = cpEdit.orig; if (usoConcepto(c)) break; if (Object.keys(S.listas).length <= 1 && c in S.listas) { toast('Debe quedar al menos un concepto activo'); break; } delete S.listas[c]; if (S.conceptosOff) delete S.conceptosOff[c]; if (S.conceptosCfg) delete S.conceptosCfg[c]; await guardar(); cpEdit = null; cerrarSheet(); render(); toast('Concepto eliminado'); break; }
    case 'reset-listas': S.listas = JSON.parse(JSON.stringify(LISTAS_DEF)); S.conceptosOff = {}; S.conceptosCfg = {}; await guardar(); render(); toast('Lista original restaurada'); break;
    case 'del-trip': $('#danger').innerHTML = `<div class="note">Se borrará el viaje y sus ${viaje().gastos.length} gastos. No se puede deshacer.</div><div class="row"><button class="btn danger" data-act="del-trip-ok">Sí, eliminar viaje</button><button class="btn" data-act="del-trip-no">Cancelar</button></div>`; break;
    case 'del-trip-no': render(); break;
    case 'del-trip-ok': {
      const v = viaje(); for (const g of v.gastos) if (g.foto) await DB.del('foto:' + g.id);
      S.viajes = S.viajes.filter(x => x.id !== v.id);
      if (!S.viajes.length) S.viajes.push(nuevoViaje());
      S.activo = S.viajes[0].id; await guardar(); tab = 'gastos'; render(); toast('Viaje eliminado'); break;
    }
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'g-form') { e.preventDefault(); guardarGasto(!!(e.submitter && e.submitter.dataset.otro)); } if (e.target.id === 'cfg-form') { e.preventDefault(); probarClaveCfg(); } if (e.target.id === 'pv-form') { e.preventDefault(); guardarProveedor(); } if (e.target.id === 'cp-form') { e.preventDefault(); guardarConcepto(); } });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.hasAttribute('data-money')) moneyFormat(el);
  if (el.dataset.vf) {
    const v = viaje(); const k = el.dataset.vf;
    v[k] = el.hasAttribute('data-money') ? (el.value === '' ? (k === 'efectivo' ? '' : 0) : parseValor(el.value)) : el.value;
    if (['trabajador', 'cedula', 'lugar'].includes(k)) S.perfil[k] = el.value;
    guardar();
    if (['cliente', 'cot', 'servicio', 'ciudad', 'inicio', 'fin'].includes(k)) {
      $('#trip-name').textContent = [v.cliente || 'Viaje sin nombre', v.cot ? 'COT ' + v.cot : ''].filter(Boolean).join(' · ');
      $('#trip-sub').textContent = `${v.servicio || ''}${v.ciudad ? ' — ' + v.ciudad : ''} · ${fmtFecha(v.inicio)} a ${fmtFecha(v.fin)}`;
    }
  }
  if (el.id === 'dr-carpeta') { driveCfg().carpeta = el.value.trim(); guardar(); }
  if (editando && (el.dataset.fx !== undefined || ['g-valor', 'g-nit', 'g-dv', 'gx-compradorNit', 'gx-compradorNombre'].includes(el.id)) && $('#g-form')) {
    leerFormGasto();
    const c = $('#g-cuadre'); if (c) c.innerHTML = vCuadre(editando);
    const n = $('#g-nitchk'); if (n) n.innerHTML = nitAviso(editando);
    const b = $('#g-comprador'); if (b) b.innerHTML = avisoComprador(editando);
  }
  if (el.id === 'pv-nit') { const d = $('#pv-dv'); if (d) d.textContent = dvNIT(el.value) || '—'; }
  if (corteForm && (el.id === 'ct-desde' || el.id === 'ct-hasta')) { corteForm[el.id === 'ct-desde' ? 'desde' : 'hasta'] = el.value; corteForm.adicional = parseValor(($('#ct-adic') || {}).value) || 0; const y = window.scrollY; render(); window.scrollTo(0, y); }
  if (el.id === 'emp-nit') { S.empresa = Object.assign(S.empresa || {}, { nit: soloDig(el.value) }); guardar(); }
  if (el.id === 'dr-correos') { driveCfg().correos = el.value; guardar(); }
  if (el.id === 'ia-key') { IA.key = el.value.trim(); guardarIA(); }
  if (el.id === 'ia-modelo') { IA.modelo = el.value.trim() || IA_MODELOS[0]; guardarIA(); }
  if (el.id === 'cp-buscar') { cpBuscar = el.value; const pos = el.selectionStart; render(); const n = $('#cp-buscar'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } }
  if (el.dataset.lista) { S.listas[el.dataset.lista] = el.value.split('\n').map(s => s.trim()).filter(Boolean); guardar(); }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'pv-nit') buscarRUESProveedor(false);
  if (el.id === 'g-nit') ruesEnGasto();
  if (['g-factura', 'g-nit', 'g-prov', 'g-razon', 'g-fecha', 'g-valor', 'gx-cufe'].includes(el.id)) avisoDupVivo();
  if (el.dataset.vf && tab === 'legal') { const { L, html } = foHTML(vistaAbierta(viaje())); $('.fo-wrap').innerHTML = html; const n = $('#main .note'); if (n) { n.textContent = L.aviso; n.classList.toggle('ok', L.ok); } }
  else if (el.dataset.vf && el.type === 'date') { const y = window.scrollY; render(); window.scrollTo(0, y); }
  if ((el.id === 'g-file' || el.id === 'g-galeria') && el.files[0]) {
    try { leerFormGasto(); const f = el.files[0]; el.value = ''; pdfTextoTmp = null;
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        toast('Abriendo el PDF…'); const p = await pdfAImagen(f); if (!editando) return;
        fotoTmp = p.src; pdfTextoTmp = { id: editando.id, t: p.texto }; editando.foto = true; pintarGasto();
        if (p.paginas > 4) toast(`El PDF tiene ${p.paginas} páginas: se guardaron las primeras 4`);
        if (iaLista() && IA.auto) aplicarIA(fotoTmp); return;
      }
      const r = await abrirEscaner(f); if (!r || !editando) return; fotoTmp = r; editando.foto = true; pintarGasto(); if (iaLista() && IA.auto) aplicarIA(fotoTmp); }
    catch { toast('No se pudo leer la imagen'); }
  }
  if (el.id === 'g-sub' && editando) editando.sub = el.value;
  if (el.id === 'dr-porviaje') { driveCfg().porViaje = el.checked; guardar(); }
  if (el.id === 'dr-avisar') { driveCfg().avisar = el.checked; guardar(); }
  if (el.id === 'ia-auto') { IA.auto = el.checked; guardarIA(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheet').innerHTML) cerrarSheet(); });

/* ---------- Inicio ---------- */
(async function init() {
  const t0 = Date.now();
  try { $('#splash-logo').src = LOGO; $('#hdr-logo').src = LOGO; } catch {}
  await cargar(); await cargarIA();
  try { const em = window.Android && Android.web && GW.ls('email'); if (em && !(await correoPermitido(em))) { Android.logoutSilencioso(); loginEstado = { cargando: false, msg: `La cuenta ${em} no tiene acceso. ${textoAcceso()}`, config: false }; } } catch {}
  try { pintarLogin(); } catch {}
  try { const p = perfil(); if (p && !p.name && Android.refreshProfile) Android.refreshProfile(); } catch {}
  setTimeout(() => { const sp = $('#splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 400); } }, Math.max(0, 700 - (Date.now() - t0)));
  $('#trip-btn').addEventListener('click', abrirViajes);
  { const ti = $('#trip-ic'); if (ti) ti.innerHTML = ICON.viaje; }
  $('#fab').addEventListener('click', () => abrirGasto());
  $('#fab').innerHTML = ICON.plus + '<span>Registrar gasto</span>';
  try { if (location.hash && TABS.some(t => t[0] === location.hash.slice(1))) tab = location.hash.slice(1); } catch {}
  render();
  limpiarEjemplo().then(c => { if (c) render(); }).catch(() => {}).then(() => metaSync()).then(() => sellar()).then(() => programarSync(1200)).catch(e => console.error(e));
  window.addEventListener('online', () => programarSync(500));
  window.addEventListener('offline', () => { if (syncActivo()) { syncEstado = { ...syncEstado, estado: 'offline' }; pintarSyncChip(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') programarSync(500); else if (syncActivo() && SM && SM.pendiente) guardarYa(); });
  setInterval(() => { if (document.visibilityState === 'visible' && !syncCorriendo) sincronizar(false); }, 90000);
  if ('serviceWorker' in navigator && !inIframe && (!window.Android || Android.web) && location.protocol === 'https:') {
    // Actualización automática: busca versión nueva al abrir y al volver a la app, y recarga cuando el service worker nuevo toma control
    const habia = !!navigator.serviceWorker.controller; let recargado = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia && !recargado) { recargado = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }
})();
