(function () {
  // Árbol de expansión mínimo (CLAUDE.md 5.18). Se vio en clase con Prim y
  // Kruskal, sin hojas del docente (dicho por el usuario, 2026-11-09): el
  // paso a paso lo define esta aplicación, y las pruebas se anclan a la
  // figura 12 del documento de apoyo, que es un grafo ponderado del docente.
  //
  //   árbol de expansión  subgrafo conexo y sin ciclos con todos los vértices;
  //                       tiene n − 1 aristas
  //   mínimo              el de menor peso total
  //   Kruskal             las aristas de menor a mayor peso; entra la que une
  //                       dos componentes distintos, y la que cerraría un
  //                       ciclo se descarta
  //   Prim                desde un vértice, entra en cada paso la arista más
  //                       liviana que sale del árbol hacia un vértice nuevo
  //
  // **Empates**: gana la que se escribió antes. Si un empate deja elegir, hay
  // otro árbol del mismo peso, y la conclusión lo dice.
  //
  // Del árbol salen los conceptos del documento de apoyo (2026-11-09), que
  // el docente calcula antes de los circuitos y cortes fundamentales:
  //
  //   ramas     las aristas del árbol; rango = n − 1, cuántas son
  //   cuerdas   el complemento del árbol, G′ = (S′, A′): todos los vértices
  //             y las aristas que no están en él; nulidad = m − n + 1
  //
  // Su ejemplo es el grafo verde sin pesos —todas valen 1— con el árbol
  // a, b, e, f, «a varias soluciones, se escogió la siguiente». Para poder
  // seguirlo, el árbol también se puede escribir (`DADO`).

  const METODOS = Object.freeze({ KRUSKAL: 'kruskal', PRIM: 'prim', DADO: 'dado' });

  // Con 10 vértices caben 45 aristas, y la lista ordenada de Kruskal todavía
  // entra al lado del grafo.
  const VERTICES_MAXIMOS = 10;
  const PESO_MAXIMO = 999;

  const VERTICE = /^[0-9]{1,2}$|^[a-zA-Z][0-9]?$/;
  const esNumero = (v) => /^[0-9]+$/.test(v);

  // Los números en orden y después las letras en orden: así el 1 y la A
  // quedan arriba a la izquierda del dibujo, como en todos los temas.
  const enOrden = (a, b) => (esNumero(a) && esNumero(b) ? Number(a) - Number(b)
    : esNumero(a) !== esNumero(b) ? (esNumero(a) ? -1 : 1) : a.localeCompare(b));

  // El grafo, un renglón por arista: «1 2 5», sus dos vértices y su peso.
  // **Sin peso vale 1**, como en la hoja de Floyd del docente. Los vértices
  // pueden ser números o letras (los libros dibujan estos grafos con A, B…).
  function leerGrafo(texto) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    const vertices = new Set();
    const aristas = [];
    const vistas = new Map();
    let conPesos = false;
    for (const [indice, renglon] of renglones.entries()) {
      const partes = renglon.split(/[\s,\-–>]+/).filter(Boolean);
      const donde = `Renglón ${indice + 1} («${renglon}»)`;
      // El guion separa vértices («1-2»); delante del peso sería un negativo,
      // y partido como separador lo volvería positivo sin avisar.
      if (/\s-\s*[0-9]+\s*$/.test(renglon)) return { valido: false, mensaje: `${donde}: el peso es un entero de 0 a ${PESO_MAXIMO}.` };
      if (partes.length > 3) return { valido: false, mensaje: `${donde}: una arista lleva sus dos vértices y, si tiene, su peso.` };
      const [origen, destino, textoPeso] = partes;
      if (![origen, destino].filter((v) => v !== undefined).every((v) => VERTICE.test(v))) {
        return { valido: false, mensaje: `${donde}: un vértice es un número de hasta dos cifras o una letra (1, 12, A, x1).` };
      }
      vertices.add(origen);
      if (destino === undefined) continue;
      vertices.add(destino);
      if (origen === destino) return { valido: false, mensaje: `${donde}: un lazo nunca entra a un árbol; quítelo.` };
      let peso = 1;
      if (textoPeso !== undefined) {
        peso = Number(textoPeso);
        if (!/^[0-9]+$/.test(textoPeso) || peso > PESO_MAXIMO) {
          return { valido: false, mensaje: `${donde}: el peso es un entero de 0 a ${PESO_MAXIMO}.` };
        }
        conPesos = true;
      }
      const clave = [origen, destino].sort().join('|');
      if (vistas.has(clave)) return { valido: false, mensaje: `${donde}: esa arista ya está en el renglón ${vistas.get(clave) + 1}.` };
      vistas.set(clave, indice);
      // **El nombre lo pone el orden**: a, b, c… como las del docente, que
      // en el grafo verde van en el orden en que se escriben. Las ramas y las
      // cuerdas se dicen por su nombre; lo demás, por sus vértices, «1–3».
      aristas.push({ origen, destino, peso, nombre: nombreEnOrden(aristas.length), orden: aristas.length });
    }
    if (aristas.length === 0) return { valido: false, mensaje: 'Escriba al menos una arista: sus dos vértices y su peso, por ejemplo «1 2 5».' };
    if (vertices.size > VERTICES_MAXIMOS) {
      return { valido: false, mensaje: `El grafo tiene ${vertices.size} vértices; caben hasta ${VERTICES_MAXIMOS}.` };
    }
    const grafo = { tipo: 'no-dirigido', vertices: [...vertices].sort(enOrden), aristas, conPesos };
    // Sin conexión no hay árbol que toque a todos: Kruskal daría un bosque y
    // Prim se quedaría en una parte. Se dice antes de crear.
    const partes = componentes(grafo, grafo.aristas);
    if (partes.length > 1) {
      return {
        valido: false,
        mensaje: `El grafo no es conexo: ${partes.map((p) => `{${p.join(', ')}}`).join(' y ')} no están unidos, y un árbol de expansión tiene que llegar a todos los vértices.`
      };
    }
    return { valido: true, grafo };
  }

  // a, b, … z, y después aa, ab… (con 10 vértices caben 45 aristas).
  function nombreEnOrden(indice) {
    const letra = (i) => String.fromCharCode(97 + i);
    return indice < 26 ? letra(indice) : letra(Math.floor(indice / 26) - 1) + letra(indice % 26);
  }

  function comoTexto(grafo) {
    return grafo.aristas.map((a) => `${a.origen} ${a.destino}${grafo.conPesos ? ` ${a.peso}` : ''}`).join('\n');
  }

  const etiqueta = (a) => `${a.origen}–${a.destino}`;
  const otroExtremo = (a, v) => (a.origen === v ? a.destino : a.origen);

  // Los componentes que forman `aristas` sobre todos los vértices, cada uno
  // en orden, y ordenados por su primer vértice.
  function componentes(grafo, aristas) {
    const de = new Map(grafo.vertices.map((v) => [v, v]));
    const raiz = (v) => (de.get(v) === v ? v : raiz(de.get(v)));
    for (const a of aristas) de.set(raiz(a.origen), raiz(a.destino));
    const grupos = new Map();
    for (const v of grafo.vertices) {
      const r = raiz(v);
      if (!grupos.has(r)) grupos.set(r, []);
      grupos.get(r).push(v);
    }
    return [...grupos.values()];
  }

  // El camino entre dos vértices dentro de un bosque: sus aristas, o null.
  function caminoEn(aristas, desde, hasta) {
    const buscar = (v, previo, recorridas) => {
      if (v === hasta) return recorridas;
      for (const a of aristas) {
        if (a === previo || (a.origen !== v && a.destino !== v)) continue;
        const hallado = buscar(otroExtremo(a, v), a, recorridas.concat(a));
        if (hallado) return hallado;
      }
      return null;
    };
    return buscar(desde, null, []);
  }

  // Kruskal: las aristas de menor a mayor peso —las de igual peso, en el
  // orden escrito— y cada una entra si une dos componentes. Se detiene al
  // tener n − 1: las que quedan ya no hace falta mirarlas.
  function kruskal(grafo) {
    const orden = grafo.aristas.slice().sort((x, y) => x.peso - y.peso || x.orden - y.orden);
    const arbol = [];
    const decisiones = [];
    for (const a of orden) {
      if (arbol.length === grafo.vertices.length - 1) break;
      const antes = componentes(grafo, arbol);
      const de = (v) => antes.find((c) => c.includes(v));
      if (de(a.origen) === de(a.destino)) {
        decisiones.push({ arista: a, entra: false, ciclo: caminoEn(arbol, a.origen, a.destino), componentes: antes });
      } else {
        arbol.push(a);
        decisiones.push({ arista: a, entra: true, une: [de(a.origen), de(a.destino)], componentes: antes });
      }
    }
    return { orden, decisiones, arbol };
  }

  // Prim: desde `inicio`, en cada vuelta las candidatas son las aristas con
  // un extremo en el árbol y el otro fuera; entra la más liviana, y entre
  // iguales la escrita antes.
  function prim(grafo, inicio = grafo.vertices[0]) {
    const dentro = [inicio];
    const arbol = [];
    const vueltas = [];
    while (dentro.length < grafo.vertices.length) {
      const candidatas = grafo.aristas
        .filter((a) => dentro.includes(a.origen) !== dentro.includes(a.destino))
        .sort((x, y) => x.peso - y.peso || x.orden - y.orden);
      const [elegida] = candidatas;
      const nuevo = dentro.includes(elegida.origen) ? elegida.destino : elegida.origen;
      vueltas.push({ dentro: dentro.slice(), candidatas, elegida, nuevo });
      dentro.push(nuevo);
      arbol.push(elegida);
    }
    return { inicio, vueltas, arbol };
  }

  const peso = (aristas) => aristas.reduce((suma, a) => suma + a.peso, 0);

  // **¿Es el único árbol mínimo?** Lo es si toda arista de fuera pesa más que
  // cada arista del camino que une sus extremos en el árbol. Si pesa igual
  // que alguna, se pueden cambiar y sale otro del mismo peso.
  function otroDelMismoPeso(grafo, arbol) {
    for (const a of grafo.aristas) {
      if (arbol.includes(a)) continue;
      const igual = caminoEn(arbol, a.origen, a.destino).find((t) => t.peso === a.peso);
      if (igual) return { entra: a, sale: igual };
    }
    return null;
  }

  // Un árbol escrito por el nombre de sus aristas, «a b e f»: tiene que tener
  // n − 1, sin ciclos (con n − 1 y sin ciclos, toca a todos los vértices).
  function leerArbol(texto, grafo) {
    const partes = String(texto || '').replace(/[{}]/g, ' ').split(/[\s,;]+/).filter(Boolean);
    const arbol = [];
    for (const parte of partes) {
      const a = grafo.aristas.find((x) => x.nombre === parte);
      if (!a) return { valido: false, mensaje: `«${parte}» no es una arista del grafo (${grafo.aristas.map((x) => x.nombre).join(', ')}).` };
      if (arbol.includes(a)) return { valido: false, mensaje: `la arista ${parte} está dos veces.` };
      arbol.push(a);
    }
    const n = grafo.vertices.length;
    if (arbol.length !== n - 1) {
      return { valido: false, mensaje: `tiene ${arbol.length} ${arbol.length === 1 ? 'arista' : 'aristas'}, y un árbol de ${n} vértices tiene n − 1 = ${n - 1}.` };
    }
    for (const [i, a] of arbol.entries()) {
      const camino = caminoEn(arbol.slice(0, i), a.origen, a.destino);
      if (camino) return { valido: false, mensaje: `${[...camino, a].map((x) => x.nombre).join(', ')} forman un ciclo.` };
    }
    return { valido: true, arbol: grafo.aristas.filter((a) => arbol.includes(a)) };
  }

  // Ramas y cuerdas de un árbol: las suyas y su complemento, en el orden del
  // grafo, con el rango y la nulidad.
  function ramasYCuerdas(grafo, arbol) {
    const ramas = grafo.aristas.filter((a) => arbol.includes(a));
    const cuerdas = grafo.aristas.filter((a) => !arbol.includes(a));
    const n = grafo.vertices.length;
    const m = grafo.aristas.length;
    return { ramas, cuerdas, rango: n - 1, nulidad: m - n + 1, n, m };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.expansion = {
    METODOS, VERTICES_MAXIMOS, leerGrafo, comoTexto, etiqueta, componentes, caminoEn, kruskal, prim, peso, otroDelMismoPeso,
    leerArbol, ramasYCuerdas
  };
})();
