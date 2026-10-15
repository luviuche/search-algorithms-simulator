const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const cubetasAlg = CC2.algoritmos.cubetas;
const cubetasDom = CC2.dominio.cubetas;
const estructuras = CC2.dominio.estructura;

// Los mismos aplicadores que usa la pantalla (tema-busqueda.js): la traza no
// toca nada, y quien la reproduce aplica el `efecto` de cada paso. El orden de
// llegada no se lleva aquí: lo lleva el dominio al colocar y al retirar, desde
// que hizo falta también para guardar en archivo (CLAUDE.md 10).
const APLICADORES = {
  'colocar-cubeta': (estructura, efecto) => {
    if (efecto.posicion === undefined) estructuras.colocarEn(estructura, efecto.casilla, efecto.clave);
    else estructuras.colocarEnAnidado(estructura, efecto.casilla, efecto.posicion, efecto.clave);
  },
  'retirar-cubeta': (estructura, efecto) => {
    if (efecto.posicion === undefined) estructuras.retirarDe(estructura, efecto.casilla);
    else estructuras.retirarDeAnidado(estructura, efecto.casilla, efecto.posicion);
  },
  'compactar-anidado': (estructura, efecto) => estructuras.compactarAnidado(estructura, efecto.casilla),
  'colocar-col': (estructura, efecto) => estructuras.colocarEnCol(estructura, efecto.casilla, efecto.clave),
  'retirar-col': (estructura, efecto) => estructuras.retirarDeCol(estructura, efecto.casilla, efecto.col),
  'subir-de-col': (estructura, efecto) => estructuras.subirDeCol(estructura, efecto.casilla, efecto.posicion),
  redimensionar: (estructura, efecto) => {
    estructura.n = efecto.n;
    estructura.claves = new Array(efecto.n);
    estructura.anidados = new Array(efecto.n);
    estructura.desbordes = new Array(efecto.n);
    estructura.ordenLlegada = [];
  }
};

function aplicar(estructura, pasos) {
  for (const paso of pasos) {
    if (paso.efecto) APLICADORES[paso.efecto.tipo](estructura, paso.efecto);
  }
  return estructura;
}

// Sin `l`: las claves de este tema no tienen una longitud fija (CLAUDE.md 5.7).
function crear({ n, r, modoExpansion, umbralExpandir = 0.82, umbralReducir = 1.25 }) {
  const { estructura } = estructuras.crearEstructura({
    n, l: undefined, tipoClave: 'numerica', modo: estructuras.MODOS.DISPERSA
  });
  estructura.parametros = { r, modoExpansion, umbralExpandir, umbralReducir, n0: n };
  return estructura;
}

function insertarTodas(estructura, claves) {
  for (const clave of claves) aplicar(estructura, cubetasAlg.insertar({ estructura, clave }));
}

function eliminarTodas(estructura, claves) {
  for (const clave of claves) aplicar(estructura, cubetasAlg.eliminar({ estructura, clave }));
}

// Retrata la tabla como "cubeta:renglones", para comparar contra el taller
// sin depender de cómo esté implementado el arreglo por dentro.
function retrato(estructura) {
  const filas = [];
  for (let i = 1; i <= estructura.n; i++) {
    const renglones = [estructura.claves[i - 1]]
      .concat(estructura.anidados[i - 1] || [])
      .filter((valor) => valor !== undefined);
    if (renglones.length > 0) filas.push(`${i}:${renglones.join(',')}`);
  }
  return filas.join(' ');
}

// El ejercicio del taller resuelto (docs/Taller Solucion 02-09-26.docx.pdf):
// n0 = 2, r = 3, expandir al 82 %, reducir al 125 %, H(k) = k mod n. La
// última clave de la lista original es 38, no un 28 repetido —se confirma
// contando las 17 direcciones que el propio taller calcula—.
const CLAVES = [115, 96, 48, 79, 35, 26, 57, 81, 70, 64, 107, 45, 62, 98, 33, 28, 38];
const CLAVES_A_ELIMINAR = [48, 35, 81, 70, 45, 33, 38, 115];
const RETRATO_FINAL_17 = '1:96,48,64 2:57,81,33 3:26,98 4:115,35,107 5:28 6:45 7:70,62,38 8:79';

test('expansión total duplica n en cada paso', () => {
  assert.equal(cubetasDom.siguienteN(2, 2, 'total'), 4);
  assert.equal(cubetasDom.siguienteN(4, 2, 'total'), 8);
});

