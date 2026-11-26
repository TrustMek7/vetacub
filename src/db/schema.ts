// Esquema SQLite local. Las tablas sincronizables se describen una sola vez y de ahí se generan
// el DDL, el mapeo fila ↔ entidad y el payload de sincronización.
import type { TablaSync } from '../sync/protocol';

export type TipoCol = 'text' | 'real' | 'int' | 'bool' | 'json';
export type DefCol = readonly [campo: string, columna: string, tipo: TipoCol, nullable?: boolean];

/** Columnas comunes de auditoría/sincronización (todas las tablas sincronizables). */
export const COLS_SYNC: DefCol[] = [
  ['id', 'id', 'text'],
  ['createdAt', 'created_at', 'text'],
  ['updatedAt', 'updated_at', 'text'],
  ['version', 'version', 'int'],
  ['serverVersion', 'server_version', 'int'],
  ['syncStatus', 'sync_status', 'text'],
  ['syncError', 'sync_error', 'text', true],
  ['deleted', 'deleted', 'bool'],
];

export const TABLAS: Record<TablaSync, { cols: DefCol[]; indices?: string[] }> = {
  operacion: { cols: [['nombre', 'nombre', 'text'], ['empresaId', 'empresa_id', 'text', true]] },
  bocamina: {
    cols: [['operacionId', 'operacion_id', 'text'], ['lat', 'lat', 'real'], ['lon', 'lon', 'real'], ['precisionGpsM', 'precision_gps_m', 'real', true],
      ['cota', 'cota', 'real'], ['rumboGrados', 'rumbo_grados', 'real'], ['zonaUtm', 'zona_utm', 'int'], ['hemisferio', 'hemisferio', 'text']],
    indices: ['CREATE UNIQUE INDEX IF NOT EXISTS ux_bocamina_op ON bocamina(operacion_id)'],
  },
  galeria: {
    cols: [['operacionId', 'operacion_id', 'text'], ['nombre', 'nombre', 'text'], ['modoDesnivel', 'modo_desnivel', 'text'], ['desnivelM', 'desnivel_m', 'real'],
      ['galeriaRefId', 'galeria_ref_id', 'text', true], ['fecha', 'fecha', 'text'], ['observaciones', 'observaciones', 'text', true]],
    indices: ['CREATE INDEX IF NOT EXISTS ix_galeria_op ON galeria(operacion_id)'],
  },
  muestra: {
    cols: [['operacionId', 'operacion_id', 'text'], ['galeriaId', 'galeria_id', 'text'], ['codigo', 'codigo', 'text'], ['avanceM', 'avance_m', 'real'],
      ['anchoM', 'ancho_m', 'real'], ['leyGt', 'ley_gt', 'real', true], ['origenLey', 'origen_ley', 'text'], ['fotoUri', 'foto_uri', 'text', true],
      ['loteVentaCodigo', 'lote_venta_codigo', 'text', true], ['fecha', 'fecha', 'text'], ['observaciones', 'observaciones', 'text', true]],
    indices: ['CREATE INDEX IF NOT EXISTS ix_muestra_op ON muestra(operacion_id)', 'CREATE INDEX IF NOT EXISTS ix_muestra_gal ON muestra(galeria_id, avance_m)'],
  },
  parametros: {
    cols: [['operacionId', 'operacion_id', 'text'], ['valores', 'valores', 'json']],
    indices: ['CREATE UNIQUE INDEX IF NOT EXISTS ux_parametros_op ON parametros(operacion_id)'],
  },
};

const sqlTipo = (t: TipoCol) => (t === 'real' ? 'REAL' : t === 'int' || t === 'bool' ? 'INTEGER' : 'TEXT');

export function ddl(): string[] {
  const out: string[] = [];
  for (const [tabla, def] of Object.entries(TABLAS)) {
    const cols = [...COLS_SYNC, ...def.cols].map(([, c, t, n]) => `${c} ${sqlTipo(t)}${c === 'id' ? ' PRIMARY KEY' : n ? '' : ' NOT NULL'}`);
    out.push(`CREATE TABLE IF NOT EXISTS ${tabla} (${cols.join(', ')})`);
    out.push(`CREATE INDEX IF NOT EXISTS ix_${tabla}_sync ON ${tabla}(sync_status)`);
    out.push(...(def.indices ?? []));
  }
  out.push(`CREATE TABLE IF NOT EXISTS liquidacion (id TEXT PRIMARY KEY, operacion_id TEXT NOT NULL, lote_codigo TEXT NOT NULL, fecha TEXT NOT NULL,
    toneladas REAL NOT NULL, ley_gt REAL NOT NULL, codigos_muestra TEXT, server_version INTEGER NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`);
  out.push(`CREATE TABLE IF NOT EXISTS sync_conflicto (tabla TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (tabla, id))`);
  out.push(`CREATE TABLE IF NOT EXISTS sync_meta (clave TEXT PRIMARY KEY, valor TEXT)`);
  out.push(`CREATE TABLE IF NOT EXISTS sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, resumen TEXT NOT NULL)`);
  out.push(`CREATE TABLE IF NOT EXISTS region_teselas (id TEXT PRIMARY KEY, operacion_id TEXT, lat REAL, lon REAL, radio_m REAL, zoom_min INTEGER, zoom_max INTEGER, teselas INTEGER, bytes INTEGER, fecha TEXT)`);
  return out;
}

export const VERSION_ESQUEMA = 1;

// ---- mapeo fila <-> entidad ----
type Fila = Record<string, unknown>;

export function aEntidad<T>(tabla: TablaSync, f: Fila): T {
  const o: Record<string, unknown> = {};
  for (const [campo, col, tipo] of [...COLS_SYNC, ...TABLAS[tabla].cols]) {
    const v = f[col];
    o[campo] = v == null ? null : tipo === 'bool' ? v === 1 || v === true : tipo === 'json' ? JSON.parse(String(v)) : v;
  }
  return o as T;
}

export function aFila(tabla: TablaSync, e: Record<string, unknown>): { cols: string[]; vals: (string | number | null)[] } {
  const cols: string[] = [], vals: (string | number | null)[] = [];
  for (const [campo, col, tipo] of [...COLS_SYNC, ...TABLAS[tabla].cols]) {
    const v = e[campo];
    cols.push(col);
    vals.push(v == null ? null : tipo === 'bool' ? (v ? 1 : 0) : tipo === 'json' ? JSON.stringify(v) : (v as string | number));
  }
  return { cols, vals };
}

/** Datos de negocio (sin campos de sync) que viajan al servidor. */
export function datosNegocio(tabla: TablaSync, e: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [campo] of TABLAS[tabla].cols) o[campo] = e[campo] ?? null;
  return o;
}
