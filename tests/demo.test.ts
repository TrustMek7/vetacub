import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datosDemo } from '../src/demo/datosDemo';
import { ADVERTENCIA_LEGAL } from '../src/domain/types';
import { estimar } from '../src/engine';
import { csvResumen, reporteHtml } from '../src/export/reportHtml';

test('la operación demo permite incorporar un ensaye y demostrar el factor de planta', () => {
  const demo = datosDemo();
  const liquidaciones = demo.liquidaciones.slice(0, 2);
  const antes = estimar({ ...demo, liquidaciones });
  assert.equal(antes.factor.nLiquidaciones, 2);
  assert.equal(antes.factor.aplicado, false);
  assert.ok(antes.modelo.bloques.some((b) => !b.sobreLeyCorte));

  const pendiente = demo.muestras.find((m) => m.leyGt == null);
  assert.ok(pendiente);
  const muestras = demo.muestras.map((m) => m.id === pendiente.id ? { ...m, leyGt: 8 } : m);
  const conEnsaye = estimar({ ...demo, muestras, liquidaciones });
  assert.notEqual(conEnsaye.resumen.total.gramos, antes.resumen.total.gramos);

  const conFactor = estimar({ ...demo, muestras });
  assert.equal(conFactor.factor.nLiquidaciones, 3);
  assert.equal(conFactor.factor.aplicado, true);
  assert.notEqual(conFactor.resumen.total.gramos, conEnsaye.resumen.total.gramos);
  assert.ok(reporteHtml({ ...demo, muestras, operacion: demo.operacion.nombre, est: conFactor }).includes(ADVERTENCIA_LEGAL));
  assert.ok(csvResumen(conFactor, demo.params).includes(ADVERTENCIA_LEGAL));
});
