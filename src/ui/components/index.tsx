import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Icono, type NombreIcono } from '../Icono';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ADVERTENCIA_LEGAL } from '../../domain/types';
import { ALTO_BOTON, C, ESPACIO, T } from '../theme';
import type { Semaforo } from '../../engine';

export function Pantalla({ children, scroll = true, pie }: { children: React.ReactNode; scroll?: boolean; pie?: React.ReactNode }) {
  const enPestaña = React.useContext(BottomTabBarHeightContext) != null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.fondo }} edges={enPestaña ? ['left', 'right'] : ['left', 'right', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={{ padding: ESPACIO, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View style={{ flex: 1, padding: ESPACIO }}>{children}</View>}
      {pie ? <View style={st.pie}>{pie}</View> : null}
    </SafeAreaView>
  );
}

type Variante = 'primario' | 'secundario' | 'peligro' | 'acento';
export function Boton({ titulo, onPress, variante = 'primario', deshabilitado, estilo, chico, icono, soloIcono }: {
  titulo: string; onPress: () => void; variante?: Variante; deshabilitado?: boolean; estilo?: ViewStyle; chico?: boolean; icono?: NombreIcono; soloIcono?: boolean;
}) {
  const fondo = { primario: C.primario, secundario: C.superficie, peligro: C.peligro, acento: C.acento }[variante];
  const color = variante === 'secundario' || variante === 'acento' ? C.texto : C.primarioTexto;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={titulo} onPress={onPress} disabled={deshabilitado}
      style={({ pressed }) => [st.boton, { backgroundColor: fondo, opacity: deshabilitado ? 0.4 : pressed ? 0.75 : 1, minHeight: chico ? 48 : ALTO_BOTON }, estilo]}>
      {icono ? <Icono nombre={icono} color={color} tam={20} /> : null}
      {!soloIcono ? <Text style={[st.botonTexto, { color, fontSize: chico ? T.s : T.m }]}>{titulo}</Text> : null}
    </Pressable>
  );
}

