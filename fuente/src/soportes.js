/* Hoja "Soportes": una fila por gasto con foto, en el mismo orden de Control de Gastos, con la foto al lado. */
const xesc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function medirImagen(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 800, h: 600 }); im.src = src; });
}
async function agregarHojaSoportes(zip, gs) {
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
  const v = viaje();
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
