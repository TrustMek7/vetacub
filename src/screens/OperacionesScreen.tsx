import React, { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../state/AppContext';
import { Boton, Campo, Pantalla, Texto, Titulo } from '../ui/components';
import { cargarDemo, guardar, guardarParametros } from '../db/repos';
import { PARAMETROS_POR_DEFECTO } from '../engine/params';
import type { Operacion } from '../domain/types';
import { useNav } from './nav';

export default function OperacionesScreen() {
  const app = useApp();
  const nav = useNav();
  const [nombre, setNombre] = useState('');
  const guardandoDemo = useRef(false);
  const abrirDemo = async (restablecer = false) => {
    if (!app.db || guardandoDemo.current) return;
    guardandoDemo.current = true;
    try {
      await app.elegirOperacion(await cargarDemo(app.db, restablecer));
      nav.goBack();
    } catch (error) {
      Alert.alert('No se pudo cargar el ejemplo', error instanceof Error ? error.message : String(error));
    } finally {
      guardandoDemo.current = false;
    }
  };
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
      <Texto suave>Explora una operación ficticia con tres galerías y una muestra pendiente de ensaye.</Texto>
      <Boton variante="acento" titulo="Abrir operación demo" onPress={() => abrirDemo()} />
      <Boton variante="secundario" titulo="Restablecer demo" onPress={() => {
        Alert.alert('Restablecer operación demo', 'Se reemplazarán los cambios hechos en la operación de ejemplo.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Restablecer', style: 'destructive', onPress: () => void abrirDemo(true) },
        ]);
      }} />
    </Pantalla>
  );
}
