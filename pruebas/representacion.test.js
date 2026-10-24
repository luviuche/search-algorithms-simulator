const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const grafos = CC2.dominio.grafo;
const { REPRESENTACIONES } = grafos;
const { recorrer } = CC2.algoritmos.representacion;

// Los dos grafos de los ejemplos resueltos del docente, en el documento de
// apoyo (docs/Temas grafos apoyo 13-10-26.docx). Lo que sigue está anclado a
// sus tablas, salvo donde su tabla tiene un error, que se dice.
//
// El verde, no dirigido: las aristas a a h en el orden en que se escriben.
const VERDE = grafos.leerGrafo('1 2\n1 3\n2 3\n3 4\n2 4\n2 5\n4 5\n1 4', grafos.TIPOS.NO_DIRIGIDO).grafo;
// El morado, dirigido, con los nombres escritos.
const MORADO = grafos.leerGrafo('a 1 2\nb 2 5\nc 5 4\nd 2 4\ne 3 4\nf 3 1', grafos.TIPOS.DIRIGIDO).grafo;

const matriz = (grafo, representacion, caso = 1) => grafos.representar(grafo, { representacion, caso }).valores;

test('las aristas toman su nombre en orden, o el que se les escriba', () => {
  assert.deepEqual(VERDE.aristas.map((a) => a.nombre).join(''), 'abcdefgh');
  assert.deepEqual(MORADO.aristas.map((a) => a.nombre).join(''), 'abcdef');
  // Mezclado: la que no trae nombre toma el siguiente libre.
  const mezclado = grafos.leerGrafo('b 1 2\n2 3\n3 1', grafos.TIPOS.DIRIGIDO).grafo;
  assert.deepEqual(mezclado.aristas.map((a) => a.nombre), ['b', 'a', 'c']);
  assert.equal(grafos.comoTexto(mezclado), 'b 1 2\n2 3\n3 1');
  assert.match(grafos.leerGrafo('a 1 2\na 2 3', 'dirigido').mensaje, /Renglón 2.*ya hay una arista a/);
});

test('incidencia del grafo verde, como la tabla del docente', () => {
  assert.deepEqual(matriz(VERDE, REPRESENTACIONES.INCIDENCIA), [
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1, 0]
  ]);
});

// La tabla del docente omite el 1 entre 4 y 1 (la arista h) en la fila 4,
// aunque lo pone en la fila 1: la matriz de un no dirigido es simétrica.
test('adyacencia de vértices del grafo verde, con el 1 de la arista h en las dos filas', () => {
  assert.deepEqual(matriz(VERDE, REPRESENTACIONES.ADYACENCIA_VERTICES), [
    [0, 1, 1, 1, 0],
    [1, 0, 1, 1, 1],
    [1, 1, 0, 1, 0],
    [1, 1, 1, 0, 1],
    [0, 1, 0, 1, 0]
  ]);
});

test('adyacencia de aristas del grafo verde, como la tabla del docente', () => {
  assert.deepEqual(matriz(VERDE, REPRESENTACIONES.ADYACENCIA_ARISTAS), [
    [0, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 1, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 1, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 0, 0, 1, 1, 1, 0, 1],
    [1, 1, 0, 1, 1, 0, 1, 0]
  ]);
});

test('incidencia del grafo morado: 1 donde la arista sale, −1 donde llega', () => {
  assert.deepEqual(matriz(MORADO, REPRESENTACIONES.INCIDENCIA), [
    [1, 0, 0, 0, 0, -1],
    [-1, 1, 0, 1, 0, 0],
    [0, 0, 0, 0, 1, 1],
    [0, 0, -1, -1, -1, 0],
    [0, -1, 1, 0, 0, 0]
  ]);
});

test('adyacencia de vértices del grafo morado, casos 1 y 2', () => {
  assert.deepEqual(matriz(MORADO, REPRESENTACIONES.ADYACENCIA_VERTICES, 1), [
    [0, 1, 0, 0, 0],
    [0, 0, 0, 1, 1],
    [1, 0, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0]
  ]);
  // La tabla del docente pone 1 en la fila 4, columna 3, pero la arista e va
  // de 3 a 4: en la fila 4 llega, así que es −1, como el resto de esa fila.
  assert.deepEqual(matriz(MORADO, REPRESENTACIONES.ADYACENCIA_VERTICES, 2), [
    [0, 1, -1, 0, 0],
    [-1, 0, 0, 1, 1],
    [1, 0, 0, 1, 0],
    [0, -1, -1, 0, -1],
    [0, -1, 0, 1, 0]
  ]);
});

test('adyacencia de aristas del grafo morado, casos 1 y 2, como las tablas del docente', () => {
  assert.deepEqual(matriz(MORADO, REPRESENTACIONES.ADYACENCIA_ARISTAS, 1), [
    [0, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 0, 0],
    [0, 1, 0, 1, 1, 0],
    [1, 1, 1, 0, 1, 0],
    [0, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 0]
  ]);
  assert.deepEqual(matriz(MORADO, REPRESENTACIONES.ADYACENCIA_ARISTAS, 2), [
    [0, 1, 0, 1, 0, 1],
    [1, 0, 1, -1, 0, 0],
    [0, 1, 0, -1, -1, 0],
    [1, -1, -1, 0, -1, 0],
    [0, 0, -1, -1, 0, -1],
    [1, 0, 0, 0, -1, 0]
  ]);
});

test('una fila por paso, con lo que lleva 1 y lo que lleva 0, y la propiedad al final', () => {
  const pasos = recorrer(VERDE, { representacion: REPRESENTACIONES.INCIDENCIA });
  assert.equal(pasos.length, 1 + 5 + 1);
  const fila2 = pasos[2];
  assert.equal(fila2.filasLlenas, 2);
  assert.deepEqual(fila2.calculo.map((l) => [l.expresion, l.resultado]), [['a, c, e, f', '1'], ['b, d, g, h', '0'], ['unos de la fila', '4']]);
  assert.match(fila2.mensaje, /inciden a, c, e y f.*Grado de 2: 4/);
  const ultimo = pasos[pasos.length - 1];
  assert.equal(ultimo.tipo, 'construido');
  assert.match(ultimo.mensaje, /suma de los grados es 16, el doble de las 8 aristas/);
});
