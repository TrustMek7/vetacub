import type { Parametros } from '../domain/types';

export const PARAMETROS_POR_DEFECTO: Parametros = {
  densidad: 2.7,
  anchoMinimoMinado: 0.8,
  anchoVolumen: 'max',
  alcanceMasAllaUltimaMuestra: 10,
  celdaLargo: 2,
  celdaAlto: 2,
  leyCorte: 1.5,
  recuperacionPlanta: 0.85,
  zonaUtm: 18,
  potenciaIdw: 2,
  distanciaMaxInfluencia: 30,
  maxMuestrasIdw: 12,
  leyTope: null,
  probadoSeparacionMaxGalerias: 15,
  probadoDistanciaMuestra: 5,
  alturaProbable: 10,
  alturaPosible: 25,
  aplicarFactorPlanta: true,
  minLiquidacionesFactor: 3,
  anomaliaFactorMediana: 3,
  moneda: 'USD',
  precioOroPorOnza: 0,
  costoPorTonelada: 0,
  costoSiguienteAvance: 0,
  umbralVerde: 1.3,
  umbralAmarillo: 1.0,
  minMuestrasSemaforo: 5,
};

export interface ProblemaParametro { campo: keyof Parametros; mensaje: string; nivel: 'error' | 'aviso' }

/** Valida coherencia de parámetros. Los errores bloquean el cálculo; los avisos solo se muestran. */
export function validarParametros(p: Parametros): ProblemaParametro[] {
  const out: ProblemaParametro[] = [];
  const pos = (c: keyof Parametros, v: number) => { if (!(v > 0)) out.push({ campo: c, mensaje: 'Debe ser mayor que 0', nivel: 'error' }); };
  pos('densidad', p.densidad);
  pos('anchoMinimoMinado', p.anchoMinimoMinado);
  pos('celdaLargo', p.celdaLargo);
  pos('celdaAlto', p.celdaAlto);
  pos('potenciaIdw', p.potenciaIdw);
  pos('distanciaMaxInfluencia', p.distanciaMaxInfluencia);
  if (p.leyCorte < 0) out.push({ campo: 'leyCorte', mensaje: 'No puede ser negativa', nivel: 'error' });
  if (p.recuperacionPlanta <= 0 || p.recuperacionPlanta > 1) out.push({ campo: 'recuperacionPlanta', mensaje: 'Debe estar entre 0 y 1 (ej. 0.85)', nivel: 'error' });
  if (!(p.probadoDistanciaMuestra <= p.alturaProbable && p.alturaProbable <= p.alturaPosible))
    out.push({ campo: 'alturaPosible', mensaje: 'Debe cumplirse: distancia Probado ≤ Probable ≤ Posible', nivel: 'error' });
  if (p.distanciaMaxInfluencia < p.alturaPosible)
    out.push({ campo: 'distanciaMaxInfluencia', mensaje: 'Menor que la altura Posible: algunos bloques Posibles quedarán sin ley', nivel: 'aviso' });
  if (p.densidad < 2.2 || p.densidad > 4) out.push({ campo: 'densidad', mensaje: 'Valor inusual para veta de cuarzo-sulfuros (2.5–3.0)', nivel: 'aviso' });
  return out;
}
