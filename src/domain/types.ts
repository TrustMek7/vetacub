// Tipos de dominio compartidos por el motor de cálculo, la BD local y la sincronización.
// El motor (src/engine) solo depende de este archivo: no usa React Native ni SQLite.

export type SyncStatus = 'pendiente' | 'sincronizado' | 'error';
export type OrigenLey = 'ensaye_planta' | 'laboratorio' | 'batea';
export type ModoDesnivel = 'acumulado' | 'tramo';
export type Hemisferio = 'N' | 'S';
export type Categoria = 'probado' | 'probable' | 'posible';

/** Campos de auditoría y sincronización presentes en TODOS los registros. */
export interface Sincronizable {
  id: string;              // UUID v4 generado en el dispositivo
  createdAt: string;       // ISO-8601
  updatedAt: string;       // ISO-8601, cambia en cada edición local
  version: number;         // contador local de ediciones
  serverVersion: number;   // versión confirmada por el servidor (0 = nunca subido)
  syncStatus: SyncStatus;
  syncError?: string | null;
  deleted: boolean;        // borrado lógico (se sincroniza como tombstone)
}

export interface Operacion extends Sincronizable {
  nombre: string;
  empresaId?: string | null;
}

export interface Bocamina extends Sincronizable {
  operacionId: string;
  lat: number;
  lon: number;
  precisionGpsM?: number | null;
  cota: number;            // msnm
  rumboGrados: number;     // azimut 0–360 de la veta (dirección de avance)
  zonaUtm: number;         // 17, 18 o 19 en Perú
  hemisferio: Hemisferio;  // 'S' en Perú
}

export interface Galeria extends Sincronizable {
  operacionId: string;
  nombre: string;
  modoDesnivel: ModoDesnivel;
  /** acumulado: desnivel respecto a bocamina. tramo: respecto a galeriaRefId (o bocamina si es null). Negativo = hacia abajo. */
  desnivelM: number;
  galeriaRefId?: string | null;
  fecha: string;
  observaciones?: string | null;
}

export interface Muestra extends Sincronizable {
  operacionId: string;
  galeriaId: string;
  codigo: string;          // vinculable al lote de venta
  avanceM: number;         // metros desde la bocamina (wincha)
  anchoM: number;          // ancho de veta
  /** g/t Au. null = pendiente de ensaye (la muestra se registra en campo y la ley llega después de la liquidación). */
  leyGt: number | null;
  origenLey: OrigenLey;
  fotoUri?: string | null;
  loteVentaCodigo?: string | null;
  fecha: string;
  observaciones?: string | null;
}

/** Liquidación de planta: viene del sistema de liquidaciones existente (solo lectura en la app). */
export interface Liquidacion {
  id: string;
  operacionId: string;
  loteCodigo: string;
  fecha: string;
  toneladas: number;       // TMS
  leyGt: number;           // ley de ensaye de planta
  codigosMuestra?: string[];
}

export interface Parametros {
  densidad: number;                       // t/m³
  anchoMinimoMinado: number;              // m
  /** 'max': volumen con max(ancho veta, ancho mínimo). 'minimo': siempre ancho mínimo (fórmula literal del requerimiento). */
  alcanceMasAllaUltimaMuestra: number;    // m en horizontal
  celdaLargo: number;                     // m
  celdaAlto: number;                      // m
  leyCorte: number;                       // g/t (sobre ley diluida)
  recuperacionPlanta: number;             // 0–1
  zonaUtm: number;
  potenciaIdw: number;
  distanciaMaxInfluencia: number;         // m
  maxMuestrasIdw: number;
  leyTope: number | null;                 // g/t, recorte de altos erráticos; null = sin tope
  probadoSeparacionMaxGalerias: number;   // m: dos galerías con muestras separadas ≤ esto
  probadoDistanciaMuestra: number;        // m: "muy cerca" de una muestra
  alturaProbable: number;                 // m: umbral Probable
  alturaPosible: number;                  // m: umbral Posible
  aplicarFactorPlanta: boolean;
  minLiquidacionesFactor: number;
  anomaliaFactorMediana: number;
  // Semáforo de inversión
  moneda: string;
  precioOroPorOnza: number;               // lo que paga la planta por onza recuperada
  costoPorTonelada: number;               // minado + transporte + planta
  costoSiguienteAvance: number;           // inversión que se está evaluando
  umbralVerde: number;                    // ingreso/costo para "vale la pena"
  umbralAmarillo: number;                 // ingreso/costo para "revisar"
  minMuestrasSemaforo: number;
}

export const ADVERTENCIA_LEGAL =
  'Estimación orientativa para minería artesanal. No constituye una estimación de recursos minerales bajo normas JORC ni NI 43-101. No considera topografía ni geometría 3D de la veta.';

export const ADVERTENCIA_CATEGORIAS =
  'Probado, Probable y Posible son categorías internas orientativas de esta app, no categorías normativas.';

export const ADVERTENCIA_GPS =
  'El GPS del celular tiene error vertical de ±10–30 m; la cota de bocamina y las ubicaciones son aproximadas.';
