import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Pantalla, Texto } from '../ui/components';
import { C, T } from '../ui/theme';
import { useNav } from './nav';

export default function GaleriasScreen() {
  const app = useApp();
  const nav = useNav();
  const cotas = app.estimacion?.modelo.cotas;
  return (
    <Pantalla pie={<Boton titulo="＋ Nueva galería / nivel" onPress={() => nav.navigate('GaleriaForm')} />}>
      {!app.bocamina ? <Aviso tipo="peligro" texto="Configura primero la bocamina: la cota de cada galería se calcula desde ella." /> : null}
      {app.galerias.length === 0 ? <Texto suave>Aún no hay galerías.</Texto> : null}
      {[...app.galerias].sort((a, b) => (cotas?.get(b.id) ?? 0) - (cotas?.get(a.id) ?? 0)).map((g) => {
        const n = app.muestras.filter((m) => m.galeriaId === g.id).length;
        const ref = g.modoDesnivel === 'tramo' ? app.galerias.find((x) => x.id === g.galeriaRefId)?.nombre ?? 'bocamina' : 'bocamina';
        return (
          <Pressable key={g.id} onPress={() => nav.navigate('GaleriaForm', { id: g.id })}
            style={{ borderWidth: 2, borderColor: C.borde, borderRadius: 10, padding: 12, marginVertical: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: T.l, fontWeight: '800' }}>{g.nombre}</Text>
              <Text style={{ fontSize: T.l, fontWeight: '800' }}>{cotas?.get(g.id)?.toFixed(1) ?? '—'} m</Text>
            </View>
            <Texto suave>{g.desnivelM >= 0 ? '+' : ''}{g.desnivelM} m desde {ref} · {n} muestras · {g.syncStatus}</Texto>
          </Pressable>
        );
      })}
    </Pantalla>
  );
}
