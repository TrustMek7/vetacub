import React from 'react';
import Svg, { Path } from 'react-native-svg';

const trazos = {
  inicio: 'M3 10l9-7 9 7v10h-6v-6H9v6H3z',
  muestras: 'M8 5H5v16h14V5h-3 M8 3h8v4H8z M8 11h8m-8 5h6',
  seccion: 'M3 4v16h18 M6 15l4-5 4 3 6-7',
  bloques: 'M3 3h18v18H3z M3 12h18 M12 3v18',
  mas: 'M5 6h14 M5 12h14 M5 18h14',
  agregar: 'M12 5v14 M5 12h14',
  ampliar: 'M10 7v6 M7 10h6 M16 16l5 5 M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0',
  reducir: 'M7 10h6 M16 16l5 5 M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0',
  archivo: 'M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8m-8 4h8',
  camara: 'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 1 1 8 0',
  mapa: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16m6-14v16',
  ubicacion: 'M19 10c0 5-7 11-7 11s-7-6-7-11a7 7 0 1 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
  niveles: 'M3 7l9-4 9 4-9 4z M3 12l9 4 9-4 M3 17l9 4 9-4',
  ajustes: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M11 15v6',
  sincronizar: 'M3 11a9 9 0 0 1 15-6l3 3m0-5v5h-5 M21 13a9 9 0 0 1-15 6l-3-3m0 5v-5h5',
  aviso: 'M12 3l10 18H2z M12 9v5m0 3v.1',
  confirmar: 'M5 12l4 4L19 6',
  informacion: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0 M12 11v6m0-10v.1',
  flecha: 'M4 12h15m-6-6 6 6-6 6',
} as const;

export type NombreIcono = keyof typeof trazos;

export function Icono({ nombre, color, tam = 22 }: { nombre: NombreIcono; color: string; tam?: number }) {
  return (
    <Svg width={tam} height={tam} viewBox="0 0 24 24" accessible={false}>
      <Path d={trazos[nombre]} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
