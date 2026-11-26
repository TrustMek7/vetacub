// Empaqueta Leaflet (JS + CSS) como strings dentro del bundle para que el mapa funcione 100 % sin internet.
// Se ejecuta en postinstall. Genera src/map/leafletBundle.generated.ts
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
const out = path.join(__dirname, '..', 'src', 'map', 'leafletBundle.generated.ts');
try {
  const js = fs.readFileSync(path.join(dist, 'leaflet.js'), 'utf8');
  const css = fs.readFileSync(path.join(dist, 'leaflet.css'), 'utf8');
  fs.writeFileSync(out, `// GENERADO por scripts/bundle-leaflet.js — no editar\nexport const LEAFLET_JS = ${JSON.stringify(js)};\nexport const LEAFLET_CSS = ${JSON.stringify(css)};\n`);
  console.log('Leaflet empaquetado para uso offline');
} catch (e) {
  console.warn('No se encontró leaflet en node_modules; el mapa no funcionará hasta ejecutar npm install.', e.message);
}
