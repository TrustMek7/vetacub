// Implementación SQLite del AlmacenSync que usa el motor de sincronización.
import type { DB } from './database';
import { aEntidad, aFila, datosNegocio, TABLAS } from './schema';
import { getMeta, setMeta } from './repos';
import type { AlmacenSync, Conflicto, RegistroLocal } from '../sync/syncEngine';
import type { RegistroRemoto, TablaRemota, TablaSync } from '../sync/protocol';
import type { Sincronizable } from '../domain/types';

const TABLAS_SYNC = Object.keys(TABLAS) as TablaSync[];

function aLocal(tabla: TablaSync, fila: Record<string, unknown>): RegistroLocal {
  const e = aEntidad<Sincronizable & Record<string, unknown>>(tabla, fila);
  return { tabla, id: e.id, version: e.version, serverVersion: e.serverVersion, updatedAt: e.updatedAt, deleted: e.deleted, syncStatus: e.syncStatus, datos: datosNegocio(tabla, e) };
}

export function almacenSqlite(db: DB): AlmacenSync {
  return {
    async pendientes(limite) {
      const out: RegistroLocal[] = [];
      // Orden padre → hijo para que el servidor reciba primero operación, bocamina, galerías y luego muestras.
      for (const t of ['operacion', 'parametros', 'bocamina', 'galeria', 'muestra'] as TablaSync[]) {
        if (out.length >= limite) break;
        const filas = await db.getAllAsync<Record<string, unknown>>(
          `SELECT * FROM ${t} WHERE sync_status IN ('pendiente','error') AND id NOT IN (SELECT id FROM sync_conflicto WHERE tabla = ?) ORDER BY updated_at LIMIT ?`,
          [t, limite - out.length]);
        out.push(...filas.map((f) => aLocal(t, f)));
      }
      return out;
    },
    async obtener(tabla: TablaRemota, id) {
      if (tabla === 'liquidacion') return null;
      const f = await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${tabla} WHERE id = ?`, [id]);
      return f ? aLocal(tabla, f) : null;
    },
    async confirmar(tabla, id, version, serverVersion) {
      await db.runAsync(`UPDATE ${tabla} SET server_version = ?, sync_status = CASE WHEN version = ? THEN 'sincronizado' ELSE 'pendiente' END, sync_error = NULL WHERE id = ?`, [serverVersion, version, id]);
    },
    async marcarError(tabla, id, error) {
      await db.runAsync(`UPDATE ${tabla} SET sync_status = 'error', sync_error = ? WHERE id = ?`, [error, id]);
    },
    async guardarConflicto(c: Conflicto) {
      await db.runAsync('INSERT OR REPLACE INTO sync_conflicto (tabla, id, json) VALUES (?, ?, ?)', [c.tabla, c.id, JSON.stringify(c)]);
    },
    async eliminarConflicto(tabla, id) {
      await db.runAsync('DELETE FROM sync_conflicto WHERE tabla = ? AND id = ?', [tabla, id]);
    },
    async aplicarRemoto(r: RegistroRemoto) {
      if (r.tabla === 'liquidacion') {
        const d = r.datos as Record<string, unknown>;
        await db.runAsync(`INSERT OR REPLACE INTO liquidacion (id, operacion_id, lote_codigo, fecha, toneladas, ley_gt, codigos_muestra, server_version, updated_at, deleted) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [r.id, String(d.operacionId), String(d.loteCodigo), String(d.fecha), Number(d.toneladas), Number(d.leyGt), JSON.stringify(d.codigosMuestra ?? []), r.serverVersion, r.updatedAt, r.deleted ? 1 : 0]);
        return;
      }
      const previo = await db.getFirstAsync<{ created_at: string; version: number }>(`SELECT created_at, version FROM ${r.tabla} WHERE id = ?`, [r.id]);
      const e = { ...r.datos, id: r.id, createdAt: previo?.created_at ?? r.updatedAt, updatedAt: r.updatedAt, version: previo?.version ?? 1,
        serverVersion: r.serverVersion, syncStatus: 'sincronizado', syncError: null, deleted: r.deleted };
      const { cols, vals } = aFila(r.tabla, e);
      await db.runAsync(`INSERT OR REPLACE INTO ${r.tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
    },
    async rebasar(tabla, id, serverVersion) {
      await db.runAsync(`UPDATE ${tabla} SET server_version = ?, sync_status = 'pendiente' WHERE id = ?`, [serverVersion, id]);
    },
    getMeta: (k) => getMeta(db, k),
    setMeta: (k, v) => setMeta(db, k, v),
  };
}

export async function conflictosAbiertos(db: DB): Promise<Conflicto[]> {
  const filas = await db.getAllAsync<{ json: string }>('SELECT json FROM sync_conflicto');
  return filas.map((f) => JSON.parse(f.json) as Conflicto);
}

export { TABLAS_SYNC };
