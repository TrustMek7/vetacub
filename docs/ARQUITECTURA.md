# VetaCub — Arquitectura, modelo de datos y plan del MVP

> Estimación orientativa para minería artesanal. No constituye una estimación de recursos minerales bajo normas JORC ni NI 43-101. No considera topografía ni geometría 3D de la veta.

## 1. Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| Plataforma | **React Native + Expo (SDK 54), TypeScript** | Android primero, iOS sin reescritura. El motor de cálculo en TS puro se reutiliza en el backend y en pruebas. |
| BD local | **SQLite** (`expo-sqlite`, WAL) | Offline-first real: la BD local es la fuente de verdad del celular. |
| Cálculo | **Motor TS puro** (`src/engine`) sin dependencias | Corre igual en el celular, en Node (pruebas) y en el servidor si se quiere recalcular. |
| Mapa | **Leaflet empaquetado dentro de la app** (sin CDN) en WebView + teselas PNG en el almacenamiento del celular | Funciona sin señal. Sin teselas igual muestra los puntos. |
| Gráficos | **react-native-svg** en pantalla; el mismo código genera **SVG en texto** para el PDF | Una sola geometría (`sectionLayout.ts`) para la pantalla y el reporte. |
| PDF / CSV | `expo-print` (HTML → PDF en el dispositivo), CSV UTF-8 con BOM (abre bien en Excel) | Sin servicios externos. |
| Sincronización | **Push/pull por lotes**, UUID por registro, versión por registro, lote idempotente | Reintentos seguros con señal intermitente. |

```
┌──────────────────────────── Celular (offline) ────────────────────────────┐
│ Pantallas (src/screens) ── AppContext (estado) ── estimar() (src/engine)  │
│        │                         │                                         │
│        └── repos.ts ──── SQLite ─┴── syncStore.ts ── syncEngine.ts ──┐     │
│                                                                    HTTP  │
└────────────────────────────────────────────────────────────────────┼─────┘
                                                                     ▼
┌──────────────── Backend de la empresa (mismo contrato) ──────────────────┐
│ /sync/push  /sync/pull  →  tablas vetacub_*  ←  liquidaciones existentes │
└──────────────────────────────────────────────────────────────────────────┘
```

### Estructura del proyecto

```
App.tsx                  navegación (pestañas + pila)
src/domain/types.ts      entidades, parámetros, textos legales
src/engine/              ← cálculo 100 % local, probado
  geo.ts                 WGS84↔UTM, cotas de galerías, ubicación de muestras
  idw.ts                 IDW con pesos normalizados (auditoría)
  blockModel.ts          grilla 2D, clasificación, dilución, tonelaje
  plantFactor.ts         factor de planta
  summary.ts             totales por categoría, semáforo, estimar()
  validation.ts          validaciones de captura y ley anómala
  sectionLayout.ts       escalas, colores, SVG de sección
  params.ts              valores por defecto y validación de parámetros
src/db/                  SQLite: esquema, repositorios, AlmacenSync
src/sync/                protocolo, motor de sync, transporte HTTP
src/export/              reporte HTML/PDF, CSV, compartir
src/map/                 Leaflet offline, descarga de teselas
src/screens/             11 pantallas
backend/                 servidor de referencia del protocolo (pruebas/desarrollo)
tests/                   44 pruebas (motor + sincronización)
```

## 2. Modelo de datos (SQLite local)

Todas las tablas sincronizables comparten: `id TEXT PK (UUID v4)`, `created_at`, `updated_at`, `version` (ediciones locales), `server_version` (última versión confirmada por el servidor), `sync_status` (`pendiente | sincronizado | error`), `sync_error`, `deleted` (borrado lógico).

```
operacion (nombre, empresa_id)
  ├── bocamina   1:1  (lat, lon, precision_gps_m, cota, rumbo_grados, zona_utm, hemisferio)
  ├── parametros 1:1  (valores JSON)
  ├── galeria    1:N  (nombre, modo_desnivel[acumulado|tramo], desnivel_m, galeria_ref_id, fecha, observaciones)
  │     └── muestra 1:N (codigo, avance_m, ancho_m, ley_gt NULL=pendiente, origen_ley[ensaye_planta|laboratorio|batea],
  │                      foto_uri, lote_venta_codigo, fecha, observaciones)
  └── liquidacion 1:N  ← solo lectura, baja del sistema de liquidaciones (lote_codigo, fecha, toneladas, ley_gt, codigos_muestra JSON)

sync_meta (clave, valor)         deviceId, cursorPull, loteEnCurso, operacionActiva, syncUrl
sync_conflicto (tabla, id, json) conflictos esperando confirmación del usuario
sync_log, region_teselas
```

Notas:
- `ley_gt` admite NULL: el minero registra la muestra en campo y completa la ley cuando llega el ensaye de la planta. Las muestras sin ley no entran al cálculo y se avisa.
- `codigo` de muestra ↔ `codigos_muestra` de la liquidación es el vínculo para el factor de planta.
- La cota **no se guarda** en galerías ni muestras: se deriva siempre de la bocamina + desnivel (no queda desactualizada si se corrige la bocamina).

## 3. Cálculos (src/engine)

