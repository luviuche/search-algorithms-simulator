const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const combinaciones = CC2.dominio.combinaciones;
const { COMBINACIONES } = combinaciones;
const { recorrer } = CC2.algoritmos.combinaciones;

// No hay ejercicio del docente. El ejemplo, contado a mano: G₁ el triángulo
// 1–2–3 y G₂ el camino 2–3–4 con 4–5; comparten los vértices 2 y 3 y la
// arista 2–3, escrita al revés en G₂ a propósito.
const leer = (texto) => combinaciones.leer(texto, 'G').grafo;
const G1 = leer('1 2\n2 3\n1 3');
const G2 = leer('3 2\n3 4\n4 5');
const aristas = (op, a = G1, b = G2) => combinaciones.combinar(a, b, op).aristas.map((x) => x.arista.join('–'));
const ultimo = (pasos) => pasos[pasos.length - 1];

test('unión, intersección, diferencia y suma anillo del ejemplo', () => {
  assert.deepEqual(aristas(COMBINACIONES.UNION), ['1–2', '2–3', '1–3', '3–4', '4–5']);
  assert.deepEqual(aristas(COMBINACIONES.INTERSECCION), ['2–3']);
  assert.deepEqual(aristas(COMBINACIONES.DIFERENCIA), ['1–2', '1–3']);
  assert.deepEqual(aristas(COMBINACIONES.SUMA_ANILLO), ['1–2', '1–3', '3–4', '4–5']);
  const vertices = (op) => combinaciones.combinar(G1, G2, op).vertices.join('');
  assert.equal(vertices(COMBINACIONES.UNION), '12345');
  assert.equal(vertices(COMBINACIONES.INTERSECCION), '23');
  assert.equal(vertices(COMBINACIONES.DIFERENCIA), '123');
  assert.equal(vertices(COMBINACIONES.SUMA_ANILLO), '12345');
});

test('suma: las de los dos y todas las de V₁ con V₂, y pide vértices distintos', () => {
  const b = leer('a b');
  assert.deepEqual(aristas(COMBINACIONES.SUMA, leer('1 2'), b), ['1–2', 'a–b', '1–a', '1–b', '2–a', '2–b']);
  assert.equal(combinaciones.impedimento(G1, b, COMBINACIONES.SUMA), null);
  assert.match(combinaciones.impedimento(G1, G2, COMBINACIONES.SUMA), /2, 3 están en los dos/);
  assert.equal(combinaciones.impedimento(G1, G2, COMBINACIONES.UNION), null);
});

test('la suma anillo es la unión sin la intersección, y las fórmulas cuentan lo mismo, en 200 grafos al azar', () => {
  let semilla = 7;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
  const alAzar = (desde) => {
    const vertices = Array.from({ length: 2 + Math.floor(azar() * 5) }, (_, i) => String(desde + i));
    const lista = [];
    vertices.forEach((u, i) => vertices.slice(i + 1).forEach((v) => { if (azar() < 0.5) lista.push(azar() < 0.5 ? [u, v] : [v, u]); }));
    return { vertices, aristas: lista };
  };
  for (let i = 0; i < 200; i++) {
    const a = alAzar(1);
    const b = alAzar(1 + Math.floor(azar() * 5));
    const u = new Set(aristas(COMBINACIONES.UNION, a, b));
    const n = new Set(aristas(COMBINACIONES.INTERSECCION, a, b));
    const d = aristas(COMBINACIONES.DIFERENCIA, a, b);
    assert.deepEqual(new Set(aristas(COMBINACIONES.SUMA_ANILLO, a, b)), new Set([...u].filter((x) => !n.has(x))));
    assert.deepEqual(d, combinaciones.aristasDe(a).map((x) => x.join('–')).filter((x) => !n.has(x)));
    for (const op of Object.values(COMBINACIONES)) {
      const c2 = op === COMBINACIONES.SUMA ? { vertices: b.vertices.map((v) => `x${v}`.slice(0, 2)), aristas: b.aristas.map((e) => e.map((v) => `x${v}`.slice(0, 2))) } : b;
      if (op === COMBINACIONES.SUMA && new Set(c2.vertices).size !== c2.vertices.length) continue;
      const r = combinaciones.combinar(a, c2, op);
      const c = combinaciones.cuenta(a, c2, op);
      assert.equal(r.vertices.length, c.vertices.valor, `${op}: |V|`);
      assert.equal(r.aristas.length, c.aristas.valor, `${op}: |A|`);
      const final = ultimo(recorrer(a, c2, op));
      assert.equal(final.hechas, r.aristas.length, `${op}: la traza las pone todas`);
      const dentro = new Set(r.vertices);
      assert.ok(r.aristas.every((x) => x.arista.every((v) => dentro.has(v))), `${op}: sus extremos están`);
    }
  }
});

test('la traza revisa arista por arista y dice por qué entra o no', () => {
  const union = recorrer(G1, G2, COMBINACIONES.UNION);
  assert.equal(union.length, 1 + 6 + 1);
  assert.match(union[0].mensaje, /V = V₁ ∪ V₂ = \{1, 2, 3, 4, 5\}.*2 y 3 están en los dos y van una sola vez/);
  assert.equal(union[4].mensaje, 'Arista 2–3 de G₂: ya entró desde G₁, y no se repite.');
  assert.match(ultimo(union).mensaje, /5 vértices y 5 aristas.*= 3 \+ 3 − 1 = 5/);
  const anillo = recorrer(G1, G2, COMBINACIONES.SUMA_ANILLO);
  assert.equal(anillo[2].mensaje, 'Arista 2–3: está en los dos, no entra.');
  assert.deepEqual(anillo[2].noEntra, ['2', '3']);
  assert.match(ultimo(anillo).mensaje, /3 \+ 3 − 2 · 1 = 4/);
});

test('intersección sin vértices en común: se dice y no hay aristas', () => {
  const pasos = recorrer(leer('1 2'), leer('a b'), COMBINACIONES.INTERSECCION);
  assert.match(pasos[0].mensaje, /∅: G₁ y G₂ no comparten vértices/);
  assert.equal(ultimo(pasos).cuenta.vertices.valor, 0);
  assert.equal(ultimo(pasos).hechas, 0);
});

test('en la suma, un paso copia cada grafo y después va uno por vértice de V₁', () => {
  const pasos = recorrer(leer('1 2\n3'), leer('a b'), COMBINACIONES.SUMA);
  assert.equal(pasos.length, 1 + 2 + 3 + 1);
  assert.equal(pasos[3].mensaje, 'Vértice 1 de G₁: se une con todos los de V₂, 2 aristas.');
  assert.match(ultimo(pasos).mensaje, /\|A₁\| \+ \|A₂\| \+ \|V₁\|·\|V₂\| = 1 \+ 1 \+ 3 · 2 = 8/);
});

test('hasta 6 vértices por grafo, sin hablar del producto', () => {
  assert.equal(combinaciones.leer('1 2\n3 4\n5 6', 'G₁').valido, true);
  assert.equal(combinaciones.leer('1 2\n3 4\n5 6\n7', 'G₁').mensaje, 'G₁ tiene 7 vértices; caben hasta 6.');
});
