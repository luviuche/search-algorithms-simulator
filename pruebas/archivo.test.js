const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const archivo = CC2.persistencia.archivo;
const estructuras = CC2.dominio.estructura;
const hash = CC2.algoritmos.hash.operaciones;

function crearOrdenada({ n, l }) {
  const { estructura } = estructuras.crearEstructura({ n, l, tipoClave: 'numerica' });
  return estructura;
}

test('el archivo guarda las claves en su orden de llegada, no como quedaron en la tabla', () => {
  const estructura = crearOrdenada({ n: 10, l: 2 });
  for (const clave of [50, 10, 30]) estructuras.insertar(estructura, clave);

  // La tabla está ordenada; el orden de llegada no.
  assert.deepEqual(estructura.claves, [10, 30, 50]);
  const datos = archivo.serializar({ tema: 'secuencial', estructura });
  assert.deepEqual(datos.claves, [50, 10, 30]);
  assert.equal(datos.n, 10);
  assert.equal(datos.l, 2);
  assert.equal(datos.version, archivo.VERSION);
});

test('eliminar una clave la saca también del orden de llegada', () => {
  const estructura = crearOrdenada({ n: 10, l: 2 });
  for (const clave of [50, 10, 30]) estructuras.insertar(estructura, clave);
  estructuras.eliminar(estructura, 10);
  assert.deepEqual(archivo.serializar({ tema: 'secuencial', estructura }).claves, [50, 30]);
});

// Lo que hace que guardar el orden valga la pena: en una tabla con colisiones,
// reinsertar en otro orden da otra tabla. Si el archivo guardara las claves
// como quedaron colocadas, abrirlo no devolvería la misma estructura.
test('en una tabla con colisiones, el orden de llegada es lo que reproduce la tabla', () => {
  const claves = [1004, 1016, 1028];
  const construir = (orden) => {
    const { estructura } = estructuras.crearEstructura({
      n: 12, l: 4, tipoClave: 'numerica', modo: estructuras.MODOS.DISPERSA,
      tratamiento: hash.TRATAMIENTOS.REASIGNACION
    });
    for (const clave of orden) {
      const pasos = hash.insertar({
        claves: estructura.claves, n: estructura.n, clave,
        direccionDe: CC2.algoritmos.hash.modulo.direccionModulo,
        tratamiento: estructura.tratamiento,
        anidados: estructura.anidados, tamanoAnidado: estructura.tamanoAnidado
      });
      for (const paso of pasos) {
        if (paso.efecto && paso.efecto.tipo === 'colocar') {
          estructuras.colocarEn(estructura, paso.efecto.casilla, paso.efecto.clave);
        }
      }
    }
    return estructura.claves.map((c, i) => (c === undefined ? '' : `${i + 1}:${c}`)).filter(Boolean).join(' ');
  };

  const enOrden = construir(claves);
  const alReves = construir(claves.slice().reverse());
  assert.notEqual(enOrden, alReves, 'dos órdenes distintos tendrían que dar tablas distintas');

  // Y reinsertar en el orden guardado devuelve exactamente la misma tabla.
  assert.equal(construir(claves), enOrden);
});

test('el nombre sugerido dice de qué es el archivo sin abrirlo', () => {
  const estructura = crearOrdenada({ n: 24, l: 2 });
  assert.equal(
    archivo.nombreSugerido({ tema: 'secuencial', estructura }),
    'secuencial-n24-l2.cc2'
  );
});

test('validar acepta un archivo íntegro', () => {
  const estructura = crearOrdenada({ n: 10, l: 2 });
  estructuras.insertar(estructura, 42);
  assert.equal(archivo.validar(archivo.serializar({ tema: 'binaria', estructura })).valido, true);
});

// Lo que el usuario pedía desde el principio: una estructura hecha en
// secuencial se abre en binaria, y sale idéntica porque las dos colocan igual.
test('un archivo de secuencial se abre en binaria y sale igual', () => {
  const estructura = crearOrdenada({ n: 10, l: 2 });
  for (const clave of [50, 10, 30]) estructuras.insertar(estructura, clave);
  const datos = archivo.serializar({ tema: 'secuencial', estructura });
  const cruce = archivo.compatibilidad(datos, {
    tema: 'binaria', modo: 'ordenada', tipoClave: 'numerica'
  });
  assert.deepEqual(cruce, { abre: true, recoloca: false });
});

test('el mismo archivo se abre en un tema hash, avisando de que se recoloca', () => {
  const estructura = crearOrdenada({ n: 12, l: 4 });
  estructuras.insertar(estructura, 1024);
  const datos = archivo.serializar({ tema: 'secuencial', estructura });
  const cruce = archivo.compatibilidad(datos, {
    tema: 'hash-modulo', modo: 'dispersa', tipoClave: 'numerica'
  });
  assert.equal(cruce.abre, true);
  assert.equal(cruce.recoloca, true);
});

