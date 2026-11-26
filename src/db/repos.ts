// Acceso a datos local. Cada escritura: nuevo updatedAt, version+1 y syncStatus 'pendiente'.
import { datosDemo } from '../demo/datosDemo';
import * as Crypto from 'expo-crypto';
import type { DB } from './database';
import { aEntidad, aFila } from './schema';
import type { TablaSync } from '../sync/protocol';
import type { Bocamina, Galeria, Liquidacion, Muestra, Operacion, Parametros, Sincronizable } from '../domain/types';
import { PARAMETROS_POR_DEFECTO } from '../engine/params';

export const nuevoId = () => Crypto.randomUUID();
const ahora = () => new Date().toISOString();

type SinSync<T> = Omit<T, keyof Sincronizable> & Partial<Pick<Sincronizable, 'id'>>;

async function upsert(db: DB, tabla: TablaSync, e: Record<string, unknown>) {
  const { cols, vals } = aFila(tabla, e);
  await db.runAsync(
    `INSERT INTO ${tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
     ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(',')}`,
    vals,
  );
}

/** Crea o edita un registro local. */
export async function guardar<T extends Sincronizable>(db: DB, tabla: TablaSync, datos: SinSync<T>): Promise<T> {
  const t = ahora();
  const previo = datos.id ? await db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${tabla} WHERE id = ?`, [datos.id]) : null;
  const base = previo ? aEntidad<T>(tabla, previo) : null;
  const e = {
    ...(base ?? {}),
    ...datos,
    id: datos.id ?? nuevoId(),
    createdAt: base?.createdAt ?? t,
    updatedAt: t,
    version: (base?.version ?? 0) + 1,
    serverVersion: base?.serverVersion ?? 0,
    syncStatus: 'pendiente',
    syncError: null,
    deleted: false,
  } as unknown as T;
  await upsert(db, tabla, e as unknown as Record<string, unknown>);
  return e;
}

/** Borrado lógico: se sincroniza como tombstone. */
export async function borrar(db: DB, tabla: TablaSync, id: string) {
  await db.runAsync(`UPDATE ${tabla} SET deleted = 1, version = version + 1, updated_at = ?, sync_status = 'pendiente' WHERE id = ?`, [ahora(), id]);
}

async function listar<T>(db: DB, tabla: TablaSync, where: string, args: (string | number)[], orden = 'created_at'): Promise<T[]> {
  const filas = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${tabla} WHERE deleted = 0 AND ${where} ORDER BY ${orden}`, args);
  return filas.map((f) => aEntidad<T>(tabla, f));
}

export const operaciones = (db: DB) => listar<Operacion>(db, 'operacion', '1=1', [], 'nombre');
export const bocaminaDe = async (db: DB, op: string) => (await listar<Bocamina>(db, 'bocamina', 'operacion_id = ?', [op]))[0] ?? null;
export const galeriasDe = (db: DB, op: string) => listar<Galeria>(db, 'galeria', 'operacion_id = ?', [op], 'fecha, nombre');
export const muestrasDe = (db: DB, op: string) => listar<Muestra>(db, 'muestra', 'operacion_id = ?', [op], 'galeria_id, avance_m');

export async function parametrosDe(db: DB, op: string): Promise<{ id: string | null; valores: Parametros }> {
  const r = (await listar<{ id: string; valores: Partial<Parametros> & { anchoVolumen?: string } }>(db, 'parametros', 'operacion_id = ?', [op]))[0];
  // Mezcla con los valores por defecto para tolerar parámetros nuevos en versiones futuras.
  const valores = { ...PARAMETROS_POR_DEFECTO, ...r?.valores };
  delete valores.anchoVolumen;
  return { id: r?.id ?? null, valores };
}

export async function guardarParametros(db: DB, op: string, valores: Parametros) {
  const { id } = await parametrosDe(db, op);
  await guardar(db, 'parametros', { id: id ?? undefined, operacionId: op, valores } as never);
}

