// Modelo de bloques 2D sobre la sección longitudinal: x = metros desde bocamina, y = cota (msnm).
import type { Bocamina, Categoria, Galeria, Muestra, Parametros } from '../domain/types';
import { cotasGalerias } from './geo';
import { idw, type Influencia, type PuntoMuestra } from './idw';

export const ONZA_TROY_G = 31.1035;

export interface Bloque {
  id: string;
  i: number; j: number;                  // columna (x) y fila (y)
  x0: number; x1: number; y0: number; y1: number;
  xc: number; yc: number;
  categoria: Categoria;
  motivoCategoria: string;
  distanciaMuestraMasCercana: number;
  leyInterpolada: number;                // IDW (con tope si aplica)
  anchoInterpolado: number;
  factorPlanta: number;                  // 1 si no se aplica
  leyCorregida: number;                  // leyInterpolada × factor
  leyDiluida: number;
  anchoMinado: number;
  volumenM3: number;
  toneladas: number;
  gramos: number;
  onzas: number;
  gramosRecuperables: number;
  onzasRecuperables: number;
  sobreLeyCorte: boolean;
  influencias: Influencia[];
}

export interface PuntoSeccion extends PuntoMuestra { galeriaId: string; codigo: string }

export interface ModeloBloques {
  bloques: Bloque[];
  puntos: PuntoSeccion[];
  cotas: Map<string, number>;
  extension: { xMin: number; xMax: number; yMin: number; yMax: number };
  avisos: string[];
}

export interface EntradaModelo {
  bocamina: Pick<Bocamina, 'cota'>;
  galerias: Galeria[];
  muestras: Muestra[];
  params: Parametros;
  factorPlanta?: number | null;          // null/undefined = sin corrección
}

/** Dilución: si ancho < ancho mínimo, la ley se diluye con material estéril de ley 0. */
export function diluir(ley: number, anchoVeta: number, anchoMinimo: number): number {
  return anchoVeta >= anchoMinimo ? ley : ley * (anchoVeta / anchoMinimo);
}