test('expansión parcial intercala dos series que se doblan cada una por su cuenta', () => {
  const secuencia = [2];
  for (let i = 0; i < 4; i++) {
    secuencia.push(cubetasDom.siguienteN(secuencia[secuencia.length - 1], 2, 'parcial'));
  }
  assert.deepEqual(secuencia, [2, 3, 4, 6, 8]);
});

test('reducir retrocede exactamente lo que expandir avanzó, sin guardar historial', () => {
  assert.equal(cubetasDom.anteriorN(8, 2, 'total'), 4);
  assert.equal(cubetasDom.anteriorN(4, 2, 'total'), 2);
  assert.equal(cubetasDom.anteriorN(2, 2, 'total'), null);

  assert.equal(cubetasDom.anteriorN(8, 2, 'parcial'), 6);
  assert.equal(cubetasDom.anteriorN(6, 2, 'parcial'), 4);
  assert.equal(cubetasDom.anteriorN(4, 2, 'parcial'), 3);
  assert.equal(cubetasDom.anteriorN(3, 2, 'parcial'), 2);
  assert.equal(cubetasDom.anteriorN(2, 2, 'parcial'), null);
});

test('la traza no toca la estructura hasta que se aplica', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total' });
  cubetasAlg.insertar({ estructura, clave: 115 });
  assert.equal(estructuras.cantidadClaves(estructura), 0);
  assert.deepEqual(estructura.ordenLlegada, []);
});

test('expansión total: n pasa por 2, 4 y 8 en los puntos exactos del taller', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total' });
  for (let i = 0; i < CLAVES.length; i++) {
    aplicar(estructura, cubetasAlg.insertar({ estructura, clave: CLAVES[i] }));
    if (i === 4) assert.equal(estructura.n, 4, 'tras la 5ª clave, densidad 5/6 ≥ 82 %');
    if (i === 9) assert.equal(estructura.n, 8, 'tras la 10ª clave, densidad 10/12 ≥ 82 %');
  }
  assert.equal(estructura.n, 8);
  assert.equal(estructuras.cantidadClaves(estructura), 17);
  assert.equal(retrato(estructura), RETRATO_FINAL_17);
});

test('expansión parcial: n recorre 2, 3, 4, 6 y 8 igual que en el taller', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'parcial' });
  for (let i = 0; i < CLAVES.length; i++) {
    aplicar(estructura, cubetasAlg.insertar({ estructura, clave: CLAVES[i] }));
    if (i === 4) assert.equal(estructura.n, 3, 'tras la 5ª clave: 2 + 1');
    if (i === 7) assert.equal(estructura.n, 4, 'la 8ª clave (81) choca: la cubeta llena expande aunque la densidad ya avisaba');
    if (i === 9) assert.equal(estructura.n, 6, 'tras la 10ª clave: dobla la 2ª estructura (3 → 6)');
    if (i === 14) assert.equal(estructura.n, 8, 'la 15ª clave (33) choca: dobla la 3ª estructura (4 → 8)');
  }
  // Confirma exactamente lo que sorprende del taller: total y parcial llegan
  // al mismo n = 8 con las mismas 17 claves, aunque el camino fue distinto.
  assert.equal(estructura.n, 8);
  assert.equal(retrato(estructura), RETRATO_FINAL_17);
});

// Una cubeta llena no expande: la clave queda en su Col y ahí se guarda,
// con las que choquen después, hasta que la densidad pida expandir
// (corrección del usuario, 2026-10-14; CLAUDE.md 5.7).
test('una cubeta llena guarda la clave en Col y no expande si la densidad no lo pide', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total' });
  insertarTodas(estructura, [2, 4, 6, 8]);
  assert.equal(estructura.n, 2, '4/6 = 66,7 % no llega al 82 %');
  assert.deepEqual(estructuras.colDe(estructura, 1), [8]);
  assert.equal(estructuras.cantidadClaves(estructura), 4, 'la clave en Col cuenta');

  // La siguiente sí la lleva al 82 %: 5/6 = 83,3 %. Ahí expande, y la 8 sale
  // de Col a su cubeta nueva.
  insertarTodas(estructura, [10]);
  assert.equal(estructura.n, 4);
  assert.deepEqual(estructuras.colDe(estructura, 1), []);
});

test('Col guarda varias claves de la misma cubeta, en el orden en que llegan', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total', umbralExpandir: 0.99 });
  insertarTodas(estructura, [2, 4, 6, 8, 10]);
  assert.equal(estructura.n, 2);
  assert.deepEqual(estructuras.colDe(estructura, 1), [8, 10]);
});

