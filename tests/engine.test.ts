import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirModelo, diluir, estimar, idw, calcularFactorPlanta, cotasGalerias, latLonAUtm, utmALatLon,
  ubicarMuestra, validarMuestra, validarParametros, resumir, evaluarInversion, seccionSvg, zonaSugerida,
} from '../src/engine';
import { bocamina, galeria, liquidacion, muestra, params, serie } from './fixtures';

const cerca = (a: number, b: number, tol = 1e-6, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, msg ?? `esperado ${b}, obtenido ${a}`);
const bloqueEn = (m: ReturnType<typeof construirModelo>, xc: number, yc: number) => {
  const b = m.bloques.find((k) => Math.abs(k.xc - xc) < 1e-6 && Math.abs(k.yc - yc) < 1e-6);
  assert.ok(b, `no existe bloque en (${xc}, ${yc})`);
  return b;
};

describe('Caso 1 — veta angosta con dilución', () => {
  const g = galeria('G1', 0);
  const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: serie(g, 0, 20, 4, 10, 0.4), params: params() });
  test('ley diluida = 10 × 0.4/0.8 = 5 g/t en todos los bloques', () => {
    assert.ok(m.bloques.length > 0);
    for (const b of m.bloques) { cerca(b.leyInterpolada, 10); cerca(b.anchoInterpolado, 0.4); cerca(b.leyDiluida, 5); }
  });
  test('tonelaje por bloque = 2 × 2 × 0.8 × 2.7 = 8.64 t y 43.2 g', () => {
    const b = bloqueEn(m, 9, 3001);
    cerca(b.toneladas, 8.64); cerca(b.gramos, 43.2); cerca(b.onzas, 43.2 / 31.1035);
    cerca(b.gramosRecuperables, 43.2 * 0.85);
  });
  test('ley media del resumen = 5 g/t', () => cerca(resumir(m.bloques).total.leyMedia, 5));
});

describe('Caso 2 — veta ancha sin dilución', () => {
  const g = galeria('G1', 0);
  const ms = serie(g, 0, 20, 4, 6, 1.2);
  test('ley diluida = ley de veta (6 g/t)', () => {
    const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: ms, params: params() });
    for (const b of m.bloques) cerca(b.leyDiluida, 6);
  });
  test("volumen con ancho real (modo 'max'): 2 × 2 × 1.2 × 2.7 = 12.96 t", () => {
    const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: ms, params: params() });
    cerca(bloqueEn(m, 5, 3001).toneladas, 12.96);
  });
  test("fórmula literal (modo 'minimo'): 2 × 2 × 0.8 × 2.7 = 8.64 t", () => {
    const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: ms, params: params({ anchoVolumen: 'minimo' }) });
    cerca(bloqueEn(m, 5, 3001).toneladas, 8.64);
  });
  test('diluir() en el límite exacto no diluye', () => cerca(diluir(7, 0.8, 0.8), 7));
});

describe('Caso 3 — bloque entre dos galerías', () => {
  test('galerías a 15 m con muestras: bloque intermedio a > 5 m de toda muestra es Probado', () => {
    const g1 = galeria('Nv3000', 0);
    const g2 = galeria('Nv2985', -15, { modoDesnivel: 'tramo', galeriaRefId: g1.id });
    const ms = [...serie(g1, 0, 20, 4, 8, 1), ...serie(g2, 0, 20, 4, 4, 1)];
    const m = construirModelo({ bocamina: bocamina(), galerias: [g1, g2], muestras: ms, params: params() });
    cerca(m.cotas.get(g2.id)!, 2985);
    const b = bloqueEn(m, 11, 2991);
    assert.ok(b.distanciaMuestraMasCercana > 5);
    assert.equal(b.categoria, 'probado');
    assert.equal(b.motivoCategoria, 'Entre dos galerías con muestras');
    // Ley interpolada entre 4 (abajo) y 8 (arriba)
    assert.ok(b.leyInterpolada > 4 && b.leyInterpolada < 8);
    const ids = new Set(b.influencias.map((i) => i.muestraId));
    assert.ok(ms.some((x) => x.galeriaId === g1.id && ids.has(x.id)) && ms.some((x) => x.galeriaId === g2.id && ids.has(x.id)), 'influyen muestras de ambas galerías');
  });
  test('galerías a 20 m (> 15): el mismo tipo de bloque baja a Probable', () => {
    const g1 = galeria('Nv3000', 0);
    const g2 = galeria('Nv2980', -20);
    const ms = [...serie(g1, 0, 20, 4, 8, 1), ...serie(g2, 0, 20, 4, 4, 1)];
    const m = construirModelo({ bocamina: bocamina(), galerias: [g1, g2], muestras: ms, params: params() });
    assert.equal(bloqueEn(m, 11, 2993).categoria, 'probable');
  });
});

