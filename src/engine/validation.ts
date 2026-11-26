// Validaciones de captura de muestras (se ejecutan al guardar, sin conexión).

export interface EntradaMuestra {
  galeriaId?: string | null;
  avanceM?: number | null;
  anchoM?: number | null;
  leyGt?: number | null;
}

export interface ResultadoValidacion {
  errores: Partial<Record<'galeriaId' | 'avanceM' | 'anchoM' | 'leyGt', string>>;
  advertencias: string[];
  ok: boolean;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function mediana(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * @param vecinas leyes de muestras de la misma galería (contexto local). Se usan las que están a ≤ radioLocal m.
 */
export function validarMuestra(
  m: EntradaMuestra,
  vecinas: { avanceM: number; leyGt: number }[] = [],
  opts: { factorAnomalia?: number; radioLocalM?: number; minVecinas?: number; anchoMaxRazonableM?: number; leyObligatoria?: boolean } = {},
): ResultadoValidacion {
  const { factorAnomalia = 3, radioLocalM = 20, minVecinas = 3, anchoMaxRazonableM = 5, leyObligatoria = true } = opts;
  const errores: ResultadoValidacion['errores'] = {};
  const advertencias: string[] = [];

  if (!m.galeriaId) errores.galeriaId = 'Elige la galería';
  if (!num(m.avanceM)) errores.avanceM = 'Ingresa los metros desde bocamina';
  else if (m.avanceM < 0) errores.avanceM = 'El avance no puede ser negativo';
  if (!num(m.anchoM)) errores.anchoM = 'Ingresa el ancho de veta';
  else if (m.anchoM <= 0) errores.anchoM = 'El ancho debe ser mayor que 0';
  else if (m.anchoM > anchoMaxRazonableM) advertencias.push(`Ancho de ${m.anchoM} m es inusual. ¿Está en metros (no cm)?`);
  if (!num(m.leyGt)) {
    if (leyObligatoria) errores.leyGt = 'Ingresa la ley en g/t';
    else advertencias.push('Sin ley: la muestra queda "pendiente de ensaye" y no entra al cálculo hasta completarla.');
  } else if (m.leyGt < 0) errores.leyGt = 'La ley no puede ser negativa';

  if (num(m.leyGt) && m.leyGt > 0 && num(m.avanceM)) {
    const locales = vecinas.filter((v) => Math.abs(v.avanceM - (m.avanceM as number)) <= radioLocalM).map((v) => v.leyGt);
    if (locales.length >= minVecinas) {
      const med = mediana(locales);
      if (med > 0 && m.leyGt > factorAnomalia * med) {
        advertencias.push(`Ley anómalamente alta: ${m.leyGt} g/t es más de ${factorAnomalia}× la mediana local (${med.toFixed(2)} g/t). Verifica el dato o el ensaye.`);
      }
    }
  }
  return { errores, advertencias, ok: Object.keys(errores).length === 0 };
}
