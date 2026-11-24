(function () {
  // Caminos mínimos desde un vértice (CLAUDE.md 5.20): Dijkstra, y Bellman con
  // su función ordinal, como en las notas de clase del docente
  // (`NotasClase grafos.pdf`).
  //
  //   función ordinal  numera de 0 a n − 1 los vértices de un grafo dirigido
  //                    sin ciclos: el 0 es uno sin predecesores, y cada
  //                    siguiente, uno cuyos predecesores ya tienen número
  //   Bellman          λ₀ = 0 y, para j de 1 a n − 1, λⱼ = min(λᵢ + vᵢⱼ)
  //   Dijkstra         etiquetas [d, n], d la distancia acumulada y n el
  //                    predecesor, temporales hasta que se hacen permanentes
  //
  // Dijkstra sí acepta ciclos, y grafos no dirigidos.
  const { TIPOS } = window.CC2.dominio.grafo;
  const { ordenNatural } = window.CC2.dominio.operaciones;

  const ALGORITMOS = Object.freeze({ FLOYD: 'floyd', DIJKSTRA: 'dijkstra', BELLMAN: 'bellman' });
  const VERTICES_MAXIMOS = 8;
  const PESO_MAXIMO = 999;
  const VERTICE = /^[0-9]{1,2}$|^[a-zA-Z][0-9]?$/;

  // Como los demás: «origen destino [peso]», sin peso vale 1. Aquí los
  // vértices pueden ser 0 —el docente numera desde 0— o letras, y por eso no
  // lo lee `dominio.grafo`, donde una letra delante es el nombre de la arista.
  function leerGrafo(texto, tipo = TIPOS.DIRIGIDO) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    const vertices = new Set();
    const aristas = [];
    const vistas = new Map();
    let conPesos = false;
    const error = (mensaje) => ({ valido: false, mensaje });
    for (const [indice, renglon] of renglones.entries()) {
      const donde = `Renglón ${indice + 1} («${renglon}»)`;
      const pesoMalo = `${donde}: el peso es un entero de 0 a ${PESO_MAXIMO}.`;
      // El guion separa vértices («0-1»); delante del peso sería un negativo.
      if (/\s[-−]\s*[0-9]+\s*$/.test(renglon)) return error(pesoMalo);
      const partes = renglon.split(/[\s,\-–>]+/).filter(Boolean);
      if (partes.length > 3) return error(`${donde}: una arista lleva origen, destino y, si tiene, su peso.`);
      const [origen, destino, textoPeso] = partes;
      if (![origen, destino].every((v) => v === undefined || VERTICE.test(v))) {
        return error(`${donde}: un vértice es un número de hasta dos cifras o una letra (0, 12, A, x1).`);
      }
      vertices.add(origen);
      if (destino === undefined) continue;
      vertices.add(destino);
      if (origen === destino) return error(`${donde}: un lazo (de un vértice a sí mismo) no cambia ninguna distancia; quítelo.`);
      let peso = 1;
      if (textoPeso !== undefined) {
        peso = Number(textoPeso);
        if (!/^[0-9]+$/.test(textoPeso) || peso > PESO_MAXIMO) return error(pesoMalo);
        conPesos = true;
      }
      const clave = (tipo === TIPOS.DIRIGIDO ? [origen, destino] : [origen, destino].sort()).join('|');
      if (vistas.has(clave)) return error(`${donde}: esa arista ya está en el renglón ${vistas.get(clave) + 1}.`);
      vistas.set(clave, indice);
      aristas.push({ origen, destino, peso, nombre: `a${aristas.length + 1}` });
    }
    if (aristas.length === 0) return error('Escriba al menos una arista: origen, destino y peso, por ejemplo «0 1 2».');
    if (vertices.size > VERTICES_MAXIMOS) return error(`El grafo tiene ${vertices.size} vértices; caben hasta ${VERTICES_MAXIMOS}.`);
    return { valido: true, grafo: { tipo, vertices: [...vertices].sort(ordenNatural), aristas, conPesos } };
  }

  function comoTexto(grafo) {
    const conArista = new Set(grafo.aristas.flatMap((a) => [a.origen, a.destino]));
    return grafo.aristas.map((a) => `${a.origen} ${a.destino}${grafo.conPesos ? ` ${a.peso}` : ''}`)
      .concat(grafo.vertices.filter((v) => !conArista.has(v)))
      .join('\n');
  }

  // A dónde se llega desde un vértice, en el orden de los vértices.
  function salidas(grafo, desde) {
    const lista = [];
    for (const arista of grafo.aristas) {
      if (arista.origen === desde) lista.push({ arista, hasta: arista.destino });
      else if (grafo.tipo !== TIPOS.DIRIGIDO && arista.destino === desde) lista.push({ arista, hasta: arista.origen });
    }
    return lista.sort((x, y) => ordenNatural(x.hasta, y.hasta));
  }

  const llegadas = (grafo, hasta) => grafo.aristas.filter((a) => a.destino === hasta);

  // La función ordinal. Entre varios que se pueden numerar, el primero en
  // orden: el docente lee el dibujo de izquierda a derecha y de arriba abajo,
  // y aquí el lugar en el dibujo sale del orden de los vértices. Devuelve
  // `{ orden, candidatos }`, o `{ ciclo }` si no es aplicable.
  function funcionOrdinal(grafo) {
    const orden = [];
    const candidatos = [];
    while (orden.length < grafo.vertices.length) {
      const posibles = grafo.vertices.filter((v) => !orden.includes(v) && llegadas(grafo, v).every((a) => orden.includes(a.origen)));
      if (posibles.length === 0) return { ciclo: buscarCiclo(grafo, orden) };
      candidatos.push(posibles);
      orden.push(posibles[0]);
    }
    return { orden, candidatos };
  }

  // Cada vértice sin numerar tiene un predecesor sin numerar: caminando hacia
  // atrás se cierra un ciclo.
  function buscarCiclo(grafo, numerados) {
    const camino = [grafo.vertices.find((v) => !numerados.includes(v))];
    for (;;) {
      const anterior = llegadas(grafo, camino[camino.length - 1]).find((a) => !numerados.includes(a.origen)).origen;
      const en = camino.indexOf(anterior);
      camino.push(anterior);
      if (en !== -1) return camino.slice(en).reverse();
    }
  }

  // El camino hasta un vértice, siguiendo los predecesores; null si no hay.
  function ruta(predecesores, inicio, hasta) {
    const camino = [hasta];
    while (camino[0] !== inicio) {
      const anterior = predecesores[camino[0]];
      if (anterior === undefined || anterior === null) return null;
      camino.unshift(anterior);
    }
    return camino;
  }

  // Las aristas que recorre un camino.
  function aristasDe(grafo, camino) {
    return camino.slice(1).map((v, i) => grafo.aristas.find((a) => (a.origen === camino[i] && a.destino === v)
      || (grafo.tipo !== TIPOS.DIRIGIDO && a.destino === camino[i] && a.origen === v)));
  }

  window.CC2.dominio.caminos = {
    ALGORITMOS, VERTICES_MAXIMOS, leerGrafo, comoTexto, salidas, llegadas, funcionOrdinal, ruta, aristasDe
  };
})();
