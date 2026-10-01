const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

// Prueba cuadrática y doble función hash (CLAUDE.md 5.4), confirmadas por el
// docente el 2026-09-23. Todas con la función módulo, H(k) = (k mod n) + 1, y
// con claves que caen en la misma dirección para que haya con qué chocar.

const { direccionModulo } = CC2.algoritmos.hash.modulo;
const { TRATAMIENTOS, insertar, buscar, eliminar } = CC2.algoritmos.hash.operaciones;
const estructuras = CC2.dominio.estructura;

const APLICADORES = {
  colocar: (estructura, efecto) => estructuras.colocarEn(estructura, efecto.casilla, efecto.clave),
  retirar: (estructura, efecto) => estructuras.retirarDe(estructura, efecto.casilla)
};

function aplicar(estructura, pasos) {
  for (const paso of pasos) {
    if (paso.efecto) APLICADORES[paso.efecto.tipo](estructura, paso.efecto);
  }
  return pasos;
}

function nueva(n, tratamiento) {
  const { estructura } = estructuras.crearEstructura({
    n, l: 4, tipoClave: 'numerica', modo: estructuras.MODOS.DISPERSA, tratamiento
  });
  return estructura;
}

const argumentos = (estructura) => ({
  claves: estructura.claves,
  n: estructura.n,
  direccionDe: direccionModulo,
  tratamiento: estructura.tratamiento,
  ordenLlegada: estructura.ordenLlegada
});

const insertarEn = (estructura, clave) => aplicar(estructura, insertar({ ...argumentos(estructura), clave }));
const eliminarEn = (estructura, clave) => aplicar(estructura, eliminar({ ...argumentos(estructura), clave }));
const buscarEn = (estructura, objetivo) => buscar({ ...argumentos(estructura), objetivo });

const ultimo = (pasos) => pasos[pasos.length - 1];
const sondeadas = (pasos) => pasos.filter((paso) => paso.tipo === 'sondeo').map((paso) => paso.casilla);
const ocupadas = (estructura) => estructura.claves
  .map((clave, i) => (clave === undefined ? null : `${i + 1}:${clave}`))
  .filter(Boolean)
  .join(' ');

// ── Prueba cuadrática ────────────────────────────────────────────────────

test('un solo sondeo se cuenta en singular', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  insertarEn(estructura, 25);
  const uno = insertarEn(estructura, 35);
  const dos = insertarEn(estructura, 45);

  assert.match(ultimo(uno).mensaje, /tras 1 sondeo\.$/);
  assert.match(ultimo(dos).mensaje, /tras 2 sondeos\.$/);
});


test('la prueba cuadrática salta a D + 1², D + 2², D + 3²…', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  insertarEn(estructura, 25);
  insertarEn(estructura, 35);
  const pasos = insertarEn(estructura, 45);

  // 45 cae en la 6; la 7 (6 + 1²) está ocupada y la 10 (6 + 2²) libre.
  assert.deepEqual(sondeadas(pasos), [7]);
  assert.equal(ultimo(pasos).tipo, 'insercion');
  assert.equal(ultimo(pasos).casilla, 10);
  assert.match(ultimo(pasos).mensaje, /6 \+ 2²/);
  assert.equal(ocupadas(estructura), '6:25 7:35 10:45');
});

test('lo que se pasa de n da la vuelta con módulo, no se reinicia en 1', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  for (const clave of [25, 35, 45]) insertarEn(estructura, clave);
  const pasos = insertarEn(estructura, 55);

  // 6 + 3² = 15 → casilla 5. Reiniciando habría caído en la 1.
  assert.deepEqual(sondeadas(pasos), [7, 10]);
  assert.equal(ultimo(pasos).casilla, 5);
});

test('la cuadrática puede no entrar aunque queden casillas libres', () => {
  // Desde la 1, con n = 10, i² mod 10 solo da 1, 4, 9, 6 y 5: alcanza las
  // casillas 2, 5, 10, 7 y 6, y nunca la 3, 4, 8 ni 9.
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  for (const [casilla, clave] of [[1, 10], [2, 11], [5, 14], [10, 19], [7, 16], [6, 15]]) {
    estructuras.colocarEn(estructura, casilla, clave);
  }
  const pasos = insertarEn(estructura, 20);

  assert.deepEqual(sondeadas(pasos), [2, 5, 10, 7, 6]);
  assert.equal(ultimo(pasos).tipo, 'rechazada');
  assert.match(ultimo(pasos).mensaje, /Quedan 4 casillas libres/);
  assert.equal(estructuras.cantidadClaves(estructura), 6);
});

