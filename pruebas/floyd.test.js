const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const grafos = CC2.dominio.grafo;
const { recorrer } = CC2.algoritmos.floyd;
const I = Infinity;

// El ejemplo de la hoja de Floyd del docente (docs/Floyd/, tres fotos):
// dirigido, sin pesos, 1→2, 2→3, 3→1, 3→4. Todo lo que sigue está anclado a
// las matrices que él escribió a mano.
const HOJA = grafos.leerGrafo('1 2\n2 3\n3 1\n3 4', grafos.TIPOS.DIRIGIDO).grafo;

// La figura 12 del documento de apoyo (docs/Temas grafos apoyo 13-10-26.docx):
// no dirigido y ponderado. De ella salen las tablas de conceptos del docente.
const FIGURA_12 = grafos.leerGrafo('4 2 2\n4 3 8\n4 5 1\n2 3 10\n3 5 2\n3 1 4\n2 1 5', grafos.TIPOS.NO_DIRIGIDO).grafo;

const pasoDe = (pasos, j, i) => pasos.find((p) => p.fase === 'floyd' && p.j === j - 1 && p.i === i - 1);

test('la matriz inicial pone 0 en la diagonal, 1 en cada arista sin peso e ∞ en lo demás', () => {
  assert.deepEqual(grafos.matrizInicial(HOJA), [
    [0, 1, I, I],
    [I, 0, 1, I],
    [1, I, 0, 1],
    [I, I, I, 0]
  ]);
});

test('un paso por pareja (j, i), cada uno con sus n comparaciones', () => {
  const pasos = recorrer(HOJA);
  const deFloyd = pasos.filter((p) => p.j !== undefined);
  assert.equal(deFloyd.length, 16);
  assert.ok(deFloyd.every((p) => p.calculo.length === 4));
  assert.deepEqual(deFloyd.slice(0, 5).map((p) => [p.j + 1, p.i + 1]), [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1]]);
});

test('con j = 1 solo cambia D32: 1 + 1 < ∞, como en la hoja', () => {
  const pasos = recorrer(HOJA);
  const paso = pasoDe(pasos, 1, 3);
  assert.deepEqual(paso.calculo.map((l) => l.resultado), ['no', 'sí → 2', 'no', 'no']);
  assert.equal(paso.tituloCalculo, 'j = 1 · i = 3 · D₃₁ + D₁ₖ < D₃ₖ');
  assert.equal(paso.calculo[1].expresion, 'D₃₂   1 + 1 < ∞');
  assert.deepEqual(paso.cambiadas, [{ fila: 2, columna: 1, antes: I }]);
  // La matriz al terminar j = 1, la que la hoja copia como «inicial para j = 2».
  assert.deepEqual(pasoDe(pasos, 1, 4).matriz, [
    [0, 1, I, I],
    [I, 0, 1, I],
    [1, 2, 0, 1],
    [I, I, I, 0]
  ]);
});

test('con j = 2 cambia D13: 1 + 1 < ∞, y las filas 2, 3 y 4 no cambian', () => {
  const pasos = recorrer(HOJA);
  assert.deepEqual(pasoDe(pasos, 2, 1).calculo.map((l) => l.resultado), ['no', 'no', 'sí → 2', 'no']);
  for (const i of [2, 3, 4]) assert.deepEqual(pasoDe(pasos, 2, i).cambiadas, [], `fila ${i}`);
  assert.deepEqual(pasoDe(pasos, 2, 4).matriz, [
    [0, 1, 2, I],
    [I, 0, 1, I],
    [1, 2, 0, 1],
    [I, I, I, 0]
  ]);
});

test('la matriz final de la hoja tiene las distancias mínimas, y sin conceptos: desde 4 no se llega a nadie', () => {
  const pasos = recorrer(HOJA);
  const ultimo = pasos[pasos.length - 1];
  assert.deepEqual(ultimo.matriz, [
    [0, 1, 2, 3],
    [2, 0, 1, 2],
    [1, 2, 0, 1],
    [I, I, I, 0]
  ]);
  assert.equal(ultimo.conceptos, null);
  assert.match(ultimo.mensaje, /∞/);
  assert.equal(ultimo.comparaciones, 64);
});

