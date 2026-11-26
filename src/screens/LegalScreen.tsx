import React from 'react';
import { AdvertenciaLegal, Pantalla, Texto, Titulo } from '../ui/components';
import { ADVERTENCIA_CATEGORIAS, ADVERTENCIA_GPS } from '../domain/types';

const LIMITES = [
  'La veta se trata como un plano vertical (sección longitudinal 2D): no se consideran buzamiento, pliegues, fallas ni topografía.',
  'Cada galería se supone recta siguiendo el rumbo registrado; las curvas en la galería desplazan la ubicación real de las muestras.',
  ADVERTENCIA_GPS,
  'La ley y el ancho se interpolan por separado con IDW; IDW no mide la incertidumbre ni el efecto pepita del oro.',
  'La dilución asume material estéril de ley 0 hasta completar el ancho mínimo de minado.',
  'Los bloques Posibles son una proyección lejana: no deben usarse solos para decidir inversiones.',
  'La ley de batea es muy aproximada; los resultados mejoran con ensayes de planta o laboratorio.',
  'El factor de planta compara muestras de canal con mineral vendido; solo es útil si ese mineral salió de la zona muestreada.',
];

export default function LegalScreen() {
  return (
    <Pantalla>
      <AdvertenciaLegal />
      <Titulo>Categorías</Titulo>
      <Texto>{ADVERTENCIA_CATEGORIAS} Probado: entre dos galerías con muestras (o muy cerca de una muestra). Probable: cerca de muestras. Posible: proyección más lejana. Los umbrales se editan en Parámetros.</Texto>
      <Titulo>Limitaciones</Titulo>
      {LIMITES.map((l) => <Texto key={l}>• {l}</Texto>)}
      <Titulo>Uso responsable</Titulo>
      <Texto>Esta herramienta ayuda a ordenar tus datos y a decidir el siguiente avance. No reemplaza a un geólogo ni a un estudio técnico, y no sirve para vender, financiar o declarar recursos ante terceros.</Texto>
    </Pantalla>
  );
}
