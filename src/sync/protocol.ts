// Contrato de sincronización cliente ↔ servidor (JSON sobre HTTPS).
// Compartido por la app (src/sync/syncEngine.ts) y el backend de referencia (backend/).

export type TablaSync = 'operacion' | 'bocamina' | 'galeria' | 'muestra' | 'parametros';
export type TablaRemota = TablaSync | 'liquidacion';

export interface RegistroPush {
  tabla: TablaSync;
  id: string;                 // UUID generado en el dispositivo
  version: number;            // versión local enviada
  baseServerVersion: number;  // última versión del servidor que conocía el cliente (0 = nuevo)
  updatedAt: string;
  deleted: boolean;
  datos: Record<string, unknown>;
}

export interface SolicitudPush {
  deviceId: string;
  loteId: string;             // UUID del lote: reintentar el mismo lote es idempotente
  registros: RegistroPush[];
}

export interface RegistroRemoto {
  tabla: TablaRemota;
  id: string;
  serverVersion: number;
  updatedAt: string;
  deleted: boolean;
  datos: Record<string, unknown>;
}

export type ResultadoRegistro =
  | { tabla: TablaSync; id: string; estado: 'ok'; serverVersion: number }
  | { tabla: TablaSync; id: string; estado: 'conflicto'; servidor: RegistroRemoto }
  | { tabla: TablaSync; id: string; estado: 'error'; error: string };

export interface RespuestaPush { loteId: string; resultados: ResultadoRegistro[]; repetido: boolean }

export interface RespuestaPull { registros: RegistroRemoto[]; cursor: number; hayMas: boolean }
