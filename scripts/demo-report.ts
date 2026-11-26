// Genera el reporte y los CSV del ejemplo con el MISMO código que usa la app.
// Uso: npx tsx scripts/demo-report.ts  → demo/reporte_demo.html, demo/*.csv
import { writeFileSync, mkdirSync } from 'node:fs';
import { datosDemo } from '../src/demo/datosDemo';
import { estimar, ubicarMuestra, cotasGalerias } from '../src/engine';
import { reporteHtml, csvResumen, csvBloques, csvMuestras } from '../src/export/reportHtml';

const d = datosDemo();
const est = estimar(d);
mkdirSync('demo', { recursive: true });
writeFileSync('demo/reporte_demo.html', reporteHtml({ operacion: d.operacion.nombre, galerias: d.galerias, muestras: d.muestras, params: d.params, est, generadoEn: '25/11/2026' }));
writeFileSync('demo/resumen_demo.csv', csvResumen(est, d.params));
writeFileSync('demo/bloques_demo.csv', csvBloques(est, new Map(d.muestras.map((m) => [m.id, m.codigo]))));
const cotas = cotasGalerias(d.bocamina.cota, d.galerias);
writeFileSync('demo/muestras_demo.csv', csvMuestras(d.muestras, d.galerias, new Map(d.muestras.map((m) => [m.id, ubicarMuestra(d.bocamina, m.avanceM, cotas.get(m.galeriaId)!)]))));

const r = est.resumen;
const fmt = (n: number) => n.toFixed(2);
console.log('Factor planta:', est.factor.factor?.toFixed(3), est.factor.aplicado ? '(aplicado)' : '(no aplicado)');
for (const [k, t] of Object.entries(r)) console.log(k.padEnd(20), 't', fmt(t.toneladas).padStart(9), 'g/t', fmt(t.leyMedia).padStart(6), 'oz', fmt(t.onzas).padStart(7), 'oz rec', fmt(t.onzasRecuperables).padStart(7), 'bloques', t.bloques);
console.log('Semáforo:', est.semaforo.titulo, '|', est.semaforo.detalle);
console.log('Avisos:', est.modelo.avisos.join(' / '));
