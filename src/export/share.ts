// Exportación en el dispositivo: PDF con expo-print (sin internet) y CSV con expo-file-system; se comparte con expo-sharing.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ADVERTENCIA_LEGAL, ADVERTENCIA_GPS } from '../domain/types';
import { cotasGalerias, seccionSvg, ubicarMuestra, type Estimacion } from '../engine';
import { csvBloques, csvMuestras, csvResumen, reporteHtml } from './reportHtml';
import type { useApp } from '../state/AppContext';

type App = ReturnType<typeof useApp>;

const nombreArchivo = (app: App, sufijo: string, ext: string) => {
  const op = app.operaciones.find((o) => o.id === app.operacionId)?.nombre ?? 'operacion';
  return `${op.replace(/[^\w-]+/g, '_')}_${sufijo}_${new Date().toISOString().slice(0, 10)}.${ext}`;
};

async function compartir(uri: string, mime: string) {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: 'Compartir' });
}

async function pdfDesdeHtml(html: string, nombre: string) {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const destino = `${FileSystem.documentDirectory}${nombre}`;
  await FileSystem.moveAsync({ from: uri, to: destino });
  await compartir(destino, 'application/pdf');
  return destino;
}

export function compartirPdfReporte(app: App, est: Estimacion) {
  const op = app.operaciones.find((o) => o.id === app.operacionId)?.nombre ?? '';
  return pdfDesdeHtml(reporteHtml({ operacion: op, galerias: app.galerias, muestras: app.muestras, params: app.params, est }), nombreArchivo(app, 'cubicacion', 'pdf'));
}

export function compartirPdfSeccion(app: App, est: Estimacion) {
  const nombres = new Map(app.galerias.map((g) => [g.id, g.nombre]));
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Helvetica,Arial;font-size:11px}
  .a{border:2px solid #C8102E;padding:6px;font-weight:bold;margin:6px 0}svg{width:100%;height:auto}</style></head><body>
  <h2>Sección longitudinal — ${app.operaciones.find((o) => o.id === app.operacionId)?.nombre ?? ''}</h2>
  ${seccionSvg(est.modelo, nombres, { mostrarBloques: false, ancho: 1000, alto: 520 })}
  <p>${ADVERTENCIA_GPS}</p><div class="a">${ADVERTENCIA_LEGAL}</div></body></html>`;
  return pdfDesdeHtml(html, nombreArchivo(app, 'seccion', 'pdf'));
}

export async function compartirCsv(app: App, est: Estimacion, tipo: 'resumen' | 'bloques' | 'muestras') {
  let contenido: string;
  if (tipo === 'resumen') contenido = csvResumen(est, app.params);
  else if (tipo === 'bloques') contenido = csvBloques(est, new Map(app.muestras.map((m) => [m.id, m.codigo])));
  else {
    const b = app.bocamina!;
    const cotas = cotasGalerias(b.cota, app.galerias);
    contenido = csvMuestras(app.muestras, app.galerias, new Map(app.muestras.filter((m) => cotas.has(m.galeriaId)).map((m) => [m.id, ubicarMuestra(b, m.avanceM, cotas.get(m.galeriaId)!)])));
  }
  const destino = `${FileSystem.documentDirectory}${nombreArchivo(app, tipo, 'csv')}`;
  await FileSystem.writeAsStringAsync(destino, contenido, { encoding: FileSystem.EncodingType.UTF8 });
  await compartir(destino, 'text/csv');
  return destino;
}
