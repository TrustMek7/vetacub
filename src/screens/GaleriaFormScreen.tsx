import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Campo, Pantalla, Selector, Texto, num } from '../ui/components';
import { borrar, guardar } from '../db/repos';
import { cotasGalerias } from '../engine/geo';
import type { Galeria, ModoDesnivel } from '../domain/types';
import type { RootStack } from '../../App';
import { useNav } from './nav';

export default function GaleriaFormScreen() {
  const app = useApp();
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStack, 'GaleriaForm'>>();
  const g = app.galerias.find((x) => x.id === params?.id);
  const [nombre, setNombre] = useState(g?.nombre ?? (app.galerias.length === 0 ? 'Nivel principal' : ''));
  const [modo, setModo] = useState<ModoDesnivel>(g?.modoDesnivel ?? 'acumulado');
  const [sentido, setSentido] = useState<'abajo' | 'arriba'>(g && g.desnivelM > 0 ? 'arriba' : 'abajo');
  const [desnivel, setDesnivel] = useState(g ? String(Math.abs(g.desnivelM)) : app.galerias.length === 0 ? '0' : '');
  const [ref, setRef] = useState<string>(g?.galeriaRefId ?? '__boca');
  const [fecha, setFecha] = useState(g?.fecha ?? new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState(g?.observaciones ?? '');
  const [err, setErr] = useState<Record<string, string>>({});

  const d = num(desnivel);
  const desnivelM = d == null ? null : sentido === 'abajo' ? -Math.abs(d) : Math.abs(d);
  const otras = app.galerias.filter((x) => x.id !== g?.id);

  const cotaPrevia = useMemo(() => {
    if (!app.bocamina || desnivelM == null) return null;
    try {
      const prueba = { id: '__nueva', modoDesnivel: modo, desnivelM, galeriaRefId: modo === 'tramo' && ref !== '__boca' ? ref : null };
      return cotasGalerias(app.bocamina.cota, [...otras, prueba]).get('__nueva') ?? null;
    } catch { return null; }
  }, [app.bocamina, desnivelM, modo, ref, otras]);

  const guardarG = async () => {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = 'Ponle un nombre (ej. Nv 2850)';
    if (desnivelM == null) e.desnivel = 'Ingresa el desnivel medido con wincha (0 si es el nivel de la bocamina)';
    if (otras.some((x) => x.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())) e.nombre = 'Ya existe una galería con ese nombre';
    setErr(e);
    if (Object.keys(e).length || !app.db || !app.operacionId) return;
    await guardar<Galeria>(app.db, 'galeria', {
      id: g?.id, operacionId: app.operacionId, nombre: nombre.trim(), modoDesnivel: modo, desnivelM: desnivelM!,
      galeriaRefId: modo === 'tramo' && ref !== '__boca' ? ref : null, fecha, observaciones: obs || null,
    });
    await app.recargar();
    nav.goBack();
  };

  return (
    <Pantalla pie={<Boton titulo="Guardar galería" onPress={guardarG} />}>
      <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} error={err.nombre} placeholder="Nv 2850, Galería Norte…" />
      <Selector etiqueta="¿Cómo mediste el desnivel?" valor={modo} onCambio={setModo} opciones={[
        { k: 'acumulado', t: 'Desde la bocamina' }, { k: 'tramo', t: 'Desde otra galería' }]} />
      {modo === 'tramo' ? (
        <Selector etiqueta="Medido desde" valor={ref} onCambio={setRef}
          opciones={[{ k: '__boca', t: 'Bocamina' }, ...otras.map((x) => ({ k: x.id, t: x.nombre }))]} />
      ) : null}
      <Selector etiqueta="Sentido" valor={sentido} onCambio={setSentido} opciones={[{ k: 'abajo', t: '⬇ Más abajo' }, { k: 'arriba', t: '⬆ Más arriba' }]} />
      <Campo etiqueta="Desnivel (wincha)" valor={desnivel} onCambio={setDesnivel} numerico sufijo="m" error={err.desnivel} />
      {cotaPrevia != null ? <Texto negrita>Cota calculada: {cotaPrevia.toFixed(1)} msnm</Texto> : null}
      <Campo etiqueta="Fecha" valor={fecha} onCambio={setFecha} placeholder="AAAA-MM-DD" />
      <Campo etiqueta="Observaciones" valor={obs} onCambio={setObs} multilinea />
      {g ? <Boton variante="peligro" titulo="Eliminar galería" onPress={() => {
        const n = app.muestras.filter((m) => m.galeriaId === g.id).length;
        if (n > 0) { Alert.alert('No se puede eliminar', `Tiene ${n} muestras. Elimínalas o muévelas primero.`); return; }
        if (otras.some((x) => x.galeriaRefId === g.id)) { Alert.alert('No se puede eliminar', 'Otra galería mide su desnivel desde esta.'); return; }
        Alert.alert('Eliminar galería', '¿Seguro?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await borrar(app.db!, 'galeria', g.id); await app.recargar(); nav.goBack(); } }]);
      }} /> : null}
      {!app.bocamina ? <Aviso tipo="peligro" texto="Sin bocamina no se puede calcular la cota." /> : null}
    </Pantalla>
  );
}
