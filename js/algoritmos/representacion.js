(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const grafos = window.CC2.dominio.grafo;
  const { REPRESENTACIONES } = grafos;

  // Representación matricial (CLAUDE.md 5.13): la matriz y su estructura de
  // adyacencia **se llenan una fila por paso** (maqueta A, elegida por el
  // usuario el 2026-10-23). En cada fila se dice qué lleva 1, qué lleva −1 y
  // qué lleva 0, y por qué; al final, la propiedad que se lee de la matriz
  // completa. La matriz no cambia de un paso a otro —solo cuántas filas se
  // ven—, así que todos los pasos comparten la misma.

  const lista = (nombres) => (nombres.length === 0 ? '—'
    : nombres.length === 1 ? nombres[0]
      : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`);
  const conComas = (nombres) => (nombres.length ? nombres.join(', ') : '—');

  const TITULOS = {
    [REPRESENTACIONES.INCIDENCIA]: 'Matriz de incidencia',
    [REPRESENTACIONES.ADYACENCIA_VERTICES]: 'Matriz de adyacencia de vértices',
    [REPRESENTACIONES.ADYACENCIA_ARISTAS]: 'Matriz de adyacencia de aristas'
  };

  function recorrer(grafo, { representacion, caso = 1 }) {
    const matriz = grafos.representar(grafo, { representacion, caso });
    const pasos = [];
    const titulo = TITULOS[representacion];
    const deCaso = matriz.dirigido && representacion !== REPRESENTACIONES.INCIDENCIA ? `, caso ${matriz.caso}` : '';
    const ejes = representacion === REPRESENTACIONES.INCIDENCIA
      ? 'filas los vértices y columnas las aristas'
      : representacion === REPRESENTACIONES.ADYACENCIA_VERTICES
        ? 'filas y columnas los vértices'
        : 'filas y columnas las aristas';
    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      representacion: matriz,
      filasLlenas: 0,
      mensaje: `${titulo}${deCaso}: ${ejes}.`
    }));

    let distintos = 0;
    matriz.filas.forEach((fila, indice) => {
      const valores = matriz.valores[indice];
      const con = (buscado) => matriz.columnas.filter((_, k) => valores[k] === buscado).map((c) => c.etiqueta);
      const unos = con(1);
      const menos = con(-1);
      const ceros = matriz.columnas.filter((c, k) => valores[k] === 0 && c.clave !== fila.clave).map((c) => c.etiqueta);
      distintos += unos.length + menos.length;
      const { lineas, mensaje } = explicarFila({ representacion, matriz, fila, unos, menos, ceros });
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        representacion: matriz,
        filasLlenas: indice + 1,
        filaActual: indice,
        distintos,
        calculo: lineas.map((linea, k) => ({ ...linea, activa: k === 0 })),
        tituloCalculo: fila.clase === 'vertice' ? `Vértice ${fila.etiqueta}` : `Arista ${fila.etiqueta}`,
        mensaje
      }));
    });

    const { lineas, mensaje } = propiedad({ representacion, matriz, grafo });
    pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      representacion: matriz,
      filasLlenas: matriz.filas.length,
      distintos,
      calculo: lineas.map((linea, k) => ({ ...linea, activa: k === lineas.length - 1 })),
      tituloCalculo: titulo,
      mensaje
    }));
    return pasos;
  }

  function explicarFila({ representacion, matriz, fila, unos, menos, ceros }) {
    const e = fila.etiqueta;
    if (representacion === REPRESENTACIONES.INCIDENCIA) {
      if (!matriz.dirigido) {
        return {
          lineas: [
            { etiqueta: `Inciden en ${e}`, expresion: conComas(unos), resultado: '1' },
            { etiqueta: 'No inciden', expresion: conComas(ceros), resultado: '0' },
            { etiqueta: `Grado de ${e}`, expresion: 'unos de la fila', resultado: String(unos.length) }
          ],
          mensaje: `Fila del vértice ${e}: ${unos.length ? `${unos.length === 1 ? 'incide' : 'inciden'} ${lista(unos)}, así que ${unos.length === 1 ? 'lleva' : 'llevan'} 1` : 'no incide ninguna arista'}; las demás, 0. Grado de ${e}: ${unos.length}.`
        };
      }
      return {
        lineas: [
          { etiqueta: `Salen de ${e}`, expresion: conComas(unos), resultado: '1' },
          { etiqueta: `Llegan a ${e}`, expresion: conComas(menos), resultado: '−1' },
          { etiqueta: 'No inciden', expresion: conComas(ceros), resultado: '0' }
        ],
        mensaje: `Fila del vértice ${e}: ${unos.length ? `${unos.length === 1 ? 'sale' : 'salen'} ${lista(unos)} (1)` : 'no sale ninguna arista'}; ${menos.length ? `${menos.length === 1 ? 'llega' : 'llegan'} ${lista(menos)} (−1)` : 'no llega ninguna'}.`
      };
    }
    if (representacion === REPRESENTACIONES.ADYACENCIA_VERTICES) {
      if (!matriz.dirigido) {
        return {
          lineas: [
            { etiqueta: `Adyacentes a ${e}`, expresion: conComas(unos), resultado: '1' },
            { etiqueta: 'No adyacentes', expresion: conComas(ceros), resultado: '0' },
            { etiqueta: `Grado de ${e}`, expresion: 'unos de la fila', resultado: String(unos.length) }
          ],
          mensaje: `Fila del vértice ${e}: ${unos.length ? `${unos.length === 1 ? 'es adyacente' : 'son adyacentes'} ${lista(unos)}` : 'no tiene adyacentes'}; los demás, 0. Grado de ${e}: ${unos.length}.`
        };
      }
      if (matriz.caso === 1) {
        return {
          lineas: [
            { etiqueta: `De ${e} se va a`, expresion: conComas(unos), resultado: '1' },
            { etiqueta: 'A los demás no', expresion: conComas(ceros), resultado: '0' }
          ],
          mensaje: `Fila del vértice ${e}: ${unos.length ? `de ${e} sale una arista hacia ${lista(unos)}` : `de ${e} no sale ninguna arista`}; los demás, 0.`
        };
      }
      return {
        lineas: [
          { etiqueta: `Sale de ${e} hacia`, expresion: conComas(unos), resultado: '1' },
          { etiqueta: `Llega a ${e} desde`, expresion: conComas(menos), resultado: '−1' },
          { etiqueta: 'Sin arista', expresion: conComas(ceros), resultado: '0' }
        ],
        mensaje: `Fila del vértice ${e}: ${unos.length ? `sale hacia ${lista(unos)} (1)` : 'no sale hacia nadie'}; ${menos.length ? `llega desde ${lista(menos)} (−1)` : 'no llega desde nadie'}.`
      };
    }
    if (!matriz.dirigido || matriz.caso === 1) {
      return {
        lineas: [
          { etiqueta: `Comparten un vértice con ${e}`, expresion: conComas(unos), resultado: '1' },
          { etiqueta: 'No comparten', expresion: conComas(ceros), resultado: '0' }
        ],
        mensaje: `Fila de la arista ${e}: ${unos.length ? `comparte un vértice con ${lista(unos)}` : 'no comparte vértice con ninguna'}; las demás, 0.`
      };
    }
    return {
      lineas: [
        { etiqueta: 'Una llega y la otra sale', expresion: conComas(unos), resultado: '1' },
        { etiqueta: 'Las dos llegan o salen', expresion: conComas(menos), resultado: '−1' },
        { etiqueta: 'No comparten', expresion: conComas(ceros), resultado: '0' }
      ],
      mensaje: `Fila de la arista ${e}: en el vértice que comparten, ${unos.length ? `con ${lista(unos)} una llega y la otra sale (1)` : 'con ninguna una llega y la otra sale'}; ${menos.length ? `con ${lista(menos)} las dos llegan o las dos salen (−1)` : 'con ninguna las dos llegan o salen'}.`
    };
  }

  // Lo que se lee de la matriz completa: la propiedad que el docente nombra
  // en su documento, comprobada sobre esta matriz.
  function propiedad({ representacion, matriz, grafo }) {
    const n = grafo.aristas.length;
    const suma = (fila) => fila.reduce((total, v) => total + Math.abs(v), 0);
    if (representacion === REPRESENTACIONES.INCIDENCIA) {
      const grados = matriz.valores.map(suma);
      const total = grados.reduce((a, b) => a + b, 0);
      if (!matriz.dirigido) {
        return {
          lineas: [
            { etiqueta: 'Cada columna', expresion: 'una arista toca dos vértices', resultado: 'dos unos' },
            { etiqueta: 'Suma de los grados', expresion: grados.join(' + '), resultado: `${total} = 2 × ${n}` }
          ],
          mensaje: `Matriz de incidencia completa: cada columna tiene dos unos —cada arista toca dos vértices—, y la suma de los grados es ${total}, el doble de las ${n} aristas.`
        };
      }
      return {
        lineas: [
          { etiqueta: 'Cada columna', expresion: 'de dónde sale y a dónde llega', resultado: 'un 1 y un −1' },
          { etiqueta: 'Cada columna suma', expresion: '1 + (−1)', resultado: '0' }
        ],
        mensaje: 'Matriz de incidencia completa: cada columna tiene un 1, donde la arista sale, y un −1, donde llega.'
      };
    }
    const simetrica = matriz.valores.every((fila, i) => fila.every((v, k) => v === matriz.valores[k][i]));
    const antisimetrica = matriz.valores.every((fila, i) => fila.every((v, k) => v === -matriz.valores[k][i]));
    const unos = matriz.valores.flat().filter((v) => v === 1).length;
    if (representacion === REPRESENTACIONES.ADYACENCIA_VERTICES) {
      if (!matriz.dirigido) {
        return {
          lineas: [
            { etiqueta: 'Simétrica', expresion: 'a_ij = a_ji', resultado: 'sí' },
            { etiqueta: 'Unos en total', expresion: `2 × ${n} aristas`, resultado: String(unos) }
          ],
          mensaje: `Matriz de adyacencia completa: es simétrica —si i es adyacente a j, j lo es a i—, y tiene ${unos} unos, dos por cada una de las ${n} aristas.`
        };
      }
      if (matriz.caso === 1) {
        return {
          lineas: [
            { etiqueta: 'Simétrica', expresion: 'a_ij = a_ji', resultado: simetrica ? 'sí' : 'no' },
            { etiqueta: 'Unos en total', expresion: 'uno por arista', resultado: String(unos) }
          ],
          mensaje: `Matriz de adyacencia completa: ${simetrica ? 'aquí es simétrica, pero' : 'no es simétrica:'} en un dirigido cada 1 es una arista de la fila a la columna, ${unos} en total.`
        };
      }
      return {
        lineas: [
          { etiqueta: 'Antisimétrica', expresion: 'a_ij = −a_ji', resultado: antisimetrica ? 'sí' : 'no' }
        ],
        mensaje: `Matriz de adyacencia completa: ${antisimetrica ? 'es antisimétrica: el 1 de una arista en su fila es −1 en la otra.' : 'cada arista deja un 1 en la fila de donde sale y un −1 en la de donde llega.'}`
      };
    }
    return {
      lineas: [
        { etiqueta: 'Simétrica', expresion: 'a_ij = a_ji', resultado: simetrica ? 'sí' : 'no' },
        { etiqueta: 'Diagonal', expresion: 'una arista no es adyacente a sí misma', resultado: '0' }
      ],
      mensaje: `Matriz de adyacencia de aristas completa: ${simetrica ? 'es simétrica —si x comparte vértice con y, y lo comparte con x— ' : ''}y la diagonal es 0.`
    };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.representacion = { recorrer, TITULOS };
})();
