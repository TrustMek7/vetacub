import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Campo, Pantalla, Selector, Tarjeta, Texto, Titulo, num } from '../ui/components';
import { guardar, guardarParametros } from '../db/repos';
import { latLonAUtm, zonaSugerida } from '../engine/geo';
import { ADVERTENCIA_GPS, type Bocamina, type Hemisferio } from '../domain/types';
import { useNav } from './nav';
import { T } from '../ui/theme';

export default function BocaminaScreen() {
  const app = useApp();
  const nav = useNav();
  const b = app.bocamina;
  const [lat, setLat] = useState(b ? String(b.lat) : '');
  const [lon, setLon] = useState(b ? String(b.lon) : '');
  const [prec, setPrec] = useState<number | null>(b?.precisionGpsM ?? null);
  const [altGps, setAltGps] = useState<number | null>(null);
  const [cota, setCota] = useState(b ? String(b.cota) : '');
  const [rumbo, setRumbo] = useState(b ? String(b.rumboGrados) : '');
  const [zona, setZona] = useState(b ? String(b.zonaUtm) : String(app.params.zonaUtm));
  const [hem, setHem] = useState<Hemisferio>(b?.hemisferio ?? 'S');
  const [buscando, setBuscando] = useState(false);
  const [rumboVivo, setRumboVivo] = useState<number | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => () => sub.current?.remove(), []);

  const tomarGps = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setErr({ gps: 'Permiso de ubicación denegado' }); return; }
    setBuscando(true);
    try {
      // Varias lecturas y se queda con la más precisa (en bocamina, cielo abierto).
      let mejor: Location.LocationObject | null = null;
      for (let i = 0; i < 4; i++) {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        if (!mejor || (p.coords.accuracy ?? 999) < (mejor.coords.accuracy ?? 999)) mejor = p;
      }
      if (mejor) {
        setLat(mejor.coords.latitude.toFixed(7)); setLon(mejor.coords.longitude.toFixed(7));
        setPrec(mejor.coords.accuracy ?? null); setAltGps(mejor.coords.altitude ?? null);
        setZona(String(zonaSugerida(mejor.coords.longitude))); setHem(mejor.coords.latitude < 0 ? 'S' : 'N');
      }
    } catch (e) { setErr({ gps: 'No se pudo leer el GPS. Sal a cielo abierto y reintenta.' }); }
    setBuscando(false);
  };

  const brujula = async () => {
    if (sub.current) { sub.current.remove(); sub.current = null; setRumboVivo(null); return; }
    sub.current = await Location.watchHeadingAsync((h) => setRumboVivo(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
  };

  const guardarTodo = async () => {
    const e: Record<string, string> = {};
    const vLat = num(lat), vLon = num(lon), vCota = num(cota), vRumbo = num(rumbo), vZona = num(zona);
    if (vLat == null || vLat < -90 || vLat > 90) e.lat = 'Latitud inválida';
    if (vLon == null || vLon < -180 || vLon > 180) e.lon = 'Longitud inválida';
    if (vCota == null) e.cota = 'Ingresa la cota';
    if (vRumbo == null || vRumbo < 0 || vRumbo >= 360) e.rumbo = 'Rumbo entre 0 y 359°';
    if (vZona == null || vZona < 1 || vZona > 60 || !Number.isInteger(vZona)) e.zona = 'Zona 1–60 (Perú: 17, 18 o 19)';
    setErr(e);
    if (Object.keys(e).length || !app.db || !app.operacionId) return;
    await guardar<Bocamina>(app.db, 'bocamina', {
      id: b?.id, operacionId: app.operacionId, lat: vLat!, lon: vLon!, precisionGpsM: prec, cota: vCota!, rumboGrados: vRumbo!, zonaUtm: vZona!, hemisferio: hem,
    });
    if (vZona !== app.params.zonaUtm) await guardarParametros(app.db, app.operacionId, { ...app.params, zonaUtm: vZona! });
    await app.recargar();
    if (app.galerias.length === 0) nav.replace('GaleriaForm'); else nav.goBack();
  };

  const utm = num(lat) != null && num(lon) != null && num(zona) ? latLonAUtm(num(lat)!, num(lon)!, num(zona)!, hem) : null;

  return (
    <Pantalla pie={<Boton titulo="Guardar bocamina" onPress={guardarTodo} />}>
      <Titulo>1. Ubicación (en bocamina, fuera del socavón)</Titulo>
      <Boton variante="acento" titulo={buscando ? 'Leyendo GPS…' : '📍 Tomar GPS aquí'} onPress={tomarGps} deshabilitado={buscando} />
      {err.gps ? <Aviso tipo="peligro" texto={err.gps} /> : null}
      {prec != null ? <Texto negrita>Precisión horizontal: ±{prec.toFixed(0)} m {prec > 15 ? '— espera o muévete a cielo abierto' : ''}</Texto> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Campo etiqueta="Latitud" valor={lat} onCambio={setLat} numerico error={err.lat} /></View>
        <View style={{ flex: 1 }}><Campo etiqueta="Longitud" valor={lon} onCambio={setLon} numerico error={err.lon} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Campo etiqueta="Zona UTM" valor={zona} onCambio={setZona} numerico error={err.zona} /></View>
        <View style={{ flex: 1 }}><Selector etiqueta="Hemisferio" valor={hem} onCambio={setHem} opciones={[{ k: 'S', t: 'Sur' }, { k: 'N', t: 'Norte' }]} /></View>
      </View>
      {utm ? <Texto suave>UTM {utm.zona}{utm.hemisferio}: E {utm.este.toFixed(1)} · N {utm.norte.toFixed(1)}</Texto> : null}

      <Titulo>2. Cota de bocamina</Titulo>
      <Campo etiqueta="Cota (msnm)" valor={cota} onCambio={setCota} numerico sufijo="m" error={err.cota}
        ayuda="Mejor si la tomas de una carta nacional/IGN o un altímetro calibrado." />
      {altGps != null ? <Boton chico variante="secundario" titulo={`Usar altitud GPS (${altGps.toFixed(0)} m)`} onPress={() => setCota(altGps.toFixed(0))} /> : null}
      <Aviso texto={ADVERTENCIA_GPS} />

      <Titulo>3. Rumbo de la veta</Titulo>
      <Campo etiqueta="Rumbo (azimut, 0–359°)" valor={rumbo} onCambio={setRumbo} numerico sufijo="°" error={err.rumbo}
        ayuda="Dirección en que avanza la galería siguiendo la veta. N45E = 45°, N30W = 330°." />
      <Boton chico variante="secundario" titulo={rumboVivo == null ? '🧭 Usar brújula del celular' : 'Detener brújula'} onPress={brujula} />
      {rumboVivo != null ? (
        <Tarjeta>
          <Text style={{ fontSize: T.xxl, fontWeight: '900', textAlign: 'center' }}>{rumboVivo.toFixed(0)}°</Text>
          <Texto suave>Apunta el celular en la dirección de la veta, lejos de rieles y herramientas de fierro.</Texto>
          <Boton titulo="Fijar este rumbo" onPress={() => setRumbo(rumboVivo.toFixed(0))} />
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}
