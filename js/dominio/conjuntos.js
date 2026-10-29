(function () {
  // Conjuntos independientes y dominantes (CLAUDE.md 5.16), como en las hojas
  // del docente (2026-10-28, `docs/C. indep y dominante/`; él cita a
  // Grimaldi). Un grafo no dirigido y un conjunto S′ de sus vértices:
  //
  //   independiente  ningún par de S′ es adyacente
  //   maximal        independiente, y no se le puede agregar ningún vértice:
  //                  todo vértice de fuera tiene un vecino en S′
  //   dominante      todo vértice de fuera de S′ tiene un vecino en S′
  //   minimal        dominante, y sin cualquiera de sus vértices deja de serlo
  //   total          todo vértice —también los de S′— tiene un vecino en S′
  //   conexo         dominante, y S′ forma un subgrafo conexo
  //
  // «Maximal» y «dominante» se comprueban igual: un independiente es maximal
  // justo cuando además domina. Por eso el tema es uno solo (decisión del
  // usuario, 2026-10-28).

  const MODOS = Object.freeze({
    COMPROBAR: 'comprobar',
    INDEPENDIENTE_MAXIMO: 'independiente-maximo',
    DOMINANTE_MINIMO: 'dominante-minimo',
    DOMINANTE_INDEPENDIENTE: 'dominante-independiente',
    DOMINANTE_TOTAL: 'dominante-total',
    DOMINANTE_CONEXO: 'dominante-conexo',
    DOMINANTE_MINIMAL: 'dominante-minimal'
  });

  // Los ejemplos del docente llegan a 12 vértices; probar todos los
  // subconjuntos son 4096, nada.
  const VERTICES_MAXIMOS = 12;

  function vecindario(grafo) {
    const vecinos = new Map(grafo.vertices.map((v) => [v, new Set()]));
    for (const { origen, destino } of grafo.aristas) {
      vecinos.get(origen).add(destino);
      vecinos.get(destino).add(origen);
    }
    return vecinos;
  }

  // Los pares de S′ que son adyacentes: vacío si es independiente.
  function paresAdyacentes(vecinos, S) {
    const pares = [];
    S.forEach((a, i) => S.slice(i + 1).forEach((b) => { if (vecinos.get(a).has(b)) pares.push([a, b]); }));
    return pares;
  }

  // Los vértices de fuera de S′ sin ningún vecino en S′.
  function sinDominar(grafo, vecinos, S) {
    const dentro = new Set(S);
    return grafo.vertices.filter((v) => !dentro.has(v) && !S.some((s) => vecinos.get(s).has(v)));
  }

  // Los vértices de S′ sin ningún vecino en S′ (lo que le falta para total).
  const sinVecinoDentro = (vecinos, S) => S.filter((s) => !S.some((t) => vecinos.get(s).has(t)));

  function esConexo(vecinos, S) {
    if (S.length === 0) return false;
    const dentro = new Set(S);
    const vistos = new Set([S[0]]);
    const pila = [S[0]];
    while (pila.length) {
      for (const w of vecinos.get(pila.pop())) {
        if (dentro.has(w) && !vistos.has(w)) { vistos.add(w); pila.push(w); }
      }
    }
    return vistos.size === S.length;
  }

  // Para minimal: por cada vértice de S′, uno que sin él queda sin dominar.
  // El que no deja a ninguno es el que sobra.
  function quienQuedaSinEl(grafo, vecinos, S) {
    return S.map((x) => ({ vertice: x, queda: sinDominar(grafo, vecinos, S.filter((y) => y !== x))[0] ?? null }));
  }

  // Todo lo que el tema dice de un conjunto.
  function clasificar(grafo, S) {
    const vecinos = vecindario(grafo);
    const adyacentes = paresAdyacentes(vecinos, S);
    const fuera = sinDominar(grafo, vecinos, S);
    const independiente = adyacentes.length === 0;
    const domina = fuera.length === 0;
    const sinEl = domina ? quienQuedaSinEl(grafo, vecinos, S) : [];
    const sinVecino = sinVecinoDentro(vecinos, S);
    return {
      independiente, adyacentes,
      domina, sinDominar: fuera,
      maximal: independiente && domina,
      minimal: domina && sinEl.every((x) => x.queda !== null), sinEl,
      total: domina && sinVecino.length === 0, sinVecino,
      conexo: domina && esConexo(vecinos, S)
    };
  }

  // Lo que se busca en cada modo: si cumple, y si se busca el menor o el
  // mayor. El símbolo es el de los libros; el docente escribe γ(G) para todo.
  // `metrica` es su rótulo en el panel, que va en versalitas: ahí γ(G) se
  // leería Γ(G), que es otra cosa.
  const BUSQUEDAS = Object.freeze({
    [MODOS.INDEPENDIENTE_MAXIMO]: { cumple: (c) => c.independiente, mayor: true, simbolo: 'β(G)', metrica: 'Núm. de independencia', nombre: 'conjunto independiente máximo' },
    [MODOS.DOMINANTE_MINIMO]: { cumple: (c) => c.domina, mayor: false, simbolo: 'γ(G)', metrica: 'Núm. de dominación', nombre: 'conjunto dominante mínimo' },
    [MODOS.DOMINANTE_INDEPENDIENTE]: { cumple: (c) => c.domina && c.independiente, mayor: false, simbolo: 'i(G)', metrica: 'Dom. independiente', nombre: 'conjunto dominante independiente mínimo' },
    [MODOS.DOMINANTE_TOTAL]: { cumple: (c) => c.total, mayor: false, simbolo: 'γt(G)', metrica: 'Dom. total', nombre: 'conjunto dominante total mínimo' },
    [MODOS.DOMINANTE_CONEXO]: { cumple: (c) => c.conexo, mayor: false, simbolo: 'γc(G)', metrica: 'Dom. conexa', nombre: 'conjunto dominante conexo mínimo' },
    [MODOS.DOMINANTE_MINIMAL]: { cumple: (c) => c.minimal, mayor: true, simbolo: 'Γ(G)', metrica: 'Dom. superior', nombre: 'conjunto dominante minimal más grande' }
  });

  // Los subconjuntos de k vértices, en orden: {1, 2}, {1, 3}… El primero que
  // cumple es el que se muestra.
  function* combinaciones(lista, k, desde = 0, prefijo = []) {
    if (prefijo.length === k) { yield prefijo; return; }
    for (let i = desde; i <= lista.length - (k - prefijo.length); i++) {
      yield* combinaciones(lista, k, i + 1, prefijo.concat(lista[i]));
    }
  }

  const coeficiente = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

  // Prueba los conjuntos por tamaño —de menor a mayor, o al revés— y devuelve
  // el primero que cumple, con cuántos se descartaron por el lado que no
  // alcanza: eso es lo que justifica que sea el mínimo o el máximo.
  function buscar(grafo, modo) {
    const { cumple, mayor } = BUSQUEDAS[modo];
    const n = grafo.vertices.length;
    const tamanos = Array.from({ length: n }, (_, i) => (mayor ? n - i : i + 1));
    let probados = 0;
    for (const k of tamanos) {
      for (const S of combinaciones(grafo.vertices, k)) {
        if (cumple(clasificar(grafo, S))) return { conjunto: S, descartados: probados };
      }
      probados += coeficiente(n, k);
    }
    return { conjunto: null, descartados: probados };
  }

  // S′ escrito por el estudiante: sus vértices separados por espacios o
  // comas, y todos del grafo.
  function leerConjunto(texto, grafo) {
    const partes = String(texto || '').replace(/[{}]/g, ' ').split(/[\s,;]+/).filter(Boolean);
    if (partes.length === 0) return { valido: false, mensaje: 'Escriba los vértices de S′, por ejemplo «1 3».' };
    const conjunto = [];
    for (const parte of partes) {
      const v = Number(parte);
      if (!/^\d+$/.test(parte) || !grafo.vertices.includes(v)) {
        return { valido: false, mensaje: `S′: «${parte}» no es un vértice del grafo (${grafo.vertices.join(', ')}).` };
      }
      if (conjunto.includes(v)) return { valido: false, mensaje: `S′: el ${v} está dos veces.` };
      conjunto.push(v);
    }
    return { valido: true, conjunto: conjunto.sort((a, b) => a - b) };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.conjuntos = {
    MODOS, VERTICES_MAXIMOS, BUSQUEDAS, vecindario, clasificar, buscar, leerConjunto, coeficiente
  };
})();