describe('Caso 4 — bloque más allá de la última muestra', () => {
  const g = galeria('G1', 0);
  const ms = serie(g, 0, 40, 4, (x) => 2 + x / 4, 1); // ley crece: 2 … 12 g/t
  const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: ms, params: params() });
  test('se proyecta solo hasta alcance (40 + 10 = 50 m)', () => {
    assert.equal(m.extension.xMax, 50);
    assert.ok(m.bloques.every((b) => b.x1 <= 50 + 1e-9));
  });
  test('bloque a 1.4 m de la última muestra es Probado; a 5.1 m y 9.06 m es Probable', () => {
    assert.equal(bloqueEn(m, 41, 3001).categoria, 'probado');
    assert.equal(bloqueEn(m, 45, 3001).categoria, 'probable');
    assert.equal(bloqueEn(m, 49, 3001).categoria, 'probable');
  });
  test('la muestra final domina la ley proyectada y los pesos suman 1 (auditoría)', () => {
    const b = bloqueEn(m, 45, 3001);
    const ultima = ms[ms.length - 1];
    const top = [...b.influencias].sort((a, c) => c.peso - a.peso)[0];
    assert.equal(top.muestraId, ultima.id);
    cerca(b.influencias.reduce((s, i) => s + i.peso, 0), 1, 1e-9);
    assert.ok(b.leyInterpolada < 12 && b.leyInterpolada > 9);
  });
  test('bloques lejanos verticalmente (> 25 m) no se generan', () => {
    assert.ok(m.bloques.every((b) => b.distanciaMuestraMasCercana <= 25));
  });
});

describe('Caso 5 — bloque bajo ley de corte', () => {
  test('ley 1.0 g/t < corte 1.5: se excluye del tonelaje y onzas', () => {
    const g = galeria('G1', 0);
    const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: serie(g, 0, 20, 4, 1.0, 1), params: params() });
    const r = resumir(m.bloques);
    assert.equal(r.total.toneladas, 0);
    assert.equal(r.total.onzas, 0);
    assert.ok(r.bajoLeyCorte.bloques > 0);
  });
  test('la dilución puede llevar un bloque bajo el corte (2.5 g/t, 0.4 m → 1.25 g/t)', () => {
    const g = galeria('G1', 0);
    const angosta = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: serie(g, 0, 20, 4, 2.5, 0.4), params: params() });
    assert.ok(angosta.bloques.every((b) => !b.sobreLeyCorte));
    const ancha = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: serie(g, 0, 20, 4, 2.5, 1.0), params: params() });
    assert.ok(ancha.bloques.every((b) => b.sobreLeyCorte));
  });
});

describe('Caso 6 — actualización del factor de planta', () => {
  const g = galeria('G1', 0);
  const ms = serie(g, 0, 20, 4, 10, 1);
  const datos = (liqs: ReturnType<typeof liquidacion>[], p = params()) =>
    ({ bocamina: bocamina(), galerias: [g], muestras: ms, liquidaciones: liqs, params: p });

  test('con 2 liquidaciones no se aplica y se avisa', () => {
    const e = estimar(datos([liquidacion(10, 8), liquidacion(20, 8)]));
    assert.equal(e.factor.aplicado, false);
    assert.match(e.factor.avisos.join(' '), /Solo hay 2/);
    cerca(e.resumen.total.gramos, e.resumenSinFactor.total.gramos);
  });
  test('al llegar la 3.ª liquidación se aplica: factor 8/10 = 0.8 y los gramos bajan 20 %', () => {
    const e = estimar(datos([liquidacion(10, 8), liquidacion(20, 8), liquidacion(30, 8)]));
    assert.equal(e.factor.aplicado, true);
    cerca(e.factor.factor!, 0.8);
    cerca(e.resumen.total.gramos, 0.8 * e.resumenSinFactor.total.gramos, 1e-6);
  });
  test('factor ponderado por toneladas: (10·4 + 30·12)/40 = 10 → factor 1.0', () => {
    const f = calcularFactorPlanta([liquidacion(10, 4), liquidacion(30, 12), liquidacion(0, 50)], ms, params({ minLiquidacionesFactor: 2 }));
    assert.equal(f.nLiquidaciones, 2, 'la liquidación con 0 t no es representativa');
    cerca(f.factor!, 1.0);
  });
  test('usa solo muestras vinculadas por código cuando existen', () => {
    const vinc = [muestra(g, 50, 16, 1, 'M-A'), muestra(g, 52, 16, 1, 'M-B')];
    const f = calcularFactorPlanta([liquidacion(10, 8, ['M-A']), liquidacion(10, 8, ['M-B']), liquidacion(10, 8)], [...ms, ...vinc], params());
    assert.equal(f.muestrasUsadas, 'vinculadas');
    cerca(f.factor!, 0.5);
  });
  test('desactivado por el usuario: calcula el factor pero no lo aplica', () => {
    const e = estimar(datos([liquidacion(10, 8), liquidacion(20, 8), liquidacion(30, 8)], params({ aplicarFactorPlanta: false })));
    assert.equal(e.factor.aplicado, false);
    cerca(e.factor.factor!, 0.8);
  });
});

