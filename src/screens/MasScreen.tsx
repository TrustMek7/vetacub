import React from 'react';
import { useApp } from '../state/AppContext';
import { Boton, Pantalla, Texto, Titulo } from '../ui/components';
import { useNav } from './nav';

export default function MasScreen() {
  const app = useApp();
  const nav = useNav();
  const op = app.operaciones.find((o) => o.id === app.operacionId);
  return (
    <Pantalla>
      <Titulo>Operación</Titulo>
      <Texto suave>Operación activa: {op?.nombre ?? '—'}</Texto>
      <Boton variante="secundario" icono="ubicacion" titulo="Bocamina" onPress={() => nav.navigate('Bocamina')} deshabilitado={!op} />
      <Boton variante="secundario" icono="niveles" titulo="Galerías y niveles" onPress={() => nav.navigate('Galerias')} deshabilitado={!op} />
      <Boton variante="secundario" icono="mapa" titulo="Mapa" onPress={() => nav.navigate('Mapa')} deshabilitado={!app.bocamina} />
      <Boton variante="secundario" icono="bloques" titulo="Modelo de bloques" onPress={() => nav.navigate('Modelo')} deshabilitado={!app.estimacion} />
      <Titulo>Configuración</Titulo>
      <Boton variante="secundario" icono="ajustes" titulo="Parámetros" onPress={() => nav.navigate('Parametros')} deshabilitado={!op} />
      <Boton variante="secundario" icono="sincronizar" titulo={`Sincronización${app.sincronizando ? ' (en curso)' : ''}`} onPress={() => nav.navigate('Sync')} />
      <Boton variante="secundario" icono="niveles" titulo="Cambiar operación" onPress={() => nav.navigate('Operaciones')} />
      <Boton variante="secundario" icono="aviso" titulo="Advertencia y limitaciones" onPress={() => nav.navigate('Legal')} />
    </Pantalla>
  );
}
