const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const huffman = CC2.dominio.huffman;

const letras = (palabra) => [...palabra.toLowerCase()];
const CIENCIAS = letras('ciencias');

// El ejemplo del docente, traído por el usuario (2026-09-11). Es el caso de
// referencia de todo el tema: si algo cambia aquí, cambió la regla.
test('CIENCIAS: las letras entran por frecuencia ascendente y, a igual frecuencia, por orden de lectura', () => {
  const inicial = huffman.ordenInicial(CIENCIAS);
  assert.deepEqual(
    inicial.map((n) => `${n.letra}=${n.peso}`),
    ['e=1', 'n=1', 'a=1', 's=1', 'c=2', 'i=2']
  );
});

test('CIENCIAS: las reducciones son las del tablero, y la última pesa el total', () => {
  const { reducciones, total } = huffman.construir(CIENCIAS);
  const parejas = reducciones.map((r) => [
    r.izquierda.letra || '·', r.derecha.letra || '·', r.nodo.peso
  ]);
  assert.deepEqual(parejas, [
    ['e', 'n', 2],
    ['a', 's', 2],
    // El paso que revela la regla fina: con cuatro nodos de peso 2 se unen las
    // dos letras, no los dos nodos recién creados, porque las letras llevaban
    // más tiempo en la lista.
    ['c', 'i', 4],
    ['·', '·', 4],
    ['·', '·', 8]
  ]);
  assert.equal(reducciones[reducciones.length - 1].nodo.peso, total);
});

test('CIENCIAS: los códigos son los del árbol esperado', () => {
  const arbol = huffman.construir(CIENCIAS);
  const codigos = huffman.codigosDe(arbol.raiz);
  assert.deepEqual(Object.fromEntries(codigos), {
    c: '00', i: '01', e: '100', n: '101', a: '110', s: '111'
  });
});

test('CIENCIAS: la tabla de codificación suma 20/8 = 2,5 bits por letra', () => {
  const arbol = huffman.construir(CIENCIAS);
  const tabla = huffman.tablaDeCodificacion(arbol);

  // El orden es el inverso al de entrada: como el docente escribe la lista de
  // frecuencias en el tablero.
  assert.deepEqual(
    tabla.filas.map((f) => [f.letra, f.codigo, f.longitud, f.veces, f.producto]),
    [
      ['i', '01', 2, 2, 4],
      ['c', '00', 2, 2, 4],
      ['s', '111', 3, 1, 3],
      ['a', '110', 3, 1, 3],
      ['n', '101', 3, 1, 3],
      ['e', '100', 3, 1, 3]
    ]
  );
  assert.equal(tabla.suma, 20);
  assert.equal(tabla.total, 8);
  assert.equal(tabla.suma / tabla.total, 2.5);
});

// Lo que el ejemplo del docente no alcanza a decidir, porque en CIENCIAS todos
// los empates salen a favor de las letras: un nodo nuevo **se mete en su sitio
// por peso**, y no al final de la lista. Con pesos 1,1,1,5 las dos formas dan
// árboles distintos, y solo una es Huffman.
test('el nodo nuevo vuelve a la lista por peso y no al final', () => {
  // aparecen: b(1), c(1), d(1), a(5) → 'abbbbbcd' no sirve porque a va primera;
  // se usa una palabra donde las tres de peso 1 se lean antes que la de peso 5.
  const palabra = letras('bcdaaaaa');
  const { reducciones } = huffman.construir(palabra);
  const parejas = reducciones.map((r) => [
    r.izquierda.letra || '·', r.derecha.letra || '·', r.nodo.peso
  ]);
  assert.deepEqual(parejas, [
    ['b', 'c', 2],
    // Si el nodo se hubiera ido al final, aquí se uniría d(1) con a(5).
    ['d', '·', 3],
    ['·', 'a', 8]
  ]);
});

test('las tildes cuentan como la letra base y la palabra se lee en minúsculas', () => {
  const conTilde = huffman.ordenInicial(letras('ÁrbolÁ'));
  const sinTilde = huffman.ordenInicial(letras('arbola'));
  assert.deepEqual(
    conTilde.map((n) => `${n.letra}=${n.peso}`),
    sinTilde.map((n) => `${n.letra}=${n.peso}`)
  );
});

test('toda hoja recibe un código, y ninguno es prefijo de otro', () => {
  for (const palabra of ['ciencias', 'computacion', 'murcielago', 'aabbbcccc']) {
    const arbol = huffman.construir(letras(palabra));
    const codigos = [...huffman.codigosDe(arbol.raiz).values()];
    const distintas = new Set(letras(palabra)).size;
    assert.equal(codigos.length, distintas, palabra);
    for (const a of codigos) {
      for (const b of codigos) {
        if (a !== b) assert.ok(!b.startsWith(a), `${palabra}: ${a} es prefijo de ${b}`);
      }
    }
  }
});

// La suma de Pi × Li es la longitud media del código, así que tiene que caer
// entre la del código más corto y la del más largo, y mejorar —o igualar— a un
// código de longitud fija para esas mismas letras.
test('la longitud media queda por debajo de la del código de longitud fija', () => {
  for (const palabra of ['ciencias', 'computacion', 'murcielago']) {
    const arbol = huffman.construir(letras(palabra));
    const tabla = huffman.tablaDeCodificacion(arbol);
    const media = tabla.suma / tabla.total;
    const distintas = new Set(letras(palabra)).size;
    const fija = Math.ceil(Math.log2(distintas));
    assert.ok(media <= fija, `${palabra}: media ${media} contra fija ${fija}`);
  }
});

