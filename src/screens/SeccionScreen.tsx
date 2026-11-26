import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Pantalla, Tarjeta, Texto } from '../ui/components';
import { SeccionView } from '../ui/components/SeccionView';
import { RANGOS_LEY } from '../engine/sectionLayout';
import { compartirPdfSeccion } from '../export/share';
import type { PuntoSeccion } from '../engine/blockModel';
import { useNav } from './nav';
import { C, T } from '../ui/theme';

export default function SeccionScreen() {
  const app = useApp();
  const nav = useNav();
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<PuntoSeccion | null>(null);
  const e = app.estimacion;
  if (!e || e.modelo.puntos.length === 0) return <Pantalla><Aviso texto="Registra bocamina, galerías y muestras con ley para ver la sección." /></Pantalla>;
  const nombres = new Map(app.galerias.map((g) => [g.id, g.nombre]));
  const m = sel ? app.muestras.find((x) => x.id === sel.id) : null;

  return (
    <Pantalla scroll={false} pie={<Boton icono="bloques" titulo="Ver modelo de bloques" onPress={() => nav.navigate('Modelo')} />}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton chico estilo={{ flex: 1 }} variante="secundario" soloIcono icono="reducir" titulo="Reducir zoom" onPress={() => setZoom((z) => Math.max(1, z / 1.5))} />
        <Boton chico estilo={{ flex: 1 }} variante="secundario" soloIcono icono="ampliar" titulo="Ampliar zoom" onPress={() => setZoom((z) => Math.min(6, z * 1.5))} />
        <Boton chico estilo={{ flex: 2 }} titulo="Exportar PDF" onPress={() => compartirPdfSeccion(app, e)} />
      </View>
      <View style={{ flex: 1, borderWidth: 1, borderColor: C.borde, backgroundColor: C.superficie, marginVertical: 6 }}>
        <SeccionView modelo={e.modelo} nombres={nombres} ancho={(width - 28) * zoom} alto={420 * Math.max(1, zoom * 0.8)} mostrarBloques={false}
          seleccion={sel?.id} onMuestra={setSel} />
      </View>
      <Texto suave>Ley g/t: {RANGOS_LEY.map((r) => r.etiqueta).join(' · ')} (azul → rojo). Toca un punto.</Texto>
      {m && sel ? (
        <Tarjeta>
          <Texto negrita tam={T.m}>{m.codigo} — {nombres.get(m.galeriaId)}</Texto>
          <Texto>Avance {m.avanceM} m · Cota {sel.y.toFixed(1)} · Ley <Texto negrita>{m.leyGt} g/t</Texto> · Ancho <Texto negrita>{m.anchoM} m</Texto></Texto>
          <Texto suave>Origen: {m.origenLey.replace('_', ' ')} · {m.fecha.slice(0, 10)}</Texto>
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}
