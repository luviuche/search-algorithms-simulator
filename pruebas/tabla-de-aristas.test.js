const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

// El editor de un grafo (CLAUDE.md 6.13) escribe el texto de siempre y cada
// tema lo lee con su lector: lo que sale de la tabla tiene que leerse allá
// como el grafo que se armó, con sus aislados, sus pesos y sus nombres.
const { nombresDe, vale, rotulosDeAristas, leerTexto, comoTexto } = CC2.dominio.tablaDeAristas;
const { grafo, caminos, expansion, pareamientos, operaciones } = CC2.dominio;

const fila = (desde, hasta, peso = '', nombre = null) => ({ desde, hasta, peso, nombre });

test('los nombres de los vértices: desde 1, desde 0, desde otro número y con letras', () => {
  assert.deepEqual(nombresDe('n:1', 4), ['1', '2', '3', '4']);
  assert.deepEqual(nombresDe('n:0', 3), ['0', '1', '2']);
  assert.deepEqual(nombresDe('n:4', 3), ['4', '5', '6']);
  assert.deepEqual(nombresDe('A', 3), ['A', 'B', 'C']);
  assert.deepEqual(nombresDe('a', 2), ['a', 'b']);
  assert.deepEqual(nombresDe('n:1', null), []);
});

test('qué forma de nombrar vale en cada tema', () => {
  assert.equal(vale('n:1', ['n:1']), true);
  // Un lector que numera acepta empezar en otro número, pero no en 0.
  assert.equal(vale('n:3', ['n:1']), true);
  assert.equal(vale('n:0', ['n:1']), false);
  assert.equal(vale('A', ['n:1']), false);
  assert.equal(vale('n:0', ['n:1', 'n:*']), true);
  assert.equal(vale('A', ['n:0', 'n:1', 'A']), true);
});

test('de la tabla al texto: una arista por renglón y los aislados solos en el suyo', () => {
  const estado = { n: 5, esquema: 'n:1', filas: [fila(0, 1, '4'), fila(1, 2)], ponderado: true };
  assert.equal(comoTexto(estado, true), '1 2 4\n2 3\n4\n5');
  // Sin ponderar, los pesos escritos no salen.
  assert.equal(comoTexto({ ...estado, ponderado: false }, true), '1 2\n2 3\n4\n5');
  // Ni donde el tema no lleva pesos.
  assert.equal(comoTexto(estado, false), '1 2\n2 3\n4\n5');
  assert.equal(comoTexto({ ...estado, n: null }, true), '');
  // El nombre que el texto traía se conserva.
  assert.equal(comoTexto({ n: 2, esquema: 'n:1', filas: [fila(0, 1, '', 'x')], ponderado: false }, false), 'x 1 2');
});

test('lo que escribe la tabla lo lee cada tema como el grafo que se armó', () => {
  // Floyd, la matricial y el coloreado: numerados desde 1, con un aislado.
  const floyd = grafo.leerGrafo(comoTexto({ n: 4, esquema: 'n:1', filas: [fila(0, 1, '3'), fila(1, 2, '2')], ponderado: true }, true), 'dirigido');
  assert.equal(floyd.valido, true);
  assert.deepEqual(floyd.grafo.vertices, [1, 2, 3, 4]);
  assert.deepEqual(floyd.grafo.aristas.map((a) => [a.origen, a.destino, a.peso]), [[1, 2, 3], [2, 3, 2]]);

  // Dijkstra desde 0, como el docente.
  const dijkstra = caminos.leerGrafo(comoTexto({ n: 3, esquema: 'n:0', filas: [fila(0, 1, '5'), fila(0, 2, '1')], ponderado: true }, true), 'dirigido');
  assert.equal(dijkstra.valido, true);
  assert.deepEqual(dijkstra.grafo.vertices, ['0', '1', '2']);
  assert.deepEqual(dijkstra.grafo.aristas.map((a) => a.peso), [5, 1]);

  // Árbol de expansión con letras: las aristas se nombran por sus extremos,
  // AB, BC…, como las muestra la tabla (`porExtremos`); con números, a, b…
  const filas = [fila(0, 1, '2'), fila(1, 2, '7'), fila(0, 2, '4')];
  const arbol = expansion.leerGrafo(comoTexto({ n: 3, esquema: 'A', filas, ponderado: true }, true));
  assert.equal(arbol.valido, true);
  assert.deepEqual(arbol.grafo.aristas.map((a) => a.nombre), ['AB', 'BC', 'AC']);
  const numerado = expansion.leerGrafo(comoTexto({ n: 3, esquema: 'n:1', filas, ponderado: true }, true));
  assert.deepEqual(numerado.grafo.aristas.map((a) => a.nombre), rotulosDeAristas(filas));

  // Pareamientos: sin pesos, y el aislado se queda.
  const par = pareamientos.leerGrafo(comoTexto({ n: 4, esquema: 'n:1', filas: [fila(0, 1), fila(1, 2)], ponderado: false }, false));
  assert.equal(par.valido, true);
  assert.equal(par.grafo.vertices.length, 4);

  // G₂ de una operación, desde el 2.
  const g2 = operaciones.leerOperando(comoTexto({ n: 3, esquema: 'n:2', filas: [fila(0, 1), fila(1, 2)], ponderado: false }, false), 'G₂');
  assert.equal(g2.valido, true);
  assert.deepEqual(g2.grafo.vertices, ['2', '3', '4']);
});

