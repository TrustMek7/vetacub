// Backend de referencia del protocolo de sincronización (lógica pura, sin HTTP).
// En producción esta lógica vive en el backend de la empresa (mismo contrato) sobre su BD;
// ver docs/ARQUITECTURA.md §6 para el DDL del servidor.
import type { RegistroRemoto, RespuestaPull, RespuestaPush, ResultadoRegistro, SolicitudPush, TablaRemota } from '../src/sync/protocol';

interface Fila extends RegistroRemoto { ultimoDispositivo: string; ultimaVersionCliente: number }

export class ServidorSync {
  private filas = new Map<string, Fila>();             // clave tabla:id
  private lotes = new Map<string, RespuestaPush>();    // loteId → respuesta (idempotencia)
  private seq = 0;

  private clave(t: string, id: string) { return `${t}:${id}`; }

  procesarPush(s: SolicitudPush): RespuestaPush {
    const previa = this.lotes.get(s.loteId);
    if (previa) return { ...previa, repetido: true };

    const resultados: ResultadoRegistro[] = s.registros.map((r) => {
      if (!r.id || !/^[0-9a-zA-Z-]{8,}$/.test(r.id)) return { tabla: r.tabla, id: r.id, estado: 'error', error: 'id inválido' };
      const k = this.clave(r.tabla, r.id);
      const actual = this.filas.get(k);
      // Mismo dispositivo reenviando la misma versión (lote nuevo pero contenido ya aplicado): idempotente.
      if (actual && actual.ultimoDispositivo === s.deviceId && actual.ultimaVersionCliente === r.version) {
        return { tabla: r.tabla, id: r.id, estado: 'ok', serverVersion: actual.serverVersion };
      }
      if (actual && actual.serverVersion !== r.baseServerVersion) {
        const { ultimoDispositivo: _d, ultimaVersionCliente: _v, ...servidor } = actual;
        return { tabla: r.tabla, id: r.id, estado: 'conflicto', servidor };
      }
      const fila: Fila = {
        tabla: r.tabla, id: r.id, serverVersion: ++this.seq, updatedAt: r.updatedAt, deleted: r.deleted,
        datos: r.datos, ultimoDispositivo: s.deviceId, ultimaVersionCliente: r.version,
      };
      this.filas.set(k, fila);
      return { tabla: r.tabla, id: r.id, estado: 'ok', serverVersion: fila.serverVersion };
    });
    const resp: RespuestaPush = { loteId: s.loteId, resultados, repetido: false };
    this.lotes.set(s.loteId, resp);
    return resp;
  }

  procesarPull(desde: number, limite = 500): RespuestaPull {
    const nuevos = [...this.filas.values()].filter((f) => f.serverVersion > desde).sort((a, b) => a.serverVersion - b.serverVersion);
    const pagina = nuevos.slice(0, limite);
    const registros = pagina.map(({ ultimoDispositivo: _d, ultimaVersionCliente: _v, ...r }) => r);
    return { registros, cursor: pagina.length ? pagina[pagina.length - 1].serverVersion : desde, hayMas: nuevos.length > limite };
  }

  /** Simula la llegada de una liquidación desde el sistema de liquidaciones existente. */
  publicarLiquidacion(id: string, datos: Record<string, unknown>): void {
    this.filas.set(this.clave('liquidacion', id), {
      tabla: 'liquidacion' as TablaRemota, id, serverVersion: ++this.seq, updatedAt: new Date().toISOString(),
      deleted: false, datos, ultimoDispositivo: 'sistema-liquidaciones', ultimaVersionCliente: 0,
    });
  }

  contar(tabla?: string): number {
    return [...this.filas.values()].filter((f) => !tabla || f.tabla === tabla).length;
  }
}
