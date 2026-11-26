// Sección longitudinal interactiva (react-native-svg). Un solo toque detecta la muestra o bloque más cercano.
import React, { useMemo } from 'react';
import { Pressable, ScrollView } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colorBloque, colorLey, escalaSeccion, type Lienzo, type ModoColor } from '../../engine/sectionLayout';
import type { Bloque, ModeloBloques, PuntoSeccion } from '../../engine/blockModel';

export function SeccionView({ modelo, nombres, ancho, alto, mostrarBloques, modo = 'categoria', seleccion, onMuestra, onBloque }: {
  modelo: ModeloBloques; nombres: Map<string, string>; ancho: number; alto: number;
  mostrarBloques: boolean; modo?: ModoColor; seleccion?: string | null;
  onMuestra?: (p: PuntoSeccion) => void; onBloque?: (b: Bloque) => void;
}) {
  const l: Lienzo = { ancho, alto, margen: { izq: 56, der: 16, sup: 16, inf: 40 } };
  const s = useMemo(() => escalaSeccion(modelo, l), [modelo, ancho, alto]);
  const xFinal = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of modelo.puntos) m.set(p.galeriaId, Math.max(m.get(p.galeriaId) ?? 0, p.x));
    return m;
  }, [modelo]);

  const tocar = (px: number, py: number) => {
    // ¿Muestra a menos de 18 px?
    let mejor: PuntoSeccion | null = null, dMin = 18;
    for (const p of modelo.puntos) { const d = Math.hypot(s.sx(p.x) - px, s.sy(p.y) - py); if (d < dMin) { dMin = d; mejor = p; } }
    if (mejor && onMuestra) return onMuestra(mejor);
    if (onBloque) {
      const b = modelo.bloques.find((k) => px >= s.sx(k.x0) && px <= s.sx(k.x1) && py >= s.sy(k.y1) && py <= s.sy(k.y0));
      if (b) onBloque(b);
    }
  };

  return (
    <ScrollView horizontal>
      <ScrollView>
        <Pressable onPress={(e) => tocar(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
          <Svg width={ancho} height={alto}>
            <Rect x={0} y={0} width={ancho} height={alto} fill="#fff" />
            {mostrarBloques ? modelo.bloques.map((b) => (
              <Rect key={b.id} x={s.sx(b.x0)} y={s.sy(b.y1)} width={s.sx(b.x1) - s.sx(b.x0)} height={s.sy(b.y0) - s.sy(b.y1)}
                fill={colorBloque(b, modo)} fillOpacity={0.8} stroke={seleccion === b.id ? '#000' : '#fff'} strokeWidth={seleccion === b.id ? 3 : 0.4} />
            )) : null}
            {s.ticksX.map((t) => (
              <G key={`x${t}`}><Line x1={s.sx(t)} x2={s.sx(t)} y1={l.margen.sup} y2={alto - l.margen.inf} stroke="#ddd" />
                <SvgText x={s.sx(t)} y={alto - l.margen.inf + 16} fontSize={12} textAnchor="middle" fill="#000">{t}</SvgText></G>
            ))}
            {s.ticksY.map((t) => (
              <G key={`y${t}`}><Line x1={l.margen.izq} x2={ancho - l.margen.der} y1={s.sy(t)} y2={s.sy(t)} stroke="#ddd" />
                <SvgText x={l.margen.izq - 4} y={s.sy(t) + 4} fontSize={12} textAnchor="end" fill="#000">{t}</SvgText></G>
            ))}
            <SvgText x={ancho / 2} y={alto - 6} fontSize={13} fontWeight="bold" textAnchor="middle">Metros desde bocamina</SvgText>
            {[...modelo.cotas].map(([gid, cota]) => (
              <G key={gid}>
                <Line x1={s.sx(0)} x2={s.sx(xFinal.get(gid) ?? 0)} y1={s.sy(cota)} y2={s.sy(cota)} stroke="#000" strokeWidth={4} />
                <SvgText x={s.sx(0) + 4} y={s.sy(cota) - 7} fontSize={13} fontWeight="bold">{`${nombres.get(gid) ?? ''} (${cota.toFixed(0)})`}</SvgText>
              </G>
            ))}
            {modelo.puntos.map((p) => (
              <Circle key={p.id} cx={s.sx(p.x)} cy={s.sy(p.y)} r={seleccion === p.id ? 10 : 7} fill={colorLey(p.ley)} stroke="#000" strokeWidth={2} />
            ))}
          </Svg>
        </Pressable>
      </ScrollView>
    </ScrollView>
  );
}