test('con la tabla llena la cuadrática dice saturada, no que entró en ciclo', () => {
  const estructura = nueva(3, TRATAMIENTOS.CUADRATICA);
  for (const clave of [100, 101, 102]) insertarEn(estructura, clave);
  assert.equal(ultimo(insertarEn(estructura, 103)).tipo, 'saturada');
});

test('la búsqueda cuadrática repite el recorrido de la inserción', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  for (const clave of [25, 35, 45, 55]) insertarEn(estructura, clave);

  const pasos = buscarEn(estructura, 55);
  assert.deepEqual(pasos.filter((p) => p.tipo === 'comparacion').map((p) => p.casilla), [6, 7, 10]);
  assert.equal(ultimo(pasos).tipo, 'encontrada');
  assert.equal(ultimo(pasos).casilla, 5);

  // 65 recorre 6, 7, 10, 5 y halla vacía la 2 (6 + 4² = 22).
  const ausente = buscarEn(estructura, 65);
  assert.equal(ultimo(ausente).tipo, 'no-encontrada');
  assert.equal(ultimo(ausente).casilla, 2);
});

// ── Doble función hash ───────────────────────────────────────────────────

test('la doble función hash aplica H\'(D) = (D + 1) mod n + 1 a la dirección anterior', () => {
  const estructura = nueva(10, TRATAMIENTOS.DOBLE_HASH);
  for (const clave of [25, 35, 45]) insertarEn(estructura, clave);
  const pasos = insertarEn(estructura, 55);

  // De a dos casillas: 6 → 8 → 10 → 2.
  assert.deepEqual(sondeadas(pasos), [8, 10]);
  assert.equal(ultimo(pasos).casilla, 2);
  assert.match(ultimo(pasos).mensaje, /H'\(10\) = \(10 \+ 1\) mod 10 \+ 1/);
  assert.equal(ocupadas(estructura), '2:55 6:25 8:35 10:45');
});

test('con n par la doble función hash entra en ciclo por las de su paridad', () => {
  const estructura = nueva(10, TRATAMIENTOS.DOBLE_HASH);
  for (const clave of [25, 35, 45, 55, 65]) insertarEn(estructura, clave);
  const pasos = insertarEn(estructura, 75);

  // Las cinco pares están llenas; de la 4 volvería a la 6 y ahí se corta.
  assert.deepEqual(sondeadas(pasos), [8, 10, 2, 4]);
  assert.equal(ultimo(pasos).tipo, 'rechazada');
  assert.match(ultimo(pasos).mensaje, /Quedan 5 casillas libres/);

  const ausente = buscarEn(estructura, 75);
  assert.equal(ultimo(ausente).tipo, 'no-encontrada');
});

test('con n impar la doble función hash sí recorre toda la tabla', () => {
  const estructura = nueva(5, TRATAMIENTOS.DOBLE_HASH);
  for (const clave of [10, 15, 20, 25]) insertarEn(estructura, clave);
  const pasos = insertarEn(estructura, 30);

  // 1 → 3 → 5 → 2 → 4.
  assert.deepEqual(sondeadas(pasos), [3, 5, 2]);
  assert.equal(ultimo(pasos).casilla, 4);
});

// ── Eliminación: todas las claves que llegaron por colisión se reorganizan ─

test('al eliminar, las desplazadas se levantan todas y se recolocan en su orden de llegada', () => {
  const estructura = nueva(10, TRATAMIENTOS.DOBLE_HASH);
  for (const clave of [25, 35, 45, 55, 13]) insertarEn(estructura, clave);
  assert.equal(ocupadas(estructura), '2:55 4:13 6:25 8:35 10:45');

  const pasos = eliminarEn(estructura, 35);

  // 45 y 55 no están en su dirección; 25 y 13 sí, y no se tocan.
  const levantadas = pasos.filter((p) => p.tipo === 'extraccion').map((p) => p.clave);
  assert.deepEqual(levantadas, [45, 55]);
  // Primero se levantan las dos, después se recolocan.
  const primeraRecolocacion = pasos.findIndex((p, i) => i > pasos.findIndex((q) => q.tipo === 'extraccion') && p.tipo === 'calculo');
  assert.ok(pasos.slice(primeraRecolocacion).every((p) => p.tipo !== 'extraccion'));

  assert.equal(ocupadas(estructura), '4:13 6:25 8:45 10:55');
  for (const clave of [25, 45, 55, 13]) {
    assert.equal(ultimo(buscarEn(estructura, clave)).tipo, 'encontrada', `${clave} sigue alcanzable`);
  }
});

test('la cuadrática también reorganiza las desplazadas al eliminar', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  for (const clave of [25, 35, 45, 55]) insertarEn(estructura, clave);
  assert.equal(ocupadas(estructura), '5:55 6:25 7:35 10:45');

  eliminarEn(estructura, 25);

  // 35 recupera la 6, 45 sube a la 7 (6 + 1²) y 55 a la 10 (6 + 2²).
  assert.equal(ocupadas(estructura), '6:35 7:45 10:55');
  for (const clave of [35, 45, 55]) {
    assert.equal(ultimo(buscarEn(estructura, clave)).tipo, 'encontrada', `${clave} sigue alcanzable`);
  }
});