test('una palabra de una sola letra distinta se rechaza en vez de inventar un código', () => {
  const validacion = huffman.validarPalabra('aaa');
  assert.equal(validacion.valido, false);
  assert.match(validacion.mensaje, /dos letras distintas/);
});

// ── La traza: cada reducción en tres tiempos (2026-09-30) ────────────────

const { construirDesdePalabra } = CC2.algoritmos.huffman;
const nombres = (bosque) => bosque.map((nodo) => (nodo.letra !== undefined ? nodo.letra : nodo.peso)).join(' ');

test('cada unión se marca, se junta donde está y vuelve a su sitio por peso, cada cosa en su paso', () => {
  const pasos = construirDesdePalabra({ letras: CIENCIAS });
  const [, marca, junta, ubica] = pasos;

  assert.equal(nombres(marca.bosque), 'e n a s c i');
  assert.deepEqual(marca.uniendo.map((nodo) => nodo.letra), ['e', 'n']);

  // Nace al principio de la lista, donde estaban e y n, y queda resaltado.
  assert.equal(nombres(junta.bosque), '2 a s c i');
  assert.deepEqual(junta.uniendo, [junta.bosque[0]]);
  assert.match(junta.mensaje, /Nace el nodo de 2\/8: e a la izquierda \(0\) y n a la derecha \(1\)/);

  // Y en su propio paso se va detrás de c e i, que pesan lo mismo.
  assert.equal(nombres(ubica.bosque), 'a s c i 2');
  assert.deepEqual(ubica.uniendo, [junta.bosque[0]]);
  assert.match(ubica.mensaje, /en su sitio por peso, detrás de c y i, que pesan lo mismo y estaban antes\./);
});

test('si el nodo nuevo ya va primero, no hay paso de ubicarlo', () => {
  const pasos = construirDesdePalabra({ letras: CIENCIAS });
  // Cinco reducciones: la última deja un solo nodo y no tiene adónde ir, así
  // que hay tres tiempos en cuatro de ellas y dos en la última. Más el paso
  // inicial y el que cierra con la tabla.
  assert.equal(pasos.length, 1 + 4 * 3 + 2 + 1);
  assert.equal(pasos.filter((paso) => /vuelve a la lista/.test(paso.mensaje)).length, 4);
  assert.match(pasos[pasos.length - 2].mensaje, /Nace el nodo de 8\/8/);
});

test('sin empate, el mensaje de ubicación no inventa a nadie detrás de quien ir', () => {
  const pasos = construirDesdePalabra({ letras: CIENCIAS });
  const ubicaciones = pasos.filter((paso) => /vuelve a la lista/.test(paso.mensaje)).map((paso) => paso.mensaje);
  // c + i = 4/8 va detrás de los dos nodos de 2/8, que pesan menos.
  assert.ok(ubicaciones.includes('El nodo de 4/8 vuelve a la lista en su sitio por peso.'));
  assert.ok(ubicaciones.includes('El nodo de 4/8 vuelve a la lista en su sitio por peso, detrás de (4/8), que pesa lo mismo y estaba antes.'));
});

test('el espacio es un carácter más y se escribe _ (taller de JULIO CESAR)', () => {
  const validacion = huffman.validarPalabra('JULIO CESAR');
  assert.equal(validacion.valido, true);
  assert.equal(validacion.valor, 'julio_cesar');
  assert.equal(validacion.letras.length, 11);
  // Escrito con guion bajo es la misma palabra.
  assert.deepEqual(huffman.validarPalabra('julio_cesar').letras, validacion.letras);

  const arbol = huffman.construir(validacion.letras);
  const codigos = huffman.codigosDe(arbol.raiz);
  assert.ok(codigos.has('_'), 'el espacio tiene su código');
  assert.equal(codigos.size, 11);
});

test('los espacios de los extremos no cuentan; los de en medio, todos', () => {
  assert.equal(huffman.validarPalabra('  ab ').valor, 'ab');
  assert.equal(huffman.validarPalabra('a  b').valor, 'a__b');
  assert.equal(huffman.validarPalabra('   ').valido, false);
});

test('fuera de letras y espacios, la palabra se rechaza', () => {
  assert.equal(huffman.validarPalabra('julio-cesar').valido, false);
  assert.equal(huffman.validarPalabra('abc1').valido, false);
});

test('la media de bits por letra se escribe con a lo sumo dos decimales, y dice si es exacta', () => {
  assert.deepEqual(huffman.mediaComoTexto(20, 8), { signo: '=', valor: '2,5' });
  assert.deepEqual(huffman.mediaComoTexto(34, 10), { signo: '=', valor: '3,4' });
  // JULIO_CESAR: 39/11 = 3,5454…, periódica.
  assert.deepEqual(huffman.mediaComoTexto(39, 11), { signo: '≈', valor: '3,55' });
  assert.deepEqual(huffman.mediaComoTexto(8, 4), { signo: '=', valor: '2' });
});
