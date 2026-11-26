import React, { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { AdvertenciaLegal, Aviso, Boton, Campo, Fila, Pantalla, SemaforoCard, Tarjeta, Texto, Titulo, fmt } from '../ui/components';
import { cargarDemo, guardar, guardarParametros } from '../db/repos';
import type { Operacion } from '../domain/types';
import { PARAMETROS_POR_DEFECTO } from '../engine/params';
import { useNav } from './nav';
import { C, T } from '../ui/theme';

export default function InicioScreen() {
  const app = useApp();
  const nav = useNav();
  const [nombre, setNombre] = useState('');
  const abriendoDemo = useRef(false);

  if (!app.operacionId) {
    return (
      <Pantalla>
        <Titulo>Nueva operación</Titulo>
        <Texto>Registra tu mina una sola vez. Todo se guarda en el celular y funciona sin señal.</Texto>
        <Campo etiqueta="Nombre de la mina / operación" valor={nombre} onCambio={setNombre} placeholder="Ej. Mina Santa Rosa" />
        <Boton titulo="Crear y configurar bocamina" deshabilitado={!nombre.trim()} onPress={async () => {
          if (!app.db) return;
          const op = await guardar<Operacion>(app.db, 'operacion', { nombre: nombre.trim() });
          await guardarParametros(app.db, op.id, PARAMETROS_POR_DEFECTO);
          await app.elegirOperacion(op.id);
          nav.navigate('Bocamina');
        }} />
        <Boton variante="secundario" icono="muestras" titulo="Abrir operación demo" onPress={async () => {
          if (!app.db || abriendoDemo.current) return;
          abriendoDemo.current = true;
          try {
            await app.elegirOperacion(await cargarDemo(app.db));
          } catch (error) {
            Alert.alert('No se pudo abrir el demo', error instanceof Error ? error.message : String(error));
          } finally {
            abriendoDemo.current = false;
          }
        }} />
        <AdvertenciaLegal compacta />
      </Pantalla>
    );
  }

  const op = app.operaciones.find((o) => o.id === app.operacionId);
  const e = app.estimacion;
  const r = e?.resumen;
  const pendientes = app.muestras.filter((m) => m.syncStatus !== 'sincronizado').length + app.galerias.filter((g) => g.syncStatus !== 'sincronizado').length;

  return (
    <Pantalla pie={app.bocamina && app.galerias.length > 0
      ? <Boton icono="agregar" titulo="Registrar muestra" onPress={() => nav.navigate('MuestraForm')} />
      : undefined}>
      <Text style={{ fontSize: T.xl, color: C.texto, fontWeight: '900' }}>{op?.nombre}</Text>
      <Texto suave>{app.galerias.length} galerías · {app.muestras.length} muestras · {app.operacionDemo
        ? 'Demo guardada en este equipo'
        : pendientes > 0 ? `${pendientes} por sincronizar` : 'todo sincronizado'}</Texto>

      {!app.bocamina ? <><Aviso tipo="peligro" texto="Falta configurar la bocamina (GPS, cota y rumbo)." /><Boton titulo="Configurar bocamina" onPress={() => nav.navigate('Bocamina')} /></> : null}
      {app.bocamina && app.galerias.length === 0 ? <><Aviso texto="Registra al menos una galería o nivel." /><Boton titulo="Agregar galería" onPress={() => nav.navigate('GaleriaForm')} /></> : null}
      {app.errorCalculo ? <Aviso tipo="peligro" texto={app.errorCalculo} /> : null}

      {e && r ? (
        <>
          <Tarjeta>
            <Texto suave>Oro recuperable · Probado + Probable</Texto>
            <Text style={{ color: C.primario, fontSize: T.xxl, fontWeight: '800', marginVertical: 4 }}>
              {fmt(r.probadoMasProbable.onzasRecuperables, 1)} oz
            </Text>
            <Fila izq="Toneladas" der={fmt(r.probadoMasProbable.toneladas, 1)} />
            <Fila izq="Ley media diluida" der={`${fmt(r.probadoMasProbable.leyMedia, 2)} g/t`} />
            <Fila izq="Oro contenido" der={`${fmt(r.probadoMasProbable.gramos, 0)} g · ${fmt(r.probadoMasProbable.onzas, 1)} oz`} />
            <Fila izq="Oro recuperable" der={`${fmt(r.probadoMasProbable.gramosRecuperables, 0)} g · ${fmt(r.probadoMasProbable.onzasRecuperables, 1)} oz`} negrita />
            <View style={{ height: 8 }} />
            <Texto suave>Posible (no entra al semáforo): {fmt(r.posible.toneladas, 0)} t · {fmt(r.posible.onzasRecuperables, 1)} oz rec.</Texto>
            {e.factor.aplicado ? <Texto suave>Factor de planta aplicado: {fmt(e.factor.factor ?? 1, 2)}</Texto> : null}
          </Tarjeta>
          <SemaforoCard s={e.semaforo} moneda={app.params.moneda} />
          {e.modelo.avisos.map((a) => <Aviso key={a} texto={a} />)}
          <Boton variante="secundario" icono="seccion" titulo="Explorar sección" onPress={() => nav.navigate('Tabs', { screen: 'Sección' })} />
          <Boton icono="archivo" titulo="Ver resultados" onPress={() => nav.navigate('Tabs', { screen: 'Resumen' })} />
        </>
      ) : null}
      <AdvertenciaLegal compacta />
      {app.sincronizando ? <Text style={{ color: C.primario, fontWeight: '700' }}>Sincronizando…</Text> : null}
    </Pantalla>
  );
}
