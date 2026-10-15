const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const { buscarSecuencialExterna } = CC2.algoritmos.secuencialExterna;
const eliminacion = CC2.algoritmos.eliminacion;
const estructuras = CC2.dominio.estructura;

// El archivo del ejemplo: N = 23 → 5 bloques de 5, el último con 3 posiciones.
// Doce claves ordenadas ocupan B1 y B2 enteros y dos registros de B3.
const CLAVES = [1010, 1023, 1105, 1204, 1310, 2011, 2230, 3020, 3145, 3388, 4102, 4521];
const N = 23;

const buscar = (objetivo, claves = CLAVES) => buscarSecuencialExterna({ claves, n: N, objetivo });
const ultimo = (pasos) => pasos[pasos.length - 1];

test('encuentra la clave y lo dice por bloque, no por registro', () => {
  const pasos = buscar(3020);
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.bloque, 2);
  assert.equal(fin.casilla, 8);
  assert.equal(fin.mensaje, 'Clave localizada en el bloque 2.');
});

// La lección del tema: leer un bloque cuesta, y por eso se lee uno por bloque
// descartado más el que la contiene, no un acceso por registro.
test('cuenta un acceso por bloque leído y no uno por registro', () => {
  const fin = ultimo(buscar(3020));
  assert.equal(fin.accesos, 2);
  // Cinco de B1..B2 (el último registro de cada uno) más tres dentro de B2.
  assert.equal(fin.comparaciones, 5);
});

test('descarta el bloque entero cuando la clave supera a su último registro', () => {
  const pasos = buscar(3020);
  const primero = pasos[0];
  assert.equal(primero.tipo, 'comparacion');
  assert.equal(primero.bloque, 1);
  // El registro comparado es el último del bloque 1, no el primero.
  assert.equal(primero.casilla, 5);
  assert.deepEqual(primero.bloquesDescartados, [1]);
  assert.match(primero.mensaje, /se descarta entero/);
});

test('el último bloque con datos compara contra su último registro ocupado', () => {
  // 4521 vive en el registro 12, a media llenar el bloque 3.
  const pasos = buscar(4521);
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.bloque, 3);
  assert.equal(fin.accesos, 3);
  const entradaAlBloque = pasos.find((paso) => paso.bloque === 3);
  assert.equal(entradaAlBloque.casilla, 12);
});

test('una clave ausente dentro del rango se corta en su bloque y no sigue leyendo', () => {
  const pasos = buscar(2100);
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'no-encontrada');
  assert.equal(fin.bloque, 2);
  assert.equal(fin.accesos, 2);
  assert.match(fin.mensaje, /no puede estar en otro/);
});

test('una clave mayor que todo el archivo agota los bloques con datos', () => {
  const fin = ultimo(buscar(9999));
  assert.equal(fin.tipo, 'no-encontrada');
  // Tres bloques tienen datos: no se leen los dos vacíos del final.
  assert.equal(fin.accesos, 3);
  assert.match(fin.mensaje, /supera al último registro del archivo/);
});

test('el archivo vacío no lee ningún bloque', () => {
  const fin = ultimo(buscar(1010, []));
  assert.equal(fin.tipo, 'no-encontrada');
  assert.equal(fin.accesos, 0);
  assert.match(fin.mensaje, /vacío/);
});

test('la clave de la primera posición se encuentra sin descartar nada', () => {
  const pasos = buscar(1010);
  const fin = ultimo(pasos);
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.bloque, 1);
  assert.equal(fin.accesos, 1);
  assert.deepEqual(fin.bloquesDescartados, []);
});

// Un barrido: toda clave del archivo se encuentra, y siempre en el bloque que
// de verdad la contiene según el reparto del dominio.
test('cada clave del archivo se encuentra en su bloque', () => {
  const externa = CC2.dominio.externa;
  const forma = externa.formaDelArchivo(N);
  for (let registro = 1; registro <= CLAVES.length; registro++) {
    const fin = ultimo(buscar(CLAVES[registro - 1]));
    assert.equal(fin.tipo, 'encontrada', `clave ${CLAVES[registro - 1]}`);
    assert.equal(fin.casilla, registro);
    assert.equal(fin.bloque, externa.bloqueDe(forma, registro));
  }
});

test('eliminar usa el recorrido del tema y nombra el bloque', () => {
  const { estructura } = estructuras.crearEstructura({ n: N, l: 4, tipoClave: 'numerica' });
  for (const clave of CLAVES) estructuras.insertar(estructura, clave);

  const pasos = eliminacion.eliminarPorBusqueda({
    pasos: buscarSecuencialExterna({ claves: estructura.claves, n: N, objetivo: 3020 }),
    claves: estructura.claves,
    clave: 3020,
    nombrar: (paso) => `el bloque ${paso.bloque}`
  });

  const eliminado = pasos.find((paso) => paso.tipo === 'eliminacion');
  assert.equal(eliminado.mensaje, 'Clave 3020 localizada en el bloque 2: se elimina.');
  // El bloque viaja hasta el final de la operación: sin él, el dibujo perdería
  // el bloque justo en el paso que mueve las claves.
  assert.equal(eliminado.bloque, 2);

  const desplazamiento = ultimo(pasos);
  assert.equal(desplazamiento.tipo, 'desplazamiento');
  assert.equal(desplazamiento.efecto.tipo, 'eliminar');
  assert.equal(desplazamiento.bloque, 2);
});

// Insertar no tiene traza propia: es el mismo arreglo ordenado y denso de
// secuencial, y el desbordamiento al bloque de al lado sale de que las claves
// se corren dentro del arreglo. Esta prueba fija esa equivalencia.
test('insertar en medio empuja la última clave del bloque al bloque siguiente', () => {
  const externa = CC2.dominio.externa;
  const forma = externa.formaDelArchivo(N);
  const { estructura } = estructuras.crearEstructura({ n: N, l: 4, tipoClave: 'numerica' });
  for (const clave of CLAVES) estructuras.insertar(estructura, clave);

  // 1310 cierra el bloque 1; 2011 abre el bloque 2.
  assert.equal(externa.bloqueDe(forma, estructura.claves.indexOf(1310) + 1), 1);
  assert.equal(externa.bloqueDe(forma, estructura.claves.indexOf(2011) + 1), 2);

  estructuras.insertar(estructura, 1100);

  // La clave entra en el bloque 1 y empuja a 1310 fuera de él.
  assert.equal(externa.bloqueDe(forma, estructura.claves.indexOf(1100) + 1), 1);
  assert.equal(externa.bloqueDe(forma, estructura.claves.indexOf(1310) + 1), 2);
  // Y el archivo sigue ordenado, que es lo que hace que comparar contra el
  // último registro de cada bloque signifique algo.
  const ordenado = estructura.claves.every((clave, i) => i === 0 || estructura.claves[i - 1] < clave);
  assert.ok(ordenado);
});
