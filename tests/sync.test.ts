import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sincronizar, resolverConflicto, type AlmacenSync, type Conflicto, type RegistroLocal } from '../src/sync/syncEngine';
import type { RegistroRemoto, TablaRemota, TablaSync } from '../src/sync/protocol';
import { ServidorSync } from '../backend/syncServer';
import type { TransporteSync } from '../src/sync/syncEngine';

let u = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++u).padStart(12, '0')}`;

/** Almacén en memoria con la misma semántica que la implementación SQLite. */
class Memoria implements AlmacenSync {
  regs = new Map<string, RegistroLocal>();
  liqs = new Map<string, RegistroRemoto>();
  conflictos = new Map<string, Conflicto>();
  meta = new Map<string, string>();
  k = (t: string, id: string) => `${t}:${id}`;

  crear(tabla: TablaSync, datos: Record<string, unknown>, updatedAt = '2026-11-20T10:00:00Z'): RegistroLocal {
    const r: RegistroLocal = { tabla, id: uuid(), version: 1, serverVersion: 0, updatedAt, deleted: false, syncStatus: 'pendiente', datos };
    this.regs.set(this.k(tabla, r.id), r); return r;
  }
  editar(r: RegistroLocal, datos: Record<string, unknown>, updatedAt: string) {
    const x = this.regs.get(this.k(r.tabla, r.id))!;
    Object.assign(x, { datos: { ...x.datos, ...datos }, version: x.version + 1, updatedAt, syncStatus: 'pendiente' });
  }
  async pendientes(n: number) { return [...this.regs.values()].filter((r) => r.syncStatus !== 'sincronizado' && !this.conflictos.has(this.k(r.tabla, r.id))).slice(0, n).map((r) => ({ ...r })); }
  async obtener(t: TablaRemota, id: string) { const r = this.regs.get(this.k(t, id)); return r ? { ...r } : null; }
  async confirmar(t: TablaSync, id: string, version: number, sv: number) {
    const r = this.regs.get(this.k(t, id))!; r.serverVersion = sv; if (r.version === version) r.syncStatus = 'sincronizado';
  }
  async marcarError(t: TablaSync, id: string) { this.regs.get(this.k(t, id))!.syncStatus = 'error'; }
  async guardarConflicto(c: Conflicto) { this.conflictos.set(this.k(c.tabla, c.id), c); }
  async eliminarConflicto(t: TablaSync, id: string) { this.conflictos.delete(this.k(t, id)); }
  async aplicarRemoto(r: RegistroRemoto) {
    if (r.tabla === 'liquidacion') { this.liqs.set(r.id, r); return; }
    this.regs.set(this.k(r.tabla, r.id), { tabla: r.tabla, id: r.id, version: 1, serverVersion: r.serverVersion, updatedAt: r.updatedAt, deleted: r.deleted, syncStatus: 'sincronizado', datos: r.datos });
  }
  async rebasar(t: TablaSync, id: string, sv: number) { const r = this.regs.get(this.k(t, id))!; r.serverVersion = sv; r.syncStatus = 'pendiente'; }
  async getMeta(k: string) { return this.meta.get(k) ?? null; }
  async setMeta(k: string, v: string | null) { if (v == null) this.meta.delete(k); else this.meta.set(k, v); }
}

const transporte = (s: ServidorSync, opts: { perderRespuesta?: () => boolean } = {}): TransporteSync => ({
  async push(req) {
    const resp = s.procesarPush(JSON.parse(JSON.stringify(req)));
    if (opts.perderRespuesta?.()) throw new Error('timeout: se perdió la respuesta');
    return JSON.parse(JSON.stringify(resp));
  },
  async pull(desde) { return JSON.parse(JSON.stringify(s.procesarPull(desde, 3))); },
});

describe('Sincronización por lotes', () => {
  test('sube en lotes y marca sincronizado', async () => {
    const s = new ServidorSync(); const m = new Memoria();
    for (let i = 0; i < 7; i++) m.crear('muestra', { codigo: `M${i}` });
    const r = await sincronizar(m, transporte(s), { deviceId: 'cel-1', uuid, tamLote: 3 });
    assert.equal(r.fallo, undefined);
    assert.equal(r.subidos, 7); assert.equal(r.lotes, 3);
    assert.equal(s.contar('muestra'), 7);
    assert.ok([...m.regs.values()].every((x) => x.syncStatus === 'sincronizado'));
  });

  test('respuesta perdida + reintento del mismo lote → no duplica', async () => {
    const s = new ServidorSync(); const m = new Memoria();
    for (let i = 0; i < 4; i++) m.crear('muestra', { codigo: `M${i}` });
    let primera = true;
    const r1 = await sincronizar(m, transporte(s, { perderRespuesta: () => { const p = primera; primera = false; return p; } }), { deviceId: 'cel-1', uuid });
    assert.match(r1.fallo ?? '', /timeout/);
    assert.equal(s.contar(), 4, 'el servidor sí lo aplicó');
    assert.ok([...m.regs.values()].every((x) => x.syncStatus === 'pendiente'), 'el cliente no lo sabe');
    const loteAntes = JSON.parse(m.meta.get('loteEnCurso')!).loteId;
    const r2 = await sincronizar(m, transporte(s), { deviceId: 'cel-1', uuid });
    assert.equal(r2.subidos, 4);
    assert.equal(s.contar(), 4, 'sin duplicados');
    assert.ok(loteAntes);
  });

  test('mismo loteId reenviado directamente devuelve la respuesta guardada', () => {
    const s = new ServidorSync();
    const req = { deviceId: 'd', loteId: uuid(), registros: [{ tabla: 'muestra' as const, id: uuid(), version: 1, baseServerVersion: 0, updatedAt: 'x', deleted: false, datos: {} }] };
    const a = s.procesarPush(req); const b = s.procesarPush(req);
    assert.equal(b.repetido, true); assert.deepEqual(a.resultados, b.resultados); assert.equal(s.contar(), 1);
  });

  test('edición durante la subida: queda pendiente y se sube la nueva versión', async () => {
    const s = new ServidorSync(); const m = new Memoria();
    const r = m.crear('muestra', { leyGt: 5 });
    const t = transporte(s);
    const t2: TransporteSync = { ...t, async push(req) { const resp = await t.push(req); m.editar(r, { leyGt: 6 }, '2026-11-20T11:00:00Z'); return resp; } };
    await sincronizar(m, t2, { deviceId: 'd', uuid, maxLotes: 1 });
    assert.equal(m.regs.get(`muestra:${r.id}`)!.syncStatus, 'pendiente');
    await sincronizar(m, t, { deviceId: 'd', uuid });
    assert.equal(s.procesarPull(0).registros.find((x) => x.id === r.id)!.datos.leyGt, 6);
    assert.equal(s.contar(), 1);
  });

  test('conflicto entre dos celulares → sugerencia por última modificación y confirmación', async () => {
    const s = new ServidorSync(); const a = new Memoria(); const b = new Memoria();
    const reg = a.crear('galeria', { nombre: 'Nv 1' });
    await sincronizar(a, transporte(s), { deviceId: 'A', uuid });
    await sincronizar(b, transporte(s), { deviceId: 'B', uuid }); // B baja la galería
    a.editar(reg, { nombre: 'Nivel 1 (A)' }, '2026-11-21T08:00:00Z');
    const enB = b.regs.get(`galeria:${reg.id}`)!; b.editar(enB, { nombre: 'Nivel 1 (B)' }, '2026-11-21T09:00:00Z');
    await sincronizar(a, transporte(s), { deviceId: 'A', uuid });
    const rb = await sincronizar(b, transporte(s), { deviceId: 'B', uuid });
    assert.equal(rb.conflictos, 1);
    const c = b.conflictos.get(`galeria:${reg.id}`)!;
    assert.equal(c.sugerencia, 'local', 'B editó después');
    // El conflicto bloquea la subida hasta que el usuario confirme
    assert.equal((await b.pendientes(10)).length, 0);
    await resolverConflicto(b, c, 'local');
    const rb2 = await sincronizar(b, transporte(s), { deviceId: 'B', uuid });
    assert.equal(rb2.subidos, 1);
    await sincronizar(a, transporte(s), { deviceId: 'A', uuid });
    assert.equal(a.regs.get(`galeria:${reg.id}`)!.datos.nombre, 'Nivel 1 (B)');
    assert.equal(s.contar('galeria'), 1);
  });

  test('pull trae liquidaciones nuevas del sistema de planta (paginado)', async () => {
    const s = new ServidorSync(); const m = new Memoria();
    for (let i = 0; i < 5; i++) s.publicarLiquidacion(`liq-${i}`, { toneladas: 10, leyGt: 8 });
    const r = await sincronizar(m, transporte(s), { deviceId: 'd', uuid });
    assert.equal(r.bajados, 5); assert.equal(m.liqs.size, 5);
    s.publicarLiquidacion('liq-nueva', { toneladas: 10, leyGt: 9 });
    const r2 = await sincronizar(m, transporte(s), { deviceId: 'd', uuid });
    assert.equal(r2.bajados, 1, 'solo lo nuevo, por cursor');
  });
});
