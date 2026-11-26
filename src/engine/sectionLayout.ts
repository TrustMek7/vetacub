// Geometría de dibujo de la sección longitudinal y del modelo de bloques.
// Se usa en pantalla (react-native-svg) y para generar SVG en texto (PDF / imagen exportada).
import type { Categoria } from '../domain/types';
import type { Bloque, ModeloBloques } from './blockModel';

export const COLOR_CATEGORIA: Record<Categoria, string> = {
  probado: '#1B7F3B',
  probable: '#E0A800',
  posible: '#8A8F98',
};
export const COLOR_BAJO_CORTE = '#D9D9D9';

/** Escala de ley (g/t) de azul a rojo, 5 tramos fijos para que el minero los aprenda. */
export const RANGOS_LEY: { max: number; color: string; etiqueta: string }[] = [
  { max: 1.5, color: '#3B6FB6', etiqueta: '< 1.5' },
  { max: 4, color: '#3FA796', etiqueta: '1.5–4' },
  { max: 8, color: '#F2C14E', etiqueta: '4–8' },
  { max: 15, color: '#F08A24', etiqueta: '8–15' },
  { max: Infinity, color: '#C8102E', etiqueta: '≥ 15' },
];
export const colorLey = (l: number) => (RANGOS_LEY.find((r) => l < r.max) ?? RANGOS_LEY[RANGOS_LEY.length - 1]).color;

export interface Lienzo { ancho: number; alto: number; margen: { izq: number; der: number; sup: number; inf: number } }

export interface Escala {
  sx: (x: number) => number;
  sy: (y: number) => number;
  xMin: number; xMax: number; yMin: number; yMax: number;
  ticksX: number[]; ticksY: number[];
}

function ticks(min: number, max: number, n = 6): number[] {
  const paso0 = (max - min) / n || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
  const paso = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= paso0) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function escalaSeccion(m: ModeloBloques, l: Lienzo): Escala {
  const e = m.extension;
  const xMin = Math.min(0, e.xMin), xMax = Math.max(e.xMax, 10);
  const yMin = e.yMin, yMax = e.yMax > e.yMin ? e.yMax : e.yMin + 10;
  const w = l.ancho - l.margen.izq - l.margen.der;
  const h = l.alto - l.margen.sup - l.margen.inf;
  return {
    xMin, xMax, yMin, yMax,
    sx: (x) => l.margen.izq + ((x - xMin) / (xMax - xMin)) * w,
    sy: (y) => l.margen.sup + (1 - (y - yMin) / (yMax - yMin)) * h,
    ticksX: ticks(xMin, xMax), ticksY: ticks(yMin, yMax),
  };
}

export type ModoColor = 'categoria' | 'ley';
export function colorBloque(b: Bloque, modo: ModoColor): string {
  if (!b.sobreLeyCorte) return COLOR_BAJO_CORTE;
  return modo === 'categoria' ? COLOR_CATEGORIA[b.categoria] : colorLey(b.leyDiluida);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** SVG autocontenido: bloques (opcional), galerías, muestras con ley y ancho, ejes. */
export function seccionSvg(
  m: ModeloBloques,
  nombresGaleria: Map<string, string>,
  opts: { ancho?: number; alto?: number; mostrarBloques?: boolean; modo?: ModoColor } = {},
): string {
  const l: Lienzo = { ancho: opts.ancho ?? 900, alto: opts.alto ?? 480, margen: { izq: 64, der: 20, sup: 20, inf: 48 } };
  const s = escalaSeccion(m, l);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${l.ancho}" height="${l.alto}" viewBox="0 0 ${l.ancho} ${l.alto}" font-family="Helvetica, Arial, sans-serif" font-size="11">`);
  out.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  if (opts.mostrarBloques) {
    for (const b of m.bloques) {
      const x = s.sx(b.x0), y = s.sy(b.y1);
      out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(s.sx(b.x1) - x).toFixed(1)}" height="${(s.sy(b.y0) - y).toFixed(1)}" fill="${colorBloque(b, opts.modo ?? 'categoria')}" fill-opacity="0.75" stroke="#fff" stroke-width="0.3"/>`);
    }
  }
  for (const t of s.ticksX) out.push(`<line x1="${s.sx(t)}" x2="${s.sx(t)}" y1="${l.margen.sup}" y2="${l.alto - l.margen.inf}" stroke="#eee"/><text x="${s.sx(t)}" y="${l.alto - l.margen.inf + 16}" text-anchor="middle" fill="#333">${t}</text>`);
  for (const t of s.ticksY) out.push(`<line x1="${l.margen.izq}" x2="${l.ancho - l.margen.der}" y1="${s.sy(t)}" y2="${s.sy(t)}" stroke="#eee"/><text x="${l.margen.izq - 6}" y="${s.sy(t) + 4}" text-anchor="end" fill="#333">${t}</text>`);
  out.push(`<text x="${(l.ancho) / 2}" y="${l.alto - 8}" text-anchor="middle" fill="#000" font-weight="bold">Metros desde bocamina</text>`);
  out.push(`<text x="14" y="${l.alto / 2}" transform="rotate(-90 14 ${l.alto / 2})" text-anchor="middle" fill="#000" font-weight="bold">Cota (msnm)</text>`);
  // Galerías: línea horizontal desde la bocamina hasta la última muestra.
  const xFinal = new Map<string, number>();
  for (const p of m.puntos) xFinal.set(p.galeriaId, Math.max(xFinal.get(p.galeriaId) ?? 0, p.x));
  for (const [gid, cota] of m.cotas) {
    const xf = xFinal.get(gid) ?? 0;
    out.push(`<line x1="${s.sx(0)}" x2="${s.sx(xf)}" y1="${s.sy(cota)}" y2="${s.sy(cota)}" stroke="#222" stroke-width="3"/>`);
    out.push(`<text x="${s.sx(0) + 4}" y="${s.sy(cota) - 6}" fill="#000" font-weight="bold">${esc(nombresGaleria.get(gid) ?? '')} (${cota.toFixed(1)})</text>`);
  }
  // Etiquetas de ley solo si hay espacio horizontal suficiente entre muestras (≥ 34 px).
  const minSep = Math.min(...[...new Set(m.puntos.map((p) => p.galeriaId))].map((g) => {
    const xs = m.puntos.filter((p) => p.galeriaId === g).map((p) => s.sx(p.x)).sort((a, b) => a - b);
    return xs.slice(1).reduce((mn, x, i) => Math.min(mn, x - xs[i]), Infinity);
  }));
  for (const p of m.puntos) {
    out.push(`<circle cx="${s.sx(p.x).toFixed(1)}" cy="${s.sy(p.y).toFixed(1)}" r="4.5" fill="${colorLey(p.ley)}" stroke="#000"/>`);
    if (minSep >= 34) out.push(`<text x="${s.sx(p.x).toFixed(1)}" y="${(s.sy(p.y) + 15).toFixed(1)}" text-anchor="middle" font-size="9" fill="#000" stroke="#fff" stroke-width="2.5" paint-order="stroke">${p.ley}</text>`);
  }
  out.push(`</svg>`);
  return out.join('');
}
