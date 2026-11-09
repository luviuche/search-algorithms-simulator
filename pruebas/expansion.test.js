const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const expansion = CC2.dominio.expansion;
const { recorrer } = CC2.algoritmos.expansion;
const { METODOS, etiqueta } = expansion;

// Sin hojas del docente para este tema (usuario, 2026-11-09): la prueba
// principal es su grafo ponderado de la figura 12 del documento de apoyo.
const leer = (texto) => expansion.leerGrafo(texto).grafo;
const ultimo = (pasos) => pasos[pasos.length - 1];
// El paso que concluye el árbol, antes de las ramas y las cuerdas.
const delArbol = (pasos) => pasos.find((p) => p.fase === 'arbol');
const FIGURA_12 = leer('4 2 2\n4 3 8\n4 5 1\n2 3 10\n3 5 2\n3 1 4\n2 1 5');
const etiquetas = (grafo, nombres) => nombres.map((n) => etiqueta(grafo.aristas.find((a) => a.nombre === n)));

test('el grafo admite números o letras, y sin peso la arista vale 1', () => {
  assert.deepEqual(FIGURA_12.vertices, ['1', '2', '3', '4', '5']);
  assert.deepEqual(leer('B A\nA C 3').vertices, ['A', 'B', 'C']);
  assert.equal(leer('1 2').aristas[0].peso, 1);
  assert.match(expansion.leerGrafo('1 1 3').mensaje, /lazo/);
  assert.match(expansion.leerGrafo('1 2 3\n2 1 4').mensaje, /ya está en el renglón 1/);
  assert.match(expansion.leerGrafo('1 2 -3').mensaje, /entero de 0/);
  assert.match(expansion.leerGrafo('1 2\n3 4').mensaje, /no es conexo: \{1, 2\} y \{3, 4\}/);
  assert.equal(expansion.leerGrafo(expansion.comoTexto(FIGURA_12)).grafo.aristas.length, 7);
});

test('Kruskal en la figura 12: entran 4–5, 4–2, 3–5 y 3–1, peso 9, y lo demás no se revisa', () => {
  const pasos = recorrer(FIGURA_12, { metodo: METODOS.KRUSKAL });
  assert.deepEqual(pasos[0].tabla.map((f) => f.etiqueta), ['4–5', '4–2', '3–5', '3–1', '2–1', '4–3', '2–3']);
  assert.equal(pasos.length, 1 + 4 + 1 + 2, 'el orden, cuatro aristas que entran, el árbol, y ramas y cuerdas');
  const final = delArbol(pasos);
  assert.deepEqual(etiquetas(FIGURA_12, final.T), ['4–5', '4–2', '3–5', '3–1']);
  assert.equal(final.total, 9);
  assert.equal(final.suma, '1 + 2 + 2 + 4 = 9');
  assert.deepEqual(final.tabla.map((f) => f.decision), ['entra', 'entra', 'entra', 'entra', 'sobra', 'sobra', 'sobra']);
  assert.equal(final.propiedades[1].valor, true, 'es el único árbol mínimo');
  assert.match(final.mensaje, /las 3 que quedan \(2–1, 4–3, 2–3\) no hace falta revisarlas/);
});

test('Kruskal descarta la arista que cerraría un ciclo y dice por dónde', () => {
  const grafo = leer('1 2 1\n2 3 2\n1 3 3\n3 4 4');
  const pasos = recorrer(grafo, { metodo: METODOS.KRUSKAL });
  const ciclo = pasos.find((p) => p.entra === false);
  assert.equal(etiqueta(grafo.aristas.find((a) => a.nombre === ciclo.actual)), '1–3');
  assert.deepEqual(etiquetas(grafo, ciclo.ciclo), ['1–2', '2–3']);
  assert.match(ciclo.mensaje, /ya están unidos en el árbol por 1–2, 2–3\. Cerraría un ciclo/);
  assert.equal(ultimo(pasos).total, 7);
});

test('Prim en la figura 12 desde 1: 3–1, 3–5, 4–5, 4–2, el mismo peso que Kruskal', () => {
  const pasos = recorrer(FIGURA_12, { metodo: METODOS.PRIM, inicio: '1' });
  const elegidas = pasos.filter((p) => p.candidatas).map((p) => etiqueta(FIGURA_12.aristas.find((a) => a.nombre === p.actual)));
  assert.deepEqual(elegidas, ['3–1', '3–5', '4–5', '4–2']);
  assert.deepEqual(pasos[2].desde, ['1', '3']);
  assert.deepEqual(etiquetas(FIGURA_12, pasos[2].candidatas), ['3–5', '2–1', '4–3', '2–3'], 'de la más liviana a la más pesada');
  assert.equal(ultimo(pasos).total, 9);
  // Desde cualquier vértice, el mismo peso.
  for (const v of FIGURA_12.vertices) assert.equal(ultimo(recorrer(FIGURA_12, { metodo: METODOS.PRIM, inicio: v })).total, 9);
});

test('Prim apaga las aristas que ya no pueden entrar: sus dos extremos están en el árbol', () => {
  const pasos = recorrer(FIGURA_12, { metodo: METODOS.PRIM, inicio: '1' });
  // Con {1, 3, 5, 4}, 4–3 tiene los dos extremos dentro.
  assert.deepEqual(etiquetas(FIGURA_12, pasos[3].descartadas), ['4–3']);
});

