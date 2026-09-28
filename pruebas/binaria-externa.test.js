const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const { buscarBinariaExterna } = CC2.algoritmos.binariaExterna;
const { buscarSecuencialExterna } = CC2.algoritmos.secuencialExterna;
const eliminacion = CC2.algoritmos.eliminacion;

// El archivo de la maqueta (2026-09-27): N = 23 → 5 bloques de 5, el último
// con 3, y lleno.
//
//   B1: 10 12 15 18 20   B2: 22 25 27 30 33   B3: 35 38 40 42 45
//   B4: 48 50 53 55 58   B5: 60 63 67
const LLENO = [10, 12, 15, 18, 20, 22, 25, 27, 30, 33, 35, 38, 40, 42, 45,
  48, 50, 53, 55, 58, 60, 63, 67];
// El de secuencial externa: doce claves, B1 y B2 enteros y dos en B3.
const A_MEDIAS = [1010, 1023, 1105, 1204, 1310, 2011, 2230, 3020, 3145, 3388, 4102, 4521];
const N = 23;

const buscar = (objetivo, claves = LLENO) => buscarBinariaExterna({ claves, n: N, objetivo });
const ultimo = (pasos) => pasos[pasos.length - 1];
const lineaDe = (paso, etiqueta) => paso.calculo.find((linea) => linea.etiqueta === etiqueta);

test('el recorrido de la maqueta: dos bloques leídos y la binaria dentro del que queda', () => {
  const pasos = buscar(50);
  assert.deepEqual(pasos.map((paso) => paso.casilla), [15, 20, 18, 16, 17]);

  // B3: 50 > 45, se descartan B1 a B3.
  assert.equal(pasos[0].bloque, 3);
  assert.equal(lineaDe(pasos[0], 'Medio').expresion, '⌊(1 + 5) / 2⌋ · acceso 1');
  assert.equal(lineaDe(pasos[0], 'Último registro').resultado, 'inicio = 4');
  assert.match(pasos[0].mensaje, /se descartan los bloques 1 a 3/);

  // B4: 50 < 58, B4 se queda en el rango.
  assert.equal(pasos[1].bloque, 4);
  assert.deepEqual(pasos[1].bloquesDescartados, [1, 2, 3]);
  assert.deepEqual(pasos[1].rangoBloques, { inicio: 4, fin: 5 });
  assert.equal(lineaDe(pasos[1], 'Último registro').resultado, 'fin = 4');
  assert.match(pasos[1].mensaje, /está en el bloque 4 o antes; se descarta el bloque 5/);

  // Dentro de B4: renglones 1…5 → medio 3; 1…2 → medio 1; 2…2 → medio 2.
  assert.deepEqual(pasos.slice(2).map((paso) => lineaDe(paso, 'Renglones').expresion), ['1 … 5', '1 … 2', '2 … 2']);
  assert.deepEqual(pasos[2].rangoRegistros, { inicio: 16, fin: 20 });
  assert.deepEqual(pasos[3].rangoRegistros, { inicio: 16, fin: 17 });
  assert.deepEqual(pasos[2].bloquesDescartados, [1, 2, 3, 5]);
  assert.equal(pasos[2].tituloCalculo, 'Dentro del bloque B4');

  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.mensaje, 'Clave encontrada en el bloque 4.');
  assert.equal(fin.comparaciones, 5);
  assert.equal(fin.accesos, 2);
});

// La lectura de la fase de bloques es el último registro, igual que en
// secuencial externa: si es la clave, no hace falta entrar al bloque.
test('si la clave es el último registro del medio, se encuentra sin entrar al bloque', () => {
  const pasos = buscar(45);
  assert.equal(pasos.length, 1);
  assert.equal(pasos[0].tipo, 'encontrada');
  assert.equal(pasos[0].bloque, 3);
  assert.equal(pasos[0].accesos, 1);
  assert.equal(pasos[0].comparaciones, 1);
});

test('el bloque que queda, si es el que se acaba de leer, no cuesta otro acceso', () => {
  const pasos = buscar(53);
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.accesos, 2);
  assert.equal(lineaDe(pasos[2], 'Bloque').expresion, 'ya leído');
});

// Buscando 22 se leen B3, B2 y B1, y el rango se cierra en B2. En memoria
// está B1: B2 hay que volver a leerlo (decisión del usuario, 2026-09-27).
test('el bloque que queda se relee si el último leído fue otro', () => {
  const pasos = buscar(22);
  assert.deepEqual(pasos.slice(0, 3).map((paso) => paso.bloque), [3, 2, 1]);
  const entrada = pasos[3];
  assert.equal(entrada.bloque, 2);
  assert.equal(lineaDe(entrada, 'Bloque').expresion, 'se relee · acceso 4');
  assert.match(entrada.mensaje, /hay que volver a leerlo: el último leído fue el 1/);

  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.bloque, 2);
  assert.equal(fin.accesos, 4);
});

