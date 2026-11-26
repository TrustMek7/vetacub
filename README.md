# VetaCub — Cubicación orientativa de vetas de oro (MVP)

App Android offline-first para que el minero artesanal registre bocamina, galerías y muestras de canal y vea en el celular tonelaje, ley diluida, gramos, onzas, oro recuperable por categoría y un semáforo de inversión.

> **Estimación orientativa para minería artesanal. No constituye una estimación de recursos minerales bajo normas JORC ni NI 43-101. No considera topografía ni geometría 3D de la veta.**
> Probado / Probable / Posible son categorías internas orientativas, no categorías normativas.

Arquitectura, modelo de datos, protocolo de sync y plan: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Instalación y prueba en Android

El proyecto usa Expo SDK 58, React Native 0.88 y SQLite. Usa Node.js 22.13 o superior y npm. Para probar en un teléfono, instala Expo Go compatible con SDK 58.

```bash
npm ci
npm start -- --go
```

Conecta la PC y el teléfono a la misma red Wi-Fi y escanea desde Expo Go el QR que aparece en la terminal. Si el puerto está ocupado, ejecuta `npm start -- --go --port 8082` y usa el QR nuevo.

`npm ci` instala las versiones del archivo de bloqueo y ejecuta el script que incluye Leaflet en el paquete de la app. Para una compilación nativa local, usa `npm run android` con Android Studio y el SDK de Android configurados. El script `npm run build:apk` requiere un proyecto EAS configurado con un perfil `preview` para APK.

## Sincronización y mapa offline

En `app.json`, dentro de `expo.extra`, configura estos valores para tu entorno.

- `syncUrl` apunta al endpoint de sincronización. `npm run sync-server` inicia un servidor de referencia en el puerto 8787 con datos en memoria.
- `tileUrl` contiene la plantilla de URL `{z}/{x}/{y}` de un servidor de teselas propio o con licencia para descarga offline. Descarga las teselas de la zona antes de ir a campo.

El registro de datos y los cálculos se ejecutan en el dispositivo. La sincronización y la descarga inicial de teselas requieren acceso a sus respectivos servidores.

## Pruebas y reporte de ejemplo

```bash
npm test
npm run typecheck
npm run demo
```

El reporte de ejemplo y sus CSV quedan en `demo/`.

## Uso en campo

1. **Inicio** → crear operación (o *Más → Operaciones → Abrir operación demo*).
2. **Bocamina** (en la entrada, fuera del socavón): *Tomar GPS*, cota (mejor de carta IGN), rumbo con número o brújula del celular.
3. **Galerías**: nombre y desnivel con wincha, desde la bocamina o desde otra galería. La cota se calcula sola.
4. **Muestras** cada 2–5 m: *＋ Registrar muestra* → metros (sugeridos), ancho, ley (puede quedar vacía hasta el ensaye), origen. *Guardar y siguiente* deja lista la siguiente muestra de la misma galería. Objetivo: menos de 1 minuto.
5. **Sección** y **Bloques**: tocar una muestra para ver ley y ancho; tocar un bloque para ver qué muestras influyeron y con qué peso.
6. **Resultados**: por categoría, factor de planta (activar/desactivar y ver impacto), exportar PDF y CSV.
7. **Parámetros**: densidad, ancho mínimo, ley de corte, recuperación, celda, IDW, umbrales, precio y costos del semáforo.
8. **Sincronización**: automática al detectar señal; los conflictos se confirman a mano.

La operación demo se guarda en el equipo y se excluye de la sincronización. En **Resultados → Factor de planta**, agrega la tercera liquidación de ejemplo para ver la corrección. **Restablecer demo** repone sus muestras y liquidaciones iniciales después de confirmar.

## Casos de prueba (tests/engine.test.ts, tests/sync.test.ts)

| Caso | Verifica |
|---|---|
| Veta angosta con dilución | 10 g/t, 0.4 m → 5 g/t diluida; 8.64 t y 43.2 g por bloque de 2×2 m |
| Veta ancha sin dilución | 6 g/t, 1.2 m → sin dilución; 8.64 t con el ancho mínimo de minado |
| Bloque entre dos galerías | A > 5 m de toda muestra pero entre galerías a 15 m → Probado; a 20 m → Probable |
| Más allá de la última muestra | Proyección hasta 10 m; categorías por distancia; pesos IDW suman 1 y domina la última muestra |
| Bajo ley de corte | 1.0 g/t excluido; 2.5 g/t en 0.4 m cae bajo el corte por dilución |
| Factor de planta | 2 liquidaciones → no se aplica + aviso; 3.ª liquidación → factor 0.8 aplicado; ponderación por toneladas; muestras vinculadas por código; desactivable |
| Sincronización | Lotes; respuesta perdida + reintento sin duplicar; mismo `loteId` idempotente; edición durante la subida; conflicto entre dos celulares con confirmación; pull paginado de liquidaciones |
| Otros | IDW exacto, UTM ida y vuelta < 1 mm, cotas por tramo y detección de ciclos, validaciones, semáforo, muestras pendientes de ensaye |

## Limitaciones

- Veta tratada como plano vertical 2D: sin buzamiento, fallas, pliegues ni topografía (puede proyectar bloques sobre la superficie).
- Galerías supuestas rectas según el rumbo de la bocamina.
- GPS de celular: ±3–10 m en horizontal y ±10–30 m en cota.
- Ley y ancho se interpolan por separado (como pide el requerimiento); IDW no da incertidumbre. Con mucho efecto pepita conviene usar *ley tope*.
- Dilución con estéril de ley 0.
- Fotos: se guardan en el celular; su subida al servidor está planificada para la fase 2.
- El backend de referencia guarda los datos en memoria. La integración con el sistema de liquidaciones y la validación en campo quedan pendientes.
