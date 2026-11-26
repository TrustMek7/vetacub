import React, { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Boton, Pantalla, Selector, Texto } from '../ui/components';
import { colorLey } from '../engine/sectionLayout';
import { Icono } from '../ui/Icono';
import { C, T } from '../ui/theme';
import { useNav } from './nav';

export default function MuestrasScreen() {
  const app = useApp();
  const nav = useNav();
  const [filtro, setFiltro] = useState<string>('todas');
  const nombres = new Map(app.galerias.map((g) => [g.id, g.nombre]));
  const lista = app.muestras
    .filter((m) => filtro === 'todas' || (filtro === 'pendientes' ? m.leyGt == null : m.galeriaId === filtro))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Pantalla scroll={false} pie={<Boton variante="acento" icono="agregar" titulo="Nueva muestra" onPress={() => nav.navigate('MuestraForm')} deshabilitado={app.galerias.length === 0} />}>
      <Selector valor={filtro} onCambio={setFiltro} opciones={[
        { k: 'todas', t: 'Todas' }, { k: 'pendientes', t: 'Sin ley' }, ...app.galerias.map((g) => ({ k: g.id, t: g.nombre }))]} />
      {app.galerias.length === 0 ? <Boton variante="secundario" icono="niveles" titulo="Abrir galerías" onPress={() => nav.navigate('Galerias')} /> : null}
      <FlatList style={{ flex: 1 }} ListEmptyComponent={<Texto suave>{filtro === 'pendientes' ? 'No hay muestras pendientes de ensaye.' : 'Aún no hay muestras en esta vista.'}</Texto>} data={lista} keyExtractor={(m) => m.id} renderItem={({ item: m }) => (
        <Pressable accessibilityRole="button" onPress={() => nav.navigate('MuestraForm', { id: m.id })}
          style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#CCC', paddingVertical: 10, gap: 12 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: m.leyGt == null ? C.fondo : colorLey(m.leyGt) }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: T.m, fontWeight: '800' }}>{m.codigo}</Text>
            <Texto suave>{nombres.get(m.galeriaId)} · {m.avanceM} m · ancho {m.anchoM} m</Texto>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: T.l, fontWeight: '900' }}>{m.leyGt == null ? '—' : m.leyGt}</Text>
            <Text style={{ fontSize: T.xs }}>{m.leyGt == null ? 'Sin ensaye' : 'g/t'}</Text>
          </View>
          <Icono nombre="flecha" color={C.gris} tam={16} />
        </Pressable>
      )} />
    </Pantalla>
  );
}