export function construirModelo(e: EntradaModelo): ModeloBloques {
  const p = e.params;
  const avisos: string[] = [];
  const galerias = e.galerias.filter((g) => !g.deleted);
  const cotas = cotasGalerias(e.bocamina.cota, galerias);
  const muestras = e.muestras.filter((m): m is Muestra & { leyGt: number } => !m.deleted && m.leyGt != null && cotas.has(m.galeriaId));
  const pendientes = e.muestras.filter((m) => !m.deleted && m.leyGt == null).length;
  if (pendientes > 0) avisos.push(`${pendientes} muestra(s) pendientes de ensaye no entran al cálculo.`);

  const puntos: PuntoSeccion[] = muestras.map((m) => ({
    id: m.id, galeriaId: m.galeriaId, codigo: m.codigo,
    x: m.avanceM, y: cotas.get(m.galeriaId) as number, ley: m.leyGt, ancho: m.anchoM,
  }));

  const vacio: ModeloBloques = { bloques: [], puntos, cotas, extension: { xMin: 0, xMax: 0, yMin: 0, yMax: 0 }, avisos };
  if (puntos.length === 0) { avisos.push('Sin muestras: registra muestras para calcular.'); return vacio; }

  // Cobertura horizontal de cada galería con muestras (para la regla "entre dos galerías").
  const cobertura = new Map<string, { cota: number; xMin: number; xMax: number }>();
  for (const pt of puntos) {
    const c = cobertura.get(pt.galeriaId);
    if (!c) cobertura.set(pt.galeriaId, { cota: pt.y, xMin: pt.x, xMax: pt.x });
    else { c.xMin = Math.min(c.xMin, pt.x); c.xMax = Math.max(c.xMax, pt.x); }
  }
  const galsConMuestras = [...cobertura.values()].sort((a, b) => a.cota - b.cota);

  const xsMin = Math.min(...puntos.map((q) => q.x));
  const xsMax = Math.max(...puntos.map((q) => q.x));
  const ysMin = Math.min(...puntos.map((q) => q.y));
  const ysMax = Math.max(...puntos.map((q) => q.y));
  // La grilla se ancla en x = 0 (bocamina) y en la cota de bocamina, para que las galerías
  // caigan en bordes de celda cuando su desnivel es múltiplo del alto de celda.
  const y0r = e.bocamina.cota;
  const xMin = Math.max(0, Math.floor((xsMin - p.alcanceMasAllaUltimaMuestra) / p.celdaLargo) * p.celdaLargo);
  const xMax = xsMax + p.alcanceMasAllaUltimaMuestra;
  const yMin = y0r - Math.ceil((y0r - (ysMin - p.alturaPosible)) / p.celdaAlto - 1e-9) * p.celdaAlto;
  const yMax = ysMax + p.alturaPosible;
  const nx = Math.ceil((xMax - xMin) / p.celdaLargo - 1e-9);
  const ny = Math.ceil((yMax - yMin) / p.celdaAlto - 1e-9);
  if (nx * ny > 200000) { avisos.push('Demasiadas celdas: aumenta el tamaño de celda.'); return { ...vacio, extension: { xMin, xMax, yMin, yMax } }; }

  const factor = e.factorPlanta && e.factorPlanta > 0 ? e.factorPlanta : 1;
  const tol = p.probadoDistanciaMuestra;
  const entreGalerias = (x: number, y: number): boolean => {
    for (let a = 0; a < galsConMuestras.length; a++) {
      const ga = galsConMuestras[a];
      if (ga.cota > y) break;
      for (let b = a + 1; b < galsConMuestras.length; b++) {
        const gb = galsConMuestras[b];
        if (gb.cota < y) continue;
        if (gb.cota - ga.cota > p.probadoSeparacionMaxGalerias) break;
        const dentro = (g: typeof ga) => x >= g.xMin - tol && x <= g.xMax + tol;
        if (dentro(ga) && dentro(gb)) return true;
      }
    }
    return false;
  };

  const bloques: Bloque[] = [];
  let sinLey = 0;
  for (let i = 0; i < nx; i++) {
    const x0 = xMin + i * p.celdaLargo;
    const x1 = Math.min(x0 + p.celdaLargo, xMax);
    const xc = (x0 + x1) / 2;
    for (let j = 0; j < ny; j++) {
      const y0 = yMin + j * p.celdaAlto;
      const y1 = Math.min(y0 + p.celdaAlto, yMax);
      const yc = (y0 + y1) / 2;

      let dMin = Infinity;
      for (const q of puntos) dMin = Math.min(dMin, Math.hypot(q.x - xc, q.y - yc));

      let categoria: Categoria | null = null;
      let motivo = '';
      if (entreGalerias(xc, yc)) { categoria = 'probado'; motivo = 'Entre dos galerías con muestras'; }
      else if (dMin <= p.probadoDistanciaMuestra) { categoria = 'probado'; motivo = `A ≤ ${p.probadoDistanciaMuestra} m de una muestra`; }
      else if (dMin <= p.alturaProbable) { categoria = 'probable'; motivo = `A ≤ ${p.alturaProbable} m de una muestra`; }
      else if (dMin <= p.alturaPosible) { categoria = 'posible'; motivo = `A ≤ ${p.alturaPosible} m de una muestra`; }
      if (!categoria) continue;

      const est = idw(xc, yc, puntos, { potencia: p.potenciaIdw, distanciaMax: p.distanciaMaxInfluencia, maxMuestras: p.maxMuestrasIdw, leyTope: p.leyTope });
      if (!est) { sinLey++; continue; }

      const leyCorregida = est.ley * factor;
      const leyDiluida = diluir(leyCorregida, est.ancho, p.anchoMinimoMinado);
      const anchoMinado = p.anchoVolumen === 'max' ? Math.max(est.ancho, p.anchoMinimoMinado) : p.anchoMinimoMinado;
      const largo = x1 - x0, alto = y1 - y0;
      const volumenM3 = largo * alto * anchoMinado;
      const toneladas = volumenM3 * p.densidad;
      const gramos = toneladas * leyDiluida;
      bloques.push({
        id: `${i}_${j}`, i, j, x0, x1, y0, y1, xc, yc,
        categoria, motivoCategoria: motivo, distanciaMuestraMasCercana: dMin,
        leyInterpolada: est.ley, anchoInterpolado: est.ancho, factorPlanta: factor,
        leyCorregida, leyDiluida, anchoMinado, volumenM3, toneladas, gramos,
        onzas: gramos / ONZA_TROY_G,
        gramosRecuperables: gramos * p.recuperacionPlanta,
        onzasRecuperables: (gramos * p.recuperacionPlanta) / ONZA_TROY_G,
        sobreLeyCorte: leyDiluida >= p.leyCorte,
        influencias: est.influencias,
      });
    }
  }
  if (sinLey > 0) avisos.push(`${sinLey} bloque(s) sin muestras dentro de la distancia máxima de influencia: no se estimaron.`);
  return { bloques, puntos, cotas, extension: { xMin, xMax, yMin, yMax }, avisos };
}
