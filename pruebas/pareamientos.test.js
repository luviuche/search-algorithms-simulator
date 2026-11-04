const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const pareamientos = CC2.dominio.pareamientos;
const { recorrer } = CC2.algoritmos.pareamientos;
const { MODOS } = pareamientos;

// Los ejemplos de las hojas del docente (docs/Inf. Pareamientos 29-10-26/).
const leer = (texto) => pareamientos.leerGrafo(texto).grafo;
const ultimo = (pasos) => pasos[pasos.length - 1];
// Hojas 9 y 10: el ejemplo central, con vértices letra.
const HOJA_9 = leer('a I E\nb I M\nc M E\nd M S\ne E G\nf F G\ng S G\nh S L\ni S A\nj G A\nk L A');
// Hojas 4 y 5.
const SEIS = leer('a 1 2\nb 1 3\nc 2 3\nd 2 4\ne 3 5\nf 4 5\ng 4 6');

test('el grafo admite letras o números, y nombra las aristas si no se escriben', () => {
  assert.deepEqual(HOJA_9.vertices, ['I', 'E', 'M', 'S', 'G', 'F', 'L', 'A']);
  const sin = leer('I E\nz I M\nM E');
  assert.deepEqual(sin.aristas.map((a) => a.nombre), ['a', 'z', 'b']);
  assert.match(pareamientos.leerGrafo('1 1').mensaje, /lazos/);
  assert.match(pareamientos.leerGrafo('1 2\n2 1').mensaje, /ya está en el renglón 1/);
  assert.equal(pareamientos.leerGrafo(pareamientos.comoTexto(HOJA_9)).grafo.aristas.length, 11);
});

test('hojas 9 y 10: los tres caminos del docente llevan de {b} a {a, d, f, k}', () => {
  const pasos = recorrer(HOJA_9, {
    modo: MODOS.MAXIMO, pareamiento: ['b'],
    caminos: [['a', 'b', 'd'], ['e', 'a', 'b', 'd', 'h'], ['f', 'e', 'a', 'b', 'd', 'h', 'k']]
  });
  const tras = pasos.filter((p) => p.fase === 'invertido').map((p) => p.M.join(' '));
  assert.deepEqual(tras, ['a d', 'b e h', 'a d f k']);
  assert.deepEqual(pasos.find((p) => p.fase === 'camino').camino.vertices, ['E', 'I', 'M', 'S']);
  const final = ultimo(pasos);
  assert.equal(final.nu, 4);
  assert.deepEqual(final.propiedades.map((p) => p.valor), [true, true, true, true]);
  assert.match(final.mensaje, /es perfecto, máximo y maximal\. ν\(G\) = 4/);
});

test('sin escribir caminos también llega al máximo, por el más corto', () => {
  for (const pareamiento of [[], ['b'], ['a', 'd']]) {
    assert.equal(ultimo(recorrer(HOJA_9, { modo: MODOS.MAXIMO, pareamiento })).M.length, 4);
  }
  assert.equal(pareamientos.caminosAumentados(HOJA_9, ['b']).length / 2, 8, 'cada camino se halla en los dos sentidos');
});

test('un ciclo impar no esconde caminos: hace falta recorrer caminos simples', () => {
  // El triángulo 3-4-5 con M = {2–3, 4–5}. El único camino M-aumentado entra
  // por 3, da la vuelta 3-4-5 y sale a 6: una búsqueda por niveles que marque
  // el 5 al llegar por 3–5 ya no puede salir por él.
  const flor = leer('a 1 2\nb 2 3\nc 3 5\nd 3 4\ne 4 5\nf 5 6');
  const caminos = pareamientos.caminosAumentados(flor, ['b', 'e']);
  assert.ok(caminos.some((c) => c.aristas.join(' ') === 'a b d e f'));
  assert.equal(ultimo(recorrer(flor, { modo: MODOS.MAXIMO, pareamiento: ['b', 'e'] })).M.length, 3);
});

test('un camino escrito se revisa: alterna, y va de libre a libre', () => {
  const c = (nombres, M = ['b']) => pareamientos.comprobarCamino(HOJA_9, M, nombres);
  assert.deepEqual(c(['a', 'b', 'd']).camino.vertices, ['E', 'I', 'M', 'S']);
  assert.deepEqual(c(['d', 'b', 'a']).camino.vertices, ['S', 'M', 'I', 'E'], 'en los dos sentidos');
  assert.match(c(['a', 'b']).mensaje, /cantidad impar/);
  assert.match(c(['a', 'c', 'd']).mensaje, /no alterna/);
  assert.match(c(['b', 'c', 'e'], ['b']).mensaje, /no alterna/);
  assert.match(c(['a', 'j', 'd']).mensaje, /no sigue/);
});

test('hoja 5: {a, e, g} es máximo y perfecto, {b, d} es maximal y no máximo', () => {
  const a = pareamientos.clasificar(SEIS, ['a', 'e', 'g']);
  assert.ok(a.maximo && a.perfecto && a.maximal);
  assert.deepEqual(a.aristasLibres, ['b', 'c', 'd', 'f']);
  const b = pareamientos.clasificar(SEIS, ['b', 'd']);
  assert.ok(b.maximal && !b.maximo);
  assert.deepEqual(b.libres, ['5', '6']);
  assert.equal(b.nu, 3);
});

test('hoja 4: desde {b, f} el camino M-aumentado es a, b, e, f, g', () => {
  const [camino] = pareamientos.caminosAumentados(SEIS, ['b', 'f']);
  assert.deepEqual(camino.aristas, ['a', 'b', 'e', 'f', 'g']);
  assert.deepEqual(pareamientos.invertir(['b', 'f'], camino).sort(), ['a', 'e', 'g']);
});

test('hoja 6: {c} es maximal sin ser máximo, y el inextensible de cardinalidad 2 no es máximo', () => {
  const estrella = leer('a 1 2\nb 1 3\nc 2 3\nd 2 4\ne 2 5\nf 2 6');
  const c = pareamientos.clasificar(estrella, ['c']);
  assert.ok(c.maximal && !c.maximo);
  assert.equal(c.nu, 2);
  const inextensible = leer('a 1 4\nb 1 5\nc 2 4\nd 2 5\ne 2 6\nf 3 5\ng 3 6');
  const i = pareamientos.clasificar(inextensible, ['b', 'e']);
  assert.ok(i.maximal && !i.maximo);
  assert.equal(i.nu, 3);
});

test('comprobar sigue la hoja 5: con quién comparte cada arista, y la conclusión', () => {
  const pasos = recorrer(SEIS, { modo: MODOS.COMPROBAR, pareamiento: ['b', 'd'] });
  assert.equal(pasos.length, 1 + 2 + 1);
  assert.deepEqual(pasos[1].tabla[0].comparte, ['a', 'c', 'e']);
  const final = ultimo(pasos);
  assert.deepEqual(final.vl, ['5', '6']);
  assert.match(final.mensaje, /M = \{b, d\}, 2 aristas: es maximal\. ν\(G\) = 3/);
  assert.equal(final.propiedades.find((p) => p.nombre === 'Máximo').detalle, 'tiene 2 y ν(G) = 3');
});

test('si dos aristas comparten vértice no es pareamiento, y se dice cuáles', () => {
  const final = ultimo(recorrer(SEIS, { modo: MODOS.COMPROBAR, pareamiento: ['a', 'b'] }));
  assert.equal(final.propiedades[0].valor, false);
  assert.equal(final.propiedades[1].valor, null);
  assert.match(final.mensaje, /a y b comparten 1/);
});
