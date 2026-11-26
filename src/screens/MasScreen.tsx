import React from 'react';
import { useApp } from '../state/AppContext';
import { AdvertenciaLegal, Boton, Pantalla, Texto } from '../ui/components';
import { useNav } from './nav';

export default function MasScreen() {
  const app = useApp();
  const nav = useNav();
  const op = app.operaciones.find((o) => o.id === app.operacionId);
  return (
    <Pantalla>
      <Texto suave>Operación activa: {op?.nombre ?? '—'}</Texto>
      <Boton titulo="📍 Bocamina" onPress={() => nav.navigate('Bocamina')} deshabilitado={!op} />
      <Boton titulo="⛏ Galerías / niveles" onPress={() => nav.navigate('Galerias')} deshabilitado={!op} />
      <Boton titulo="🗺 Mapa" onPress={() => nav.navigate('Mapa')} deshabilitado={!app.bocamina} />
      <Boton titulo="📊 Resultados y exportación" onPress={() => nav.navigate('Resultados')} deshabilitado={!op} />
      <Boton titulo="⚙ Parámetros" onPress={() => nav.navigate('Parametros')} deshabilitado={!op} />
      <Boton titulo={`⇅ Sincronización${app.sincronizando ? ' (en curso)' : ''}`} onPress={() => nav.navigate('Sync')} />
      <Boton variante="secundario" titulo="Operaciones" onPress={() => nav.navigate('Operaciones')} />
      <Boton variante="secundario" titulo="⚠ Advertencia y limitaciones" onPress={() => nav.navigate('Legal')} />
      <AdvertenciaLegal compacta />
    </Pantalla>
  );
}