test('un archivo de números no se abre en un tema de letras', () => {
  const estructura = crearOrdenada({ n: 10, l: 2 });
  const datos = archivo.serializar({ tema: 'secuencial', estructura });
  const cruce = archivo.compatibilidad(datos, {
    tema: 'residuos', modo: 'arbol', tipoClave: 'alfabetica'
  });
  assert.equal(cruce.abre, false);
  assert.match(cruce.mensaje, /números.*letras/);
});

// Índices (CLAUDE.md 5.10) guarda una estructura que sale de parámetros y no
// de claves. Se guarda y se vuelve a abrir como cualquier otra —era lo que el
// usuario quería (2026-09-17)— pero no cruza de tema: sus parámetros no
// significan nada fuera de él, y no trae claves que ver con otras reglas.
test('un archivo sin claves se abre en su propio tema', () => {
  const estructura = crearOrdenada({ n: 1, l: 1 });
  estructura.parametros = { r: 500000, B: 4096, R: 120, Ri: 15, tipo: 'primario', niveles: 'un-nivel' };
  const datos = archivo.serializar({ tema: 'indices', estructura, sinClaves: true });
  assert.equal(datos.sinClaves, true);
  assert.deepEqual(datos.parametros.tipo, 'primario');
  assert.equal(archivo.validar(datos).valido, true, 'sin claves sigue siendo un archivo íntegro');

  const cruce = archivo.compatibilidad(datos, {
    tema: 'indices', modo: 'ordenada', tipoClave: 'numerica', sinClaves: true
  });
  assert.deepEqual(cruce, { abre: true, recoloca: false });
});

test('un archivo sin claves no cruza de tema, ni en una dirección ni en la otra', () => {
  const sinClaves = crearOrdenada({ n: 1, l: 1 });
  sinClaves.parametros = { r: 500000 };
  const deIndices = archivo.serializar({ tema: 'indices', estructura: sinClaves, sinClaves: true });
  const haciaSecuencial = archivo.compatibilidad(deIndices, {
    tema: 'secuencial', modo: 'ordenada', tipoClave: 'numerica'
  });
  assert.equal(haciaSecuencial.abre, false);
  assert.match(haciaSecuencial.mensaje, /parámetros y no de claves/);

  const conClaves = crearOrdenada({ n: 10, l: 2 });
  estructuras.insertar(conClaves, 42);
  const deSecuencial = archivo.serializar({ tema: 'secuencial', estructura: conClaves });
  const haciaIndices = archivo.compatibilidad(deSecuencial, {
    tema: 'indices', modo: 'ordenada', tipoClave: 'numerica', sinClaves: true
  });
  assert.equal(haciaIndices.abre, false);
  assert.match(haciaIndices.mensaje, /Este tema/);
});

test('el archivo de un tema sin claves se nombra por lo que lo distingue', () => {
  const estructura = crearOrdenada({ n: 1, l: 1 });
  assert.equal(
    archivo.nombreSugerido({ tema: 'indices', estructura, detalle: 'r500000-B4096-primario' }),
    'indices-r500000-B4096-primario.cc2',
    'y no «indices-n1-l1», que no dice nada'
  );
});

test('validar rechaza versiones que no sabe leer', () => {
  const resultado = archivo.validar({ version: 99, tema: 'secuencial', n: 4, claves: [] });
  assert.equal(resultado.valido, false);
  assert.match(resultado.mensaje, /Versión no reconocida/);
});

// `n` es cuántas casillas tiene la tabla, no cuántas claves caben: con
// encadenamiento la cadena no tiene tope, y una tabla así se tiene que poder
// guardar y volver a abrir. Si caben o no lo decide el tema que abre.
test('validar acepta más claves que n: una tabla encadenada guarda más claves que direcciones', () => {
  const { estructura } = estructuras.crearEstructura({
    n: 3, l: 4, tipoClave: 'numerica', modo: estructuras.MODOS.DISPERSA,
    tratamiento: hash.TRATAMIENTOS.ENCADENAMIENTO
  });
  estructura.tamanoAnidado = Infinity;
  const direccionDe = CC2.algoritmos.hash.modulo.direccionModulo;
  for (const clave of [1000, 1003, 1006, 1009, 1001]) {
    const pasos = hash.insertar({
      claves: estructura.claves, n: estructura.n, clave, direccionDe, parametros: {},
      tratamiento: estructura.tratamiento, anidados: estructura.anidados,
      tamanoAnidado: estructura.tamanoAnidado, ordenLlegada: estructura.ordenLlegada
    });
    for (const paso of pasos) {
      if (!paso.efecto) continue;
      if (paso.efecto.posicion === undefined) estructuras.colocarEn(estructura, paso.efecto.casilla, paso.efecto.clave);
      else estructuras.colocarEnAnidado(estructura, paso.efecto.casilla, paso.efecto.posicion, paso.efecto.clave);
    }
  }
  assert.equal(estructuras.cantidadClaves(estructura), 5);
  const datos = JSON.parse(archivo.comoTexto(archivo.serializar({ tema: 'hash-modulo', estructura })));
  assert.equal(datos.claves.length, 5);
  assert.equal(archivo.validar(datos).valido, true);
});

