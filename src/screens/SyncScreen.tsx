import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Campo, Fila, Pantalla, Tarjeta, Texto, Titulo } from '../ui/components';
import { conteoSync } from '../db/repos';
import { almacenSqlite, conflictosAbiertos } from '../db/syncStore';
import { resolverConflicto, type Conflicto } from '../sync/syncEngine';
import { T } from '../ui/theme';

const NOMBRE: Record<string, string> = { operacion: 'Operación', bocamina: 'Bocamina', galeria: 'Galerías', muestra: 'Muestras', parametros: 'Parámetros' };

export default function SyncScreen() {
  const app = useApp();
  const [conteo, setConteo] = useState<Record<string, Record<string, number>>>({});
  const [conflictos, setConflictos] = useState<Conflicto[]>([]);
  const [url, setUrl] = useState(app.syncUrl);
  const [ultimo, setUltimo] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!app.db) return;
    setConteo(await conteoSync(app.db));
    setConflictos(await conflictosAbiertos(app.db));
    const l = await app.db.getFirstAsync<{ fecha: string; resumen: string }>('SELECT fecha, resumen FROM sync_log ORDER BY id DESC LIMIT 1');
    setUltimo(l ? `${l.fecha.slice(0, 16).replace('T', ' ')} — ${l.resumen}` : null);
  }, [app.db]);
  useEffect(() => { void refrescar(); }, [refrescar, app.ultimoSync]);

  const tot = (s: string) => Object.values(conteo).reduce((a, c) => a + (c[s] ?? 0), 0);
  const configurado = !!app.syncUrl && !app.syncUrl.includes('TU-BACKEND');

  return (
    <Pantalla pie={<Boton titulo={app.sincronizando ? 'Sincronizando…' : '⇅ Sincronizar ahora'} deshabilitado={app.sincronizando || !configurado}
      onPress={async () => { await app.sincronizarAhora(); await refrescar(); }} />}>
      <Tarjeta>
        <Fila izq="Pendientes" der={String(tot('pendiente'))} negrita />
        <Fila izq="Sincronizados" der={String(tot('sincronizado'))} />
        <Fila izq="Con error" der={String(tot('error'))} />
        <Fila izq="Conflictos por resolver" der={String(conflictos.length)} negrita />
      </Tarjeta>
      {Object.entries(conteo).map(([t, c]) => (
        <Texto key={t} suave>{NOMBRE[t]}: {c.pendiente ?? 0} pendientes · {c.sincronizado ?? 0} sincronizados · {c.error ?? 0} con error</Texto>
      ))}
      <Texto suave>Se sincroniza solo al detectar señal. Puedes trabajar días sin conexión: nada se pierde.</Texto>
      {ultimo ? <Texto suave>Último: {ultimo}</Texto> : null}
      {app.ultimoSync?.fallo ? <Aviso tipo="peligro" texto={`Falló: ${app.ultimoSync.fallo}. Se reintentará con el mismo lote (sin duplicar).`} /> : null}

      {conflictos.length > 0 ? <Titulo>Conflictos</Titulo> : null}
      {conflictos.map((c) => (
        <Tarjeta key={`${c.tabla}:${c.id}`}>
          <Texto negrita tam={T.m}>{NOMBRE[c.tabla]}: {String(c.local.datos.codigo ?? c.local.datos.nombre ?? c.id.slice(0, 8))}</Texto>
          <Texto>Se editó en este celular y en otro lugar.</Texto>
          <Texto suave>Este celular: {c.local.updatedAt.slice(0, 16).replace('T', ' ')} — {resumen(c.local.datos)}</Texto>
          <Texto suave>Servidor: {c.servidor.updatedAt.slice(0, 16).replace('T', ' ')} — {resumen(c.servidor.datos)}</Texto>
          <Aviso tipo="info" texto={`Sugerido (última modificación): ${c.sugerencia === 'local' ? 'mantener el de este celular' : 'usar el del servidor'}`} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton chico estilo={{ flex: 1 }} variante={c.sugerencia === 'local' ? 'primario' : 'secundario'} titulo="Mantener mío"
              onPress={async () => { await resolverConflicto(almacenSqlite(app.db!), c, 'local'); await app.recargar(); await refrescar(); }} />
            <Boton chico estilo={{ flex: 1 }} variante={c.sugerencia === 'servidor' ? 'primario' : 'secundario'} titulo="Usar servidor"
              onPress={async () => { await resolverConflicto(almacenSqlite(app.db!), c, 'servidor'); await app.recargar(); await refrescar(); }} />
          </View>
        </Tarjeta>
      ))}

      <Titulo>Servidor</Titulo>
      <Campo etiqueta="URL de sincronización" valor={url} onCambio={setUrl} placeholder="https://…/api/vetacub/sync" />
      <Boton chico variante="secundario" titulo="Guardar URL" onPress={() => app.setSyncUrl(url.trim())} />
      {!configurado ? <Aviso texto="Configura la URL del backend de tu empresa para sincronizar." /> : null}
    </Pantalla>
  );
}

function resumen(d: Record<string, unknown>): string {
  const k = ['nombre', 'avanceM', 'anchoM', 'leyGt', 'desnivelM', 'cota', 'rumboGrados'].filter((x) => d[x] != null);
  return k.map((x) => `${x}=${String(d[x])}`).join(', ');
}
