// HTML del mapa (Leaflet embebido, sin CDN). Las teselas se leen de archivos locales descargados.
import { LEAFLET_CSS, LEAFLET_JS } from './leafletBundle.generated';

export interface PuntoMapa { lat: number; lon: number; etiqueta: string; color: string; detalle: string }

export function mapaHtml(o: { centro: { lat: number; lon: number }; bocamina: PuntoMapa; muestras: PuntoMapa[]; teselas: string | null; zoomMax: number }): string {
  const datos = JSON.stringify(o).replace(/</g, '\\u003c');
  if (!LEAFLET_JS) return '<html><body style="font:18px sans-serif;padding:16px">Leaflet no está empaquetado. Ejecuta <b>npm install</b> (postinstall genera el paquete offline).</body></html>';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>${LEAFLET_CSS} html,body,#m{height:100%;margin:0;background:#e8e8e8} .lbl{font:bold 12px sans-serif;background:#fff;border:1px solid #000;padding:1px 3px}</style>
<script>${LEAFLET_JS}</script></head><body><div id="m"></div><script>
const D = ${datos};
const map = L.map('m', { zoomControl: true, maxZoom: 21 }).setView([D.centro.lat, D.centro.lon], 17);
if (D.teselas) L.tileLayer(D.teselas, { maxNativeZoom: D.zoomMax, maxZoom: 21, errorTileUrl: '' }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);
function popup(p) {
  const panel = document.createElement('div');
  const titulo = document.createElement('strong');
  titulo.textContent = p.etiqueta;
  const detalle = document.createElement('div');
  detalle.style.whiteSpace = 'pre-line';
  detalle.textContent = p.detalle;
  panel.append(titulo, detalle);
  return panel;
}
const b = D.bocamina;
L.circleMarker([b.lat, b.lon], { radius: 9, color: '#fff', weight: 2, fillColor: b.color, fillOpacity: 1 })
  .addTo(map).bindPopup(popup(b)).bindTooltip('Bocamina', { permanent: true, className: 'lbl', direction: 'top', offset: [0, -10] });
const pts = [[b.lat, b.lon]];
for (const m of D.muestras) {
  pts.push([m.lat, m.lon]);
  L.circleMarker([m.lat, m.lon], { radius: 7, color: '#000', weight: 2, fillColor: m.color, fillOpacity: 1 }).addTo(map).bindPopup(popup(m));
}
if (pts.length > 1) {
  // Traza de la veta: de la bocamina a la muestra más lejana (proyección en planta según el rumbo).
  const lejos = pts.slice(1).reduce((a, p) => (map.distance(pts[0], p) > map.distance(pts[0], a) ? p : a), pts[1]);
  L.polyline([pts[0], lejos], { color: '#000', weight: 2, dashArray: '6 6' }).addTo(map);
  map.fitBounds(pts, { padding: [40, 40], maxZoom: 19 });
}
</script></body></html>`;
}
