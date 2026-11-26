// Descarga de teselas para uso offline (se hace en la ciudad / con señal, antes de subir a la mina).
// IMPORTANTE: usar un servidor de teselas propio o con licencia que permita descarga para uso offline.
// Los servidores públicos de OpenStreetMap PROHÍBEN la descarga masiva (tile.openstreetmap.org).
import * as FileSystem from 'expo-file-system/legacy';

export const DIR_TESELAS = `${FileSystem.documentDirectory}tiles/`;

const lon2x = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export function listaTeselas(lat: number, lon: number, radioM: number, zMin: number, zMax: number) {
  const dLat = radioM / 111320;
  const dLon = radioM / (111320 * Math.cos((lat * Math.PI) / 180));
  const out: { z: number; x: number; y: number }[] = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2x(lon - dLon, z), x1 = lon2x(lon + dLon, z);
    const y0 = lat2y(lat + dLat, z), y1 = lat2y(lat - dLat, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  }
  return out;
}

export async function descargarTeselas(
  plantilla: string, lat: number, lon: number,
  o: { radioM?: number; zMin?: number; zMax?: number; onProgreso?: (hechas: number, total: number) => void } = {},
): Promise<{ total: number; ok: number; fallidas: number }> {
  const lista = listaTeselas(lat, lon, o.radioM ?? 1500, o.zMin ?? 12, o.zMax ?? 17);
  let ok = 0, fallidas = 0, hechas = 0;
  const cola = [...lista];
  const trabajador = async () => {
    for (let t = cola.shift(); t; t = cola.shift()) {
      const dir = `${DIR_TESELAS}${t.z}/${t.x}/`;
      const destino = `${dir}${t.y}.png`;
      try {
        const info = await FileSystem.getInfoAsync(destino);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
          const url = plantilla.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
          const r = await FileSystem.downloadAsync(url, destino);
          if (r.status !== 200) { await FileSystem.deleteAsync(destino, { idempotent: true }); throw new Error(String(r.status)); }
        }
        ok++;
      } catch { fallidas++; }
      o.onProgreso?.(++hechas, lista.length);
    }
  };
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
  return { total: lista.length, ok, fallidas };
}

export async function hayTeselas(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(DIR_TESELAS);
  return info.exists;
}
