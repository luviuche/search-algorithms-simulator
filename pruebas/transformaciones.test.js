const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const t = CC2.dominio.transformaciones;
const { TRANSFORMACIONES: T } = t;
const { recorrer } = CC2.algoritmos.transformaciones;

// No hay ejercicio del docente. El ejemplo, contado a mano: el cuadrado
// 1–2–3–4 con la diagonal 1–3.
const G = t.leer('1 2\n2 3\n3 4\n4 1\n1 3').grafo;
const escritas = (grafo) => grafo.aristas.map((a) => a.join('–'));
const ultimo = (pasos) => pasos[pasos.length - 1];

test('insertar y borrar un vértice', () => {
  const con = t.transformar(G, T.INSERTAR_VERTICE, { vertice: '5', vecinos: ['1', '3'] });
  assert.deepEqual(con.vertices, ['1', '2', '3', '4', '5']);
  assert.deepEqual(escritas(con).slice(5), ['5–1', '5–3']);
  const sin = t.transformar(G, T.BORRAR_VERTICE, { vertice: '1' });
  assert.deepEqual(sin.vertices, ['2', '3', '4']);
  assert.deepEqual(escritas(sin), ['2–3', '3–4']);
  const pasos = recorrer(G, T.BORRAR_VERTICE, { vertice: '1' });
  assert.equal(pasos.length, 1 + 3 + 1 + 1);
  assert.match(ultimo(pasos).mensaje, /G − 1: 3 vértices y 2 aristas/);
  assert.equal(recorrer(G, T.INSERTAR_VERTICE, { vertice: '5', vecinos: [] }).length, 2);
});

test('insertar y borrar una arista: los vértices se quedan', () => {
  assert.equal(escritas(t.transformar(G, T.INSERTAR_ARISTA, { par: ['2', '4'] })).pop(), '2–4');
  const sin = t.transformar(G, T.BORRAR_ARISTA, { par: ['1', '4'] });
  assert.deepEqual(escritas(sin), ['1–2', '2–3', '3–4', '1–3'], 'aunque se escribió 4 1');
  assert.deepEqual(sin.vertices, G.vertices);
});

test('fusionar vértices: los vecinos de los dos, sin lazos ni paralelas', () => {
  // 2 y 4 no son adyacentes; los dos tienen a 1 y a 3: dos paralelas.
  const { nuevo, cambios, resultado } = t.fusionar(G, '2', '4');
  assert.equal(nuevo, '2,4');
  assert.deepEqual(cambios.map((c) => c.tipo), ['pasa', 'pasa', 'paralela', 'paralela']);
  assert.deepEqual(escritas(resultado), ['1–3', '2,4–1', '2,4–3']);
  const pasos = recorrer(G, T.FUSIONAR_VERTICES, { par: ['2', '4'] });
  assert.match(ultimo(pasos).mensaje, /3 vértices y 3 aristas.*grafo simple/);
  assert.match(pasos[3].mensaje, /paralela a «2,4»–3, que ya está: se descarta/);
});

test('fusionar dos vértices adyacentes descarta el lazo y lo dice', () => {
  const pasos = recorrer(G, T.FUSIONAR_VERTICES, { par: ['1', '2'] });
  assert.equal(pasos[1].mensaje, 'La arista 1–2 unía a los dos: quedaría un lazo, y se descarta.');
  assert.equal(ultimo(pasos).cuenta.aristas.numeros, '5 − 1 − 1');
  assert.equal(ultimo(pasos).cuenta.aristas.valor, 3);
});

test('contraer una arista: |A| baja en ella y en un vecino común por cada paralela', () => {
  const pasos = recorrer(G, T.CONTRAER_ARISTA, { par: ['1', '3'] });
  assert.equal(pasos[1].mensaje, 'La arista 1–3 es la que se contrae: desaparece.');
  assert.deepEqual(escritas(ultimo(pasos).parcial), ['1,3–2', '1,3–4']);
  assert.equal(ultimo(pasos).cuenta.aristas.numeros, '5 − 1 − 2');
});

test('complemento: lo que faltaba, y el complemento del complemento es G', () => {
  assert.deepEqual(escritas(t.complemento(G).resultado), ['2–4']);
  const otro = t.leer('1 2\n2 3\n4\na b').grafo;
  const doble = t.complemento(t.complemento(otro).resultado).resultado;
  assert.equal(doble.aristas.length, otro.aristas.length);
  assert.ok(otro.aristas.every(([u, v]) => t.tiene(doble, u, v)));
  assert.equal(recorrer(G, T.COMPLEMENTO).length, 3 + 1);
  assert.equal(ultimo(recorrer(G, T.COMPLEMENTO)).cuenta.aristas.numeros, '6 − 5');
});

test('en toda operación, la traza termina en el resultado y la cuenta da sus números', () => {
  const casos = [
    [T.INSERTAR_VERTICE, { vertice: 'x', vecinos: ['1'] }], [T.BORRAR_VERTICE, { vertice: '3' }],
    [T.INSERTAR_ARISTA, { par: ['2', '4'] }], [T.BORRAR_ARISTA, { par: ['1', '2'] }],
    [T.FUSIONAR_VERTICES, { par: ['2', '4'] }], [T.CONTRAER_ARISTA, { par: ['1', '2'] }], [T.COMPLEMENTO, {}]
  ];
  for (const [op, datos] of casos) {
    const pasos = recorrer(G, op, datos);
    const { cuenta, parcial } = ultimo(pasos);
    assert.deepEqual(parcial, t.transformar(G, op, datos), op);
    const anterior = pasos[pasos.length - 2].parcial;
    assert.deepEqual(escritas(anterior), escritas(parcial), `${op}: el paso de antes ya lo tiene todo`);
    // eslint-disable-next-line no-eval
    const suma = (texto) => eval(texto.replace(/−/g, '-').replace(/·/g, '*'));
    assert.equal(suma(cuenta.vertices.numeros), cuenta.vertices.valor, `${op}: |V′|`);
    assert.equal(suma(cuenta.aristas.numeros), cuenta.aristas.valor, `${op}: |A′|`);
  }
});

test('los datos que no valen se rechazan diciendo por qué', () => {
  assert.match(t.leerVertice('2', G, T.INSERTAR_VERTICE).mensaje, /ya está en G/);
  assert.match(t.leerVertice('9', G, T.BORRAR_VERTICE).mensaje, /9 no está en G/);
  assert.match(t.leerVertice('ab', G, T.INSERTAR_VERTICE).mensaje, /no es un vértice/);
  assert.match(t.leerVecinos('1 9', G).mensaje, /9 no está en G/);
  assert.deepEqual(t.leerVecinos('', G).vecinos, []);
  assert.match(t.leerPar('1 2', G, T.INSERTAR_ARISTA).mensaje, /1–2 ya está/);
  assert.match(t.leerPar('2 4', G, T.CONTRAER_ARISTA).mensaje, /2–4 no está/);
  assert.match(t.leerPar('1 1', G, T.FUSIONAR_VERTICES).mensaje, /mismo vértice/);
  assert.deepEqual(t.leerPar('4 1', G, T.BORRAR_ARISTA).par, ['1', '4']);
});