1. **Cota de galería**: `acumulado` → cota_bocamina + desnivel; `tramo` → cota(galería de referencia) + desnivel (encadenable, detecta ciclos).
2. **Ubicación**: bocamina a UTM (zona editable) → `E = E0 + avance·sin(rumbo)`, `N = N0 + avance·cos(rumbo)` → de vuelta a lat/lon para Leaflet.
3. **Sección longitudinal**: x = metros desde bocamina, y = cota.
4. **Grilla**: celdas `celdaLargo × celdaAlto` (2×2 m), ancladas en x = 0 y en la cota de bocamina. Extensión: hasta `alcance` m más allá de la primera/última muestra y `alturaPosible` m arriba/abajo.
5. **IDW**: `Σ(Lᵢ/dᵢᵖ)/Σ(1/dᵢᵖ)`, igual para el ancho; distancia máxima, máximo de muestras, ley tope opcional. Cada bloque guarda `{muestraId, distancia, peso normalizado}`.
6. **Clasificación orientativa** (en este orden):
   - Probado: entre dos galerías **con muestras** separadas ≤ `probadoSeparacionMaxGalerias` (15 m) y dentro de su cobertura horizontal, **o** a ≤ `probadoDistanciaMuestra` (5 m) de una muestra.
   - Probable: a ≤ `alturaProbable` (10 m) de una muestra.
   - Posible: a ≤ `alturaPosible` (25 m). Más lejos: no se genera bloque.
7. **Factor de planta** (si está activo y hay ≥ 3 liquidaciones representativas): ley_bloque × factor.
8. **Dilución**: si ancho < ancho mínimo → `ley × ancho/ancho_mínimo`.
9. **Tonelaje**: `largo × alto × ancho_minado × densidad`; gramos = t × ley diluida; onzas = g/31.1035; recuperable = g × recuperación.
10. **Ley de corte** sobre la ley diluida (y corregida): bajo el corte → excluido de los totales (se informa aparte).
11. **Semáforo**: solo Probado + Probable. Ingreso = oz recuperables × precio que paga la planta; costo = t × costo/t + costo del siguiente avance. Verde ≥ 1.3×, amarillo ≥ 1.0×, rojo < 1.0×. Con menos de 5 muestras nunca da verde.

### Interpretaciones del requerimiento (a validar con ustedes)

| Punto | Lo que dice el requerimiento | Lo implementado |
|---|---|---|
| Volumen de bloque | `largo × alto × ancho_mínimo` | El ancho estimado de la veta se usa para la dilución. |
| Umbral Probado "10–15 m" vs Probable "10 m" | Se solapan | 15 m = separación máxima entre dos galerías con muestras; 5 m = "muy cerca de una muestra". Ambos editables. |
| Ley obligatoria | ley ≥ 0 | Se permite guardar sin ley ("pendiente de ensaye"), porque la ley llega después con la liquidación. |
| Factor de planta | Liquidaciones ÷ muestras | Planta ponderada por toneladas; muestras ponderadas por ancho, usando solo las vinculadas por código si existen. |

## 4. Protocolo de sincronización

- **Push** `POST /sync/push` `{deviceId, loteId, registros:[{tabla, id, version, baseServerVersion, updatedAt, deleted, datos}]}` → `{resultados:[ok|conflicto|error]}`.
  - El servidor guarda la respuesta por `loteId`: reenviar el mismo lote devuelve la misma respuesta (**idempotente**).
  - Upsert por UUID; si el mismo dispositivo reenvía la misma `version`, responde `ok` sin cambiar nada (respuesta perdida + lote nuevo).
  - Si `baseServerVersion` ≠ versión actual del servidor → **conflicto** con la copia del servidor.
  - El cliente guarda el `loteId` en curso y lo reutiliza si el reintento lleva exactamente los mismos registros y versiones.
- **Pull** `GET /sync/pull?desde=cursor` → registros con `server_version > cursor` (paginado). Incluye las liquidaciones del sistema de planta.
- **Conflictos**: se sugiere la versión con `updatedAt` más reciente; el usuario confirma ("Mantener mío" / "Usar servidor"). Mientras no confirme, ese registro no se sube.
- Si el usuario edita un registro mientras sube, queda `pendiente` y se sube la nueva versión en la siguiente pasada.
- Disparo: al recuperar conexión (NetInfo) y manual desde la pantalla de sincronización.

### DDL sugerido en el servidor (PostgreSQL)

```sql
create table vetacub_registro (
  tabla text not null, id uuid not null, operacion_id uuid, server_version bigint not null,
  updated_at timestamptz not null, deleted boolean not null default false, datos jsonb not null,
  ultimo_dispositivo text not null, ultima_version_cliente int not null,
  primary key (tabla, id));
create sequence vetacub_seq;
create index on vetacub_registro (server_version);
create table vetacub_lote (lote_id uuid primary key, device_id text not null, respuesta jsonb not null, recibido timestamptz default now());
-- Liquidaciones: vista sobre el sistema existente que asigna server_version con la misma secuencia
-- (trigger en insert/update de la liquidación) y expone operacion_id, lote, toneladas, ley y códigos de muestra.
```

Seguridad: token del usuario (mismo login del sistema de liquidaciones), filtrar pull por las operaciones del usuario, HTTPS obligatorio. Fotos: subir aparte (multipart) después del registro — pendiente para la fase 2.

## 5. Plan de implementación

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Motor de cálculo + 44 pruebas, protocolo de sync + backend de referencia | ✅ en este entregable |
| 1 (2 sem) | App Expo: BD, 11 pantallas, mapa offline, sección, bloques, PDF/CSV | ✅ código entregado; falta compilar y probar en equipo real |
| 2 (2 sem) | Integrar push/pull en su backend + vista de liquidaciones, login, subida de fotos, servidor de teselas propio | Pendiente |
| 3 (1–2 sem) | Piloto con 2–3 mineros: medir tiempo de captura (< 1 min), ajustar textos, umbrales y semáforo | Pendiente |
| 4 | Build firmado (EAS), distribución por APK o Play Store, monitoreo de errores | Pendiente |

Riesgos: error de cota del GPS (mitigar con cota de carta IGN), galerías curvas (agregar quiebres de rumbo en fase 3), muestras de canal no representativas del mineral vendido (el factor de planta lo detecta), licencias de teselas.
