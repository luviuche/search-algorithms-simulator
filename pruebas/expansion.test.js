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
  assert.equal(pasos.length, 1 + 4 + 1, 'el orden, cuatro aristas que entran y la conclusión');
  const final = ultimo(pasos);
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
  const final = ultimo(recorrer(triangulo, { metodo: METODOS.KRUSKAL }));
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