test('con un empate que deja elegir, se dice que hay otro árbol del mismo peso', () => {
  const triangulo = leer('1 2 1\n2 3 1\n1 3 1');
  const final = delArbol(recorrer(triangulo, { metodo: METODOS.KRUSKAL }));
  assert.equal(final.propiedades[1].valor, false);
  assert.match(final.mensaje, /No es el único: con 1–3 en lugar de 1–2 pesa lo mismo/);
  const prim = recorrer(triangulo, { metodo: METODOS.PRIM, inicio: '1' });
  assert.match(prim[1].mensaje, /empata con 1–3; va la escrita antes/);
});

test('Prim y Kruskal dan el mismo peso en grafos al azar', () => {
  let semilla = 7;
  const azar = (k) => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla % k; };
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const n = 2 + azar(9);
    const renglones = [];
    for (let v = 2; v <= n; v++) renglones.push(`${1 + azar(v - 1)} ${v} ${azar(20)}`);
    for (let x = 1; x <= n; x++) for (let y = x + 1; y <= n; y++) {
      if (azar(3) === 0 && !renglones.some((r) => r.startsWith(`${x} ${y} `))) renglones.push(`${x} ${y} ${azar(20)}`);
    }
    const grafo = leer(renglones.join('\n'));
    const k = ultimo(recorrer(grafo, { metodo: METODOS.KRUSKAL }));
    const p = ultimo(recorrer(grafo, { metodo: METODOS.PRIM, inicio: String(1 + azar(n)) }));
    assert.equal(k.T.length, n - 1);
    assert.equal(p.total, k.total, renglones.join('; '));
  }
});

// El ejemplo del documento de apoyo para los circuitos y cortes
// fundamentales: el grafo verde, sin pesos, con el árbol a, b, e, f.
const VERDE = leer('1 2\n1 3\n2 3\n3 4\n2 4\n2 5\n4 5\n1 4');

test('las aristas se nombran a, b, c… en el orden escrito, como las del grafo verde', () => {
  assert.deepEqual(VERDE.aristas.map((a) => `${a.nombre} ${etiqueta(a)}`),
    ['a 1–2', 'b 1–3', 'c 2–3', 'd 3–4', 'e 2–4', 'f 2–5', 'g 4–5', 'h 1–4']);
});

test('documento de apoyo: con el árbol a, b, e, f, ramas y rango 4, cuerdas c, d, g, h y nulidad 4', () => {
  const { arbol } = expansion.leerArbol('a b e f', VERDE);
  const pasos = recorrer(VERDE, { metodo: METODOS.DADO, arbol: arbol.map((a) => a.nombre) });
  assert.deepEqual(pasos.map((p) => p.fase), ['dado', 'arbol', 'ramas', 'cuerdas']);
  const ramas = pasos[2];
  assert.deepEqual(ramas.ramas, ['a', 'b', 'e', 'f']);
  assert.equal(ramas.rango, 4);
  assert.match(ramas.mensaje, /Rango = n − 1 = 5 − 1 = 4/);
  const final = ultimo(pasos);
  assert.deepEqual(final.cuerdas, ['c', 'd', 'g', 'h']);
  assert.equal(final.nulidad, 4);
  assert.match(final.mensaje, /G′ = \(S′, A′\), con S′ = \{1, 2, 3, 4, 5\} y A′ = \{c, d, g, h\}/);
  assert.match(final.mensaje, /Nulidad = m − n \+ 1 = 8 − 5 \+ 1 = 4/);
  assert.equal(final.propiedades.find((p) => p.nombre === 'Mínimo').valor, true, 'sin pesos, todos los árboles pesan 4');
});

test('Kruskal en el grafo verde da otro árbol, a, b, d, f, con el mismo rango y nulidad', () => {
  const final = ultimo(recorrer(VERDE, { metodo: METODOS.KRUSKAL }));
  assert.deepEqual(final.ramas, ['a', 'b', 'd', 'f']);
  assert.deepEqual(final.cuerdas, ['c', 'e', 'g', 'h']);
  assert.equal(final.rango + final.nulidad, VERDE.aristas.length);
});

test('un árbol escrito se revisa: n − 1 aristas, sin ciclos, y que existan', () => {
  assert.match(expansion.leerArbol('a b e', VERDE).mensaje, /tiene 3 aristas, y un árbol de 5 vértices tiene n − 1 = 4/);
  assert.match(expansion.leerArbol('a b c f', VERDE).mensaje, /a, b, c forman un ciclo/);
  assert.match(expansion.leerArbol('a b e z', VERDE).mensaje, /«z» no es una arista/);
  const caro = leer('1 2 1\n2 3 1\n1 3 5');
  const pasos = recorrer(caro, { metodo: METODOS.DADO, arbol: ['b', 'c'] });
  assert.match(delArbol(pasos).mensaje, /No es mínimo: el mínimo pesa 2/);
});

test('un grafo que ya es un árbol no tiene cuerdas: nulidad 0', () => {
  const final = ultimo(recorrer(leer('1 2 3\n2 3 4'), { metodo: METODOS.PRIM }));
  assert.deepEqual(final.cuerdas, []);
  assert.equal(final.nulidad, 0);
  assert.match(final.mensaje, /no tiene cuerdas/);
});
