const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const { limites, clave, estructura } = CC2.dominio;

test('rangoValido deriva el rango desde l', () => {
  assert.deepEqual(limites.rangoValido(4), { min: 1000, max: 9999 });
});

test('validarTamano rechaza n por encima del límite duro', () => {
  const resultado = limites.validarTamano(10001, 4);
  assert.equal(resultado.valido, false);
});

test('validarTamano rechaza n imposible para l = 2', () => {
  const resultado = limites.validarTamano(150, 2);
  assert.equal(resultado.valido, false);
  assert.match(resultado.mensaje, /90 claves distintas/);
});

test('validarTamano advierte por encima del umbral sin bloquear', () => {
  const resultado = limites.validarTamano(600, 4);
  assert.equal(resultado.valido, true);
  assert.ok(resultado.advertencia);
});

test('validarClaveNumerica rechaza ceros a la izquierda', () => {
  const resultado = clave.validarClaveNumerica('0521', 4);
  assert.equal(resultado.valido, false);
});

test('validarClaveNumerica acepta clave con l dígitos', () => {
  const resultado = clave.validarClaveNumerica('4096', 4);
  assert.equal(resultado.valido, true);
  assert.equal(resultado.valor, 4096);
});

test('validarClaveAlfabetica mapea CASA al ejemplo del spec', () => {
  const resultado = clave.validarClaveAlfabetica('CASA', 4);
  assert.equal(resultado.valido, true);
  assert.equal(resultado.claveTransformada, 3011901);
});

test('validarClaveAlfabetica rechaza la Ñ', () => {
  const resultado = clave.validarClaveAlfabetica('NIÑO', 4);
  assert.equal(resultado.valido, false);
});

test('estructura mantiene orden ascendente al insertar', () => {
  const { estructura: e } = estructura.crearEstructura({ n: 5, l: 4, tipoClave: 'numerica' });
  estructura.insertar(e, 5000);
  estructura.insertar(e, 1000);
  estructura.insertar(e, 3000);
  assert.deepEqual(e.claves, [1000, 3000, 5000]);
});

test('estructura rechaza duplicados', () => {
  const { estructura: e } = estructura.crearEstructura({ n: 5, l: 4, tipoClave: 'numerica' });
  estructura.insertar(e, 1000);
  const resultado = estructura.insertar(e, 1000);
  assert.equal(resultado.exito, false);
  assert.match(resultado.mensaje, /Clave duplicada/);
});

test('estructura rechaza inserción al llegar a n', () => {
  const { estructura: e } = estructura.crearEstructura({ n: 1, l: 4, tipoClave: 'numerica' });
  estructura.insertar(e, 1000);
  const resultado = estructura.insertar(e, 2000);
  assert.equal(resultado.exito, false);
  assert.match(resultado.mensaje, /saturada/);
});

test('insertar devuelve el índice en base 1', () => {
  const { estructura: e } = estructura.crearEstructura({ n: 5, l: 4, tipoClave: 'numerica' });
  const resultado = estructura.insertar(e, 1000);
  assert.equal(resultado.indice, 1);
});

// Las invariantes no dependen del formulario (CLAUDE.md 3.2): abrir un
// archivo, o cualquier otro camino, llega al dominio sin pasar por él.
test('validarTamano rechaza un n que no es un entero positivo', () => {
  for (const n of [0, -3, 2.5, NaN, undefined, '10']) {
    const resultado = limites.validarTamano(n, 4);
    assert.equal(resultado.valido, false, `n = ${String(n)}`);
    assert.match(resultado.mensaje, /Tamaño inválido/);
  }
});

test('validarTamano acota l entre 1 y L_MAXIMA, y la deja faltar', () => {
  assert.equal(limites.L_MAXIMA, 15);
  for (const l of [0, 16, 2.5, NaN, null, '4']) {
    const resultado = limites.validarTamano(10, l);
    assert.equal(resultado.valido, false, `l = ${String(l)}`);
    assert.match(resultado.mensaje, /Longitud de clave inválida/);
  }
  assert.equal(limites.validarTamano(10, 15).valido, true);
  // Sin `l` —cubetas— sigue valiendo: solo queda el límite duro.
  assert.equal(limites.validarTamano(10, undefined).valido, true);
});

test('crearEstructura no crea una estructura con n o l inválidos', () => {
  assert.equal(estructura.crearEstructura({ n: 0, l: 4, tipoClave: 'numerica' }).exito, false);
  assert.equal(estructura.crearEstructura({ n: 10, l: NaN, tipoClave: 'numerica' }).exito, false);
  assert.equal(estructura.crearEstructura({ n: 10, l: 16, tipoClave: 'numerica' }).exito, false);
  assert.equal(estructura.crearEstructura({ n: 10, l: 15, tipoClave: 'numerica' }).exito, true);
});

// Con 15 cifras la clave más grande (999 999 999 999 999) todavía es un entero
// seguro; con 17, dos claves distintas salían como el mismo número.
test('una clave numérica que no cabe en un entero seguro se rechaza, no se falsea', () => {
  assert.deepEqual(clave.validarClaveNumerica('999999999999999', 15), { valido: true, valor: 999999999999999 });
  const grande = clave.validarClaveNumerica('10000000000000001', 17);
  assert.equal(grande.valido, false);
  assert.match(grande.mensaje, /demasiado grande/);
});
