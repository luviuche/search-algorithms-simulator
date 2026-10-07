const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const { calcularSegmentos, UMBRAL_HORIZONTAL } = CC2.vista.elision;

const indicesDe = (segmentos) => segmentos.filter((s) => s.tipo === 'casilla').map((s) => s.indice);
const tramosDe = (segmentos) => segmentos.filter((s) => s.tipo === 'tramo');

test('bajo el umbral dibuja la estructura completa', () => {
  const segmentos = calcularSegmentos({ n: UMBRAL_HORIZONTAL, relevantes: [3] });
  assert.equal(tramosDe(segmentos).length, 0);
  assert.equal(segmentos.length, UMBRAL_HORIZONTAL);
});

test('mantiene visibles la casilla 1, la n y las relevantes con sus vecinas', () => {
  const segmentos = calcularSegmentos({ n: 40, relevantes: [20] });
  assert.deepEqual(indicesDe(segmentos), [1, 19, 20, 21, 40]);
});

test('cada tramo declara cuántas casillas oculta', () => {
  const segmentos = calcularSegmentos({ n: 40, relevantes: [20] });
  const tramos = tramosDe(segmentos);
  assert.deepEqual(tramos.map((t) => t.cantidad), [17, 18]);
  assert.deepEqual(tramos.map((t) => [t.desde, t.hasta]), [[2, 18], [22, 39]]);
  const ocultas = tramos.reduce((suma, t) => suma + t.cantidad, 0);
  assert.equal(ocultas + indicesDe(segmentos).length, 40);
});

test('no comprime un tramo de una sola casilla: la dibuja', () => {
  // Relevantes 1, 4 y 8 sobre n = 16 dejan la casilla 6 sola entre visibles.
  const segmentos = calcularSegmentos({ n: 16, relevantes: [1, 4, 8] });
  assert.ok(indicesDe(segmentos).includes(6), 'la casilla 6 debería dibujarse, no elidirse');
  assert.ok(tramosDe(segmentos).every((t) => t.cantidad > 1));
});

test('sin vecinas sobreviven solo la 1, la n y las relevantes', () => {
  // Es lo que pide el docente para las tablas dispersas: la estructura se
  // dibuja con sus extremos y las claves colocadas, sin casillas vacías
  // intermedias que solo rotulan direcciones.
  const segmentos = calcularSegmentos({ n: 40, relevantes: [20], vecinas: false });
  assert.deepEqual(indicesDe(segmentos), [1, 20, 40]);
});

test('sin vecinas, una tabla dispersa dibuja una casilla por clave', () => {
  // Seis claves en una tabla de 100: ocho casillas y siete tramos, contra las
  // veinte casillas que salían cuando cada clave arrastraba sus dos vecinas.
  const ocupadas = [15, 21, 27, 34, 46, 56];
  const segmentos = calcularSegmentos({ n: 100, relevantes: ocupadas, vecinas: false });
  assert.deepEqual(indicesDe(segmentos), [1].concat(ocupadas, [100]));
  assert.equal(segmentos.length, 15);
  // La escala sigue completa: lo dibujado más lo elidido son las 100 casillas.
  const ocultas = tramosDe(segmentos).reduce((suma, t) => suma + t.cantidad, 0);
  assert.equal(ocultas + indicesDe(segmentos).length, 100);
});

test('el control de ver estructura completa desactiva la elisión', () => {
  const segmentos = calcularSegmentos({ n: 100, relevantes: [50], mostrarCompleta: true });
  assert.equal(tramosDe(segmentos).length, 0);
  assert.equal(segmentos.length, 100);
});

test('las tres casillas relevantes de binaria sobreviven a la elisión', () => {
  const segmentos = calcularSegmentos({ n: 60, relevantes: [10, 30, 50] });
  const visibles = indicesDe(segmentos);
  for (const relevante of [10, 30, 50]) {
    assert.ok(visibles.includes(relevante), `falta la casilla relevante ${relevante}`);
  }
});

test('con capacidad medida, dibuja entera la estructura que cabe aunque pase del umbral', () => {
  // Secuencial con n = 24 en una pantalla donde caben 26: el umbral fijo la
  // comprimía y escondía el recorrido casilla por casilla.
  const segmentos = calcularSegmentos({ n: 24, relevantes: [4], capacidad: 26 });
  assert.equal(tramosDe(segmentos).length, 0);
  assert.equal(segmentos.length, 24);
});

test('con capacidad medida, elide solo lo que no cabe', () => {
  // Caben nueve: se destapan casillas alrededor de la relevante hasta
  // llenarlas, en vez de quedarse en la 1, la n y las vecinas.
  const segmentos = calcularSegmentos({ n: 24, relevantes: [4], capacidad: 9 });
  assert.ok(segmentos.length <= 9);
  assert.deepEqual(indicesDe(segmentos), [1, 2, 3, 4, 5, 6, 7, 24]);
  const ocultas = tramosDe(segmentos).reduce((suma, t) => suma + t.cantidad, 0);
  assert.equal(ocultas + indicesDe(segmentos).length, 24);
});

test('con capacidad menor que el mínimo, conserva la 1, la n y las relevantes con sus vecinas', () => {
  const segmentos = calcularSegmentos({ n: 60, relevantes: [10, 30, 50], capacidad: 3 });
  assert.deepEqual(indicesDe(segmentos), [1, 9, 10, 11, 29, 30, 31, 49, 50, 51, 60]);
});
