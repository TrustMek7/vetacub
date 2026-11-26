// Conversión WGS84 <-> UTM (Transversa de Mercator, series de Snyder) y ubicación aproximada de muestras.
import type { Bocamina, Galeria, Hemisferio } from '../domain/types';

const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const RAD = Math.PI / 180;

export interface Utm { este: number; norte: number; zona: number; hemisferio: Hemisferio }

export function zonaSugerida(lon: number): number {
  return Math.floor((lon + 180) / 6) + 1;
}

function meridianoCentral(zona: number): number {
  return ((zona - 1) * 6 - 180 + 3) * RAD;
}

export function latLonAUtm(lat: number, lon: number, zona: number, hemisferio: Hemisferio): Utm {
  const phi = lat * RAD;
  const lam = lon * RAD;
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const N = A / Math.sqrt(1 - E2 * s * s);
  const T = t * t;
  const C = EP2 * c * c;
  const Aa = c * (lam - meridianoCentral(zona));
  const e4 = E2 * E2, e6 = e4 * E2;
  const M = A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi));
  const este = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
  let norte = K0 * (M + N * t * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
  if (hemisferio === 'S') norte += 10000000;
  return { este, norte, zona, hemisferio };
}

export function utmALatLon(este: number, norte: number, zona: number, hemisferio: Hemisferio): { lat: number; lon: number } {
  const x = este - 500000;
  const y = hemisferio === 'S' ? norte - 10000000 : norte;
  const e4 = E2 * E2, e6 = e4 * E2;
  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s1 = Math.sin(phi1), c1 = Math.cos(phi1), t1 = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - E2 * s1 * s1);
  const T1 = t1 * t1;
  const C1 = EP2 * c1 * c1;
  const R1 = A * (1 - E2) / Math.pow(1 - E2 * s1 * s1, 1.5);
  const D = x / (N1 * K0);
  const phi = phi1 - (N1 * t1 / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lam = meridianoCentral(zona) + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / c1;
  return { lat: phi / RAD, lon: lam / RAD };
}

/**
 * Cota de cada galería. 'acumulado' = cota_bocamina + desnivel.
 * 'tramo' = cota de la galería de referencia (o bocamina) + desnivel. Detecta referencias circulares.
 */
export function cotasGalerias(cotaBocamina: number, galerias: Pick<Galeria, 'id' | 'modoDesnivel' | 'desnivelM' | 'galeriaRefId'>[]): Map<string, number> {
  const porId = new Map(galerias.map((g) => [g.id, g]));
  const res = new Map<string, number>();
  const resolver = (id: string, visitando: Set<string>): number => {
    const ya = res.get(id);
    if (ya !== undefined) return ya;
    const g = porId.get(id);
    if (!g) throw new Error(`Galería de referencia no encontrada: ${id}`);
    if (visitando.has(id)) throw new Error('Referencia circular entre galerías (desnivel por tramo)');
    visitando.add(id);
    let cota: number;
    if (g.modoDesnivel === 'acumulado' || !g.galeriaRefId) cota = cotaBocamina + g.desnivelM;
    else cota = resolver(g.galeriaRefId, visitando) + g.desnivelM;
    res.set(id, cota);
    return cota;
  };
  for (const g of galerias) resolver(g.id, new Set());
  return res;
}

export interface UbicacionMuestra { este: number; norte: number; cota: number; lat: number; lon: number }

/** Este = E0 + avance·sin(rumbo); Norte = N0 + avance·cos(rumbo); Cota = cota de su galería. */
export function ubicarMuestra(boca: Pick<Bocamina, 'lat' | 'lon' | 'rumboGrados' | 'zonaUtm' | 'hemisferio'>, avanceM: number, cota: number): UbicacionMuestra {
  const b = latLonAUtm(boca.lat, boca.lon, boca.zonaUtm, boca.hemisferio);
  const r = boca.rumboGrados * RAD;
  const este = b.este + avanceM * Math.sin(r);
  const norte = b.norte + avanceM * Math.cos(r);
  const ll = utmALatLon(este, norte, boca.zonaUtm, boca.hemisferio);
  return { este, norte, cota, lat: ll.lat, lon: ll.lon };
}
