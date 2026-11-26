import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../state/AppContext';
import { Boton, Campo, Pantalla, Texto, Titulo } from '../ui/components';
import { guardar, guardarParametros, importarDatos, nuevoId } from '../db/repos';
import { datosDemo } from '../demo/datosDemo';
import { PARAMETROS_POR_DEFECTO } from '../engine/params';
import type { Operacion } from '../domain/types';
import { useNav } from './nav';

export default function OperacionesScreen() {
  const app = useApp();
  const nav = useNav();
  const [nombre, setNombre] = useState('');
  return (
    <Pantalla>
      <Titulo>Elegir operación</Titulo>
      {app.operaciones.map((o) => (
        <Boton key={o.id} variante={o.id === app.operacionId ? 'primario' : 'secundario'} titulo={o.nombre}
          onPress={async () => { await app.elegirOperacion(o.id); nav.goBack(); }} />
      ))}
      <Titulo>Nueva operación</Titulo>
      <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
      <Boton titulo="Crear" deshabilitado={!nombre.trim()} onPress={async () => {
        const op = await guardar<Operacion>(app.db!, 'operacion', { nombre: nombre.trim() });
        await guardarParametros(app.db!, op.id, PARAMETROS_POR_DEFECTO);
        await app.elegirOperacion(op.id);
        nav.replace('Bocamina');
      }} />
      <Titulo>Datos de ejemplo</Titulo>
      <Texto suave>Carga una mina ficticia con 3 niveles, 45 muestras y 3 liquidaciones para conocer la app.</Texto>
      <Boton variante="acento" titulo="Cargar ejemplo" onPress={async () => {
        const d = datosDemo(nuevoId());
        // IDs nuevos para no chocar con otra carga del ejemplo
        const mapa = new Map<string, string>();
        const id = (v: string) => { if (!mapa.has(v)) mapa.set(v, nuevoId()); return mapa.get(v)!; };
        d.bocamina.id = id(d.bocamina.id);
        d.galerias.forEach((g) => { g.id = id(g.id); if (g.galeriaRefId) g.galeriaRefId = id(g.galeriaRefId); });
        d.muestras.forEach((m) => { m.id = id(m.id); m.galeriaId = id(m.galeriaId); });
        d.liquidaciones.forEach((l) => { l.id = id(l.id); l.operacionId = d.operacion.id; });
        await importarDatos(app.db!, d);
        await app.elegirOperacion(d.operacion.id);
        Alert.alert('Listo', 'Se cargó la mina de ejemplo.');
        nav.goBack();
      }} />
    </Pantalla>
  );
}
