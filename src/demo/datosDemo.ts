// Datos de ejemplo (ficticios) para probar la app y el reporte. Se cargan desde "Más → Cargar ejemplo".
import type { Bocamina, Galeria, Liquidacion, Muestra } from '../domain/types';
import { PARAMETROS_POR_DEFECTO } from '../engine/params';

const base = (id: string) => ({
  id, createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
  version: 1, serverVersion: 0, syncStatus: 'pendiente' as const, deleted: false,
});

export function datosDemo(operacionId = 'demo-op') {
  const bocamina: Bocamina = { ...base('demo-boca'), operacionId, lat: -14.6235, lon: -74.0812, precisionGpsM: 6, cota: 2850, rumboGrados: 62, zonaUtm: 18, hemisferio: 'S' };
  const g1: Galeria = { ...base('demo-g1'), operacionId, nombre: 'Nv 2850', modoDesnivel: 'acumulado', desnivelM: 0, fecha: '2026-06-01' };
  const g2: Galeria = { ...base('demo-g2'), operacionId, nombre: 'Nv 2838', modoDesnivel: 'acumulado', desnivelM: -12, fecha: '2026-08-10' };
  const g3: Galeria = { ...base('demo-g3'), operacionId, nombre: 'Nv 2826', modoDesnivel: 'tramo', desnivelM: -12, galeriaRefId: 'demo-g2', fecha: '2026-10-05' };

  // Clavo mineralizado centrado en ~25 m, ancho variable 0.3–1.1 m.
  const ley = (x: number, nivel: number) => Math.max(0.6, 16 * Math.exp(-(((x - 25) / 14) ** 2)) * (1 - 0.15 * nivel) + ((x * 7 + nivel * 3) % 5) * 0.4);
  const ancho = (x: number, nivel: number) => Math.round((0.35 + 0.6 * Math.abs(Math.sin((x + nivel * 9) / 11))) * 100) / 100;
  const muestras: Muestra[] = [];
  const serie = (g: Galeria, nivel: number, desde: number, hasta: number) => {
    for (let x = desde, k = 1; x <= hasta; x += 3, k++) {
      muestras.push({
        ...base(`demo-m-${g.id}-${x}`), operacionId, galeriaId: g.id, codigo: `${g.nombre.replace(' ', '')}-${String(k).padStart(3, '0')}`,
        avanceM: x, anchoM: ancho(x, nivel), leyGt: Math.round(ley(x, nivel) * 100) / 100,
        origenLey: x % 9 === 0 ? 'laboratorio' : 'ensaye_planta', fecha: '2026-10-15',
      });
    }
  };
  serie(g1, 0, 3, 60);
  serie(g2, 1, 3, 45);
  serie(g3, 2, 9, 33);
  // Una muestra recién tomada, esperando el ensaye de la planta:
  muestras.push({ ...base('demo-m-pend'), operacionId, galeriaId: g3.id, codigo: 'Nv2826-010', avanceM: 36, anchoM: 0.5, leyGt: null, origenLey: 'ensaye_planta', fecha: '2026-11-20' });

  const codigos = (g: string, n: number[]) => n.map((k) => `${g}-${String(k).padStart(3, '0')}`);
  const liquidaciones: Liquidacion[] = [
    { id: 'demo-liq-1', operacionId, loteCodigo: 'L-2026-071', fecha: '2026-08-20', toneladas: 14.2, leyGt: 12.6, codigosMuestra: codigos('Nv2850', [5, 6, 7, 8, 9, 10]) },
    { id: 'demo-liq-2', operacionId, loteCodigo: 'L-2026-084', fecha: '2026-09-28', toneladas: 11.8, leyGt: 11.2, codigosMuestra: codigos('Nv2838', [6, 7, 8, 9, 10]) },
    { id: 'demo-liq-3', operacionId, loteCodigo: 'L-2026-097', fecha: '2026-11-10', toneladas: 9.5, leyGt: 9.9, codigosMuestra: codigos('Nv2826', [3, 4, 5, 6]) },
  ];
  const params = { ...PARAMETROS_POR_DEFECTO, precioOroPorOnza: 2900, costoPorTonelada: 260, costoSiguienteAvance: 6000 };
  return { operacion: { id: operacionId, nombre: 'Mina Santa Rosa (ejemplo)' }, bocamina, galerias: [g1, g2, g3], muestras, liquidaciones, params };
}
