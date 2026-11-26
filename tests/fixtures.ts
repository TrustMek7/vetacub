import type { Bocamina, Galeria, Liquidacion, Muestra, Parametros } from '../src/domain/types';
import { PARAMETROS_POR_DEFECTO } from '../src/engine/params';

let n = 0;
const sync = () => ({
  id: `id-${++n}`, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  version: 1, serverVersion: 0, syncStatus: 'pendiente' as const, deleted: false,
});

export const params = (p: Partial<Parametros> = {}): Parametros => ({ ...PARAMETROS_POR_DEFECTO, ...p });

export const bocamina = (cota = 3000): Bocamina => ({
  ...sync(), operacionId: 'op', lat: -14.5, lon: -74.2, cota, rumboGrados: 45, zonaUtm: 18, hemisferio: 'S',
});

export const galeria = (nombre: string, desnivelM: number, extra: Partial<Galeria> = {}): Galeria => ({
  ...sync(), operacionId: 'op', nombre, modoDesnivel: 'acumulado', desnivelM, fecha: '2026-11-01', ...extra,
});

export const muestra = (g: Galeria, avanceM: number, leyGt: number, anchoM: number, codigo?: string): Muestra => ({
  ...sync(), operacionId: 'op', galeriaId: g.id, codigo: codigo ?? `${g.nombre}-${avanceM}`, avanceM, anchoM, leyGt,
  origenLey: 'ensaye_planta', fecha: '2026-11-01',
});

/** Muestras cada `paso` m desde `desde` hasta `hasta` con ley/ancho fijos o función. */
export const serie = (g: Galeria, desde: number, hasta: number, paso: number, ley: number | ((x: number) => number), ancho: number) => {
  const out: Muestra[] = [];
  for (let x = desde; x <= hasta + 1e-9; x += paso) out.push(muestra(g, x, typeof ley === 'function' ? ley(x) : ley, ancho));
  return out;
};

export const liquidacion = (toneladas: number, leyGt: number, codigos: string[] = []): Liquidacion => ({
  id: `liq-${++n}`, operacionId: 'op', loteCodigo: `L-${n}`, fecha: '2026-11-01', toneladas, leyGt, codigosMuestra: codigos,
});
