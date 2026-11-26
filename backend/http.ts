// Servidor HTTP mínimo (sin dependencias) para probar la app contra el protocolo.
// Ejecutar: npx tsx backend/http.ts   → http://0.0.0.0:8787
// Solo para desarrollo: guarda en memoria, sin autenticación. En producción integrar en el backend de la empresa.
import { createServer } from 'node:http';
import { ServidorSync } from './syncServer';

const srv = new ServidorSync();
srv.publicarLiquidacion('liq-demo-1', { operacionId: 'demo', loteCodigo: 'L-001', fecha: '2026-11-01', toneladas: 12, leyGt: 9.1, codigosMuestra: [] });

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && url.pathname === '/api/vetacub/sync/pull') {
    return send(200, srv.procesarPull(Number(url.searchParams.get('desde') ?? 0)));
  }
  if (req.method === 'POST' && url.pathname === '/api/vetacub/sync/push') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { send(200, srv.procesarPush(JSON.parse(raw))); } catch (e) { send(400, { error: String(e) }); } });
    return;
  }
  send(404, { error: 'no encontrado' });
}).listen(8787, () => console.log('Sync de referencia en :8787'));