describe('IDW', () => {
  const pts = [{ id: 'a', x: 1, y: 0, ley: 10, ancho: 1 }, { id: 'b', x: 2, y: 0, ley: 20, ancho: 2 }];
  const o = { potencia: 2, distanciaMax: 30, maxMuestras: 12, leyTope: null };
  test('fórmula Σ(L/d^p)/Σ(1/d^p)', () => {
    const r = idw(0, 0, pts, o)!;
    cerca(r.ley, (10 + 20 / 4) / 1.25); cerca(r.ancho, (1 + 2 / 4) / 1.25);
    cerca(r.influencias[0].peso, 0.8); cerca(r.influencias[1].peso, 0.2);
  });
  test('sobre una muestra devuelve su valor exacto', () => cerca(idw(2, 0, pts, o)!.ley, 20));
  test('respeta distancia máxima', () => {
    assert.equal(idw(0, 0, pts, { ...o, distanciaMax: 0.5 }), null);
    assert.equal(idw(0, 0, pts, { ...o, distanciaMax: 1.5 })!.influencias.length, 1);
  });
  test('ley tope recorta altos erráticos', () => cerca(idw(2, 0, pts, { ...o, leyTope: 15 })!.ley, 15));
});

describe('Ubicación y cotas', () => {
  test('UTM ida y vuelta < 1 mm', () => {
    for (const [lat, lon] of [[-14.5, -74.2], [-6.1, -78.6], [-15.8, -70.0]]) {
      const z = zonaSugerida(lon);
      const u = latLonAUtm(lat, lon, z, 'S');
      const b = utmALatLon(u.este, u.norte, z, 'S');
      cerca(b.lat, lat, 1e-8); cerca(b.lon, lon, 1e-8);
    }
  });
  test('meridiano central zona 18 (−75°) en el ecuador → E 500 000, N 10 000 000', () => {
    const u = latLonAUtm(0, -75, 18, 'S');
    cerca(u.este, 500000, 1e-3); cerca(u.norte, 10000000, 1e-3);
  });
  test('Perú cae en zonas 17–19', () => {
    assert.equal(zonaSugerida(-80.5), 17); assert.equal(zonaSugerida(-74.2), 18); assert.equal(zonaSugerida(-70.0), 19);
  });
  test('muestra a 100 m con rumbo 45°: ΔE = ΔN = 70.71 m', () => {
    const b = bocamina();
    const u0 = latLonAUtm(b.lat, b.lon, 18, 'S');
    const u = ubicarMuestra(b, 100, 2990);
    cerca(u.este - u0.este, 70.7107, 1e-3); cerca(u.norte - u0.norte, 70.7107, 1e-3); assert.equal(u.cota, 2990);
  });
  test('cotas por tramo encadenadas y detección de ciclo', () => {
    const g1 = galeria('A', -10);
    const g2 = galeria('B', -12, { modoDesnivel: 'tramo', galeriaRefId: g1.id });
    const g3 = galeria('C', -8, { modoDesnivel: 'tramo', galeriaRefId: g2.id });
    const c = cotasGalerias(3000, [g3, g2, g1]);
    assert.equal(c.get(g1.id), 2990); assert.equal(c.get(g2.id), 2978); assert.equal(c.get(g3.id), 2970);
    const x = galeria('X', 1, { modoDesnivel: 'tramo' }); const y = galeria('Y', 1, { modoDesnivel: 'tramo', galeriaRefId: x.id });
    x.galeriaRefId = y.id;
    assert.throws(() => cotasGalerias(3000, [x, y]), /circular/);
  });
});