test('validar rechaza una clave que no es un número ni una letra', () => {
  const resultado = archivo.validar({ version: 1, tema: 'secuencial', n: 4, l: 4, claves: [1000, {}, 2000] });
  assert.equal(resultado.valido, false);
  assert.match(resultado.mensaje, /clave 2 de la lista/);
  assert.equal(archivo.validar({ version: 1, n: 4, l: 4, claves: [[1000]] }).valido, false);
});

test('validar rechaza una longitud de clave que no es un entero positivo', () => {
  for (const l of [0, -2, 2.5, '4']) {
    const resultado = archivo.validar({ version: 1, tema: 'secuencial', n: 4, l, claves: [] });
    assert.equal(resultado.valido, false, `l = ${JSON.stringify(l)}`);
    assert.match(resultado.mensaje, /longitud de clave/);
  }
  // Sin `l` sí se abre: cubetas no la pide.
  assert.equal(archivo.validar({ version: 1, tema: 'cubetas', n: 4, claves: [5, 123] }).valido, true);
});

test('nInicial devuelve el n de partida guardado, y si no cuadra, el n del archivo', () => {
  assert.equal(archivo.nInicial({ n: 4, parametros: { n0: 2 } }), 2);
  assert.equal(archivo.nInicial({ n: 4, parametros: {} }), 4);
  assert.equal(archivo.nInicial({ n: 4 }), 4);
  assert.equal(archivo.nInicial({ n: 4, parametros: { n0: 9 } }), 4);
  assert.equal(archivo.nInicial({ n: 4, parametros: { n0: 0 } }), 4);
  assert.equal(archivo.nInicial({ n: 4, parametros: { n0: '2' } }), 4);
});

// Una estructura a medio llenar se guarda como está: el archivo devuelve lo
// que había, completo o no.
test('una estructura a medio llenar se guarda y se valida igual', () => {
  const estructura = crearOrdenada({ n: 24, l: 2 });
  for (const clave of [10, 20]) estructuras.insertar(estructura, clave);
  const datos = archivo.serializar({ tema: 'secuencial', estructura });
  assert.equal(datos.claves.length, 2);
  assert.equal(datos.n, 24);
  assert.equal(archivo.validar(datos).valido, true);
});

test('lo que se escribe es JSON legible', () => {
  const estructura = crearOrdenada({ n: 4, l: 2 });
  estructuras.insertar(estructura, 11);
  const texto = archivo.comoTexto(archivo.serializar({ tema: 'secuencial', estructura }));
  assert.deepEqual(JSON.parse(texto).claves, [11]);
  assert.ok(texto.includes('\n'), 'se guarda con saltos de línea, para poder leerlo a ojo');
});

// Al abrir en su propio tema, los parámetros guardados se reescriben como se
// digitan y pasan por los validadores del formulario (CLAUDE.md 10).
test('parametrosComoTexto escribe cada parámetro declarado como se digita', () => {
  const declarados = [
    { nombre: 'r' },
    { nombre: 'posiciones' },
    { nombre: 'umbralExpandir', comoTexto: CC2.dominio.cubetas.umbralComoTexto },
    { nombre: 'faltante' }
  ];
  const texto = archivo.parametrosComoTexto(
    { r: 3, posiciones: [1, 3], umbralExpandir: 0.82, n0: 2, ajeno: 'x' }, declarados
  );
  assert.deepEqual([...texto], [['r', '3'], ['posiciones', '1,3'], ['umbralExpandir', '82'], ['faltante', '']]);
  // Responde a `get` como el FormData del formulario.
  assert.equal(texto.get('r'), '3');
  // Un archivo sin parámetros, o con algo que no es un objeto, deja todo vacío.
  assert.deepEqual([...archivo.parametrosComoTexto(undefined, declarados)].map(([, valor]) => valor), ['', '', '', '']);
  assert.deepEqual([...archivo.parametrosComoTexto('basura', [{ nombre: 'r' }])], [['r', '']]);
});

test('el umbral de cubetas sobrevive a guardarse como fracción y volver a validarse', () => {
  const cubetas = CC2.dominio.cubetas;
  for (const porcentaje of ['82', '125', '29', '57.5', '1']) {
    const guardado = cubetas.validarUmbral(porcentaje, 'Umbral').valor;
    assert.equal(cubetas.umbralComoTexto(guardado), porcentaje);
    assert.equal(cubetas.validarUmbral(cubetas.umbralComoTexto(guardado), 'Umbral').valor, guardado);
  }
});

test('un parámetro guardado fuera de rango no pasa el validador del tema', () => {
  const cubetas = CC2.dominio.cubetas;
  const texto = archivo.parametrosComoTexto({ r: 0, umbralExpandir: -0.5 }, [
    { nombre: 'r' }, { nombre: 'umbralExpandir', comoTexto: cubetas.umbralComoTexto }
  ]);
  assert.equal(cubetas.validarR(texto.get('r')).valido, false);
  assert.equal(cubetas.validarUmbral(texto.get('umbralExpandir'), 'Umbral').valido, false);
});
