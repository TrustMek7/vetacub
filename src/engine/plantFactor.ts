// Factor de planta = ley ponderada de liquidaciones / ley ponderada de muestras.
import type { Liquidacion, Muestra, Parametros } from '../domain/types';

export interface FactorPlanta {
  factor: number | null;        // calculado (aunque no se aplique)
  aplicado: boolean;            // se usa en el cálculo
  nLiquidaciones: number;       // representativas
  leyPlanta: number | null;     // ponderada por toneladas
  leyMuestras: number | null;   // ponderada por ancho de veta
  muestrasUsadas: 'vinculadas' | 'todas' | 'ninguna';
  avisos: string[];
}

export function calcularFactorPlanta(
  liquidaciones: Liquidacion[],
  muestras: Pick<Muestra, 'codigo' | 'leyGt' | 'anchoM' | 'deleted'>[],
  p: Pick<Parametros, 'aplicarFactorPlanta' | 'minLiquidacionesFactor'>,
): FactorPlanta {
  const avisos: string[] = [];
  const rep = liquidaciones.filter((l) => l.toneladas > 0 && l.leyGt > 0);
  const vivas = muestras.filter((m): m is typeof m & { leyGt: number } => !m.deleted && m.anchoM > 0 && m.leyGt != null && m.leyGt >= 0);
  const t = rep.reduce((s, l) => s + l.toneladas, 0);
  const leyPlanta = t > 0 ? rep.reduce((s, l) => s + l.leyGt * l.toneladas, 0) / t : null;

  // Preferir muestras vinculadas por código a las liquidaciones; si no hay vínculos, todas.
  const codigos = new Set(rep.flatMap((l) => l.codigosMuestra ?? []));
  const vinculadas = vivas.filter((m) => codigos.has(m.codigo));
  const base = vinculadas.length > 0 ? vinculadas : vivas;
  const muestrasUsadas: FactorPlanta['muestrasUsadas'] = base.length === 0 ? 'ninguna' : vinculadas.length > 0 ? 'vinculadas' : 'todas';
  const sa = base.reduce((s, m) => s + m.anchoM, 0);
  const leyMuestras = sa > 0 ? base.reduce((s, m) => s + m.leyGt * m.anchoM, 0) / sa : null;

  const factor = leyPlanta != null && leyMuestras != null && leyMuestras > 0 ? leyPlanta / leyMuestras : null;
  let aplicado = false;
  if (rep.length < p.minLiquidacionesFactor) {
    avisos.push(`Solo hay ${rep.length} liquidación(es) representativa(s); se necesitan ${p.minLiquidacionesFactor}. No se aplica corrección.`);
  } else if (factor == null) {
    avisos.push('No hay muestras con ley para comparar. No se aplica corrección.');
  } else if (!p.aplicarFactorPlanta) {
    avisos.push('Factor de planta desactivado por el usuario.');
  } else {
    aplicado = true;
  }
  if (factor != null && (factor < 0.4 || factor > 2.5)) {
    avisos.push(`Factor ${factor.toFixed(2)} muy lejos de 1: revisa que las muestras representen el mineral vendido.`);
  }
  if (muestrasUsadas === 'todas' && rep.length > 0) {
    avisos.push('Ninguna liquidación tiene códigos de muestra vinculados; se comparó con todas las muestras.');
  }
  return { factor, aplicado, nLiquidaciones: rep.length, leyPlanta, leyMuestras, muestrasUsadas, avisos };
}
