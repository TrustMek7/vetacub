// Inverso de la Distancia Ponderada sobre el plano de la sección longitudinal (x = avance, y = cota).

export interface PuntoMuestra { id: string; x: number; y: number; ley: number; ancho: number }
export interface Influencia { muestraId: string; distancia: number; peso: number }
export interface ResultadoIdw { ley: number; ancho: number; influencias: Influencia[] }

export interface OpcionesIdw {
  potencia: number;
  distanciaMax: number;
  maxMuestras: number;
  leyTope: number | null;
}

/**
 * Ley_bloque = Σ(Ley_i / d_i^p) / Σ(1 / d_i^p); igual para ancho.
 * Si d=0 se toma la muestra tal cual. Devuelve null si no hay muestras dentro de distanciaMax.
 * Los pesos devueltos están normalizados (suman 1) para auditoría.
 */
export function idw(x: number, y: number, muestras: PuntoMuestra[], o: OpcionesIdw): ResultadoIdw | null {
  const cand = muestras
    .map((m) => ({ m, d: Math.hypot(m.x - x, m.y - y) }))
    .filter((c) => c.d <= o.distanciaMax)
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(1, o.maxMuestras));
  if (cand.length === 0) return null;
  const tope = (l: number) => (o.leyTope != null ? Math.min(l, o.leyTope) : l);

  const exactas = cand.filter((c) => c.d < 1e-9);
  if (exactas.length > 0) {
    const w = 1 / exactas.length;
    return {
      ley: exactas.reduce((s, c) => s + tope(c.m.ley), 0) * w,
      ancho: exactas.reduce((s, c) => s + c.m.ancho, 0) * w,
      influencias: exactas.map((c) => ({ muestraId: c.m.id, distancia: 0, peso: w })),
    };
  }
  const pesos = cand.map((c) => 1 / Math.pow(c.d, o.potencia));
  const sw = pesos.reduce((a, b) => a + b, 0);
  let ley = 0, ancho = 0;
  cand.forEach((c, i) => { ley += tope(c.m.ley) * pesos[i]; ancho += c.m.ancho * pesos[i]; });
  return {
    ley: ley / sw,
    ancho: ancho / sw,
    influencias: cand.map((c, i) => ({ muestraId: c.m.id, distancia: c.d, peso: pesos[i] / sw })),
  };
}
