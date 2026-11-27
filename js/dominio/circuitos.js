(function () {
  // **Circuitos y conjuntos de corte** (2026-11-26, CLAUDE.md 5.22), dentro
  // del árbol de expansión: la matriz de circuitos, la de circuitos
  // fundamentales, la de conjuntos de corte y la de cortes fundamentales, cada
  // fila con su circuito o su corte. La referencia es el taller del usuario
  // (docs/Grafos/Taller Grafo Árbol Exp.pdf), que sigue las definiciones:
  //
  //   circuito                camino cerrado que no repite vértices
  //   circuito fundamental    una cuerda y el camino del árbol entre sus
  //                           extremos: uno por cuerda
  //   conjunto de corte       un conjunto mínimo de aristas que, quitadas,
  //                           dejan el grafo en dos partes; mínimo es que las
  //                           dos partes sigan conexas por dentro
  //   corte fundamental       una rama y las cuerdas que cruzan entre las dos
  //                           partes en que su salida deja el árbol: uno por
  //                           rama
  //
  // El documento de apoyo del docente dibuja como fundamentales las caras del
  // dibujo y los cortes que aíslan un vértice; el taller, no.
  //
  // Las columnas son las aristas en el orden escrito, como en el taller, y las
  // filas van **de las más cortas a las más largas**, y entre iguales en el
  // orden de sus aristas: así salen los 12 circuitos del taller, en su orden.

  // Hasta cuántos se muestran uno por uno: cada uno es un paso.
  const MAXIMO = 40;

  const DIGITOS = '₀₁₂₃₄₅₆₇₈₉';
  const subindice = (n) => String(n).replace(/\d/g, (d) => DIGITOS[d]);

  const otroExtremo = (a, v) => (a.origen === v ? a.destino : a.origen);

  // Los de menos aristas primero; entre iguales, por el orden de sus aristas.
  function enOrden(grafo) {
    const indice = new Map(grafo.aristas.map((a, i) => [a, i]));
    return (x, y) => {
      if (x.aristas.length !== y.aristas.length) return x.aristas.length - y.aristas.length;
      const ix = x.aristas.map((a) => indice.get(a)).sort((p, q) => p - q);
      const iy = y.aristas.map((a) => indice.get(a)).sort((p, q) => p - q);
      for (let i = 0; i < ix.length; i++) if (ix[i] !== iy[i]) return ix[i] - iy[i];
      return 0;
    };
  }

  // Las aristas de un conjunto, en el orden del grafo.
  const ordenadas = (grafo, conjunto) => grafo.aristas.filter((a) => conjunto.includes(a));

  // **Todos los circuitos.** Desde cada vértice se buscan los caminos que
  // vuelven a él pasando solo por vértices que van después: así cada
  // circuito se encuentra desde su primer vértice, en sus dos sentidos, y se
  // queda uno. El recorrido es el de ese camino.
  function circuitos(grafo) {
    const { vertices } = grafo;
    const posicion = new Map(vertices.map((v, i) => [v, i]));
    const vistos = new Map();
    let trabajo = 0;
    for (const inicio of vertices) {
      const buscar = (v, camino, aristas) => {
        if (++trabajo > 400000 || vistos.size > MAXIMO) return;
        for (const a of grafo.aristas) {
          if (a.origen !== v && a.destino !== v) continue;
          if (aristas.includes(a)) continue;
          const w = otroExtremo(a, v);
          if (w === inicio && aristas.length >= 2) {
            const todas = aristas.concat(a);
            const clave = todas.map((x) => grafo.aristas.indexOf(x)).sort((p, q) => p - q).join(',');
            if (!vistos.has(clave)) vistos.set(clave, { aristas: todas, recorrido: camino.concat(inicio) });
            continue;
          }
          if (posicion.get(w) <= posicion.get(inicio) || camino.includes(w)) continue;
          buscar(w, camino.concat(w), aristas.concat(a));
        }
      };
      buscar(inicio, [inicio], []);
    }
    const lista = [...vistos.values()].sort(enOrden(grafo));
    return {
      demasiados: vistos.size > MAXIMO || trabajo > 400000,
      lista: lista.map((c, i) => ({
        nombre: `C${subindice(i + 1)}`,
        aristas: ordenadas(grafo, c.aristas),
        recorrido: c.recorrido,
        vertices: vertices.filter((v) => c.recorrido.includes(v))
      }))
    };
  }

  // Si un conjunto de vértices es conexo usando solo las aristas dadas.
  function conexo(conjunto, aristas) {
    if (conjunto.length === 0) return false;
    const dentro = new Set(conjunto);
    const vistos = new Set([conjunto[0]]);
    const pila = [conjunto[0]];
    while (pila.length) {
      const v = pila.pop();
      for (const a of aristas) {
        if (a.origen !== v && a.destino !== v) continue;
        const w = otroExtremo(a, v);
        if (dentro.has(w) && !vistos.has(w)) { vistos.add(w); pila.push(w); }
      }
    }
    return vistos.size === dentro.size;
  }

  // **Todos los conjuntos de corte.** Cada uno separa el grafo en dos partes,
  // y es mínimo justo cuando las dos siguen conexas por dentro: si una se
  // partiera, sobraría alguna de sus aristas. Se prueban las partes que
  // tienen el primer vértice, así cada corte sale una vez.
  function cortes(grafo) {
    const { vertices, aristas } = grafo;
    const resto = vertices.slice(1);
    const lista = [];
    for (let mascara = 0; mascara < 2 ** resto.length - 1; mascara++) {
      const lado = [vertices[0], ...resto.filter((_, i) => mascara & (1 << i))];
      const otro = vertices.filter((v) => !lado.includes(v));
      if (!conexo(lado, aristas) || !conexo(otro, aristas)) continue;
      const cortadas = aristas.filter((a) => lado.includes(a.origen) !== lado.includes(a.destino));
      lista.push({ aristas: cortadas, lado, otro });
    }
    lista.sort(enOrden(grafo));
    return {
      demasiados: lista.length > MAXIMO,
      lista: lista.map((c, i) => ({ ...c, nombre: `Cc${subindice(i + 1)}` }))
    };
  }

  // El camino del árbol entre dos vértices: sus aristas, en orden.
  function caminoEnArbol(arbol, desde, hasta) {
    const buscar = (v, previo, recorridas, vertices) => {
      if (v === hasta) return { aristas: recorridas, vertices };
      for (const a of arbol) {
        if (a === previo || (a.origen !== v && a.destino !== v)) continue;
        const w = otroExtremo(a, v);
        const hallado = buscar(w, a, recorridas.concat(a), vertices.concat(w));
        if (hallado) return hallado;
      }
      return null;
    };
    return buscar(desde, null, [], [desde]);
  }

  // **Circuitos fundamentales**: uno por cuerda, en el orden de las cuerdas.
  // El circuito es la cuerda y el camino del árbol entre sus extremos.
  function circuitosFundamentales(grafo, arbol) {
    const cuerdas = grafo.aristas.filter((a) => !arbol.includes(a));
    return cuerdas.map((cuerda, i) => {
      const camino = caminoEnArbol(arbol, cuerda.destino, cuerda.origen);
      return {
        nombre: `Cf${subindice(i + 1)}`,
        cuerda,
        camino: camino.aristas,
        aristas: ordenadas(grafo, camino.aristas.concat(cuerda)),
        recorrido: [cuerda.origen, ...camino.vertices],
        vertices: grafo.vertices.filter((v) => camino.vertices.includes(v))
      };
    });
  }

  // **Cortes fundamentales**: uno por rama, en el orden de las ramas. Sin la
  // rama, el árbol queda en dos partes —la del extremo de origen y la del
  // otro—, y el corte son las aristas del grafo que cruzan entre ellas: la
  // rama y algunas cuerdas.
  function cortesFundamentales(grafo, arbol) {
    const ramas = grafo.aristas.filter((a) => arbol.includes(a));
    return ramas.map((rama, i) => {
      const sin = arbol.filter((a) => a !== rama);
      const lado = grafo.vertices.filter((v) => v === rama.origen || caminoEnArbol(sin, rama.origen, v));
      const otro = grafo.vertices.filter((v) => !lado.includes(v));
      return {
        nombre: `Ccf${subindice(i + 1)}`,
        rama,
        aristas: grafo.aristas.filter((a) => lado.includes(a.origen) !== lado.includes(a.destino)),
        lado,
        otro
      };
    });
  }

  // La matriz, con la forma de la representación matricial (CLAUDE.md 5.13)
  // para dibujarla con la misma tabla y su estructura de adyacencia: una fila
  // por circuito o corte, una columna por arista —o por vértice—, 1 si está.
  function matriz(grafo, lista, { titulo, porVertices = false } = {}) {
    const columnas = porVertices
      ? grafo.vertices.map((v) => ({ clave: v, etiqueta: String(v) }))
      : grafo.aristas.map((a) => ({ clave: a.nombre, etiqueta: a.nombre }));
    return {
      titulo,
      filas: lista.map((c) => ({ clave: c.nombre, etiqueta: c.nombre, clase: 'circuito' })),
      columnas,
      valores: lista.map((c) => (porVertices
        ? grafo.vertices.map((v) => (c.vertices.includes(v) ? 1 : 0))
        : grafo.aristas.map((a) => (c.aristas.includes(a) ? 1 : 0))))
    };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.circuitos = {
    MAXIMO, circuitos, cortes, circuitosFundamentales, cortesFundamentales, caminoEnArbol, matriz, conexo
  };
})();
