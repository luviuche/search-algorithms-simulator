const test = require('node:test');
const assert = require('node:assert/strict');
const CC2 = require('./apoyo.js');

const plano = CC2.dominio.envolvente;
const { METODOS } = plano;
const { recorrer } = CC2.algoritmos.envolvente;
const leer = (texto) => plano.leerPuntos(texto).puntos;
const ultimo = (pasos) => pasos[pasos.length - 1];
const de = (paso, etiqueta) => paso.conjuntos.find((f) => f.etiqueta === etiqueta).elementos;
const ordenados = (lista) => lista.slice().sort().join(' ');

// Los puntos de las hojas del docente no traen coordenadas: se midieron sobre
// sus dibujos. La pág. 6, divide y vencerás, y la 7, QuickHull —donde a y f
// salen a la misma altura de −x, y él toma a—.
const PAGINA_6 = 'A 14 50\nB 52 61\nC 0 31\nD 47 45\nE 70 49\nF 18 27\nG 9 12\nH 34 13\nI 48 21\nJ 74 29\nK 55 11\nL 25 1\nM 70 6';
const PAGINA_7 = 'a 0 30\nb 25 42\nc 39 41\nd 14 23\ne 30 21\nf 0.5 15\ng 49 21\nh 6 4\ni 18 0\nJ 39 6';

test('divide y vencerás, pág. 6: los conjuntos, los extremos de cada mitad y los de la envolvente', () => {
  const pasos = recorrer(leer(PAGINA_6), METODOS.DIVIDE);
  assert.deepEqual(de(pasos[0], 'S₁'), ['A', 'C', 'F', 'G', 'H', 'L']);
  assert.deepEqual(de(pasos[0], 'S₂'), ['B', 'D', 'E', 'I', 'J', 'K', 'M']);
  assert.equal(ordenados(de(pasos[1], 'Ext S₁')), 'A C G H L');
  assert.equal(ordenados(de(pasos[2], 'Ext S₂')), 'B D E I J K M');
  const final = ultimo(pasos);
  assert.equal(ordenados(de(final, 'Extremos')), 'A B C E G J L M');
  // La hoja escribe «D, F, H, I, J» por internos: J es K, que ya está en los extremos.
  assert.deepEqual(de(final, 'Internos'), ['D', 'F', 'H', 'I', 'K']);
  assert.match(pasos[3].mensaje, /por arriba con B–A/);
  assert.match(pasos[4].mensaje, /por abajo con L–M/);
  assert.match(pasos[5].mensaje, /dejan de ser extremos/);
});

test('QuickHull, pág. 7: los cuatro extremos, lo descartado y los que salen por fuera', () => {
  const pasos = recorrer(leer(PAGINA_7), METODOS.QUICKHULL);
  assert.equal(pasos[0].mensaje, 'Puntos extremos: en y, b; en x, g; en −y, i; en −x, a.');
  assert.deepEqual(de(pasos[1], 'Descartados'), ['d', 'e']);
  assert.equal(ordenados(de(pasos[1], 'Por fuera')), 'J c f h');
  assert.equal(ordenados(de(ultimo(pasos), 'Extremos')), 'J a b c f g h i');
  assert.deepEqual(de(ultimo(pasos), 'Internos'), ['d', 'e']);
});

test('Graham: empieza en el de menor ordenada, ordena por ángulo y saca los que giran a la derecha', () => {
  const pasos = recorrer(leer('A 0 0\nB 4 0\nC 4 4\nD 0 4\nE 1 2'), METODOS.GRAHAM);
  assert.match(pasos[0].mensaje, /menor ordenada es A/);
  assert.match(pasos[1].mensaje, /: B, C, E, D\./);
  assert.ok(pasos.some((p) => p.mensaje === 'C → E → D gira a la derecha: E no es extremo y sale de la pila.'));
  assert.deepEqual(de(ultimo(pasos), 'Extremos'), ['A', 'B', 'C', 'D']);
});

test('Jarvis: rodea la nube y termina donde empezó', () => {
  const pasos = recorrer(leer('A 0 0\nB 4 0\nC 4 4\nD 0 4\nE 1 2'), METODOS.JARVIS);
  assert.equal(pasos.length, 1 + 4 + 1);
  assert.match(pasos[4].mensaje, /el siguiente es A, donde se empezó: la envolvente se cierra/);
});

