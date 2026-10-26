const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const operaciones = CC2.dominio.operaciones;
const { recorrer } = CC2.algoritmos.operaciones;
const { OPERACIONES } = operaciones;

// No hay ejercicio del docente: las pruebas se anclan al ejemplo de las
// maquetas que aprobó el usuario (2026-10-26), G₁ el camino 1–2–3 y G₂ la
// arista a–b, contado a mano, y a las fórmulas de |A| de cada operación.
const leer = (texto, nombre = 'G') => operaciones.leerOperando(texto, nombre).grafo;
const G1 = leer('1 2\n2 3');
const G2 = leer('a b');
const ultimo = (pasos) => pasos[pasos.length - 1];
const clave = ([p, q]) => [p.join(','), q.join(',')].sort().join('|');
// Las aristas del resultado según la regla, comparando todos los pares.
function porLaRegla(g1, g2, regla) {
  const ad = operaciones.adyacentes;
  const V = g1.vertices.flatMap((u) => g2.vertices.map((v) => [u, v]));
  const salen = new Set();
  V.forEach((p, i) => V.slice(i + 1).forEach((q) => {
    if (regla(ad, g1, g2, p, q)) salen.add(clave([p, q]));
  }));
  return salen;
}
const REGLAS = {
  [OPERACIONES.CARTESIANO]: (ad, g1, g2, [u, v], [x, y]) => (u === x && ad(g2, v, y)) || (v === y && ad(g1, u, x)),
  [OPERACIONES.TENSORIAL]: (ad, g1, g2, [u, v], [x, y]) => ad(g1, u, x) && ad(g2, v, y),
  [OPERACIONES.COMPOSICION]: (ad, g1, g2, [u, v], [x, y]) => ad(g1, u, x) || (u === x && ad(g2, v, y))
};

test('los vértices pueden ser números o letras, en los dos grafos', () => {
  assert.deepEqual(leer('1 2\n2 3').vertices, ['1', '2', '3']);
  assert.deepEqual(leer('b a\nx1').vertices, ['a', 'b', 'x1']);
  assert.deepEqual(leer('10 2\na 2').vertices, ['2', '10', 'a']);
  assert.deepEqual(leer('1-2; 2, 3').aristas, [['1', '2'], ['2', '3']]);
  assert.equal(operaciones.comoTexto(leer('1 2\n3')), '1 2\n3');
});

test('lo que no es un grafo simple de hasta 4 vértices se rechaza, con el renglón', () => {
  const error = (texto) => operaciones.leerOperando(texto, 'G₁').mensaje;
  assert.match(error(''), /G₁: escriba al menos una arista/);
  assert.match(error('1 1'), /renglón 1 .*lazo/);
  assert.match(error('1 2\n2 1'), /renglón 2 .*ya está en el renglón 1/);
  assert.match(error('1 2 5'), /sin peso ni nombre/);
  assert.match(error('1 ab'), /un número de hasta dos cifras o una letra/);
  assert.match(error('1 2\n3 4\n5'), /tiene 5 vértices; caben hasta 4/);
});

test('camino 1–2–3 y arista a–b: 7, 4 y 11 aristas, como en las maquetas', () => {
  const total = (op) => operaciones.operar(G1, G2, op).total;
  assert.equal(total(OPERACIONES.CARTESIANO), 7);
  assert.equal(total(OPERACIONES.TENSORIAL), 4);
  assert.equal(total(OPERACIONES.COMPOSICION), 11);
});

test('cada operación da exactamente las aristas de su regla, sin repetir', () => {
  const ejemplos = [[G1, G2], [leer('1 2\n2 3\n3 1\n4'), leer('a b\nb c')], [leer('1 2\n3 4'), leer('1 2\n1 3\n1 4\n2 3')], [leer('a'), leer('1 2')]];
  for (const [g1, g2] of ejemplos) {
    for (const op of Object.values(OPERACIONES)) {
      const { grupos, total } = operaciones.operar(g1, g2, op);
      const salen = grupos.flatMap((g) => g.aristas).map(clave);
      assert.equal(new Set(salen).size, salen.length, `${op}: sin repetidas`);
      assert.deepEqual(new Set(salen), porLaRegla(g1, g2, REGLAS[op]), op);
      assert.equal(total, operaciones.cuenta(g1, g2, op).valor, `${op}: la fórmula cuenta lo mismo`);
    }
  }
});

test('producto cartesiano: los vértices, una fila por vértice de G₁, una columna por vértice de G₂, y la cuenta', () => {
  const pasos = recorrer(G1, G2, OPERACIONES.CARTESIANO);
  assert.equal(pasos.length, 1 + 3 + 2 + 1);
  assert.match(pasos[0].mensaje, /los pares \(u, v\), con u de G₁ y v de G₂, 3 · 2 = 6/);
  assert.equal(pasos[2].mensaje, 'Vértice 2 de G₁: se copia G₂ en la fila 2: (2, a)–(2, b).');
  assert.deepEqual([pasos[2].nuevasDesde, pasos[2].hechas], [1, 2]);
  assert.equal(pasos[4].mensaje, 'Vértice a de G₂: se copia G₁ en la columna a: (1, a)–(2, a), (2, a)–(3, a).');
  const final = ultimo(pasos);
  assert.equal(final.hechas, 7);
  assert.deepEqual(final.calculo.map((l) => l.resultado), ['6', '7']);
  assert.match(final.mensaje, /\|A\| = \|V₁\|·\|A₂\| \+ \|V₂\|·\|A₁\| = 3 · 1 \+ 2 · 2 = 7/);
});

test('producto tensorial: una arista de G₁ por paso, en cruz con las de G₂', () => {
  const pasos = recorrer(G1, G2, OPERACIONES.TENSORIAL);
  assert.equal(pasos.length, 1 + 2 + 1);
  assert.equal(pasos[1].mensaje, 'Arista 1–2 de G₁ con cada arista de G₂, en cruz: a–b da (1, a)–(2, b) y (1, b)–(2, a).');
  assert.match(ultimo(pasos).mensaje, /= 2 · 2 · 1 = 4/);
});

test('composición: copias de G₂ en las filas, y cada arista de G₁ une dos filas todos con todos', () => {
  const pasos = recorrer(G1, G2, OPERACIONES.COMPOSICION);
  assert.equal(pasos.length, 1 + 3 + 2 + 1);
  assert.equal(pasos[5].mensaje, 'Arista 2–3 de G₁: todos los de la fila 2 se unen con todos los de la fila 3, 2 · 2 = 4 aristas.');
  assert.equal(pasos[5].paresResaltados.length, 4);
  assert.match(ultimo(pasos).mensaje, /= 3 · 1 \+ 2² · 2 = 11/);
});

test('un operando sin aristas deja su paso, dicho', () => {
  const pasos = recorrer(G1, leer('a\nb'), OPERACIONES.CARTESIANO);
  assert.match(pasos[1].mensaje, /G₂ no tiene aristas, así que la fila 1 queda sin ninguna/);
  assert.equal(ultimo(pasos).hechas, 4);
});
