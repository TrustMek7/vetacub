// Generación pura (sin dependencias nativas) del reporte HTML → PDF y de los CSV.
// En el celular se convierte a PDF con expo-print (src/export/share.ts).
import { ADVERTENCIA_CATEGORIAS, ADVERTENCIA_GPS, ADVERTENCIA_LEGAL, type Galeria, type Muestra, type Parametros } from '../domain/types';
import type { Estimacion, TotalCategoria } from '../engine/summary';
import { COLOR_CATEGORIA, seccionSvg } from '../engine/sectionLayout';

const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const COLOR_SEMAFORO = { seguir: '#1B7F3B', revisar: '#E0A800', no_conviene: '#C8102E', sin_datos: '#6B7280' } as const;

export interface DatosReporte {
  operacion: string;
  galerias: Galeria[];
  muestras: Muestra[];
  params: Parametros;
  est: Estimacion;
  generadoEn?: string;
}

export function reporteHtml(d: DatosReporte): string {
  const { est, params: p } = d;
  const r = est.resumen;
  const fila = (nombre: string, t: TotalCategoria, color?: string, negrita = false) => `
    <tr${negrita ? ' class="b"' : ''}><td>${color ? `<span class="dot" style="background:${color}"></span>` : ''}${nombre}</td>
    <td>${f(t.toneladas, 1)}</td><td>${f(t.leyMedia)}</td><td>${f(t.gramos, 1)}</td><td>${f(t.onzas)}</td><td>${f(t.gramosRecuperables, 1)}</td><td>${f(t.onzasRecuperables)}</td></tr>`;
  const nombres = new Map(d.galerias.map((g) => [g.id, g.nombre]));
  const s = est.semaforo;
  const fp = est.factor;
  const cotaG = (id: string) => est.modelo.cotas.get(id) ?? 0;
  const muestrasOrden = [...d.muestras].filter((m) => !m.deleted).sort((a, b) => cotaG(b.galeriaId) - cotaG(a.galeriaId) || a.avanceM - b.avanceM);

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cubicación orientativa — ${esc(d.operacion)}</title>
<style>
 @page { size: A4; margin: 14mm; }
 body { font-family: Helvetica, Arial, sans-serif; color:#111; font-size:11px; }
 h1 { font-size:18px; margin:0 0 4px } h2 { font-size:13px; margin:16px 0 6px; border-bottom:2px solid #111; padding-bottom:2px }
 .aviso { border:2px solid #C8102E; background:#FFF4F4; padding:8px 10px; font-weight:bold; font-size:11.5px; margin:8px 0 }
 .meta { color:#444 } table { border-collapse:collapse; width:100% } th,td { border:1px solid #bbb; padding:4px 6px; text-align:right }
 th:first-child, td:first-child { text-align:left } th { background:#f0f0f0 } tr.b td { font-weight:bold; background:#fafafa }
 .dot { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px }
 .sem { border-left:10px solid ${COLOR_SEMAFORO[s.estado]}; padding:8px 12px; background:#f7f7f7 } .sem b { font-size:15px }
 .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 2px 18px } .small { font-size:9.5px; color:#333 }
 svg { max-width:100%; height:auto; border:1px solid #ddd }
</style></head><body>
<h1>Cubicación orientativa de veta — ${esc(d.operacion)}</h1>
<div class="meta">Generado: ${esc(d.generadoEn ?? new Date(est.calculadoEn).toLocaleString('es-PE'))} · Calculado en el dispositivo · ${est.modelo.puntos.length} muestras con ley</div>
<div class="aviso">${ADVERTENCIA_LEGAL}</div>

<h2>Semáforo de inversión (orientativo)</h2>
<div class="sem"><b>${esc(s.titulo)}</b><br>${esc(s.detalle)}<br>
Onzas recuperables Probado + Probable: <b>${f(s.onzasRecuperablesPP)}</b> oz ·
Ingreso estimado: ${esc(p.moneda)} ${f(s.ingreso, 0)} · Costo estimado: ${esc(p.moneda)} ${f(s.costo, 0)} · Margen: ${esc(p.moneda)} ${f(s.margen, 0)}</div>
<p class="small">Depende de los parámetros editables (precio ${esc(p.moneda)} ${f(p.precioOroPorOnza, 0)}/oz, costo ${esc(p.moneda)} ${f(p.costoPorTonelada, 0)}/t, siguiente avance ${esc(p.moneda)} ${f(p.costoSiguienteAvance, 0)}). La categoría Posible no entra en el semáforo.</p>

<h2>Resultados por categoría (sobre ley de corte ${f(p.leyCorte)} g/t diluida)</h2>
<table><tr><th>Categoría</th><th>Toneladas</th><th>Ley media g/t</th><th>Gramos Au</th><th>Onzas</th><th>Gramos recup.</th><th>Onzas recup.</th></tr>
${fila('Probado', r.probado, COLOR_CATEGORIA.probado)}${fila('Probable', r.probable, COLOR_CATEGORIA.probable)}${fila('Posible', r.posible, COLOR_CATEGORIA.posible)}
${fila('Probado + Probable', r.probadoMasProbable, undefined, true)}${fila('Total', r.total, undefined, true)}
${fila('Bajo ley de corte (excluido)', r.bajoLeyCorte, '#D9D9D9')}</table>
<p class="small">${ADVERTENCIA_CATEGORIAS}</p>

<h2>Factor de planta</h2>
<p>${fp.factor != null ? `Factor calculado: <b>${f(fp.factor, 3)}</b> (planta ${f(fp.leyPlanta ?? NaN)} g/t ÷ muestras ${f(fp.leyMuestras ?? NaN)} g/t, ${fp.nLiquidaciones} liquidaciones). ` : 'Sin factor calculable. '}
${fp.aplicado ? '<b>Aplicado.</b>' : '<b>No aplicado.</b>'} ${fp.avisos.map(esc).join(' ')}
${fp.aplicado ? `Sin factor, el total sería ${f(est.resumenSinFactor.total.onzasRecuperables)} oz recuperables (con factor: ${f(r.total.onzasRecuperables)}).` : ''}</p>

<h2>Sección longitudinal y modelo de bloques</h2>
${seccionSvg(est.modelo, nombres, { mostrarBloques: true, modo: 'categoria', ancho: 900, alto: 430 })}
<p class="small"><span class="dot" style="background:${COLOR_CATEGORIA.probado}"></span>Probado <span class="dot" style="background:${COLOR_CATEGORIA.probable}"></span>Probable <span class="dot" style="background:${COLOR_CATEGORIA.posible}"></span>Posible <span class="dot" style="background:#D9D9D9"></span>Bajo ley de corte · Puntos: muestras coloreadas por ley (azul &lt; 1.5 · verde 1.5–4 · amarillo 4–8 · naranja 8–15 · rojo ≥ 15 g/t). ${ADVERTENCIA_GPS}</p>

<h2>Parámetros usados</h2>
<div class="grid2 small">
<div>Densidad: ${f(p.densidad)} t/m³</div><div>Ancho mínimo de minado: ${f(p.anchoMinimoMinado)} m</div>
<div>Celda: ${f(p.celdaLargo, 1)} × ${f(p.celdaAlto, 1)} m</div><div>Ley de corte: ${f(p.leyCorte)} g/t · Recuperación: ${f(p.recuperacionPlanta * 100, 0)} %</div>
<div>IDW potencia ${f(p.potenciaIdw, 1)} · dist. máx ${f(p.distanciaMaxInfluencia, 0)} m · máx ${p.maxMuestrasIdw} muestras${p.leyTope != null ? ` · tope ${f(p.leyTope)} g/t` : ''}</div>
<div>Alcance tras última muestra: ${f(p.alcanceMasAllaUltimaMuestra, 0)} m</div>
<div>Probado: entre galerías a ≤ ${f(p.probadoSeparacionMaxGalerias, 0)} m o a ≤ ${f(p.probadoDistanciaMuestra, 0)} m de muestra</div><div>Probable ≤ ${f(p.alturaProbable, 0)} m · Posible ≤ ${f(p.alturaPosible, 0)} m</div>
</div>
${est.modelo.avisos.length ? `<p class="small"><b>Avisos:</b> ${est.modelo.avisos.map(esc).join(' · ')}</p>` : ''}

<h2>Muestras</h2>
<table class="small"><tr><th>Código</th><th style="text-align:left">Galería</th><th>Avance m</th><th>Ancho m</th><th>Ley g/t</th><th style="text-align:left">Origen</th><th>Fecha</th></tr>
${muestrasOrden.map((m) => `<tr><td>${esc(m.codigo)}</td><td style="text-align:left">${esc(nombres.get(m.galeriaId) ?? '')}</td><td>${f(m.avanceM, 1)}</td><td>${f(m.anchoM)}</td><td>${m.leyGt == null ? 'pendiente' : f(m.leyGt)}</td><td style="text-align:left">${{ ensaye_planta: 'Ensaye planta', laboratorio: 'Laboratorio', batea: 'Batea (estimado)' }[m.origenLey]}</td><td>${esc(m.fecha.slice(0, 10))}</td></tr>`).join('')}
</table>
<div class="aviso">${ADVERTENCIA_LEGAL}</div>
</body></html>`;
}

// ---------- CSV ----------
const csvCampo = (v: unknown) => {
  const s = v == null ? '' : typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (filas: unknown[][]) => '﻿' + filas.map((r) => r.map(csvCampo).join(',')).join('\r\n');

export function csvResumen(est: Estimacion, p: Parametros): string {
  const r = est.resumen;
  const filas: unknown[][] = [[ADVERTENCIA_LEGAL], [], ['categoria', 'bloques', 'toneladas', 'ley_media_gt', 'gramos', 'onzas', 'gramos_recuperables', 'onzas_recuperables']];
  for (const [n, t] of [['probado', r.probado], ['probable', r.probable], ['posible', r.posible], ['probado_mas_probable', r.probadoMasProbable], ['total', r.total], ['bajo_ley_corte_excluido', r.bajoLeyCorte]] as const)
    filas.push([n, t.bloques, t.toneladas, t.leyMedia, t.gramos, t.onzas, t.gramosRecuperables, t.onzasRecuperables]);
  filas.push([], ['factor_planta', est.factor.factor ?? '', 'aplicado', est.factor.aplicado ? 'si' : 'no']);
  filas.push(['semaforo', est.semaforo.titulo, 'ingreso', est.semaforo.ingreso, 'costo', est.semaforo.costo, 'moneda', p.moneda]);
  filas.push([], ['parametro', 'valor'], ...Object.entries(p).map(([k, v]) => [k, v]));
  return csv(filas);
}

export function csvBloques(est: Estimacion, codigos: Map<string, string>): string {
  const filas: unknown[][] = [[ADVERTENCIA_LEGAL], ['id', 'x0_m', 'x1_m', 'cota0', 'cota1', 'categoria', 'motivo', 'dist_muestra_m', 'ley_idw_gt', 'ancho_idw_m', 'factor_planta', 'ley_diluida_gt', 'ancho_minado_m', 'toneladas', 'gramos', 'onzas', 'onzas_recuperables', 'sobre_ley_corte', 'influencias(codigo:peso%:dist_m)']];
  for (const b of est.modelo.bloques) {
    filas.push([b.id, b.x0, b.x1, b.y0, b.y1, b.categoria, b.motivoCategoria, b.distanciaMuestraMasCercana, b.leyInterpolada, b.anchoInterpolado, b.factorPlanta, b.leyDiluida, b.anchoMinado, b.toneladas, b.gramos, b.onzas, b.onzasRecuperables, b.sobreLeyCorte ? 'si' : 'no',
      b.influencias.map((i) => `${codigos.get(i.muestraId) ?? i.muestraId}:${(i.peso * 100).toFixed(1)}:${i.distancia.toFixed(1)}`).join(' | ')]);
  }
  return csv(filas);
}

export function csvMuestras(muestras: Muestra[], galerias: Galeria[], ubic: Map<string, { este: number; norte: number; cota: number; lat: number; lon: number }>): string {
  const nom = new Map(galerias.map((g) => [g.id, g.nombre]));
  const filas: unknown[][] = [['id', 'codigo', 'galeria', 'avance_m', 'ancho_m', 'ley_gt', 'origen_ley', 'este_utm', 'norte_utm', 'cota', 'lat', 'lon', 'lote_venta', 'fecha', 'observaciones']];
  for (const m of muestras.filter((x) => !x.deleted)) {
    const u = ubic.get(m.id);
    filas.push([m.id, m.codigo, nom.get(m.galeriaId), m.avanceM, m.anchoM, m.leyGt ?? 'pendiente', m.origenLey, u?.este, u?.norte, u?.cota, u?.lat, u?.lon, m.loteVentaCodigo, m.fecha, m.observaciones]);
  }
  return csv(filas);
}
