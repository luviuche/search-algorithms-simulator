const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const grafos = CC2.dominio.grafo;
const coloreado = CC2.dominio.coloreado;
const { recorrer } = CC2.algoritmos.coloreado;
const { MODOS, COLORES } = coloreado;

// Los ejemplos de los apuntes de coloreado (docs/Coloreado de Grafos/, hojas
// de 2021-I). En 2026 se vio en clase lo mismo, sin ejercicio resuelto: las
// pruebas se anclan a estas hojas.
const leer = (texto) => grafos.leerGrafo(texto, grafos.TIPOS.NO_DIRIGIDO).grafo;
// Hoja 1: vértices 1 a 4, aristas a (1–3), b (1–2), c (2–3), d (2–4), e (3–4).
const HOJA_1 = leer('a 1 3\nb 1 2\nc 2 3\nd 2 4\ne 3 4');
const letras = (colores) => Object.values(colores).map((c) => COLORES[c].letra).join('');
const ultimo = (pasos) => pasos[pasos.length - 1];

test('vértices en orden, el primer color libre: R, N, A, R, como la hoja 1', () => {
  const pasos = recorrer(HOJA_1, { modo: MODOS.VERTICES });
  const final = ultimo(pasos);
  assert.equal(letras(final.colores), 'RNAR');
  assert.equal(final.minimo, 3);
  assert.match(final.mensaje, /1, 2 y 3 son vecinos entre sí\. χ\(G\) = 3/);
  const vertice3 = pasos.find((p) => p.actual === 3);
  assert.deepEqual(vertice3.calculo.map((l) => l.resultado), ['R, N', 'A']);
  assert.match(vertice3.mensaje, /sus vecinos 1 y 2 ya tienen R y N; el primer color libre es A \(azul\)/);
});

test('aristas en orden: tres colores, y χ′(G) = Δ = 3', () => {
  const final = ultimo(recorrer(HOJA_1, { modo: MODOS.ARISTAS }));
  assert.equal(letras(final.colores), 'RNARN');
  assert.equal(final.minimo, 3);
  assert.equal(final.delta, 3);
  assert.match(final.mensaje, /χ′\(G\) = Δ/);
});

test('si el orden usa más colores que el mínimo, se dice y se muestra uno con χ', () => {
  // El camino 1–3–4–2 escrito en este orden: 1 y 2 toman R sin verse, y 4
  // queda con R y N al lado. Alcanza con dos.
  const pasos = recorrer(leer('1 3\n3 4\n4 2'), { modo: MODOS.VERTICES });
  const final = ultimo(pasos);
  assert.ok(pasos.some((p) => /se usaron 3 colores, pero alcanza con 2/.test(p.mensaje)));
  assert.equal(final.optimo, true);
  assert.equal(new Set(Object.values(final.colores)).size, 2);
});

test('el polinomio con la fórmula general: la hoja 1 da cᵢ = 0, 0, 6, 24 y P(3) = 6', () => {
  const p = coloreado.polinomioCromatico(HOJA_1);
  assert.deepEqual(p.c, [0, 0, 6, 24]);
  assert.equal(coloreado.polinomioComoTexto(p.coeficientes), 'λ⁴ − 5λ³ + 8λ² − 4λ');
  assert.equal(coloreado.factoresComoTexto(p.factores), 'λ(λ−1)(λ−2)²');
  const final = ultimo(recorrer(HOJA_1, { modo: MODOS.POLINOMIO, lambda: 3 }));
  assert.equal(final.valor, 6);
  assert.match(final.mensaje, /hay 6 formas de colorear el grafo con 3 colores/);
});

test('los ejemplos de las hojas Pc1 a Pc3 que dan bien', () => {
  const P = (texto, k) => coloreado.evaluar(coloreado.polinomioCromatico(leer(texto)).coeficientes, k);
  assert.equal(P('1 2\n2 3\n3 1', 3), 6, 'triángulo, hoja Pc3');
  assert.equal(P('1 2\n2 3\n3 4', 2), 2, 'lineal de 4 vértices');
  assert.equal(P('1 2\n1 3\n2 4\n3 5\n3 6', 2), 2, 'árbol de 6 vértices');
  // El nulo no se escribe —el formulario pide al menos una arista—: se arma
  // a mano.
  const nulo = { tipo: grafos.TIPOS.NO_DIRIGIDO, vertices: [1, 2, 3, 4], aristas: [], conPesos: false };
  assert.equal(coloreado.evaluar(coloreado.polinomioCromatico(nulo).coeficientes, 3), 81, 'nulo: λⁿ');
  assert.equal(P('1 2\n2 3\n3 4\n2 4', 3), 12, 'el «grafo simple» de la hoja Pc2');
  assert.equal(P('1 2\n1 3\n1 4\n2 3\n2 4\n3 4', 4), 24, 'completo de 4');
});

// La hoja Pc2 da para los cíclicos fórmulas que fallan en general: con 5
// vértices y 3 colores dice 24, y son 30. La fórmula general da lo real,
// (λ−1)ⁿ + (−1)ⁿ(λ−1).
test('los cíclicos: el de 5 con 3 colores son 30, y el de 6 con 2 son 2', () => {
  const P = (texto, k) => coloreado.evaluar(coloreado.polinomioCromatico(leer(texto)).coeficientes, k);
  assert.equal(P('1 2\n2 3\n3 4\n4 5\n5 1', 3), 30);
  assert.equal(P('1 2\n2 3\n3 4\n4 5\n5 6\n6 1', 2), 2);
  assert.equal(P('1 2\n2 3\n3 4\n4 5\n5 6\n6 1', 3), 66);
});

test('con menos colores que χ, P(λ) = 0 y se dice cuántos hacen falta', () => {
  const final = ultimo(recorrer(HOJA_1, { modo: MODOS.POLINOMIO, lambda: 2 }));
  assert.equal(final.valor, 0);
  assert.match(final.mensaje, /hacen falta 3/);
});
