const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const grafos = CC2.dominio.grafo;
const conjuntos = CC2.dominio.conjuntos;
const { recorrer } = CC2.algoritmos.conjuntos;
const { MODOS } = conjuntos;

// Los ejemplos de las hojas del docente (docs/C. indep y dominante/, visto en
// clase el 2026-10-28). Las aristas se leyeron de sus dibujos.
const leer = (texto) => grafos.leerGrafo(texto, grafos.TIPOS.NO_DIRIGIDO, { verticesMaximos: 12 }).grafo;
const ultimo = (pasos) => pasos[pasos.length - 1];
const tamano = (grafo, modo) => conjuntos.buscar(grafo, modo).conjunto.length;

// Hoja 1 de dominantes: γ = 2 con {4, 5}; {2, 3, 6} también domina.
const SIETE = leer('1 2\n1 3\n1 4\n2 4\n3 4\n4 5\n4 7\n5 6\n5 7\n6 7');
// Ejemplo 2 (hoja 4): sus cinco conjuntos a–e.
const EJEMPLO_2 = leer('1 2\n1 4\n2 4\n2 3\n3 6\n3 5\n4 5');
// Ejemplo 4 (hoja 5): el ciclo de 8.
const C8 = leer('1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n7 8\n8 1');
// Hojas 1 y 2 de independientes: el cubo.
const CUBO = leer('1 2\n1 3\n1 5\n2 4\n2 6\n3 4\n3 7\n4 8\n5 6\n5 7\n6 8\n7 8');

test('se admiten hasta 12 vértices, como el grafo de la hoja 3 de independientes', () => {
  const doce = leer('11 12\n12 10\n11 10\n11 1\n1 10\n1 2\n2 3\n3 4\n4 5\n5 6\n4 7\n4 8\n7 8\n7 9');
  assert.equal(doce.vertices.length, 12);
  assert.equal(grafos.leerGrafo('1 2\n3 4\n5 6\n7 8\n9 10', grafos.TIPOS.NO_DIRIGIDO).valido, false, 'los demás temas siguen con 8');
  // {2, 4, 6, 9, 10} es maximal, pero el máximo tiene 6 (la hoja lo llama máximo).
  const c = conjuntos.clasificar(doce, [2, 4, 6, 9, 10]);
  assert.equal(c.maximal, true);
  assert.equal(tamano(doce, MODOS.INDEPENDIENTE_MAXIMO), 6);
});

test('hoja 1 de dominantes: {2, 3, 6} y {4, 5} dominan, γ = 2, y {4, 5} no es independiente', () => {
  assert.equal(conjuntos.clasificar(SIETE, [2, 3, 6]).domina, true);
  const c = conjuntos.clasificar(SIETE, [4, 5]);
  assert.equal(c.domina, true);
  assert.equal(c.independiente, false);
  assert.equal(tamano(SIETE, MODOS.DOMINANTE_MINIMO), 2);
});

test('ejemplo 2: a, b, c y d son dominantes independientes, e domina sin ser independiente, γ = 2', () => {
  for (const S of [[1, 5, 6], [3, 4], [1, 3], [4, 6]]) {
    const c = conjuntos.clasificar(EJEMPLO_2, S);
    assert.ok(c.domina && c.independiente, `{${S}}`);
  }
  const e = conjuntos.clasificar(EJEMPLO_2, [2, 3]);
  assert.ok(e.domina && !e.independiente);
  assert.equal(tamano(EJEMPLO_2, MODOS.DOMINANTE_MINIMO), 2);
});

test('ejemplo 4, el ciclo de 8: γ 3, total 4, conexo 6 y el minimal más grande 4', () => {
  assert.equal(tamano(C8, MODOS.DOMINANTE_MINIMO), 3);
  assert.deepEqual(conjuntos.buscar(C8, MODOS.DOMINANTE_TOTAL).conjunto, [1, 2, 5, 6], 'el mismo de la hoja');
  assert.deepEqual(conjuntos.buscar(C8, MODOS.DOMINANTE_CONEXO).conjunto, [1, 2, 3, 4, 5, 6], 'el mismo de la hoja');
  assert.equal(tamano(C8, MODOS.DOMINANTE_MINIMAL), 4);
  // Mínimo y minimal no son lo mismo: {1, 3, 5, 7} es minimal y tiene 4.
  assert.equal(conjuntos.clasificar(C8, [1, 3, 5, 7]).minimal, true);
});