test('un punto sobre un lado no es extremo, y se dice', () => {
  for (const metodo of Object.values(METODOS)) {
    const final = ultimo(recorrer(leer('A 0 0\nB 4 0\nC 4 4\nD 0 4\nE 2 0\nF 4 1\nG 2 2\nH 0 2'), metodo));
    assert.deepEqual(de(final, 'Extremos'), ['A', 'B', 'C', 'D'], metodo);
    assert.deepEqual(de(final, 'Internos'), ['G'], metodo);
    assert.deepEqual(de(final, 'En el borde'), ['E', 'F', 'H'], metodo);
  }
});

test('las medidas: un rectángulo de 4 por 3', () => {
  const puntos = leer('A 0 0\nB 4 0\nC 4 3\nD 0 3\nE 1 1');
  const m = plano.medidas(puntos, plano.extremos(puntos));
  assert.equal(m.perimetro, 14);
  assert.equal(m.area, 12);
  assert.equal(m.diametro.valor, 5);
  assert.equal(m.anchura.valor, 3);
});

test('los cuatro métodos dan los mismos extremos en 400 nubes al azar, y son los de la definición', () => {
  let semilla = 5;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
  let probadas = 0;
  for (let caso = 0; caso < 400; caso++) {
    // Rejillas chicas a propósito: dan empates y puntos en línea.
    const lado = 2 + Math.floor(azar() * 12);
    const lugares = new Set();
    const n = 3 + Math.floor(azar() * 14);
    for (let i = 0; i < n; i++) lugares.add(`${Math.floor(azar() * lado) - 2} ${Math.floor(azar() * lado) - 2}`);
    const lectura = plano.leerPuntos([...lugares].join('\n'));
    if (!lectura.valido) continue;
    probadas++;
    const { puntos } = lectura;
    // Extremo: hay una recta por él con todos los demás estrictamente a un lado.
    const porDefinicion = puntos.filter((p) => {
      const angulos = puntos.filter((q) => q !== p).map((q) => Math.atan2(q.y - p.y, q.x - p.x)).sort((a, b) => a - b);
      const huecos = angulos.map((a, i) => (i + 1 < angulos.length ? angulos[i + 1] - a : angulos[0] + 2 * Math.PI - a));
      return Math.max(...huecos) > Math.PI + 1e-9;
    });
    const esperado = ordenados(porDefinicion.map((p) => p.nombre));
    for (const metodo of Object.values(METODOS)) {
      const pasos = recorrer(puntos, metodo);
      const hallada = de(ultimo(pasos), 'Extremos');
      assert.equal(ordenados(hallada), esperado, `${metodo}: ${plano.comoTexto(puntos)}`);
      assert.equal(hallada.length, new Set(hallada).size, `${metodo}: sin repetir`);
      const m = plano.medidas(puntos, hallada.map((v) => puntos.find((p) => p.nombre === v)));
      assert.ok(m.area > 0, `${metodo}: en sentido antihorario`);
      assert.equal(m.internos.length + m.borde.length + hallada.length, puntos.length);
      for (const paso of pasos) for (const s of paso.segmentos) assert.ok(s.a && s.b && s.a !== s.b);
    }
  }
  assert.ok(probadas > 300, `nubes probadas: ${probadas}`);
});

test('los puntos: con nombre o sin él, y los errores con su renglón', () => {
  assert.deepEqual(leer('3 7\nA 1 2\n-1 0.5').map((p) => p.nombre), ['B', 'A', 'C']);
  assert.deepEqual(leer('p1 (3, 7)\np2 0 0\n12 5 1').map((p) => [p.nombre, p.x, p.y]), [['p1', 3, 7], ['p2', 0, 0], ['12', 5, 1]]);
  assert.equal(plano.comoTexto(leer('3 7\nA 1 2\n−1 0.5')), '3 7\nA 1 2\n-1 0.5');
  const error = (texto) => plano.leerPuntos(texto).mensaje;
  assert.match(error('A 1'), /su nombre y sus dos coordenadas/);
  assert.match(error('A 1 x'), /cada coordenada es un número/);
  assert.match(error('A 1 100'), /de −99 a 99/);
  assert.match(error('A 1 1\nA 2 2'), /ya hay un punto A, en el renglón 1/);
  assert.match(error('A 1 1\nB 1 1'), /ya hay un punto en \(1, 1\)/);
  assert.match(error('A 1 1\nB 2 2'), /al menos tres/);
  assert.match(error('A 1 1\nB 2 2\nC 3 3'), /misma recta/);
});