describe('Validaciones de captura', () => {
  test('avance negativo, ancho 0 y ley negativa son errores', () => {
    const r = validarMuestra({ galeriaId: 'g', avanceM: -1, anchoM: 0, leyGt: -2 });
    assert.equal(r.ok, false);
    assert.ok(r.errores.avanceM && r.errores.anchoM && r.errores.leyGt);
  });
  test('ley 40 g/t con mediana local 6 g/t → advertencia (no bloquea)', () => {
    const vec = [{ avanceM: 10, leyGt: 5 }, { avanceM: 14, leyGt: 6 }, { avanceM: 18, leyGt: 7 }];
    const r = validarMuestra({ galeriaId: 'g', avanceM: 22, anchoM: 0.6, leyGt: 40 }, vec);
    assert.equal(r.ok, true);
    assert.match(r.advertencias.join(' '), /anómalamente alta/);
  });
  test('ancho en cm por error → advertencia', () => {
    assert.match(validarMuestra({ galeriaId: 'g', avanceM: 5, anchoM: 40, leyGt: 3 }).advertencias.join(' '), /cm/);
  });
  test('parámetros incoherentes se rechazan', () => {
    assert.ok(validarParametros(params({ alturaProbable: 30 })).some((p) => p.nivel === 'error'));
    assert.ok(validarParametros(params({ recuperacionPlanta: 85 })).some((p) => p.campo === 'recuperacionPlanta'));
  });
});

describe('Semáforo de inversión', () => {
  const g = galeria('G1', 0);
  const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: serie(g, 0, 40, 4, 8, 1), params: params() });
  const r = resumir(m.bloques);
  test('sin precio/costo → faltan datos', () => assert.equal(evaluarInversion(r, params(), 11).estado, 'sin_datos'));
  test('usa solo Probado + Probable y clasifica por relación ingreso/costo', () => {
    const p = params({ precioOroPorOnza: 2000, costoPorTonelada: 100 });
    const s = evaluarInversion(r, p, 11);
    cerca(s.ingreso, r.probadoMasProbable.onzasRecuperables * 2000, 1e-6);
    cerca(s.costo, r.probadoMasProbable.toneladas * 100, 1e-6);
    // 8 g/t × 0.85 / 31.1035 × 2000 ≈ 437 por t vs 100 → seguir
    assert.equal(s.estado, 'seguir');
    assert.equal(evaluarInversion(r, params({ precioOroPorOnza: 2000, costoPorTonelada: 400 }), 11).estado, 'revisar');
    assert.equal(evaluarInversion(r, params({ precioOroPorOnza: 2000, costoPorTonelada: 600 }), 11).estado, 'no_conviene');
  });
  test('con pocas muestras nunca da verde', () => {
    assert.equal(evaluarInversion(r, params({ precioOroPorOnza: 2000, costoPorTonelada: 100 }), 3).estado, 'revisar');
  });
});

describe('Exportación de sección', () => {
  test('genera SVG válido con galerías y muestras', () => {
    const g = galeria('Nv1', 0);
    const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: serie(g, 0, 8, 4, 5, 1), params: params() });
    const svg = seccionSvg(m, new Map([[g.id, 'Nv1']]), { mostrarBloques: true });
    assert.match(svg, /^<svg/); assert.equal((svg.match(/<circle/g) ?? []).length, 3); assert.match(svg, /Nv1/);
  });
});

describe('Muestras pendientes de ensaye', () => {
  test('se guardan sin ley, no entran al cálculo y se avisa', () => {
    const g = galeria('G1', 0);
    const ms = serie(g, 0, 20, 4, 6, 1);
    const pend = { ...muestra(g, 24, 0, 1), leyGt: null };
    const m = construirModelo({ bocamina: bocamina(), galerias: [g], muestras: [...ms, pend], params: params() });
    assert.equal(m.puntos.length, ms.length);
    assert.match(m.avisos.join(' '), /pendientes de ensaye/);
    const v = validarMuestra({ galeriaId: 'g', avanceM: 3, anchoM: 0.5, leyGt: null }, [], { leyObligatoria: false });
    assert.equal(v.ok, true); assert.match(v.advertencias.join(' '), /pendiente/);
  });
});
