(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const conjuntos = window.CC2.dominio.conjuntos;
  const { MODOS, BUSQUEDAS } = conjuntos;

  // Conjuntos independientes y dominantes (CLAUDE.md 5.16): la traza, como
  // trabaja el docente en sus hojas. S′ en verde; después, por cada vértice
  // de S′, sus vecinos dentro de S′ —ninguno, si es independiente—; después,
  // por cada vértice de S′, a quién domina —«2 – {1, 4}»—, marcando esos
  // vértices en la lista S, y al final lo que se concluye. En los modos que
  // buscan, S′ es el primero que cumple, probando por tamaño.

  const lista = (cosas) => (cosas.length === 1 ? String(cosas[0])
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`);
  const llaves = (cosas) => `{${cosas.join(', ')}}`;

  function recorrer(grafo, { modo, conjunto }) {
    const busqueda = BUSQUEDAS[modo];
    const encontrado = busqueda ? conjuntos.buscar(grafo, modo) : null;
    const S = busqueda ? encontrado.conjunto : conjunto;
    if (!S) return [sinConjunto(grafo, modo, encontrado)];

    const vecinos = conjuntos.vecindario(grafo);
    const dentro = new Set(S);
    const ordenados = (cosas) => [...cosas].sort((a, b) => a - b);
    const tabla = S.map((v) => ({
      vertice: v,
      enS: ordenados([...vecinos.get(v)].filter((w) => dentro.has(w))),
      domina: ordenados([...vecinos.get(v)].filter((w) => !dentro.has(w)))
    }));
    const pasos = [];
    const comun = { modo, conjunto: S, tabla };
    const dominados = new Set();

    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun, fase: 'inicio', filasIndep: 0, filasDom: 0, dominados: [],
      mensaje: busqueda
        ? `Se busca el ${busqueda.nombre}: se prueban los conjuntos de vértices por tamaño, ${busqueda.mayor ? 'del más grande al más chico' : 'del más chico al más grande'}, y el primero que cumple es S′ = ${llaves(S)}. Ahora se comprueba como en la hoja.`
        : `S′ = ${llaves(S)}: se comprueba si es independiente —ningún par de S′ es adyacente— y si domina al grafo —todo vértice de fuera tiene un vecino en S′—.`
    }));

    // Independencia: los vecinos de cada uno dentro de S′.
    tabla.forEach((fila, i) => {
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun, fase: 'independencia', filasIndep: i + 1, filasDom: 0, dominados: [], actual: fila.vertice,
        calculo: [{ etiqueta: `Vecinos de ${fila.vertice} en S′`, expresion: fila.enS.join(', ') || 'ninguno', resultado: fila.enS.length ? 'adyacentes' : 'no adyacente', activa: true }],
        tituloCalculo: 'Independencia',
        mensaje: fila.enS.length === 0
          ? `${fila.vertice} no es adyacente a ningún otro vértice de S′.`
          : `${fila.vertice} es adyacente a ${lista(fila.enS)}, que ${fila.enS.length === 1 ? 'está' : 'están'} en S′: ${fila.enS.map((w) => `${fila.vertice} ~ ${w}`).join(', ')}.`
      }));
    });

    // Dominación: a quién domina cada uno, marcándolo en S.
    tabla.forEach((fila, i) => {
      const nuevos = fila.domina.filter((w) => !dominados.has(w));
      fila.domina.forEach((w) => dominados.add(w));
      const ya = fila.domina.filter((w) => !nuevos.includes(w));
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun, fase: 'dominacion', filasIndep: tabla.length, filasDom: i + 1, dominados: ordenados(dominados), actual: fila.vertice,
        calculo: [{ etiqueta: `${fila.vertice} –`, expresion: llaves(fila.domina), resultado: `${dominados.size} de ${grafo.vertices.length - S.length}`, activa: true }],
        tituloCalculo: 'Dominación',
        mensaje: fila.domina.length === 0
          ? `${fila.vertice} – {}: no tiene vecinos fuera de S′, no domina a nadie.`
          : `${fila.vertice} – ${llaves(fila.domina)}: domina a ${lista(fila.domina)}${ya.length ? ` (${lista(ya)} ya ${ya.length === 1 ? 'estaba dominado' : 'estaban dominados'})` : ''}.`
      }));
    });

    pasos.push(conclusion(grafo, { ...comun, dominados: ordenados(dominados) }, busqueda, encontrado));
    return pasos;
  }

  // Al terminar: qué es S′, propiedad por propiedad, y su tamaño contra el
  // óptimo.
  function conclusion(grafo, comun, busqueda, encontrado) {
    const S = comun.conjunto;
    const c = conjuntos.clasificar(grafo, S);
    const k = S.length;
    const propiedades = [
      {
        nombre: 'Dominante', valor: c.domina,
        detalle: c.domina ? 'todo vértice de fuera tiene vecino en S′' : `${lista(c.sinDominar)} ${c.sinDominar.length === 1 ? 'queda' : 'quedan'} sin dominar`
      },
      {
        nombre: 'Independiente', valor: c.independiente,
        detalle: c.independiente ? 'ningún par es adyacente' : c.adyacentes.map(([a, b]) => `${a} ~ ${b}`).join(', ')
      },
      {
        nombre: 'Maximal', valor: c.independiente ? c.maximal : null,
        detalle: !c.independiente ? 'no es independiente' : c.maximal ? 'no le cabe ningún vértice más' : `le cabe el ${c.sinDominar[0]}`
      },
      {
        nombre: 'Minimal', valor: c.domina ? c.minimal : null,
        detalle: !c.domina ? 'no es dominante'
          : c.minimal ? (c.sinEl.length <= 3
            ? c.sinEl.map((x) => `sin ${x.vertice}, nadie domina al ${x.queda}`).join('; ')
            : 'sin cualquiera de sus vértices, alguno queda sin dominar')
            : `sin ${c.sinEl.find((x) => x.queda === null).vertice} sigue dominando`
      },
      {
        nombre: 'Total', valor: c.domina ? c.total : null,
        detalle: !c.domina ? 'no es dominante' : c.total ? 'todo vértice tiene vecino en S′' : `${lista(c.sinVecino)} no ${c.sinVecino.length === 1 ? 'tiene' : 'tienen'} vecino en S′`
      },
      {
        nombre: 'Conexo', valor: c.domina ? c.conexo : null,
        detalle: !c.domina ? 'no es dominante' : c.conexo ? 'S′ forma un subgrafo conexo' : 'S′ no forma un subgrafo conexo'
      }
    ];

    // El óptimo: el que se buscó, o al comprobar, γ(G) y β(G) para comparar.
    const optimos = [];
    if (busqueda) {
      const cuantos = encontrado.descartados;
      optimos.push({
        simbolo: busqueda.simbolo, metrica: busqueda.metrica, valor: k,
        detalle: cuantos === 0 ? (busqueda.mayor ? 'no hay conjuntos más grandes' : 'no hay conjuntos más chicos')
          : `ninguno de los ${cuantos} conjuntos ${busqueda.mayor ? `de más de ${k}` : `de menos de ${k}`} ${k === 1 && !busqueda.mayor ? 'vértice' : 'vértices'} sirve`
      });
    } else {
      for (const modo of [MODOS.DOMINANTE_MINIMO, MODOS.INDEPENDIENTE_MAXIMO]) {
        const b = BUSQUEDAS[modo];
        const r = conjuntos.buscar(grafo, modo);
        optimos.push({ simbolo: b.simbolo, metrica: b.metrica, valor: r.conjunto.length, detalle: `por ejemplo ${llaves(r.conjunto)}` });
      }
    }

    return crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun, fase: 'final', filasIndep: S.length, filasDom: S.length,
      propiedades, optimos,
      // Las propiedades ya están en la tabla de al lado: el panel lleva el
      // óptimo.
      calculo: optimos.map((o, i) => ({ etiqueta: o.simbolo, expresion: o.detalle, resultado: String(o.valor), activa: busqueda ? true : i === 0 })),
      tituloCalculo: 'Conclusión',
      mensaje: busqueda
        ? `${busqueda.simbolo} = ${k}: S′ = ${llaves(S)} es un ${busqueda.nombre}, y ${optimos[0].detalle}.`
        : `S′ = ${llaves(S)} ${nombreDe(c)}. |S′| = ${k}; γ(G) = ${optimos[0].valor} y β(G) = ${optimos[1].valor}${comparar(c, k, optimos)}.`
    });
  }

  // Lo que es, dicho como lo dice la hoja.
  function nombreDe(c) {
    if (c.domina && c.independiente) return 'es un conjunto dominante independiente';
    if (c.domina) return 'es un conjunto dominante, pero no independiente';
    if (c.independiente) return 'es independiente, pero no domina: no es maximal';
    return 'no es independiente ni dominante';
  }

  function comparar(c, k, [gamma, beta]) {
    const dichos = [];
    if (c.domina) dichos.push(k === gamma.valor ? 'es dominante mínimo' : 'no es el dominante mínimo');
    if (c.independiente) dichos.push(k === beta.valor ? 'es independiente máximo' : 'no es el independiente máximo');
    return dichos.length ? `: ${dichos.join(', y ')}` : '';
  }

  // No hay ninguno: un dominante total con un vértice aislado, o uno conexo
  // en un grafo partido.
  function sinConjunto(grafo, modo, encontrado) {
    const b = BUSQUEDAS[modo];
    const porque = modo === MODOS.DOMINANTE_TOTAL
      ? 'un vértice aislado no tiene ningún vecino que lo domine'
      : 'el grafo no es conexo, y un dominante conexo tendría que alcanzar a todos sin salir de S′';
    return crearPaso(TIPOS_PASO.CONSTRUIDO, {
      modo, conjunto: [], tabla: [], fase: 'final', filasIndep: 0, filasDom: 0, dominados: [],
      propiedades: [], optimos: [],
      mensaje: `Este grafo no tiene ${b.nombre.replace(/ (mínimo|más grande)$/, '')}: ${porque}. Se probaron los ${encontrado.descartados} conjuntos.`
    });
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.conjuntos = { recorrer };
})();