test('ejemplo 3: el número de dominación es 3, no 4 como dice la hoja', () => {
  const g = leer('1 2\n2 3\n3 4\n4 5\n5 6\n6 1\n6 7\n7 8\n8 9\n9 5');
  assert.equal(conjuntos.clasificar(g, [1, 3, 5, 7]).domina, true, 'el de la hoja domina');
  assert.equal(conjuntos.clasificar(g, [3, 6, 8]).domina, true);
  assert.equal(tamano(g, MODOS.DOMINANTE_MINIMO), 3);
});

test('independientes: el cubo tiene β = 4 como la hoja, y {3, 6} es maximal con 2', () => {
  assert.deepEqual(conjuntos.buscar(CUBO, MODOS.INDEPENDIENTE_MAXIMO).conjunto, [1, 4, 6, 7], 'el {1, 7, 6, 4} de la hoja');
  assert.equal(conjuntos.clasificar(CUBO, [3, 6]).maximal, true);
  // Un independiente no siempre domina: solo el maximal (la duda de la hoja 3).
  const c = conjuntos.clasificar(CUBO, [1, 7, 4]);
  assert.ok(c.independiente && !c.domina);
});

test('el {5} que la hoja 3 marca «revisar» es independiente pero no maximal: le cabe el 1', () => {
  const g = leer('a 1 2\nc 2 3\nb 2 5\nd 2 4\ne 3 5\nf 4 5\ng 5 6\nh 5 7\ni 6 7');
  const pasos = recorrer(g, { modo: MODOS.COMPROBAR, conjunto: [5] });
  const maximal = ultimo(pasos).propiedades.find((p) => p.nombre === 'Maximal');
  assert.equal(maximal.valor, false);
  assert.equal(maximal.detalle, 'le cabe el 1');
  assert.equal(tamano(g, MODOS.INDEPENDIENTE_MAXIMO), 4);
});

test('comprobar sigue la hoja: un paso por vértice para la independencia y otro para la dominación', () => {
  const pasos = recorrer(SIETE, { modo: MODOS.COMPROBAR, conjunto: [4, 5] });
  assert.equal(pasos.length, 1 + 2 + 2 + 1);
  assert.equal(pasos[1].mensaje, '4 es adyacente a 5, que está en S′: 4 ~ 5.');
  assert.equal(pasos[3].mensaje, '4 – {1, 2, 3, 7}: domina a 1, 2, 3 y 7.');
  assert.equal(pasos[4].mensaje, '5 – {6, 7}: domina a 6 y 7 (7 ya estaba dominado).');
  assert.deepEqual(pasos[4].dominados, [1, 2, 3, 6, 7]);
  const final = ultimo(pasos);
  assert.match(final.mensaje, /S′ = \{4, 5\} es un conjunto dominante, pero no independiente\. \|S′\| = 2; γ\(G\) = 2 y β\(G\) = 3: es dominante mínimo/);
});

test('buscar dice por qué es el óptimo: ningún conjunto más chico sirve', () => {
  const final = ultimo(recorrer(EJEMPLO_2, { modo: MODOS.DOMINANTE_MINIMO }));
  assert.deepEqual(final.conjunto, [1, 3], 'el c de la hoja');
  assert.equal(final.mensaje, 'γ(G) = 2: S′ = {1, 3} es un conjunto dominante mínimo, y ninguno de los 6 conjuntos de menos de 2 vértices sirve.');
});

test('sin dominante total si hay un vértice aislado, y se dice', () => {
  const pasos = recorrer(leer('1 2\n3'), { modo: MODOS.DOMINANTE_TOTAL });
  assert.equal(pasos.length, 1);
  assert.match(pasos[0].mensaje, /un vértice aislado no tiene ningún vecino/);
});

test('leer S′: vértices del grafo, sin repetir, con llaves o sin ellas', () => {
  assert.deepEqual(conjuntos.leerConjunto('{5, 1}', SIETE).conjunto, [1, 5]);
  assert.match(conjuntos.leerConjunto('1 9', SIETE).mensaje, /«9» no es un vértice del grafo/);
  assert.match(conjuntos.leerConjunto('1 1', SIETE).mensaje, /el 1 está dos veces/);
});