test('la figura 12 da las distancias y excentricidades de las tablas del docente', () => {
  const pasos = recorrer(FIGURA_12);
  const final = pasos[pasos.length - 1];
  assert.deepEqual(final.matriz, [
    [0, 5, 4, 7, 6],
    [5, 0, 5, 2, 3],
    [4, 5, 0, 3, 2],
    [7, 2, 3, 0, 1],
    [6, 3, 2, 1, 0]
  ]);
  const c = final.conceptos;
  assert.deepEqual(c.distancias, [22, 15, 14, 13, 12]);
  assert.deepEqual(c.excentricidades, [7, 5, 5, 7, 6]);
  assert.equal(c.radio, 5);
  assert.equal(c.diametro, 7);
  assert.deepEqual(c.parDiametro, [1, 4]);
  assert.deepEqual(c.centro, [2, 3]);
  assert.deepEqual(c.mediana, [5]);
  assert.deepEqual(grafos.aristasInducidas(FIGURA_12, c.centro), [{ origen: 2, destino: 3, peso: 10 }]);
});

test('los conceptos van uno por paso, y el último deja el resumen', () => {
  const pasos = recorrer(FIGURA_12).filter((p) => p.fase === 'conceptos');
  assert.deepEqual(pasos.map((p) => p.conceptos.mostrar[p.conceptos.mostrar.length - 1]),
    ['distancia', 'excentricidad', 'radio', 'diametro', 'centro', 'mediana']);
  assert.deepEqual(pasos.map((p) => p.calculo.length), [1, 2, 3, 4, 5, 6]);
  const ultimo = pasos[pasos.length - 1];
  assert.equal(ultimo.tipo, 'construido');
  assert.match(ultimo.mensaje, /Radio 5, diámetro 7, centro \{2, 3\} y mediana \{5\}/);
});

test('leer el grafo: el peso es opcional, y los errores dicen en qué renglón', () => {
  const sinPeso = grafos.leerGrafo('1 2\n2-3\n3 -> 1', grafos.TIPOS.DIRIGIDO);
  assert.equal(sinPeso.valido, true);
  assert.deepEqual(sinPeso.grafo.vertices, [1, 2, 3]);
  assert.equal(sinPeso.grafo.conPesos, false);
  assert.ok(sinPeso.grafo.aristas.every((a) => a.peso === 1));

  assert.match(grafos.leerGrafo('1 2\n2 2', 'dirigido').mensaje, /Renglón 2.*lazo/);
  assert.match(grafos.leerGrafo('1 2 x', 'dirigido').mensaje, /Renglón 1.*peso/);
  assert.match(grafos.leerGrafo('', 'dirigido').mensaje, /al menos una arista/);
  // En un no dirigido 2 1 es la misma arista que 1 2; en un dirigido, no.
  assert.match(grafos.leerGrafo('1 2\n2 1', 'no-dirigido').mensaje, /Renglón 2.*ya está en el renglón 1/);
  assert.equal(grafos.leerGrafo('1 2\n2 1', 'dirigido').valido, true);
  const nueve = Array.from({ length: 8 }, (_, i) => `${i + 1} ${i + 2}`).join('\n');
  assert.match(grafos.leerGrafo(nueve, 'dirigido').mensaje, /9 vértices/);
});

test('el texto del grafo vuelve tal como se lee', () => {
  assert.equal(grafos.comoTexto(FIGURA_12), '4 2 2\n4 3 8\n4 5 1\n2 3 10\n3 5 2\n3 1 4\n2 1 5');
  assert.equal(grafos.comoTexto(HOJA), '1 2\n2 3\n3 1\n3 4');
  const conAislado = grafos.leerGrafo('1 2\n3', 'dirigido').grafo;
  assert.deepEqual(conAislado.vertices, [1, 2, 3]);
  assert.equal(grafos.comoTexto(conAislado), '1 2\n3');
});
