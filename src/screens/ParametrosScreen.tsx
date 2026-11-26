import React, { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Aviso, Boton, Campo, Pantalla, Selector, Titulo, num } from '../ui/components';
import { guardarParametros } from '../db/repos';
import { PARAMETROS_POR_DEFECTO, validarParametros } from '../engine/params';
import type { Parametros } from '../domain/types';
import { useNav } from './nav';

type Num = { [K in keyof Parametros]: Parametros[K] extends number ? K : never }[keyof Parametros];
const CAMPOS: { titulo: string; campos: { k: Num; e: string; u?: string; ayuda?: string; pct?: boolean }[] }[] = [
  { titulo: 'Material', campos: [
    { k: 'densidad', e: 'Densidad', u: 't/m³', ayuda: 'Veta de cuarzo con sulfuros: 2.6–2.9' },
    { k: 'anchoMinimoMinado', e: 'Ancho mínimo de minado', u: 'm', ayuda: 'Lo mínimo que puedes abrir a mano/explosivo' },
    { k: 'recuperacionPlanta', e: 'Recuperación de planta', u: '%', pct: true },
    { k: 'leyCorte', e: 'Ley de corte (diluida)', u: 'g/t' },
  ] },
  { titulo: 'Bloques e interpolación', campos: [
    { k: 'celdaLargo', e: 'Largo de celda', u: 'm' }, { k: 'celdaAlto', e: 'Alto de celda', u: 'm' },
    { k: 'potenciaIdw', e: 'Potencia IDW', ayuda: '2 = estándar; mayor = más peso a la muestra cercana' },
    { k: 'distanciaMaxInfluencia', e: 'Distancia máxima de influencia', u: 'm' },
    { k: 'maxMuestrasIdw', e: 'Máx. muestras por bloque' },
    { k: 'alcanceMasAllaUltimaMuestra', e: 'Alcance tras la última muestra', u: 'm' },
  ] },
  { titulo: 'Clasificación (orientativa)', campos: [
    { k: 'probadoSeparacionMaxGalerias', e: 'Probado: galerías separadas hasta', u: 'm' },
    { k: 'probadoDistanciaMuestra', e: 'Probado: distancia a muestra', u: 'm' },
    { k: 'alturaProbable', e: 'Altura / distancia Probable', u: 'm' },
    { k: 'alturaPosible', e: 'Altura / distancia Posible', u: 'm' },
  ] },
  { titulo: 'Semáforo de inversión', campos: [
    { k: 'precioOroPorOnza', e: 'Precio que paga la planta por onza', ayuda: 'Pon lo que realmente recibes, no el precio internacional' },
    { k: 'costoPorTonelada', e: 'Costo por tonelada', ayuda: 'Minado + transporte + planta' },
    { k: 'costoSiguienteAvance', e: 'Costo del siguiente avance', ayuda: 'La inversión que estás evaluando' },
    { k: 'umbralVerde', e: 'Verde si ingreso/costo ≥' }, { k: 'umbralAmarillo', e: 'Amarillo si ingreso/costo ≥' },
  ] },
  { titulo: 'Factor de planta', campos: [{ k: 'minLiquidacionesFactor', e: 'Mínimo de liquidaciones' }] },
];

export default function ParametrosScreen() {
  const app = useApp();
  const nav = useNav();
  const aTexto = (p: Parametros) => Object.fromEntries(CAMPOS.flatMap((g) => g.campos).map((c) => [c.k, String(c.pct ? Math.round(p[c.k] * 1000) / 10 : p[c.k])]));
  const [txt, setTxt] = useState<Record<string, string>>(aTexto(app.params));
  const [tope, setTope] = useState(app.params.leyTope == null ? '' : String(app.params.leyTope));
  const [anchoVol, setAnchoVol] = useState(app.params.anchoVolumen);
  const [moneda, setMoneda] = useState(app.params.moneda);

  const construir = (): Parametros | null => {
    const p: Parametros = { ...app.params, anchoVolumen: anchoVol, moneda, leyTope: num(tope) };
    for (const c of CAMPOS.flatMap((g) => g.campos)) {
      const v = num(txt[c.k] ?? '');
      if (v == null) return null;
      (p as unknown as Record<string, number>)[c.k] = c.pct ? v / 100 : v;
    }
    return p;
  };
  const p = construir();
  const problemas = p ? validarParametros(p) : [];
  const errores = Object.fromEntries(problemas.filter((x) => x.nivel === 'error').map((x) => [x.campo, x.mensaje]));

  return (
    <Pantalla pie={<Boton titulo="Guardar y recalcular" deshabilitado={!p || Object.keys(errores).length > 0}
      onPress={async () => { await guardarParametros(app.db!, app.operacionId!, p!); await app.recargar(); nav.goBack(); }} />}>
      {CAMPOS.map((g) => (
        <React.Fragment key={g.titulo}>
          <Titulo>{g.titulo}</Titulo>
          {g.campos.map((c) => (
            <Campo key={c.k} etiqueta={c.e} valor={txt[c.k] ?? ''} onCambio={(v) => setTxt((t) => ({ ...t, [c.k]: v }))} numerico sufijo={c.u}
              ayuda={c.ayuda} error={errores[c.k] ?? (num(txt[c.k] ?? '') == null ? 'Requerido' : undefined)} />
          ))}
          {g.titulo === 'Material' ? (
            <Selector etiqueta="Volumen del bloque con…" valor={anchoVol} onCambio={setAnchoVol} opciones={[
              { k: 'max', t: 'Mayor entre veta y mínimo' }, { k: 'minimo', t: 'Siempre ancho mínimo' }]} />
          ) : null}
          {g.titulo === 'Bloques e interpolación' ? (
            <Campo etiqueta="Ley tope (vacío = sin tope)" valor={tope} onCambio={setTope} numerico sufijo="g/t" ayuda="Recorta leyes erráticas muy altas antes de interpolar" />
          ) : null}
          {g.titulo === 'Semáforo de inversión' ? <Campo etiqueta="Moneda" valor={moneda} onCambio={setMoneda} /> : null}
        </React.Fragment>
      ))}
      {problemas.filter((x) => x.nivel === 'aviso').map((x) => <Aviso key={x.campo} texto={x.mensaje} />)}
      <Titulo>Ubicación</Titulo>
      <Aviso tipo="info" texto={`Zona UTM: ${app.params.zonaUtm}. Se edita en la pantalla Bocamina.`} />
      <Boton variante="secundario" titulo="Restaurar valores por defecto" onPress={() => {
        setTxt(aTexto({ ...PARAMETROS_POR_DEFECTO, precioOroPorOnza: app.params.precioOroPorOnza, costoPorTonelada: app.params.costoPorTonelada, costoSiguienteAvance: app.params.costoSiguienteAvance }));
        setTope(''); setAnchoVol('max');
      }} />
    </Pantalla>
  );
}