export function Campo({ etiqueta, valor, onCambio, numerico, error, ayuda, placeholder, multilinea, autoFocus, sufijo, refInput, onSubmit }: {
  etiqueta: string; valor: string; onCambio: (t: string) => void; numerico?: boolean; error?: string; ayuda?: string;
  placeholder?: string; multilinea?: boolean; autoFocus?: boolean; sufijo?: string; refInput?: React.Ref<React.ComponentRef<typeof TextInput>>; onSubmit?: () => void;
}) {
  return (
    <View style={{ marginBottom: ESPACIO }}>
      <Text style={st.etiqueta}>{etiqueta}</Text>
      <View style={[st.inputCaja, error ? { borderColor: C.peligro, borderWidth: 3 } : null]}>
        <TextInput ref={refInput} style={[st.input, multilinea && { minHeight: 80, textAlignVertical: 'top' }]} value={valor}
          onChangeText={(t) => onCambio(numerico ? t.replace(',', '.') : t)} keyboardType={numerico ? 'decimal-pad' : 'default'}
          placeholder={placeholder} placeholderTextColor={C.gris} multiline={multilinea} autoFocus={autoFocus}
          returnKeyType={onSubmit ? 'next' : 'done'} onSubmitEditing={onSubmit} blurOnSubmit={!onSubmit} selectTextOnFocus />
        {sufijo ? <Text style={st.sufijo}>{sufijo}</Text> : null}
      </View>
      {error ? <Text style={st.error}>{error}</Text> : ayuda ? <Text style={st.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function Selector<K extends string>({ etiqueta, opciones, valor, onCambio }: {
  etiqueta?: string; opciones: { k: K; t: string }[]; valor: K; onCambio: (k: K) => void;
}) {
  return (
    <View style={{ marginBottom: ESPACIO }}>
      {etiqueta ? <Text style={st.etiqueta}>{etiqueta}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {opciones.map((o) => (
          <Pressable key={o.k} onPress={() => onCambio(o.k)} accessibilityRole="radio" accessibilityState={{ selected: valor === o.k }}
            style={[st.opcion, valor === o.k && { backgroundColor: C.primario }]}>
            <Text style={{ fontSize: T.s, fontWeight: '700', color: valor === o.k ? C.primarioTexto : C.texto }}>{o.t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Tarjeta({ children, estilo }: { children: React.ReactNode; estilo?: ViewStyle }) {
  return <View style={[st.tarjeta, estilo]}>{children}</View>;
}

export function Titulo({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: T.l, fontWeight: '800', color: C.texto, marginVertical: 8 }}>{children}</Text>;
}

export function Texto({ children, suave, negrita, tam = T.s }: { children: React.ReactNode; suave?: boolean; negrita?: boolean; tam?: number }) {
  return <Text style={{ fontSize: tam, color: suave ? C.textoSuave : C.texto, fontWeight: negrita ? '700' : '400', lineHeight: tam * 1.35 }}>{children}</Text>;
}

/** Advertencia legal obligatoria (resultados, inicio, reportes). */
export function AdvertenciaLegal({ compacta }: { compacta?: boolean }) {
  return (
    <View style={st.advertencia} accessibilityRole="alert">
      <Text style={{ fontSize: compacta ? T.xs : T.s, fontWeight: '700', color: C.texto }}>{ADVERTENCIA_LEGAL}</Text>
    </View>
  );
}

export function Aviso({ texto, tipo = 'aviso' }: { texto: string; tipo?: 'aviso' | 'peligro' | 'info' }) {
  const color = { aviso: C.aviso, peligro: C.peligro, info: C.primario }[tipo];
  return <View style={[st.aviso, { borderLeftColor: color }]}><Text style={{ fontSize: T.s, color: C.texto }}>{texto}</Text></View>;
}

const COLOR_SEM = { seguir: C.ok, revisar: C.aviso, no_conviene: C.peligro, sin_datos: C.gris } as const;
const fmt = (n: number, d = 0) => n.toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });

export function SemaforoCard({ s, moneda }: { s: Semaforo; moneda: string }) {
  return (
    <View style={[st.semaforo, { borderColor: COLOR_SEM[s.estado] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.superficie, alignItems: 'center', justifyContent: 'center' }}>
          <Icono nombre={s.estado === 'seguir' ? 'confirmar' : s.estado === 'sin_datos' ? 'informacion' : 'aviso'} color={COLOR_SEM[s.estado]} />
        </View>
        <Text style={{ flex: 1, fontSize: T.l, fontWeight: '800', color: C.texto }}>{s.titulo}</Text>
      </View>
      <Text style={{ fontSize: T.s, marginTop: 8, color: C.texto }}>{s.detalle}</Text>
      <Text style={{ fontSize: T.m, marginTop: 6, fontWeight: '700' }}>{fmt(s.onzasRecuperablesPP, 1)} oz recuperables (Probado + Probable)</Text>
      {s.relacion != null ? <Text style={{ fontSize: T.s, color: C.textoSuave }}>Ingreso {moneda} {fmt(s.ingreso)} · Costo {moneda} {fmt(s.costo)} · Margen {moneda} {fmt(s.margen)}</Text> : null}
      <Text style={{ fontSize: T.xs, color: C.textoSuave, marginTop: 4 }}>Orientativo. Depende de los parámetros editables (precio, costos, recuperación, ley de corte).</Text>
    </View>
  );
}

export function Fila({ izq, der, negrita }: { izq: string; der: string; negrita?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#DDD' }}>
      <Text style={{ fontSize: T.s, fontWeight: negrita ? '800' : '400' }}>{izq}</Text>
      <Text style={{ fontSize: T.s, fontWeight: negrita ? '800' : '600' }}>{der}</Text>
    </View>
  );
}

export const st = StyleSheet.create({
  boton: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: C.borde, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  botonTexto: { flexShrink: 1, fontWeight: '800', textAlign: 'center' },
  etiqueta: { fontSize: T.s, fontWeight: '700', color: C.texto, marginBottom: 4 },
  inputCaja: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.borde, borderRadius: 10, backgroundColor: C.superficie },
  input: { flex: 1, fontSize: T.l, paddingHorizontal: 12, minHeight: 56, color: C.texto },
  sufijo: { fontSize: T.m, fontWeight: '700', paddingHorizontal: 12, color: C.textoSuave },
  error: { color: C.peligro, fontSize: T.s, fontWeight: '700', marginTop: 4 },
  ayuda: { color: C.textoSuave, fontSize: T.xs, marginTop: 4 },
  opcion: { borderWidth: 2, borderColor: C.borde, borderRadius: 8, paddingHorizontal: 14, minHeight: 52, justifyContent: 'center' },
  tarjeta: { borderWidth: 1, borderColor: C.borde, borderRadius: 16, padding: ESPACIO, marginVertical: 6, backgroundColor: C.superficie },
  advertencia: { borderWidth: 3, borderColor: C.peligro, backgroundColor: '#FFF4F4', padding: 10, borderRadius: 8, marginVertical: 8 },
  aviso: { borderLeftWidth: 8, backgroundColor: C.fondoSuave, padding: 10, borderRadius: 6, marginVertical: 4 },
  semaforo: { borderWidth: 1, borderRadius: 16, padding: ESPACIO, marginVertical: 8, backgroundColor: C.fondoSuave },
  pie: { paddingHorizontal: ESPACIO, paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.borde, backgroundColor: C.superficie },
});

export const num = (t: string): number | null => {
  if (t.trim() === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export { fmt };