test('al expandir, las claves de Col se recolocan con las demás en su orden de llegada', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total' });
  insertarTodas(estructura, [2, 4, 6, 8, 1]);
  // 5/6 = 83,3 %: expande a n = 4 y la 8 sale de Col.
  assert.equal(estructura.n, 4);
  assert.deepEqual(estructuras.colDe(estructura, 1), []);
  assert.equal(retrato(estructura), '1:4,8 2:1 3:2,6');
});

test('al recolocar, la que vuelve a caer en una cubeta llena queda otra vez en Col', () => {
  const estructura = crear({ n: 2, r: 2, modoExpansion: 'total', umbralExpandir: 0.8 });
  // Todas múltiplos de 4: con n = 4 siguen cayendo en la cubeta 0.
  insertarTodas(estructura, [4, 8, 12, 1]);
  assert.equal(estructura.n, 4, '4/4 = 100 % expande a n = 4');
  assert.deepEqual(estructuras.colDe(estructura, 1), [12]);
});

test('buscar sigue por Col cuando la cubeta está llena', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total', umbralExpandir: 0.99 });
  insertarTodas(estructura, [2, 4, 6, 8, 10]);
  const hallada = cubetasAlg.buscar({ estructura, objetivo: 10 });
  const fin = hallada[hallada.length - 1];
  assert.equal(fin.tipo, 'encontrada');
  assert.equal(fin.col, 2);
  assert.equal(fin.comparaciones, 5, 'tres renglones y dos de Col');

  const ausente = cubetasAlg.buscar({ estructura, objetivo: 12 });
  assert.equal(ausente[ausente.length - 1].tipo, 'no-encontrada');
});

test('eliminar de Col la saca de la lista; eliminar de la cubeta sube la primera de Col', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total', umbralExpandir: 0.99, umbralReducir: 0.1 });
  insertarTodas(estructura, [2, 4, 6, 8, 10]);
  eliminarTodas(estructura, [8]);
  assert.deepEqual(estructuras.colDe(estructura, 1), [10]);

  eliminarTodas(estructura, [4]);
  assert.deepEqual(estructuras.colDe(estructura, 1), []);
  assert.equal(retrato(estructura), '1:2,6,10');
  const hallada = cubetasAlg.buscar({ estructura, objetivo: 10 });
  assert.equal(hallada[hallada.length - 1].tipo, 'encontrada', 'la que subió se sigue encontrando');
});

test('reducción total: n vuelve a la mitad y compacta cada cubeta', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'total' });
  insertarTodas(estructura, CLAVES);
  eliminarTodas(estructura, CLAVES_A_ELIMINAR);

  assert.equal(estructura.n, 4);
  assert.equal(estructuras.cantidadClaves(estructura), 9);
  assert.equal(retrato(estructura), '1:96,64,28 2:57 3:26,62,98 4:79,107');
});

test('reducción parcial: retrocede en la misma serie intercalada por la que expandió', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'parcial' });
  insertarTodas(estructura, CLAVES);
  eliminarTodas(estructura, CLAVES_A_ELIMINAR);

  assert.equal(estructura.n, 6);
  assert.equal(estructuras.cantidadClaves(estructura), 9);
  assert.equal(retrato(estructura), '1:96 2:79 3:26,62,98 4:57 5:64,28 6:107');
});

test('buscar recorre la cubeta secuencialmente tras calcular la dirección', () => {
  const estructura = crear({ n: 8, r: 3, modoExpansion: 'total' });
  insertarTodas(estructura, CLAVES);

  const encontrada = cubetasAlg.buscar({ estructura, objetivo: 38 });
  assert.equal(encontrada[encontrada.length - 1].tipo, 'encontrada');

  const ausente = cubetasAlg.buscar({ estructura, objetivo: 999 });
  assert.equal(ausente[ausente.length - 1].tipo, 'no-encontrada');
});