test('eliminar una clave sin colisiones en la tabla no levanta ninguna', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  for (const clave of [25, 13]) insertarEn(estructura, clave);
  const pasos = eliminarEn(estructura, 25);

  assert.equal(pasos.filter((p) => p.tipo === 'extraccion').length, 0);
  assert.equal(ocupadas(estructura), '4:13');
});

// ── Los saltos en el panel del cálculo ───────────────────────────────────

const renglones = (paso) => paso.saltos.lineas.map((l) => [l.etiqueta, l.expresion, l.resultado, l.nota]);

test('cada paso del sondeo lleva los saltos revelados hasta él', () => {
  const estructura = nueva(12, TRATAMIENTOS.CUADRATICA);
  for (const clave of [1004, 1016]) insertarEn(estructura, clave);
  const pasos = insertar({ ...argumentos(estructura), clave: 1028 });

  const colision = pasos.find((p) => p.tipo === 'colision');
  assert.equal(colision.saltos.titulo, 'Prueba cuadrática · la 9 está ocupada');
  assert.deepEqual(colision.saltos.lineas, []);

  assert.deepEqual(renglones(pasos.find((p) => p.tipo === 'sondeo')), [
    ['i = 1', '9 + 1²', '10', 'ocupada por 1016']
  ]);
  // Lo que se pasa de n sigue contando y se le resta la vuelta.
  assert.deepEqual(renglones(ultimo(pasos)), [
    ['i = 1', '9 + 1²', '10', 'ocupada por 1016'],
    ['i = 2', '9 + 2² = 13 − 12', '1', null]
  ]);
});

test('la doble función hash nombra cada salto D\', D\'\'…', () => {
  const estructura = nueva(12, TRATAMIENTOS.DOBLE_HASH);
  for (const clave of [1004, 1016]) insertarEn(estructura, clave);
  const pasos = insertar({ ...argumentos(estructura), clave: 1028 });

  assert.deepEqual(renglones(ultimo(pasos)), [
    ["D' = H'(9)", '(9 + 1) mod 12 + 1', '11', 'ocupada por 1016'],
    ["D'' = H'(11)", '(11 + 1) mod 12 + 1', '1', null]
  ]);
});

test('la lineal también muestra sus saltos, con la vuelta', () => {
  const estructura = nueva(5, TRATAMIENTOS.REASIGNACION);
  for (const clave of [1004, 1000]) insertarEn(estructura, clave);
  const pasos = insertarEn(estructura, 1009);

  assert.equal(ultimo(pasos).saltos.titulo, 'Prueba lineal · la 5 está ocupada');
  assert.deepEqual(renglones(ultimo(pasos)), [
    ['i = 1', '5 + 1 = 6 − 5', '1', 'ocupada por 1000'],
    ['i = 2', '5 + 2 = 7 − 5', '2', null]
  ]);
});

test('la búsqueda anota qué contenía cada casilla y dónde terminó', () => {
  const estructura = nueva(10, TRATAMIENTOS.CUADRATICA);
  for (const clave of [25, 35, 45, 55]) insertarEn(estructura, clave);

  const hallada = buscarEn(estructura, 55);
  assert.equal(ultimo(hallada).saltos.titulo, 'Prueba cuadrática · 55 no está en la 6');
  assert.deepEqual(ultimo(hallada).saltos.lineas.map((l) => l.nota), ['contiene 35', 'contiene 45', null]);

  const ausente = buscarEn(estructura, 65);
  assert.equal(ultimo(ausente).saltos.lineas.at(-1).nota, 'vacía');
});

test('sin reasignación no hay sección de saltos', () => {
  const estructura = nueva(10, TRATAMIENTOS.NINGUNO);
  insertarEn(estructura, 25);
  const pasos = insertarEn(estructura, 35);
  assert.ok(pasos.every((p) => p.saltos === undefined));
});
