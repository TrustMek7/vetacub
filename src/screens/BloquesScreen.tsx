import React, { useState } from 'react';
import { Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useNav } from './nav';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Fila, Pantalla, Selector, Texto, Titulo, fmt } from '../ui/components';
import { SeccionView } from '../ui/components/SeccionView';
import { COLOR_BAJO_CORTE, COLOR_CATEGORIA, RANGOS_LEY, type ModoColor } from '../engine/sectionLayout';
import type { Bloque } from '../engine/blockModel';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, T } from '../ui/theme';

const NOMBRE_CAT = { probado: 'Probado', probable: 'Probable', posible: 'Posible' } as const;

export default function BloquesScreen() {
  const app = useApp();
  const nav = useNav();
  const { width } = useWindowDimensions();
  const [modo, setModo] = useState<ModoColor>('categoria');
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<Bloque | null>(null);
  const e = app.estimacion;
  if (!e || e.modelo.bloques.length === 0) return <SafeAreaView style={{ flex: 1, padding: 12 }}><Aviso texto="Aún no hay bloques: registra muestras con ley." /></SafeAreaView>;
  const nombres = new Map(app.galerias.map((g) => [g.id, g.nombre]));
  const porId = new Map(app.muestras.map((m) => [m.id, m]));
  const p = app.params;

  const leyenda = modo === 'categoria'
    ? [...Object.entries(COLOR_CATEGORIA).map(([k, c]) => ({ c, t: NOMBRE_CAT[k as keyof typeof NOMBRE_CAT] })), { c: COLOR_BAJO_CORTE, t: `< ${p.leyCorte} g/t` }]
    : [...RANGOS_LEY.map((r) => ({ c: r.color, t: r.etiqueta })), { c: COLOR_BAJO_CORTE, t: 'bajo corte' }];

  return (
    <Pantalla scroll={false} pie={<Boton icono="archivo" titulo="Ver resultados" onPress={() => nav.navigate('Resultados')} />}>
      <Selector valor={modo} onCambio={setModo} opciones={[{ k: 'categoria', t: 'Por categoría' }, { k: 'ley', t: 'Por ley diluida' }]} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton chico estilo={{ flex: 1 }} variante="secundario" soloIcono icono="reducir" titulo="Reducir zoom" onPress={() => setZoom((z) => Math.max(1, z / 1.5))} />
        <Boton chico estilo={{ flex: 1 }} variante="secundario" soloIcono icono="ampliar" titulo="Ampliar zoom" onPress={() => setZoom((z) => Math.min(6, z * 1.5))} />
      </View>
      <View style={{ flex: 1, borderWidth: 2, marginVertical: 6 }}>
        <SeccionView modelo={e.modelo} nombres={nombres} ancho={(width - 28) * zoom} alto={460 * Math.max(1, zoom * 0.8)}
          mostrarBloques modo={modo} seleccion={sel?.id} onBloque={setSel} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {leyenda.map((x) => <View key={x.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 16, height: 16, backgroundColor: x.c, borderWidth: 1 }} /><Text style={{ fontSize: T.xs, fontWeight: '700' }}>{x.t}</Text></View>)}
      </View>
      <Texto suave>Celda {p.celdaLargo}×{p.celdaAlto} m · IDW p={p.potenciaIdw}. Toca un bloque para ver qué muestras influyeron.</Texto>

      <Modal visible={!!sel} animationType="slide" onRequestClose={() => setSel(null)}>
        {sel ? (
          <SafeAreaView style={{ flex: 1, padding: 12 }}>
            <ScrollView>
              <Titulo>Bloque {sel.id} — {NOMBRE_CAT[sel.categoria]}</Titulo>
              <Texto suave>{sel.motivoCategoria} · muestra más cercana a {fmt(sel.distanciaMuestraMasCercana, 1)} m</Texto>
              {!sel.sobreLeyCorte ? <Aviso tipo="peligro" texto={`Ley diluida ${fmt(sel.leyDiluida, 2)} g/t bajo ley de corte ${p.leyCorte} g/t: NO se cuenta.`} /> : null}
              <Fila izq="Avance" der={`${fmt(sel.x0, 1)} – ${fmt(sel.x1, 1)} m`} />
              <Fila izq="Cota" der={`${fmt(sel.y0, 1)} – ${fmt(sel.y1, 1)}`} />
              <Fila izq="Ley interpolada (IDW)" der={`${fmt(sel.leyInterpolada, 2)} g/t`} />
              <Fila izq="Ancho interpolado" der={`${fmt(sel.anchoInterpolado, 2)} m`} />
              {sel.factorPlanta !== 1 ? <Fila izq="× Factor de planta" der={fmt(sel.factorPlanta, 3)} /> : null}
              <Fila izq="Ley diluida" der={`${fmt(sel.leyDiluida, 2)} g/t`} negrita />
              <Fila izq="Ancho de minado" der={`${fmt(sel.anchoMinado, 2)} m`} />
              <Fila izq="Toneladas" der={fmt(sel.toneladas, 2)} />
              <Fila izq="Oro" der={`${fmt(sel.gramos, 1)} g · ${fmt(sel.onzas, 3)} oz`} />
              <Fila izq="Oro recuperable" der={`${fmt(sel.gramosRecuperables, 1)} g`} negrita />
              <Titulo>Muestras que influyeron</Titulo>
              {[...sel.influencias].sort((a, b) => b.peso - a.peso).map((i) => {
                const m = porId.get(i.muestraId);
                return <Fila key={i.muestraId} izq={`${m?.codigo ?? i.muestraId} (${m?.leyGt} g/t, ${m?.anchoM} m)`} der={`${fmt(i.peso * 100, 1)} % · ${fmt(i.distancia, 1)} m`} />;
              })}
            </ScrollView>
            <Boton titulo="Cerrar" onPress={() => setSel(null)} />
          </SafeAreaView>
        ) : null}
      </Modal>
    </Pantalla>
  );
}
