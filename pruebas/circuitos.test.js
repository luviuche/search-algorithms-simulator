const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

// Circuitos y conjuntos de corte (CLAUDE.md 5.22). La referencia es el taller
// del usuario (docs/Grafos/Taller Grafo Árbol Exp.pdf, 2026-11-26): sus
// cuatro matrices, comprobadas a mano, son las pruebas.
const { circuitos, cortes, circuitosFundamentales, cortesFundamentales, matriz } = CC2.dominio.circuitos;
const expansion = CC2.dominio.expansion;
const { recorrer, HALLAR } = CC2.algoritmos.expansion;

const TALLER = expansion.leerGrafo('a b 2\nb d 2\nb e 3\na c 4\nc d 5\nd e 7\nc b 7\na d 8').grafo;
// Kruskal da el árbol del taller: ab, bd, be, ac.
const T = TALLER.aristas.filter((a) => ['ab', 'bd', 'be', 'ac'].includes(a.nombre));
const filas = (lista, opciones) => matriz(TALLER, lista, opciones).valores.map((fila) => fila.join(''));

test('la matriz de circuitos del taller: 12, en su mismo orden', () => {
  const { lista, demasiados } = circuitos(TALLER);
  assert.equal(demasiados, false);
  // Columnas ab bd be ac cd de cb ad, como en el taller.
  assert.deepEqual(filas(lista), [
    '11000001', '10010010', '01100100', '01001010', '00011001', '11011000',
    '10100101', '10001011', '01010011', '00101110', '10111100', '00110111'
  ]);
  assert.deepEqual(lista[0].recorrido, ['a', 'b', 'd', 'a']);
  assert.equal(lista[11].nombre, 'C₁₂');
});

test('los conjuntos de corte del taller: los 12, todos mínimos', () => {
  const { lista } = cortes(TALLER);
  // El taller los pone en otro orden; son los mismos doce.
  const delTaller = [
    '00100100', '10010001', '00011010', '10001011', '11100010', '11000110',
    '01001101', '01101001', '01110011', '11011100', '11111000', '01010111'
  ];
  assert.deepEqual(filas(lista).slice().sort(), delTaller.slice().sort());
  // Cada uno deja el grafo en dos partes conexas, y quitar uno menos no lo parte.
  for (const corte of lista) {
    const resto = TALLER.aristas.filter((a) => !corte.aristas.includes(a));
    assert.equal(CC2.dominio.circuitos.conexo(TALLER.vertices, resto), false, corte.nombre);
    for (const devuelta of corte.aristas) {
      assert.equal(CC2.dominio.circuitos.conexo(TALLER.vertices, resto.concat(devuelta)), true, `${corte.nombre} sin ${devuelta.nombre}`);
    }
  }
  assert.deepEqual(lista[0].otro, ['e'], 'el primero aísla a e: {be, de}');
});

test('los circuitos fundamentales del taller: la cuerda y el camino del árbol', () => {
  const lista = circuitosFundamentales(TALLER, T);
  assert.deepEqual(lista.map((c) => c.cuerda.nombre), ['cd', 'de', 'cb', 'ad']);
  assert.deepEqual(filas(lista), ['11011000', '01100100', '10010010', '11000001']);
  // Y por vértices, la otra tabla del taller.
  assert.deepEqual(filas(lista, { porVertices: true }), ['11110', '01011', '11100', '11010']);
});

test('los cortes fundamentales del taller: la rama y las cuerdas que cruzan', () => {
  const lista = cortesFundamentales(TALLER, T);
  assert.deepEqual(lista.map((c) => c.rama.nombre), ['ab', 'bd', 'be', 'ac']);
  assert.deepEqual(filas(lista), ['10001011', '01001101', '00100100', '00011010']);
  assert.deepEqual([lista[0].lado, lista[0].otro], [['a', 'c'], ['b', 'd', 'e']]);
});

test('el documento de apoyo: con el árbol a, b, e, f del grafo verde, la definición y no las caras', () => {
  const VERDE = expansion.leerGrafo('1 2\n1 3\n2 3\n3 4\n2 4\n2 5\n4 5\n1 4').grafo;
  const arbol = VERDE.aristas.filter((a) => ['a', 'b', 'e', 'f'].includes(a.nombre));
  const fundamentales = circuitosFundamentales(VERDE, arbol);
  // El documento escribe {d, c, e} y {h, b, d}: caras del dibujo, con otra cuerda dentro.
  assert.deepEqual(fundamentales.map((c) => c.aristas.map((a) => a.nombre).join('')), ['abc', 'abde', 'efg', 'aeh']);
  const corteDeA = cortesFundamentales(VERDE, arbol)[0];
  // El documento escribe {a, b, h}, que es aislar el vértice 1.
  assert.deepEqual(corteDeA.aristas.map((a) => a.nombre), ['a', 'c', 'd', 'h']);
  assert.equal(circuitos(VERDE).lista.length, 12, 'el documento lista 9 de 12');
});

test('la traza: un paso por circuito o corte, cada uno señalado y con su fila', () => {
  const pasos = recorrer(TALLER, { metodo: 'kruskal', hallar: HALLAR.CIRCUITOS });
  assert.equal(pasos.length, 1 + 12);
  assert.equal(pasos[0].filasLlenas, 0);
  assert.equal(pasos[3].filasLlenas, 3);
  assert.deepEqual(Object.keys(pasos[3].marcas.marcadas), ['bd', 'be', 'de']);
  assert.match(pasos[12].mensaje, /12 circuitos por 8 aristas/);

  const fund = recorrer(TALLER, { metodo: 'kruskal', hallar: HALLAR.FUNDAMENTALES });
  assert.equal(fund.length, 1 + 4, 'el árbol en un paso, y uno por cuerda');
  assert.match(fund[0].mensaje, /Hay un circuito fundamental por cuerda: 4, la nulidad/);
  assert.equal(fund[1].marcas.marcadas.cd, 'evaluacion', 'la cuerda, en naranja');
  assert.ok(fund[1].porVertices, 'con la matriz por vértices');

  const cortesF = recorrer(TALLER, { metodo: 'kruskal', hallar: HALLAR.CORTES_FUNDAMENTALES });
  assert.equal(cortesF.length, 1 + 4, 'el árbol en un paso, y uno por rama');
  assert.match(cortesF[1].mensaje, /sin ella el árbol queda en \{a, c\} y \{b, d, e\}; entre las dos partes cruzan cd, cb y ad/);

  const centro = recorrer(TALLER, { metodo: 'kruskal', hallar: HALLAR.CENTRO });
  assert.deepEqual(centro.map((p) => p.fase), ['arbol', 'centro', 'centro', 'centro', 'centro']);
  const arbol = recorrer(TALLER, { metodo: 'kruskal', hallar: HALLAR.ARBOL });
  assert.ok(!arbol.some((p) => p.fase === 'centro'), 'el árbol ya no sigue con el centro');
});

test('con demasiados circuitos se avisa, en vez de mostrar cientos de pasos', () => {
  const lineas = [];
  for (let i = 1; i <= 7; i++) for (let j = i + 1; j <= 7; j++) lineas.push(`${i} ${j}`);
  const completo = expansion.leerGrafo(lineas.join('\n')).grafo;
  assert.equal(circuitos(completo).demasiados, true);
  assert.equal(cortes(completo).demasiados, true);
});
