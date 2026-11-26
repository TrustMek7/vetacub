import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Pantalla, Texto } from '../ui/components';
import { mapaHtml } from '../map/leafletHtml';
import { descargarTeselas, hayTeselas } from '../map/tiles';
import { ubicarMuestra } from '../engine/geo';
import { colorLey } from '../engine/sectionLayout';
import { ADVERTENCIA_GPS } from '../domain/types';

export default function MapaScreen() {
  const app = useApp();
  const [conTeselas, setConTeselas] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const plantilla = (Constants.expoConfig?.extra?.tileUrl as string) ?? '';

  useEffect(() => { hayTeselas().then(setConTeselas); }, []);

  const html = useMemo(() => {
    const b = app.bocamina;
    if (!b) return null;
    const cotas = app.estimacion?.modelo.cotas ?? new Map<string, number>();
    const nombres = new Map(app.galerias.map((g) => [g.id, g.nombre]));
    const muestras = app.muestras.filter((m) => cotas.has(m.galeriaId)).map((m) => {
      const u = ubicarMuestra(b, m.avanceM, cotas.get(m.galeriaId)!);
      return {
        lat: u.lat, lon: u.lon, etiqueta: m.codigo, color: m.leyGt == null ? '#ffffff' : colorLey(m.leyGt),
        detalle: `${nombres.get(m.galeriaId)} · ${m.avanceM} m<br>Ley ${m.leyGt ?? 'pendiente'} g/t · ancho ${m.anchoM} m<br>Cota aprox. ${u.cota.toFixed(1)}<br>UTM E ${u.este.toFixed(0)} N ${u.norte.toFixed(0)}`,
      };
    });
    return mapaHtml({
      centro: { lat: b.lat, lon: b.lon }, zoomMax: 17, muestras,
      bocamina: { lat: b.lat, lon: b.lon, etiqueta: 'Bocamina', color: '#000', detalle: `Cota ${b.cota} msnm · rumbo ${b.rumboGrados}°` },
      teselas: conTeselas ? 'tiles/{z}/{x}/{y}.png' : null,
    });
  }, [app.bocamina, app.muestras, app.galerias, app.estimacion, conTeselas]);

  if (!app.bocamina || !html) return <Pantalla><Aviso tipo="peligro" texto="Configura la bocamina para ver el mapa." /></Pantalla>;

  return (
    <View style={{ flex: 1 }}>
      <WebView originWhitelist={['*']} source={{ html, baseUrl: FileSystem.documentDirectory ?? undefined }}
        allowFileAccess allowFileAccessFromFileURLs allowUniversalAccessFromFileURLs style={{ flex: 1 }} />
      <View style={{ padding: 8, backgroundColor: '#fff', borderTopWidth: 2 }}>
        <Texto suave>{ADVERTENCIA_GPS} Las muestras se ubican con rumbo y metros de avance (galería recta).</Texto>
        {!conTeselas ? <Aviso texto="Sin mapa base descargado: se ven solo los puntos. Descárgalo cuando tengas señal." /> : null}
        <Boton chico variante="secundario" deshabilitado={!!progreso || !plantilla || plantilla.includes('TU-SERVIDOR')}
          titulo={progreso ?? (plantilla.includes('TU-SERVIDOR') ? 'Configura tileUrl en app.json' : 'Descargar mapa base (≈1.5 km)')}
          onPress={async () => {
            const b = app.bocamina!;
            const r = await descargarTeselas(plantilla, b.lat, b.lon, { onProgreso: (h, t) => setProgreso(`Descargando ${h}/${t}…`) });
            setProgreso(null);
            setConTeselas(r.ok > 0);
          }} />
      </View>
    </View>
  );
}
