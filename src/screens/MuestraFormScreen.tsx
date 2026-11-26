// Captura rápida (< 1 minuto): galería y origen se recuerdan, el avance se sugiere y el código se autogenera.
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Image, type TextInput, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Campo, Pantalla, Selector, Texto, num } from '../ui/components';
import { borrar, guardar, setMeta } from '../db/repos';
import { validarMuestra } from '../engine/validation';
import type { Muestra, OrigenLey } from '../domain/types';
import type { RootStack } from '../../App';
import { useNav } from './nav';

export default function MuestraFormScreen() {
  const app = useApp();
  const nav = useNav();
  const { params } = useRoute<RouteProp<RootStack, 'MuestraForm'>>();
  const m = app.muestras.find((x) => x.id === params?.id);

  const ultima = useMemo(() => [...app.muestras].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [app.muestras]);
  const [galeriaId, setGaleriaId] = useState(m?.galeriaId ?? ultima?.galeriaId ?? app.galerias[0]?.id ?? '');
  const deGaleria = (gid: string) => app.muestras.filter((x) => x.galeriaId === gid && x.id !== m?.id).sort((a, b) => a.avanceM - b.avanceM);

  const sugerirAvance = (gid: string) => {
    const ms = deGaleria(gid);
    if (ms.length === 0) return '';
    const paso = ms.length >= 2 ? ms[ms.length - 1].avanceM - ms[ms.length - 2].avanceM : 3;
    return String(Math.round((ms[ms.length - 1].avanceM + (paso > 0 && paso <= 5 ? paso : 3)) * 10) / 10);
  };
  const sugerirCodigo = (gid: string) => {
    const g = app.galerias.find((x) => x.id === gid);
    const n = deGaleria(gid).length + 1;
    return `${(g?.nombre ?? 'M').replace(/\s+/g, '')}-${String(n).padStart(3, '0')}`;
  };

  const [avance, setAvance] = useState(m ? String(m.avanceM) : sugerirAvance(galeriaId));
  const [ancho, setAncho] = useState(m ? String(m.anchoM) : '');
  const [ley, setLey] = useState(m?.leyGt != null ? String(m.leyGt) : '');
  const [origen, setOrigen] = useState<OrigenLey>(m?.origenLey ?? ultima?.origenLey ?? 'ensaye_planta');
  const [codigo, setCodigo] = useState(m?.codigo ?? sugerirCodigo(galeriaId));
  const [lote, setLote] = useState(m?.loteVentaCodigo ?? '');
  const [foto, setFoto] = useState<string | null>(m?.fotoUri ?? null);
  const [obs, setObs] = useState(m?.observaciones ?? '');
  const [fecha] = useState(m?.fecha ?? new Date().toISOString());
  const [mas, setMas] = useState(!!m);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const refAncho = useRef<React.ComponentRef<typeof TextInput>>(null);
  const refLey = useRef<React.ComponentRef<typeof TextInput>>(null);

  const cambiarGaleria = (gid: string) => {
    setGaleriaId(gid);
    if (!m) { setAvance(sugerirAvance(gid)); setCodigo(sugerirCodigo(gid)); }
  };

  const validacion = validarMuestra(
    { galeriaId, avanceM: num(avance), anchoM: num(ancho), leyGt: num(ley) },
    deGaleria(galeriaId).filter((x) => x.leyGt != null).map((x) => ({ avanceM: x.avanceM, leyGt: x.leyGt as number })),
    { factorAnomalia: app.params.anomaliaFactorMediana, leyObligatoria: false },
  );

  const tomarFoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5, exif: false });
    if (r.canceled) return;
    const dir = `${FileSystem.documentDirectory}fotos/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const destino = `${dir}${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: r.assets[0].uri, to: destino });
    setFoto(destino);
  };

  const guardarM = async (siguiente: boolean) => {
    setErrores(validacion.errores);
    if (!validacion.ok || !app.db || !app.operacionId) return;
    const hacer = async () => {
      if (app.muestras.some((x) => x.id !== m?.id && x.codigo.trim().toLowerCase() === codigo.trim().toLowerCase())) {
        Alert.alert('Código repetido', 'Ya existe una muestra con ese código.'); return;
      }
      await guardar<Muestra>(app.db!, 'muestra', {
        id: m?.id, operacionId: app.operacionId!, galeriaId, codigo: codigo.trim(), avanceM: num(avance)!, anchoM: num(ancho)!,
        leyGt: num(ley), origenLey: origen, fotoUri: foto, loteVentaCodigo: lote.trim() || null, fecha, observaciones: obs.trim() || null,
      });
      await setMeta(app.db!, 'ultimaGaleria', galeriaId);
      await app.recargar();
      if (siguiente) {
        // Limpia para la siguiente muestra de la misma galería
        // Mismo paso que entre esta muestra y la anterior (2–5 m típico); 3 m si no hay referencia.
        const actual = num(avance)!;
        const anterior = deGaleria(galeriaId).filter((x) => x.avanceM < actual).at(-1)?.avanceM;
        const paso = anterior != null && actual - anterior >= 1 && actual - anterior <= 5 ? actual - anterior : 3;
        setAvance(String(Math.round((actual + paso) * 10) / 10)); setAncho(''); setLey(''); setFoto(null); setObs(''); setLote('');
        setCodigo((c) => c.replace(/(\d+)$/, (d) => String(Number(d) + 1).padStart(d.length, '0')));
        setErrores({});
        refAncho.current?.focus();
      } else nav.goBack();
    };
    if (validacion.advertencias.length) {
      Alert.alert('Revisa', validacion.advertencias.join('\n\n'), [{ text: 'Corregir', style: 'cancel' }, { text: 'Guardar igual', onPress: hacer }]);
    } else await hacer();
  };

  return (
    <Pantalla pie={
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton estilo={{ flex: 1 }} variante="secundario" titulo="Guardar" onPress={() => guardarM(false)} />
        {!m ? <Boton estilo={{ flex: 1.4 }} variante="acento" titulo="Guardar y siguiente" onPress={() => guardarM(true)} /> : null}
      </View>}>
      <Selector etiqueta="Galería" valor={galeriaId} onCambio={cambiarGaleria} opciones={app.galerias.map((g) => ({ k: g.id, t: g.nombre }))} />
      <Campo etiqueta="Metros desde bocamina (wincha)" valor={avance} onCambio={setAvance} numerico sufijo="m" error={errores.avanceM}
        onSubmit={() => refAncho.current?.focus()} />
      <Campo refInput={refAncho} etiqueta="Ancho de veta" valor={ancho} onCambio={setAncho} numerico sufijo="m" error={errores.anchoM}
        ayuda="En metros: 40 cm = 0.40" onSubmit={() => refLey.current?.focus()} autoFocus={!m && avance !== ''} />
      <Campo refInput={refLey} etiqueta="Ley de oro (vacío = pendiente de ensaye)" valor={ley} onCambio={setLey} numerico sufijo="g/t" error={errores.leyGt} />
      <Selector etiqueta="Origen de la ley" valor={origen} onCambio={setOrigen} opciones={[
        { k: 'ensaye_planta', t: 'Ensaye planta' }, { k: 'laboratorio', t: 'Laboratorio' }, { k: 'batea', t: 'Batea' }]} />
      {origen === 'batea' ? <Aviso texto="La ley estimada con batea es muy aproximada. Confírmala con ensaye." /> : null}
      {validacion.advertencias.map((a) => <Aviso key={a} texto={a} />)}
      <Campo etiqueta="Código de muestra" valor={codigo} onCambio={setCodigo} ayuda="Escríbelo con pintura en la caja. Se vincula al lote de venta." />

      {!mas ? <Boton chico variante="secundario" titulo="Más datos (foto, lote, notas)" onPress={() => setMas(true)} /> : (
        <>
          <Boton chico variante="secundario" titulo={foto ? '📷 Cambiar foto' : '📷 Tomar foto'} onPress={tomarFoto} />
          {foto ? <Image source={{ uri: foto }} style={{ width: '100%', height: 180, borderRadius: 8, borderWidth: 2 }} /> : null}
          <Campo etiqueta="Código de lote de venta (opcional)" valor={lote} onCambio={setLote} />
          <Campo etiqueta="Observaciones" valor={obs} onCambio={setObs} multilinea />
          <Texto suave>Fecha: {fecha.slice(0, 16).replace('T', ' ')}</Texto>
        </>
      )}
      {m ? <Boton variante="peligro" titulo="Eliminar muestra" onPress={() => Alert.alert('Eliminar muestra', `¿Eliminar ${m.codigo}?`, [
        { text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await borrar(app.db!, 'muestra', m.id); await app.recargar(); nav.goBack(); } }])} /> : null}
    </Pantalla>
  );
}
