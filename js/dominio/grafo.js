(function () {
  // Grafos (CLAUDE.md 5.12): el grafo que escribe el estudiante, la matriz con
  // que arranca Floyd y los conceptos que se leen de la matriz final.
  //
  // El grafo se escribe como lo dicta el docente: una arista por renglón,
  // origen, destino y —si tiene— su peso. **Sin peso vale 1** («el grafo no
  // ponderado implícitamente el peso de sus aristas es 1», hoja de Floyd del
  // docente). Los vértices salen de las aristas, y se nombran con números,
  // como en todos sus ejemplos resueltos.

  const TIPOS = Object.freeze({ DIRIGIDO: 'dirigido', NO_DIRIGIDO: 'no-dirigido' });

  // Más vértices no caben en el lienzo con su matriz al lado, y Floyd haría
  // más de 64 pasos (un paso por pareja j, i: n²).
  const VERTICES_MAXIMOS = 8;
  const VERTICE_MAXIMO = 99;
  const PESO_MAXIMO = 999;

  // Los vértices aislados no se pueden escribir como aristas: un grafo con
  // un vértice suelto se escribe con ese vértice solo en su renglón.
  function leerGrafo(texto, tipo = TIPOS.DIRIGIDO) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    if (renglones.length === 0) {
      return { valido: false, mensaje: 'Escriba al menos una arista: origen y destino, por ejemplo «1 2».' };
    }
    const vertices = new Set();
    const aristas = [];
    const vistas = new Map();
    let conPesos = false;
    for (const [indice, renglon] of renglones.entries()) {
      const partes = renglon.split(/[\s,\-–>]+/).filter(Boolean);
      const donde = `Renglón ${indice + 1} («${renglon}»)`;
      if (partes.length === 1) {
        const vertice = leerVertice(partes[0]);
        if (vertice === null) return { valido: false, mensaje: `${donde}: un vértice es un número entero de 1 a ${VERTICE_MAXIMO}.` };
        vertices.add(vertice);
        continue;
      }
      if (partes.length > 3) {
        return { valido: false, mensaje: `${donde}: una arista lleva origen, destino y, si tiene, su peso.` };
      }
      const origen = leerVertice(partes[0]);
      const destino = leerVertice(partes[1]);
      if (origen === null || destino === null) {
        return { valido: false, mensaje: `${donde}: un vértice es un número entero de 1 a ${VERTICE_MAXIMO}.` };
      }
      // Un lazo no cambia ninguna distancia —la diagonal de Floyd es 0— y en
      // la matriz no tendría dónde escribirse.
      if (origen === destino) {
        return { valido: false, mensaje: `${donde}: un lazo (de un vértice a sí mismo) no cambia ninguna distancia; quítelo.` };
      }
      let peso = 1;
      if (partes.length === 3) {
        peso = Number(partes[2]);
        if (!Number.isInteger(peso) || peso < 0 || peso > PESO_MAXIMO) {
          return { valido: false, mensaje: `${donde}: el peso es un entero de 0 a ${PESO_MAXIMO}.` };
        }
        conPesos = true;
      }
      const clave = tipo === TIPOS.DIRIGIDO
        ? `${origen}>${destino}`
        : `${Math.min(origen, destino)}-${Math.max(origen, destino)}`;
      if (vistas.has(clave)) {
        return { valido: false, mensaje: `${donde}: esa arista ya está en el renglón ${vistas.get(clave) + 1}.` };
      }
      vistas.set(clave, indice);
      vertices.add(origen);
      vertices.add(destino);
      aristas.push({ origen, destino, peso });
    }
    if (vertices.size > VERTICES_MAXIMOS) {
      return { valido: false, mensaje: `El grafo tiene ${vertices.size} vértices; caben hasta ${VERTICES_MAXIMOS}.` };
    }
    if (aristas.length === 0) {
      return { valido: false, mensaje: 'Escriba al menos una arista: origen y destino, por ejemplo «1 2».' };
    }
    return {
      valido: true,
      grafo: { tipo, vertices: [...vertices].sort((a, b) => a - b), aristas, conPesos }
    };
  }

  function leerVertice(texto) {
    const valor = Number(texto);
    return /^\d+$/.test(texto) && valor >= 1 && valor <= VERTICE_MAXIMO ? valor : null;
  }

  // El texto tal como se guarda y se vuelve a mostrar: un renglón por arista,
  // con el peso solo si el grafo lo tiene.
  function comoTexto(grafo) {
    const aislados = grafo.vertices.filter((v) => !grafo.aristas.some((a) => a.origen === v || a.destino === v));
    return grafo.aristas
      .map((a) => (grafo.conPesos ? `${a.origen} ${a.destino} ${a.peso}` : `${a.origen} ${a.destino}`))
      .concat(aislados.map(String))
      .join('\n');
  }

  // La matriz con que arranca Floyd (hoja del docente): 0 en la diagonal, el
  // peso de cada arista, e ∞ donde no hay. Filas y columnas en el orden de
  // `vertices`. Un grafo no dirigido pone la arista en los dos sentidos.
  function matrizInicial(grafo) {
    const n = grafo.vertices.length;
    const posicion = new Map(grafo.vertices.map((v, i) => [v, i]));
    const matriz = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => (i === k ? 0 : Infinity)));
    for (const { origen, destino, peso } of grafo.aristas) {
      const i = posicion.get(origen);
      const k = posicion.get(destino);
      matriz[i][k] = Math.min(matriz[i][k], peso);
      if (grafo.tipo === TIPOS.NO_DIRIGIDO) matriz[k][i] = Math.min(matriz[k][i], peso);
    }
    return matriz;
  }

  // Los conceptos del docente, leídos de la matriz de distancias mínimas:
  //
  //   distancia de un vértice — la suma de su fila
  //   excentricidad           — el mayor valor de su fila
  //   radio / diámetro        — la menor / la mayor excentricidad
  //   centro                  — los vértices de excentricidad mínima
  //   mediana                 — los vértices de distancia mínima
  //
  // Piden un grafo conexo (en un dirigido, que desde cada vértice se llegue
  // a todos): con un ∞ en la matriz no hay excentricidad que tomar. Entonces
  // devuelve `conexo: false` y nada más.
  function conceptos(matriz, vertices) {
    const conexo = matriz.every((fila) => fila.every(Number.isFinite));
    if (!conexo) return { conexo: false };
    const distancias = matriz.map((fila) => fila.reduce((suma, valor) => suma + valor, 0));
    const excentricidades = matriz.map((fila) => Math.max(...fila));
    const radio = Math.min(...excentricidades);
    const diametro = Math.max(...excentricidades);
    const distanciaMinima = Math.min(...distancias);
    const centro = vertices.filter((_, i) => excentricidades[i] === radio);
    const mediana = vertices.filter((_, i) => distancias[i] === distanciaMinima);
    // Entre qué vértices se da el diámetro: el primer par, en orden, que lo
    // alcanza. En un no dirigido (i, k) y (k, i) son el mismo par.
    let parDiametro = null;
    for (let i = 0; i < matriz.length && !parDiametro; i++) {
      for (let k = 0; k < matriz.length && !parDiametro; k++) {
        if (matriz[i][k] === diametro && i !== k) parDiametro = [vertices[i], vertices[k]];
      }
    }
    return { conexo: true, distancias, excentricidades, radio, diametro, centro, mediana, distanciaMinima, parDiametro };
  }

  // Las aristas del subgrafo inducido por `seleccion`: las que tienen sus dos
  // extremos dentro. Es lo que dibuja el docente para el centro y la mediana.
  function aristasInducidas(grafo, seleccion) {
    const dentro = new Set(seleccion);
    return grafo.aristas.filter((a) => dentro.has(a.origen) && dentro.has(a.destino));
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.grafo = {
    TIPOS, VERTICES_MAXIMOS, leerGrafo, comoTexto, matrizInicial, conceptos, aristasInducidas
  };
})();