test('del texto a la tabla: pesos, nombres y aislados', () => {
  const conPesos = { esquemas: ['n:1'], pesos: true, maximo: 8 };
  assert.deepEqual(leerTexto('1 2 5\n2 3\n4', conPesos), {
    valido: true, n: 4, esquema: 'n:1', ponderado: true,
    filas: [fila(0, 1, '5'), fila(1, 2)]
  });
  // En Floyd, una letra delante es el nombre de la arista, no un vértice.
  assert.deepEqual(leerTexto('a 1 2', conPesos).filas, [fila(0, 1, '', 'a')]);
  // Con vértices de letra, «A B 3» es un peso.
  const dijkstra = leerTexto('A B 3\nB C', { esquemas: ['n:0', 'n:1', 'A'], pesos: true, maximo: 8 });
  assert.equal(dijkstra.esquema, 'A');
  assert.deepEqual(dijkstra.filas, [fila(0, 1, '3'), fila(1, 2)]);
  // Sin pesos, el tercero es el nombre.
  assert.deepEqual(leerTexto('b 1 2', { esquemas: ['n:1'], pesos: false, maximo: 8 }).filas, [fila(0, 1, '', 'b')]);
  // Los separadores de los lectores: coma, guion, flecha.
  assert.deepEqual(leerTexto('0-1 4\n1>2', { esquemas: ['n:0', 'n:1'], pesos: true, maximo: 8 }).filas, [fila(0, 1, '4'), fila(1, 2)]);
  assert.deepEqual(leerTexto('  \n', conPesos), { valido: true, vacio: true });
});

test('del texto a la tabla: lo que no cabe se dice, y se sigue en texto', () => {
  const opciones = { esquemas: ['n:1'], pesos: true, maximo: 8 };
  assert.match(leerTexto('1 2\n2 4', opciones).motivo, /falta el 3/);
  assert.equal(leerTexto('1 A', { esquemas: ['n:1', 'A'], pesos: false, maximo: 8 }).valido, false);
  assert.equal(leerTexto('0 1', opciones).valido, false);
  assert.match(leerTexto('1 2\n3 4\n5 6\n7 8\n9 1', opciones).motivo, /caben hasta 8/);
  assert.equal(leerTexto('1 2 3 4', opciones).valido, false);
  // Las minúsculas no son vértices donde son los nombres de las aristas.
  assert.equal(leerTexto('a b', { esquemas: ['n:1', 'A'], pesos: false, maximo: 8 }).valido, false);
});

test('el nombre de cada arista, como lo pone el lector: los escritos se respetan', () => {
  assert.deepEqual(rotulosDeAristas([fila(0, 1), fila(1, 2), fila(2, 3)]), ['a', 'b', 'c']);
  assert.deepEqual(rotulosDeAristas([fila(0, 1), fila(1, 2, '', 'a'), fila(2, 3)]), ['b', 'a', 'c']);
});
