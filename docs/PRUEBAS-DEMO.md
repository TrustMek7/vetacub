# Pruebas del demo Android

Ejecutar `npm run typecheck` y `npm test`. La prueba automatizada de la operación demo verifica el efecto del ensaye, el paso de dos a tres liquidaciones representativas y el aviso legal en los datos del reporte.

## Recorrido con el APK

1. Instalar el APK en Android. Activar modo avión antes de la primera apertura. Desde Inicio, abrir la operación demo dos veces y confirmar que aparece una sola operación ficticia y que conserva las mismas muestras.
2. Registrar una muestra de 0,4 m con avance y código sugeridos, con la ley vacía. Cronometrar desde que se abre el formulario hasta que regresa a Inicio. Cerrar y volver a abrir la app. Verificar que la muestra sigue pendiente de ensaye.
3. Completar la ley de esa muestra con 8 g/t. Confirmar que se modifica el mismo registro y que cambian los resultados. Abrir la sección y tocar un bloque afectado para revisar las muestras y sus pesos.
4. En Resultados, verificar el aviso con dos liquidaciones, agregar la tercera y comprobar que se aplica el factor. Desactivar el factor y volver a activarlo para comparar el oro recuperable.
5. Exportar PDF y CSV. Comparar el resumen con la pantalla y verificar el aviso JORC/NI 43-101. Abrir el mapa offline y comprobar las teselas si la zona ya se descargó.
6. Cancelar una restauración y confirmar que la muestra y la tercera liquidación siguen guardadas. Confirmar la restauración y verificar que vuelven los datos iniciales del demo. Una operación normal creada para el control debe conservar sus datos.
7. Restaurar la conexión y sincronizar con el servidor de referencia. Verificar que recibe los registros de la operación de control. Revisar que la operación demo y sus altas, ediciones y borrados quedan fuera de los lotes.

Para entregar una actualización del demo, instalar la nueva versión firmada con la misma clave sobre la anterior y comprobar que siguen disponibles los datos guardados.
