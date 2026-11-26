import React, { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { AdvertenciaLegal, Aviso, Boton, Pantalla, SemaforoCard, Tarjeta, Texto, Titulo, fmt } from '../ui/components';
import { agregarLiquidacionDemo, guardarParametros } from '../db/repos';
import { compartirCsv, compartirPdfReporte } from '../export/share';
import { COLOR_CATEGORIA, COLOR_BAJO_CORTE } from '../engine/sectionLayout';
import { ADVERTENCIA_CATEGORIAS } from '../domain/types';
import type { TotalCategoria } from '../engine';
import { C, T } from '../ui/theme';

function FilaCat({ nombre, t, color, negrita }: { nombre: string; t: TotalCategoria; color?: string; negrita?: boolean }) {
  const w = negrita ? '900' : '600';
  return (
    <View style={{ borderBottomWidth: 1, borderColor: '#CCC', paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {color ? <View style={{ width: 16, height: 16, backgroundColor: color, borderWidth: 1 }} /> : null}
        <Text style={{ fontSize: T.m, fontWeight: '800' }}>{nombre}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14 }}>
        <Text style={{ fontSize: T.s, fontWeight: w }}>{fmt(t.toneladas, 1)} t</Text>
        <Text style={{ fontSize: T.s, fontWeight: w }}>{fmt(t.leyMedia, 2)} g/t</Text>
        <Text style={{ fontSize: T.s, fontWeight: w }}>{fmt(t.gramos, 0)} g</Text>
        <Text style={{ fontSize: T.s, fontWeight: w }}>{fmt(t.onzas, 1)} oz</Text>
        <Text style={{ fontSize: T.s, fontWeight: '900', color: C.ok }}>{fmt(t.onzasRecuperables, 1)} oz rec. ({fmt(t.gramosRecuperables, 0)} g)</Text>
      </View>
    </View>
  );
}

export default function ResultadosScreen() {
  const app = useApp();
  const [ocupado, setOcupado] = useState(false);
  const e = app.estimacion;
  if (!e) return <Pantalla><Aviso texto={app.errorCalculo ?? 'Faltan datos para calcular.'} /><AdvertenciaLegal /></Pantalla>;
  const r = e.resumen;
  const f = e.factor;
  const ejecutar = async (fn: () => Promise<unknown>) => { setOcupado(true); try { await fn(); } catch (error) { Alert.alert('No se pudo completar la acción', error instanceof Error ? error.message : String(error)); } finally { setOcupado(false); } };

  return (
    <Pantalla>
      <AdvertenciaLegal />
      <SemaforoCard s={e.semaforo} moneda={app.params.moneda} />
      <Tarjeta>
        <Titulo>Por categoría</Titulo>
        <Texto suave>Solo bloques con ley diluida ≥ {app.params.leyCorte} g/t. Recuperación {fmt(app.params.recuperacionPlanta * 100, 0)} %.</Texto>
        <FilaCat nombre="Probado" t={r.probado} color={COLOR_CATEGORIA.probado} />
        <FilaCat nombre="Probable" t={r.probable} color={COLOR_CATEGORIA.probable} />
        <FilaCat nombre="Posible" t={r.posible} color={COLOR_CATEGORIA.posible} />
        <FilaCat nombre="Probado + Probable" t={r.probadoMasProbable} negrita />
        <FilaCat nombre="Total" t={r.total} negrita />
        <FilaCat nombre="Bajo ley de corte (no cuenta)" t={r.bajoLeyCorte} color={COLOR_BAJO_CORTE} />
        <Texto suave>{ADVERTENCIA_CATEGORIAS}</Texto>
      </Tarjeta>

      <Tarjeta>
        <Titulo>Factor de planta</Titulo>
        {app.operacionDemo && app.liquidaciones.length === 2 ? <Boton variante="secundario"
          titulo="Agregar tercera liquidación de ejemplo" deshabilitado={ocupado}
          onPress={() => ejecutar(async () => {
            await agregarLiquidacionDemo(app.db!, app.operacionId!);
            await app.recargar();
          })} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Texto negrita>Aplicar factor de planta</Texto>
          <Switch value={app.params.aplicarFactorPlanta} style={{ transform: [{ scale: 1.4 }] }}
            onValueChange={async (v) => { await guardarParametros(app.db!, app.operacionId!, { ...app.params, aplicarFactorPlanta: v }); await app.recargar(); }} />
        </View>
        {f.factor != null ? <Texto>Factor = {fmt(f.leyPlanta ?? 0, 2)} g/t (planta, {f.nLiquidaciones} liquidaciones) ÷ {fmt(f.leyMuestras ?? 0, 2)} g/t (muestras) = <Texto negrita>{fmt(f.factor, 3)}</Texto></Texto> : null}
        {f.avisos.map((a) => <Aviso key={a} texto={a} />)}
        {f.aplicado ? (
          <Texto>Impacto: {fmt(e.resumenSinFactor.total.onzasRecuperables, 1)} oz rec. sin factor → <Texto negrita>{fmt(r.total.onzasRecuperables, 1)} oz</Texto> con factor
            ({fmt(((r.total.onzasRecuperables - e.resumenSinFactor.total.onzasRecuperables) / Math.max(1e-9, e.resumenSinFactor.total.onzasRecuperables)) * 100, 0)} %).</Texto>
        ) : null}
      </Tarjeta>

      {e.modelo.avisos.map((a) => <Aviso key={a} texto={a} />)}
      {e.problemasParametros.map((p) => <Aviso key={p.campo} texto={`Parámetro ${p.campo}: ${p.mensaje}`} />)}

      <Titulo>Exportar</Titulo>
      <Boton icono="archivo" titulo="Reporte PDF" deshabilitado={ocupado} onPress={() => ejecutar(() => compartirPdfReporte(app, e))} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Boton chico estilo={{ flex: 1 }} variante="secundario" titulo="CSV resumen" deshabilitado={ocupado} onPress={() => ejecutar(() => compartirCsv(app, e, 'resumen'))} />
        <Boton chico estilo={{ flex: 1 }} variante="secundario" titulo="CSV bloques" deshabilitado={ocupado} onPress={() => ejecutar(() => compartirCsv(app, e, 'bloques'))} />
        <Boton chico estilo={{ flex: 1 }} variante="secundario" titulo="CSV muestras" deshabilitado={ocupado} onPress={() => ejecutar(() => compartirCsv(app, e, 'muestras'))} />
      </View>
      <AdvertenciaLegal compacta />
    </Pantalla>
  );
}
