(function () {
  // Pareamientos (CLAUDE.md 5.17), como en las hojas del docente (2026-11-03,
  // `docs/Inf. Pareamientos 29-10-26/`; él cita a Morales, Gómez y Cáceres,
  // 2016). También se llaman emparejamientos o matchings. Un pareamiento M es
  // un conjunto de aristas sin ningún vértice en común:
  //
  //   saturado        vértice extremo de una arista de M; libre, el que no
  //   maximal         no le cabe ninguna arista más (o inextensible)
  //   máximo          el de más aristas; ν(G) es ese número
  //   perfecto        satura todos los vértices (óptimo, en las hojas)
  //   camino alternado   alterna aristas de M y de fuera
  //   camino M-aumentado alternado, de un vértice libre a otro libre
  //
  // «Completo» queda fuera: la hoja dice «no deja ninguna arista expuesta»,
  // el docente anotó «Revisar otro concepto» y su definición siguiente es
  // solo para bipartitos (decisión del usuario, 2026-11-03).

  const MODOS = Object.freeze({ COMPROBAR: 'comprobar', MAXIMO: 'maximo' });

  // El grafo más grande de las hojas tiene 12 vértices.
  const VERTICES_MAXIMOS = 12;

  const VERTICE = /^[0-9]{1,2}$|^[a-zA-Z][0-9]?$/;
  const NOMBRE = /^[a-zA-Z][0-9]{0,2}$/;

  // a, b, … z, y después aa, ab…
  function nombreEnOrden(indice) {
    const letra = (i) => String.fromCharCode(97 + i);
    return indice < 26 ? letra(indice) : letra(Math.floor(indice / 26) - 1) + letra(indice % 26);
  }

  // El grafo, un renglón por arista: «a I E», con su nombre delante, o «I E»,
  // y entonces lo pone el orden. Un vértice solo en su renglón queda aislado.
  // **Los vértices pueden ser números o letras**, porque el ejemplo central
  // de las hojas usa I, M, S, L…, y por eso con dos partes no hay nombre: la
  // primera es un vértice. Van en el orden en que aparecen: así se escoge
  // cómo quedan alrededor del círculo.
  function leerGrafo(texto) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    const vertices = [];
    const aristas = [];
    const vistas = new Map();
    const nombres = new Set();
    for (const [indice, renglon] of renglones.entries()) {
      const partes = renglon.split(/[\s,\-–>]+/).filter(Boolean);
      const donde = `Renglón ${indice + 1} («${renglon}»)`;
      if (partes.length > 3) return { valido: false, mensaje: `${donde}: una arista lleva su nombre, si se quiere, y sus dos vértices.` };
      const nombre = partes.length === 3 ? partes.shift() : null;
      if (nombre !== null) {
        if (!NOMBRE.test(nombre)) return { valido: false, mensaje: `${donde}: el nombre de una arista es una letra, o una letra y hasta dos cifras más.` };
        if (nombres.has(nombre)) return { valido: false, mensaje: `${donde}: ya hay una arista ${nombre}.` };
        nombres.add(nombre);
      }
      if (!partes.every((p) => VERTICE.test(p))) {
        return { valido: false, mensaje: `${donde}: un vértice es un número de hasta dos cifras o una letra (1, 12, A, x1).` };
      }
      for (const v of partes) if (!vertices.includes(v)) vertices.push(v);
      if (partes.length === 1) continue;
      const [origen, destino] = partes;
      if (origen === destino) return { valido: false, mensaje: `${donde}: un pareamiento no usa lazos; quítelo.` };
      const clave = [origen, destino].sort().join('|');
      if (vistas.has(clave)) return { valido: false, mensaje: `${donde}: esa arista ya está en el renglón ${vistas.get(clave) + 1}.` };
      vistas.set(clave, indice);
      aristas.push({ origen, destino, peso: 1, nombre, nombreEscrito: nombre !== null });
    }
    if (aristas.length === 0) return { valido: false, mensaje: 'Escriba al menos una arista: sus dos vértices, por ejemplo «1 2».' };
    if (vertices.length > VERTICES_MAXIMOS) {
      return { valido: false, mensaje: `El grafo tiene ${vertices.length} vértices; caben hasta ${VERTICES_MAXIMOS}.` };
    }
    let siguiente = 0;
    for (const arista of aristas) {
      if (arista.nombre) continue;
      while (nombres.has(nombreEnOrden(siguiente))) siguiente++;
      arista.nombre = nombreEnOrden(siguiente++);
    }
    return { valido: true, grafo: { tipo: 'no-dirigido', vertices, aristas, conPesos: false } };
  }

  const comoTexto = (grafo) => {
    const conArista = new Set(grafo.aristas.flatMap((a) => [a.origen, a.destino]));
    return grafo.aristas.map((a) => `${a.nombre} ${a.origen} ${a.destino}`)
      .concat(grafo.vertices.filter((v) => !conArista.has(v)))
      .join('\n');
  };

  const arista = (grafo, nombre) => grafo.aristas.find((a) => a.nombre === nombre);
  const extremos = (a) => [a.origen, a.destino];
  const comparten = (a, b) => extremos(a).filter((v) => extremos(b).includes(v));

  // Nombres de aristas escritos con espacios, comas o llaves: M, o un camino.
  function leerNombres(texto, grafo, rotulo) {
    const partes = String(texto || '').replace(/[{}]/g, ' ').split(/[\s,;]+/).filter(Boolean);
    const nombres = [];
    for (const parte of partes) {
      if (!arista(grafo, parte)) {
        return { valido: false, mensaje: `${rotulo}: «${parte}» no es una arista del grafo (${grafo.aristas.map((a) => a.nombre).join(', ')}).` };
      }
      if (nombres.includes(parte)) return { valido: false, mensaje: `${rotulo}: la arista ${parte} está dos veces.` };
      nombres.push(parte);
    }
    return { valido: true, nombres };
  }

  const saturados = (grafo, M) => new Set(M.flatMap((n) => extremos(arista(grafo, n))));

  // Las parejas de M que comparten vértice: vacío si es un pareamiento.
  function conflictos(grafo, M) {
    const lista = [];
    M.forEach((x, i) => M.slice(i + 1).forEach((y) => {
      const comunes = comparten(arista(grafo, x), arista(grafo, y));
      if (comunes.length) lista.push({ aristas: [x, y], vertice: comunes[0] });
    }));
    return lista;
  }

  // ν(G): el pareamiento más grande. En cada vuelta se decide el primer
  // vértice sin decidir: o queda libre o se empareja con un vecino.
  function maximo(grafo) {
    const usados = new Set();
    let mejor = [];
    const actual = [];
    const decidir = (indice) => {
      if (indice === grafo.vertices.length) {
        if (actual.length > mejor.length) mejor = actual.slice();
        return;
      }
      const v = grafo.vertices[indice];
      if (!usados.has(v)) {
        for (const a of grafo.aristas) {
          if (!extremos(a).includes(v)) continue;
          const otro = a.origen === v ? a.destino : a.origen;
          if (usados.has(otro)) continue;
          usados.add(v); usados.add(otro); actual.push(a.nombre);
          decidir(indice + 1);
          actual.pop(); usados.delete(v); usados.delete(otro);
        }
      }
      decidir(indice + 1);
    };
    decidir(0);
    return mejor;
  }

  // **Todos los caminos M-aumentados**, recorriendo caminos simples. Una
  // búsqueda por niveles no alcanza: el ejemplo de las hojas tiene el
  // triángulo I-M-E, y con un ciclo impar se pierden caminos que existen.
  // Con 12 vértices probarlos es instantáneo, porque en cada vértice saturado
  // solo hay una arista de M por donde seguir.
  function caminosAumentados(grafo, M) {
    const llenos = saturados(grafo, M);
    const enM = new Set(M);
    const hallados = [];
    const seguir = (v, vertices, nombres, tocaDeM) => {
      for (const a of grafo.aristas) {
        if (!extremos(a).includes(v) || enM.has(a.nombre) !== tocaDeM) continue;
        const otro = a.origen === v ? a.destino : a.origen;
        if (vertices.includes(otro)) continue;
        const siguientes = vertices.concat(otro);
        const aristas = nombres.concat(a.nombre);
        if (!tocaDeM && !llenos.has(otro)) hallados.push({ vertices: siguientes, aristas });
        else seguir(otro, siguientes, aristas, !tocaDeM);
      }
    };
    for (const v of grafo.vertices) if (!llenos.has(v)) seguir(v, [v], [], false);
    return hallados;
  }

  // El que toma la aplicación: el más corto, y entre iguales el primero.
  function primerCamino(grafo, M) {
    return caminosAumentados(grafo, M).reduce((mejor, c) => (!mejor || c.aristas.length < mejor.aristas.length ? c : mejor), null);
  }

  // Un camino escrito: sus aristas en orden. Devuelve sus vértices, o qué
  // tiene de malo. Se lee en los dos sentidos.
  function comprobarCamino(grafo, M, nombres) {
    const llenos = saturados(grafo, M);
    const enM = new Set(M);
    if (nombres.length === 0) return { valido: false, mensaje: 'el camino no tiene aristas' };
    if (nombres.length % 2 === 0) return { valido: false, mensaje: `tiene ${nombres.length} aristas, y un camino M-aumentado tiene una cantidad impar` };
    const inicios = nombres.length === 1
      ? [arista(grafo, nombres[0]).origen]
      : extremos(arista(grafo, nombres[0])).filter((v) => !extremos(arista(grafo, nombres[1])).includes(v));
    const vertices = [inicios[0]];
    for (const [i, nombre] of nombres.entries()) {
      const a = arista(grafo, nombre);
      const actual = vertices[vertices.length - 1];
      if (actual === undefined || !extremos(a).includes(actual)) return { valido: false, mensaje: `la arista ${nombre} no sigue a la anterior` };
      if (enM.has(nombre) !== (i % 2 === 1)) {
        return { valido: false, mensaje: `no alterna: ${nombre} ${enM.has(nombre) ? 'está' : 'no está'} en M` };
      }
      const otro = a.origen === actual ? a.destino : a.origen;
      if (vertices.includes(otro)) return { valido: false, mensaje: `pasa dos veces por ${otro}` };
      vertices.push(otro);
    }
    const [primero, ultimo] = [vertices[0], vertices[vertices.length - 1]];
    for (const v of [primero, ultimo]) if (llenos.has(v)) return { valido: false, mensaje: `${v} está saturado, y el camino empieza y termina en vértices libres` };
    return { valido: true, camino: { vertices, aristas: nombres } };
  }

  // Invertir: lo que era de M sale y lo que no, entra. M gana una arista.
  function invertir(M, camino) {
    return M.filter((n) => !camino.aristas.includes(n)).concat(camino.aristas.filter((n) => !M.includes(n)));
  }

  // Todo lo que el tema dice de M.
  function clasificar(grafo, M) {
    const choques = conflictos(grafo, M);
    const llenos = saturados(grafo, M);
    const libres = grafo.vertices.filter((v) => !llenos.has(v));
    const esPareamiento = choques.length === 0;
    const cabe = grafo.aristas.find((a) => !llenos.has(a.origen) && !llenos.has(a.destino));
    const nu = maximo(grafo).length;
    return {
      esPareamiento, choques,
      saturados: grafo.vertices.filter((v) => llenos.has(v)), libres,
      aristasLibres: grafo.aristas.map((a) => a.nombre).filter((n) => !M.includes(n)),
      maximal: esPareamiento && !cabe, cabe: cabe ? cabe.nombre : null,
      nu, maximo: esPareamiento && M.length === nu,
      perfecto: esPareamiento && libres.length === 0
    };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.pareamientos = {
    MODOS, VERTICES_MAXIMOS, leerGrafo, comoTexto, leerNombres, arista, extremos, comparten, saturados, conflictos,
    maximo, caminosAumentados, primerCamino, comprobarCamino, invertir, clasificar
  };
})();
