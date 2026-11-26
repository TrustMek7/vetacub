// Resumen por categoría, semáforo de inversión y orquestación del cálculo completo.
import type { Bocamina, Categoria, Galeria, Liquidacion, Muestra, Parametros } from '../domain/types';
import { construirModelo, ONZA_TROY_G, type Bloque, type ModeloBloques } from './blockModel';
import { calcularFactorPlanta, type FactorPlanta } from './plantFactor';
import { validarParametros, type ProblemaParametro } from './params';

export interface TotalCategoria {
  bloques: number;
  toneladas: number;
  leyMedia: number;            // ley diluida media ponderada por toneladas
  gramos: number;
  onzas: number;
  gramosRecuperables: number;
  onzasRecuperables: number;
}

export interface Resumen {
  probado: TotalCategoria;
  probable: TotalCategoria;
  posible: TotalCategoria;
  probadoMasProbable: TotalCategoria;
  total: TotalCategoria;
  bajoLeyCorte: TotalCategoria;   // informativo: NO se suma a los totales
}

const cero = (): TotalCategoria => ({ bloques: 0, toneladas: 0, leyMedia: 0, gramos: 0, onzas: 0, gramosRecuperables: 0, onzasRecuperables: 0 });

function sumar(bs: Bloque[]): TotalCategoria {
  const t = cero();
  for (const b of bs) {
    t.bloques++; t.toneladas += b.toneladas; t.gramos += b.gramos; t.gramosRecuperables += b.gramosRecuperables;
  }
  t.onzas = t.gramos / ONZA_TROY_G;
  t.onzasRecuperables = t.gramosRecuperables / ONZA_TROY_G;
  t.leyMedia = t.toneladas > 0 ? t.gramos / t.toneladas : 0;
  return t;
}

export function resumir(bloques: Bloque[]): Resumen {
  const validos = bloques.filter((b) => b.sobreLeyCorte);
  const por = (c: Categoria) => validos.filter((b) => b.categoria === c);
  return {
    probado: sumar(por('probado')),
    probable: sumar(por('probable')),
    posible: sumar(por('posible')),
    probadoMasProbable: sumar(validos.filter((b) => b.categoria !== 'posible')),
    total: sumar(validos),
    bajoLeyCorte: sumar(bloques.filter((b) => !b.sobreLeyCorte)),
  };
}

export type EstadoSemaforo = 'seguir' | 'revisar' | 'no_conviene' | 'sin_datos';

export interface Semaforo {
  estado: EstadoSemaforo;
  titulo: string;
  detalle: string;
  onzasRecuperablesPP: number;
  ingreso: number;
  costo: number;
  margen: number;
  relacion: number | null;     // ingreso / costo
}

export const TITULOS_SEMAFORO: Record<EstadoSemaforo, string> = {
  seguir: 'Vale la pena seguir',
  revisar: 'Revisar',
  no_conviene: 'No conviene con los datos actuales',
  sin_datos: 'Faltan datos',
};

/** Solo usa Probado + Probable (Posible no entra en la decisión). */
export function evaluarInversion(r: Resumen, p: Parametros, nMuestras: number): Semaforo {
  const oz = r.probadoMasProbable.onzasRecuperables;
  const ingreso = oz * p.precioOroPorOnza;
  const costo = r.probadoMasProbable.toneladas * p.costoPorTonelada + p.costoSiguienteAvance;
  const margen = ingreso - costo;
  const base = { onzasRecuperablesPP: oz, ingreso, costo, margen };
  if (p.precioOroPorOnza <= 0 || costo <= 0) {
    return { ...base, relacion: null, estado: 'sin_datos', titulo: TITULOS_SEMAFORO.sin_datos, detalle: 'Ingresa el precio que te paga la planta por onza y tus costos para ver el semáforo.' };
  }
  const relacion = ingreso / costo;
  let estado: EstadoSemaforo = relacion >= p.umbralVerde ? 'seguir' : relacion >= p.umbralAmarillo ? 'revisar' : 'no_conviene';
  let detalle = `Ingreso estimado ${relacion.toFixed(2)}× el costo (Probado + Probable).`;
  if (nMuestras < p.minMuestrasSemaforo && estado === 'seguir') {
    estado = 'revisar';
    detalle += ` Solo ${nMuestras} muestras: toma más antes de invertir.`;
  }
  return { ...base, relacion, estado, titulo: TITULOS_SEMAFORO[estado], detalle };
}

export interface DatosOperacion {
  bocamina: Bocamina;
  galerias: Galeria[];
  muestras: Muestra[];
  liquidaciones: Liquidacion[];
  params: Parametros;
}

export interface Estimacion {
  modelo: ModeloBloques;
  resumen: Resumen;
  semaforo: Semaforo;
  factor: FactorPlanta;
  /** Resultado sin factor de planta, para mostrar su impacto. */
  resumenSinFactor: Resumen;
  problemasParametros: ProblemaParametro[];
  calculadoEn: string;
}

/** Punto de entrada único: todo se calcula en el dispositivo. */
export function estimar(d: DatosOperacion): Estimacion {
  const problemas = validarParametros(d.params);
  if (problemas.some((x) => x.nivel === 'error')) throw new Error('Parámetros inválidos: ' + problemas.filter((x) => x.nivel === 'error').map((x) => `${x.campo}: ${x.mensaje}`).join('; '));
  const factor = calcularFactorPlanta(d.liquidaciones, d.muestras, d.params);
  const base = { bocamina: d.bocamina, galerias: d.galerias, muestras: d.muestras, params: d.params };
  const modelo = construirModelo({ ...base, factorPlanta: factor.aplicado ? factor.factor : null });
  const resumen = resumir(modelo.bloques);
  const resumenSinFactor = factor.aplicado ? resumir(construirModelo({ ...base, factorPlanta: null }).bloques) : resumen;
  const nMuestras = d.muestras.filter((m) => !m.deleted && m.leyGt != null).length;
  return {
    modelo, resumen, resumenSinFactor, factor,
    semaforo: evaluarInversion(resumen, d.params, nMuestras),
    problemasParametros: problemas,
    calculadoEn: new Date().toISOString(),
  };
}