export async function liquidacionesDe(db: DB, op: string): Promise<Liquidacion[]> {
  const filas = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM liquidacion WHERE deleted = 0 AND operacion_id = ? ORDER BY fecha', [op]);
  return filas.map((f) => ({
    id: String(f.id), operacionId: String(f.operacion_id), loteCodigo: String(f.lote_codigo), fecha: String(f.fecha),
    toneladas: Number(f.toneladas), leyGt: Number(f.ley_gt), codigosMuestra: f.codigos_muestra ? JSON.parse(String(f.codigos_muestra)) : [],
  }));
}

export async function getMeta(db: DB, clave: string): Promise<string | null> {
  return (await db.getFirstAsync<{ valor: string | null }>('SELECT valor FROM sync_meta WHERE clave = ?', [clave]))?.valor ?? null;
}
export async function setMeta(db: DB, clave: string, valor: string | null) {
  if (valor == null) await db.runAsync('DELETE FROM sync_meta WHERE clave = ?', [clave]);
  else await db.runAsync('INSERT INTO sync_meta (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', [clave, valor]);
}

export async function conteoSync(db: DB): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  for (const t of ['operacion', 'bocamina', 'galeria', 'muestra', 'parametros']) {
    const filas = await db.getAllAsync<{ sync_status: string; n: number }>(`SELECT sync_status, COUNT(*) n FROM ${t} GROUP BY sync_status`);
    out[t] = Object.fromEntries(filas.map((f) => [f.sync_status, f.n]));
  }
  return out;
}

/** Abre o restablece la operación local de demostración. */
export async function cargarDemo(db: DB, restablecer = false): Promise<string> {
  let demoId = '';
  await db.withExclusiveTransactionAsync(async (db) => {
    const anterior = await getMeta(db, 'operacionDemo');
    if (anterior && !restablecer) {
      demoId = anterior;
      return;
    }
    demoId = anterior ?? nuevoId();
    if (anterior) {
      for (const tabla of ['muestra', 'galeria', 'bocamina', 'parametros', 'liquidacion']) {
        await db.runAsync(`DELETE FROM ${tabla} WHERE operacion_id = ?`, [demoId]);
      }
    }

    const d = datosDemo(demoId);
    const ids = new Map(d.galerias.map((g) => [g.id, nuevoId()]));
    d.bocamina.id = nuevoId();
    for (const g of d.galerias) {
      g.id = ids.get(g.id)!;
      if (g.galeriaRefId) g.galeriaRefId = ids.get(g.galeriaRefId)!;
    }
    for (const m of d.muestras) {
      m.id = nuevoId();
      m.galeriaId = ids.get(m.galeriaId)!;
    }
    await setMeta(db, 'operacionDemo', demoId);
    await guardar<Operacion>(db, 'operacion', { id: d.operacion.id, nombre: d.operacion.nombre });
    await guardar<Bocamina>(db, 'bocamina', d.bocamina);
    for (const g of d.galerias) await guardar<Galeria>(db, 'galeria', g);
    for (const m of d.muestras) await guardar<Muestra>(db, 'muestra', m);
    await guardarParametros(db, d.operacion.id, d.params);
    for (const l of d.liquidaciones.slice(0, 2)) {
      await guardarLiquidacionDemo(db, l);
    }
  });
  return demoId;
}


async function guardarLiquidacionDemo(db: DB, l: Liquidacion) {
  await db.runAsync(`INSERT INTO liquidacion (id, operacion_id, lote_codigo, fecha, toneladas, ley_gt, codigos_muestra, server_version, updated_at, deleted)
    VALUES (?,?,?,?,?,?,?,0,?,0)`, [nuevoId(), l.operacionId, l.loteCodigo, l.fecha, l.toneladas, l.leyGt, JSON.stringify(l.codigosMuestra ?? []), ahora()]);
}

export async function agregarLiquidacionDemo(db: DB, operacionId: string) {
  await db.withExclusiveTransactionAsync(async (db) => {
    if (await getMeta(db, 'operacionDemo') !== operacionId) return;
    const liquidacion = datosDemo(operacionId).liquidaciones[2];
    const actuales = await liquidacionesDe(db, operacionId);
    if (!actuales.some((l) => l.loteCodigo === liquidacion.loteCodigo)) {
      await guardarLiquidacionDemo(db, liquidacion);
    }
  });
}
