// Motor de sincronización del cliente. Independiente de SQLite y de la red:
// recibe un AlmacenSync (implementado sobre SQLite en src/db/syncStore.ts) y un TransporteSync (HTTP).
import type { RegistroPush, RegistroRemoto, RespuestaPull, RespuestaPush, SolicitudPush, TablaRemota, TablaSync } from './protocol';
import type { SyncStatus } from '../domain/types';

export interface RegistroLocal {
  tabla: TablaSync;
  id: string;
  version: number;
  serverVersion: number;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
  datos: Record<string, unknown>;
}

export interface Conflicto {
  tabla: TablaSync;
  id: string;
  local: RegistroLocal;
  servidor: RegistroRemoto;
  /** Sugerencia por última modificación; el usuario confirma. */
  sugerencia: 'local' | 'servidor';
  detectadoEn: string;
}

export interface AlmacenSync {
  pendientes(limite: number): Promise<RegistroLocal[]>;        // syncStatus pendiente o error, sin conflicto abierto
  obtener(tabla: TablaRemota, id: string): Promise<RegistroLocal | null>;
  /** Marca sincronizado SOLO si la versión local sigue siendo `version` (si se editó mientras subía, queda pendiente). */
  confirmar(tabla: TablaSync, id: string, version: number, serverVersion: number): Promise<void>;
  marcarError(tabla: TablaSync, id: string, error: string): Promise<void>;
  guardarConflicto(c: Conflicto): Promise<void>;
  eliminarConflicto(tabla: TablaSync, id: string): Promise<void>;
  /** Escribe el registro del servidor como sincronizado (upsert por id). */
  aplicarRemoto(r: RegistroRemoto): Promise<void>;
  /** Fija la base del servidor para reenviar la versión local (el usuario eligió "mantener mío"). */
  rebasar(tabla: TablaSync, id: string, serverVersion: number): Promise<void>;
  getMeta(clave: string): Promise<string | null>;
  setMeta(clave: string, valor: string | null): Promise<void>;
}

export interface TransporteSync {
  push(s: SolicitudPush): Promise<RespuestaPush>;
  pull(desde: number): Promise<RespuestaPull>;
}

export interface ResumenSync {
  subidos: number; conflictos: number; errores: number; bajados: number; lotes: number;
  fallo?: string;
}

const sugerir = (local: { updatedAt: string }, srv: { updatedAt: string }): 'local' | 'servidor' =>
  local.updatedAt >= srv.updatedAt ? 'local' : 'servidor';

export async function sincronizar(
  a: AlmacenSync,
  t: TransporteSync,
  o: { deviceId: string; uuid: () => string; tamLote?: number; maxLotes?: number; ahora?: () => string },
): Promise<ResumenSync> {
  const tam = o.tamLote ?? 50;
  const ahora = o.ahora ?? (() => new Date().toISOString());
  const r: ResumenSync = { subidos: 0, conflictos: 0, errores: 0, bajados: 0, lotes: 0 };
  const enConflicto = new Set<string>(); // evita contar dos veces el mismo conflicto (push y pull)
  try {
    // 1) PUSH por lotes
    for (let n = 0; n < (o.maxLotes ?? 1000); n++) {
      const regs = await a.pendientes(tam);
      if (regs.length === 0) break;
      const firma = regs.map((x) => `${x.tabla}:${x.id}:${x.version}`).join('|');
      // Reusar el loteId si se reintenta exactamente el mismo lote (respuesta perdida, app cerrada, etc.)
      const previo = await a.getMeta('loteEnCurso');
      let loteId = o.uuid();
      if (previo) { const p = JSON.parse(previo) as { loteId: string; firma: string }; if (p.firma === firma) loteId = p.loteId; }
      await a.setMeta('loteEnCurso', JSON.stringify({ loteId, firma }));

      const registros: RegistroPush[] = regs.map((x) => ({
        tabla: x.tabla, id: x.id, version: x.version, baseServerVersion: x.serverVersion,
        updatedAt: x.updatedAt, deleted: x.deleted, datos: x.datos,
      }));
      const resp = await t.push({ deviceId: o.deviceId, loteId, registros });
      r.lotes++;
      for (const res of resp.resultados) {
        const local = regs.find((x) => x.tabla === res.tabla && x.id === res.id);
        if (!local) continue;
        if (res.estado === 'ok') { await a.confirmar(res.tabla, res.id, local.version, res.serverVersion); r.subidos++; }
        else if (res.estado === 'conflicto') {
          await a.guardarConflicto({ tabla: res.tabla, id: res.id, local, servidor: res.servidor, sugerencia: sugerir(local, res.servidor), detectadoEn: ahora() });
          enConflicto.add(`${res.tabla}:${res.id}`);
          r.conflictos++;
        } else { await a.marcarError(res.tabla, res.id, res.error); r.errores++; }
      }
      await a.setMeta('loteEnCurso', null);
      if (regs.length < tam) break;
    }

    // 2) PULL incremental por cursor (incluye liquidaciones del sistema de planta)
    let cursor = Number((await a.getMeta('cursorPull')) ?? '0');
    for (;;) {
      const p = await t.pull(cursor);
      for (const rem of p.registros) {
        const local = await a.obtener(rem.tabla, rem.id);
        if (rem.tabla === 'liquidacion' || !local) { await a.aplicarRemoto(rem); r.bajados++; continue; }
        if (rem.serverVersion <= local.serverVersion) continue; // eco de lo que ya tenemos
        if (local.syncStatus === 'sincronizado') { await a.aplicarRemoto(rem); r.bajados++; continue; }
        const tabla = rem.tabla as TablaSync;
        if (enConflicto.has(`${tabla}:${rem.id}`)) continue;
        enConflicto.add(`${tabla}:${rem.id}`);
        await a.guardarConflicto({ tabla, id: rem.id, local, servidor: rem, sugerencia: sugerir(local, rem), detectadoEn: ahora() });
        r.conflictos++;
      }
      cursor = p.cursor;
      await a.setMeta('cursorPull', String(cursor));
      if (!p.hayMas) break;
    }
  } catch (e) {
    r.fallo = e instanceof Error ? e.message : String(e);
  }
  return r;
}

/** Aplica la decisión del usuario sobre un conflicto. */
export async function resolverConflicto(a: AlmacenSync, c: Conflicto, eleccion: 'local' | 'servidor'): Promise<void> {
  if (eleccion === 'servidor') await a.aplicarRemoto(c.servidor);
  else await a.rebasar(c.tabla, c.id, c.servidor.serverVersion); // queda pendiente y se reenvía con la base correcta
  await a.eliminarConflicto(c.tabla, c.id);
}