// La clave que chocó queda en la fila «Col» y cuenta para la densidad: en ese
// instante el taller escribe D.O. = 8/9 = 88,89 %, no 7/9 (CLAUDE.md 5.7).
test('la clave que choca queda en Col y cuenta para la densidad', () => {
  const estructura = crear({ n: 2, r: 3, modoExpansion: 'parcial' });
  insertarTodas(estructura, [115, 96, 48, 79, 35, 26, 57]);
  assert.equal(estructura.n, 3);
  assert.equal(cubetasDom.densidadExpandir(estructura).toFixed(4), (7 / 9).toFixed(4));

  const pasos = cubetasAlg.insertar({ estructura, clave: 81 });
  const choque = pasos.findIndex((paso) => paso.tipo === 'colision');
  assert.deepEqual(pasos[choque].efecto, { tipo: 'colocar-col', casilla: 1, clave: 81 });
  aplicar(estructura, pasos.slice(0, choque + 1));
  assert.equal((cubetasDom.densidadExpandir(estructura) * 100).toFixed(2), '88.89');
});

// Guardar una tabla expandida y volver a abrirla (CLAUDE.md 10): el archivo
// lleva más claves que cubetas —caben n × r—, y abrirlo tiene que rehacer la
// misma tabla con el mismo n de partida, o la tabla reabierta ya no podría
// reducirse hasta donde podía la original. Es lo que hace la pantalla al
// abrir: crea la estructura con el `n` guardado y el `n0` de `nInicial`, y
// reinserta en orden de llegada.
for (const modoExpansion of ['total', 'parcial']) {
  test(`guardar y abrir una tabla de cubetas expandida (${modoExpansion}) devuelve la misma tabla`, () => {
    const archivo = CC2.persistencia.archivo;
    const original = crear({ n: 2, r: 3, modoExpansion, umbralExpandir: 0.82, umbralReducir: 1.25 });
    insertarTodas(original, CLAVES);
    assert.ok(CLAVES.length > original.n, 'la tabla guarda más claves que cubetas');

    const datos = JSON.parse(archivo.comoTexto(archivo.serializar({ tema: 'cubetas', estructura: original })));
    assert.equal(archivo.validar(datos).valido, true);
    assert.equal(archivo.nInicial(datos), 2);

    const reabierta = crear({ n: datos.n, r: 3, modoExpansion, umbralExpandir: 0.82, umbralReducir: 1.25 });
    reabierta.parametros.n0 = archivo.nInicial(datos);
    insertarTodas(reabierta, datos.claves);
    assert.equal(reabierta.n, original.n);
    assert.equal(retrato(reabierta), retrato(original));

    // Con el n0 de partida, eliminar reduce igual en las dos.
    eliminarTodas(original, CLAVES_A_ELIMINAR);
    eliminarTodas(reabierta, CLAVES_A_ELIMINAR);
    assert.equal(reabierta.n, original.n);
    assert.equal(retrato(reabierta), retrato(original));
  });
}

// Al cambiar de tamaño la tabla se vacía y las claves vuelven una a una: cada
// paso lleva cuántas faltan, y la densidad que las suma se lee igual desde el
// anuncio hasta la última recolocada —la del n nuevo—, en vez de arrancar en
// 0 % justo cuando el anuncio cita la cifra que lo disparó.
test('durante la reubicación la densidad cuenta las claves que faltan por recolocar', () => {
  const casos = [
    {
      operacion: 'eliminar',
      preparar: [115, 96, 48, 79, 35],
      pasos: (estructura) => cubetasAlg.eliminar({ estructura, clave: 48 }),
      densidad: (estructura, pendientes) => cubetasDom.densidadReducir(estructura, pendientes),
      esperada: 4 / 2
    },
    {
      operacion: 'insertar',
      preparar: [115, 96, 48, 79],
      pasos: (estructura) => cubetasAlg.insertar({ estructura, clave: 35 }),
      densidad: (estructura, pendientes) => cubetasDom.densidadExpandir(estructura, pendientes),
      esperada: 5 / 12
    }
  ];
  for (const caso of casos) {
    const estructura = crear({ n: 2, r: 3, modoExpansion: 'total' });
    insertarTodas(estructura, caso.preparar);
    const pasos = caso.pasos(estructura);
    const anuncio = pasos.findIndex((paso) => paso.efecto && paso.efecto.tipo === 'redimensionar');
    assert.ok(anuncio >= 0, `${caso.operacion}: la traza cambia de tamaño`);
    pasos.forEach((paso, indice) => {
      if (paso.efecto) APLICADORES[paso.efecto.tipo](estructura, paso.efecto);
      if (indice < anuncio) return;
      assert.equal(
        caso.densidad(estructura, paso.pendientes).toFixed(4),
        caso.esperada.toFixed(4),
        `${caso.operacion}, paso ${indice + 1}: ${paso.mensaje}`
      );
    });
    assert.equal(pasos[pasos.length - 1].pendientes, 0);
  }
});