test('el bloque que queda se lee si ninguna comparación lo había leído', () => {
  const pasos = buscar(67);
  const entrada = pasos.find((paso) => paso.bloque === 5);
  assert.equal(lineaDe(entrada, 'Bloque').expresion, 'se lee · acceso 3');
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.casilla, 23);
  assert.equal(fin.accesos, 3);
});

// Solo los bloques con claves entran en el rango. Con doce claves hay tres
// bloques con datos: el medio es ⌊(1 + 3) / 2⌋ = 2, no ⌊(1 + 5) / 2⌋ = 3.
test('el rango son los bloques con claves, no todos los del archivo', () => {
  const pasos = buscar(3020, A_MEDIAS);
  assert.equal(lineaDe(pasos[0], 'Rango').expresion, 'B1 … B3');
  assert.equal(pasos[0].bloque, 2);
  // Los dos bloques vacíos del final no se apagan: nunca estuvieron en juego.
  assert.ok(pasos.every((paso) => !(paso.bloquesDescartados || []).some((bloque) => bloque > 3)));
});

test('el último bloque con datos compara contra su último registro ocupado', () => {
  // 4521 es el registro 12, a medio llenar el bloque 3.
  const pasos = buscar(4521, A_MEDIAS);
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.casilla, 12);
  assert.equal(fin.accesos, 2);
  // Dentro de B3 solo hay dos renglones que partir.
  const primeraDentro = pasos.find((paso) => paso.rangoRegistros);
  assert.equal(lineaDe(primeraDentro, 'Renglones').expresion, '1 … 2');
});

test('una clave ausente se descarta en su bloque y no se leen otros', () => {
  const fin = ultimo(buscar(51));
  assert.equal(fin.tipo, 'no-encontrada');
  assert.equal(fin.bloque, 4);
  assert.equal(fin.accesos, 2);
  assert.match(fin.mensaje, /no puede estar en otro/);
});

test('una clave mayor que todo el archivo acaba en el último bloque con datos', () => {
  const fin = ultimo(buscar(9999, A_MEDIAS));
  assert.equal(fin.tipo, 'no-encontrada');
  assert.equal(fin.bloque, 3);
});

test('el archivo vacío no lee ningún bloque', () => {
  const fin = ultimo(buscar(10, []));
  assert.equal(fin.tipo, 'no-encontrada');
  assert.equal(fin.accesos, 0);
  assert.match(fin.mensaje, /vacío/);
});

test('con un solo bloque con datos, se lee y se busca dentro', () => {
  const pasos = buscar(15, [10, 12, 15]);
  assert.equal(lineaDe(pasos[0], 'Bloque').expresion, 'se lee · acceso 1');
  assert.equal(ultimo(pasos).tipo, 'encontrada');
  assert.equal(ultimo(pasos).accesos, 1);
});

// La lección del tema, frente a secuencial externa. Al principio del archivo
// secuencial gana —encuentra en B1 con un acceso—, pero en conjunto binaria
// lee bastantes menos bloques, y la diferencia crece con N.
test('en conjunto lee menos bloques que secuencial externa sobre el mismo archivo', () => {
  const n = 400;
  const claves = Array.from({ length: n }, (_, i) => 1000 + 2 * i);
  let binarios = 0;
  let secuenciales = 0;
  for (const objetivo of claves) {
    const binaria = ultimo(buscarBinariaExterna({ claves, n, objetivo }));
    assert.equal(binaria.tipo, 'encontrada', `encuentra ${objetivo}`);
    binarios += binaria.accesos;
    secuenciales += ultimo(buscarSecuencialExterna({ claves, n, objetivo })).accesos;
  }
  // 20 bloques: secuencial lee en promedio unos 10,5; binaria, unos 5.
  assert.ok(binarios * 2 < secuenciales, `binaria ${binarios}, secuencial ${secuenciales}`);
});

test('encuentra todas las claves del archivo lleno, cada una en su bloque', () => {
  LLENO.forEach((clave, i) => {
    const fin = ultimo(buscar(clave));
    assert.equal(fin.tipo, 'encontrada', `encuentra ${clave}`);
    assert.equal(fin.casilla, i + 1);
    assert.equal(fin.bloque, Math.floor(i / 5) + 1);
  });
});

test('eliminar localiza la clave con la binaria externa y la nombra por bloque', () => {
  const pasos = eliminacion.eliminarPorBusqueda({
    pasos: buscar(50),
    claves: LLENO,
    clave: 50,
    nombrar: (paso) => `el bloque ${paso.bloque}`
  });
  const marca = pasos[pasos.length - 2];
  assert.equal(marca.tipo, 'eliminacion');
  assert.equal(marca.casilla, 17);
  assert.equal(marca.mensaje, 'Clave 50 localizada en el bloque 4: se elimina.');
});
