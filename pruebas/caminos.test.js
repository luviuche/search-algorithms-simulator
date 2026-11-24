const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const caminos = CC2.dominio.caminos;
const { ALGORITMOS } = caminos;
const { recorrer } = CC2.algoritmos.caminos;
const { TIPOS, matrizInicial } = CC2.dominio.grafo;

// El ejemplo de las notas del docente (NotasClase grafos.pdf, págs. 1-3).
const NOTAS = '0 1 2\n0 3 5\n0 2 4\n1 5 7\n1 3 1\n2 4 6\n3 4 1\n4 5 1';
const leer = (texto, tipo) => caminos.leerGrafo(texto, tipo).grafo;
const G = leer(NOTAS);
const ultimo = (pasos) => pasos[pasos.length - 1];
const celda = (paso, v, i) => paso.tabla.filas.find((f) => f.vertice === v).celdas[i];

test('función ordinal de las notas: cada vértice recibe el número que le da el docente', () => {
  assert.deepEqual(caminos.funcionOrdinal(G).orden, ['0', '1', '2', '3', '4', '5']);
  // Con letras, los mismos lugares.
  const letras = leer('A B 2\nA D 5\nA C 4\nB F 7\nB D 1\nC E 6\nD E 1\nE F 1');
  const { orden, candidatos } = caminos.funcionOrdinal(letras);
  assert.deepEqual(orden, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(candidatos[2], ['C', 'D'], '«se escoge el 2, aunque se podría escoger el del centro»');
});

test('la función ordinal no se aplica con ciclos, y dice cuál', () => {
  const { ciclo } = caminos.funcionOrdinal(leer('0 1\n1 2\n2 3\n3 1'));
  assert.equal(ciclo[0], ciclo[ciclo.length - 1]);
  assert.deepEqual([...new Set(ciclo)].sort(), ['1', '2', '3']);
  const d = leer('0 1\n1 2\n2 3\n3 1');
  for (let i = 0; i < ciclo.length - 1; i++) assert.ok(d.aristas.some((a) => a.origen === ciclo[i] && a.destino === ciclo[i + 1]), 'sus flechas existen');
});

test('Bellman de las notas: λ = 0, 2, 4, 3, 4, 5 y la ruta mínima 0 → 1 → 3 → 4 → 5', () => {
  const pasos = recorrer(G, { algoritmo: ALGORITMOS.BELLMAN, inicio: '0', fin: '5' });
  assert.equal(pasos.length, 6 + 6 + 1);
  const final = ultimo(pasos);
  assert.deepEqual(final.tabla.filas.map((f) => f.celdas[2]), ['0', '2', '4', '3', '4', '5']);
  assert.equal(celda(final, '3', 1), 'min{0 + 5, 2 + 1}');
  assert.equal(celda(final, '4', 1), 'min{4 + 6, 3 + 1}');
  assert.equal(celda(final, '5', 1), 'min{2 + 7, 4 + 1}');
  assert.deepEqual(final.ruta, ['0', '1', '3', '4', '5']);
  assert.equal(final.distancia, 5);
  assert.equal(pasos[9].mensaje, 'λ₃ = min{5, 3} = 3: se comparan, y la menor viene de 1.');
  assert.match(pasos[2].mensaje, /También podía ir 3; va el primero en orden/);
});

test('Dijkstra de las notas: las etiquetas [d, n] y las que se tachan', () => {
  const pasos = recorrer(G, { algoritmo: ALGORITMOS.DIJKSTRA, inicio: '0', fin: '5' });
  const final = ultimo(pasos);
  const valen = (v) => celda(final, v, 1).filter((e) => !e.tachada).map((e) => e.texto).join();
  const tachadas = (v) => celda(final, v, 1).filter((e) => e.tachada).map((e) => e.texto).join();
  assert.deepEqual(G.vertices.map(valen), ['[0, –]', '[2, 0]', '[4, 0]', '[3, 1]', '[4, 3]', '[5, 4]']);
  assert.deepEqual(G.vertices.map(tachadas), ['', '', '', '[5, 0]', '[10, 2]', '[9, 1]']);
  assert.deepEqual(final.ruta, ['0', '1', '3', '4', '5']);
  assert.equal(final.etiquetas['5'].texto, '[5, 4]*');
  assert.deepEqual(final.permanentes, ['0', '1', '3', '2', '4', '5']);
  // Una historia no cambia en los pasos que ya pasaron.
  const primero = pasos.find((p) => p.mensaje.startsWith('Desde 0'));
  assert.deepEqual(celda(primero, '3', 1).map((e) => [e.texto, Boolean(e.tachada)]), [['[5, 0]', false]]);
});

test('Dijkstra acepta ciclos y no dirigidos; lo que no se alcanza se dice', () => {
  const conCiclo = recorrer(leer('0 1 1\n1 2 1\n2 0 1\n2 3 5'), { algoritmo: ALGORITMOS.DIJKSTRA, inicio: '0', fin: '3' });
  assert.equal(ultimo(conCiclo).distancia, 7);
  const alReves = recorrer(leer('0 1 1\n1 2 1\n2 0 1\n2 3 5'), { algoritmo: ALGORITMOS.DIJKSTRA, inicio: '3', fin: '0' });
  assert.equal(ultimo(alReves).ruta, null);
  assert.match(ultimo(alReves).mensaje, /De 3 no se llega a 0/);
  const noDirigido = recorrer(leer('A B 4\nB C 1', TIPOS.NO_DIRIGIDO), { algoritmo: ALGORITMOS.DIJKSTRA, inicio: 'C', fin: 'A' });
  assert.deepEqual(ultimo(noDirigido).ruta, ['C', 'B', 'A']);
  assert.equal(ultimo(noDirigido).distancia, 5);
});

test('Bellman desde un vértice que no es el primero: los de antes quedan en ∞', () => {
  const final = ultimo(recorrer(G, { algoritmo: ALGORITMOS.BELLMAN, inicio: '1', fin: '5' }));
  assert.deepEqual(final.tabla.filas.map((f) => f.celdas[2]), ['∞', '0', '∞', '1', '2', '3']);
  assert.deepEqual(final.ruta, ['1', '3', '4', '5']);
});

test('en 300 grafos al azar, Dijkstra y Bellman dan las distancias de Floyd', () => {
  let semilla = 11;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
  const entero = (a, b) => a + Math.floor(azar() * (b - a + 1));
  for (let caso = 0; caso < 300; caso++) {
    const n = entero(2, 8);
    const tipo = azar() < 0.5 ? TIPOS.DIRIGIDO : TIPOS.NO_DIRIGIDO;
    const aristas = [];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        if (i === k || (tipo === TIPOS.NO_DIRIGIDO && k < i) || azar() > 0.35) continue;
        aristas.push(`${i} ${k} ${entero(0, 12)}`);
      }
    }
    if (aristas.length === 0) continue;
    const grafo = leer(aristas.concat(Array.from({ length: n }, (_, i) => String(i))).join('\n'), tipo);
    const d = matrizInicial(grafo);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) d[i][k] = Math.min(d[i][k], d[i][j] + d[j][k]);
    const s = entero(0, n - 1);
    const t = entero(0, n - 1);
    if (s === t) continue;
    const pedir = { inicio: String(s), fin: String(t) };
    const dij = ultimo(recorrer(grafo, { algoritmo: ALGORITMOS.DIJKSTRA, ...pedir }));
    assert.deepEqual(dij.tabla.filas.map((f) => f.celdas[2]), d[s].map((x) => (Number.isFinite(x) ? String(x) : '∞')));
    if (dij.ruta) assert.equal(caminos.aristasDe(grafo, dij.ruta).reduce((x, a) => x + a.peso, 0), d[s][t], 'la ruta suma su distancia');
    if (tipo === TIPOS.DIRIGIDO) {
      const { orden } = caminos.funcionOrdinal(grafo);
      if (orden) {
        assert.ok(grafo.aristas.every((a) => orden.indexOf(a.origen) < orden.indexOf(a.destino)), 'toda arista va de menor a mayor');
        const bel = ultimo(recorrer(grafo, { algoritmo: ALGORITMOS.BELLMAN, ...pedir }));
        assert.equal(bel.distancia, d[s][t]);
      }
    }
  }
});

test('el grafo: vértices desde 0 o letras, hasta 8, y los errores con su renglón', () => {
  assert.deepEqual(leer('0 1\nB A 3').vertices, ['0', '1', 'A', 'B']);
  assert.equal(caminos.comoTexto(leer('0 1 2\n7')), '0 1 2\n7');
  const error = (texto, tipo) => caminos.leerGrafo(texto, tipo).mensaje;
  assert.match(error('0 1 -3'), /el peso es un entero de 0/);
  assert.match(error('0 0'), /lazo/);
  assert.match(error('0 1\n0 1'), /ya está en el renglón 1/);
  assert.equal(caminos.leerGrafo('0 1\n1 0').valido, true, 'en un dirigido, la vuelta es otra arista');
  assert.match(error('0 1\n1 0', TIPOS.NO_DIRIGIDO), /ya está/);
  assert.match(error('0 1\n2 3\n4 5\n6 7\n8 9'), /caben hasta 8/);
  assert.match(error(''), /al menos una arista/);
});
