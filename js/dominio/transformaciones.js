(function () {
  // Operaciones sobre un solo grafo (CLAUDE.md 5.19): insertar y borrar un
  // vértice o una arista, fusionar dos vértices, fusionar (contraer) una
  // arista y el complemento. Lista aprobada por el usuario el 2026-11-24. No
  // hay material del docente: **al fusionar queda un grafo simple** —los
  // lazos y las paralelas se descartan y se dice—, pendiente de confirmar.
  const { ordenNatural, leerOperando } = window.CC2.dominio.operaciones;

  const TRANSFORMACIONES = Object.freeze({
    INSERTAR_VERTICE: 'insertar-vertice',
    BORRAR_VERTICE: 'borrar-vertice',
    INSERTAR_ARISTA: 'insertar-arista',
    BORRAR_ARISTA: 'borrar-arista',
    FUSIONAR_VERTICES: 'fusionar-vertices',
    CONTRAER_ARISTA: 'contraer-arista',
    COMPLEMENTO: 'complemento'
  });

  const VERTICES_MAXIMOS = 8;
  const VERTICE = /^[0-9]{1,2}$|^[a-zA-Z][0-9]?$/;

  const leer = (texto) => leerOperando(texto, 'G', VERTICES_MAXIMOS);
  const mismos = ([a, b], [c, d]) => (a === c && b === d) || (a === d && b === c);
  const tiene = (grafo, u, v) => grafo.aristas.some((a) => mismos(a, [u, v]));
  const partir = (texto) => String(texto || '').split(/[\s,;\-–>]+/).filter(Boolean);
  const vecinosDe = (grafo, v) => grafo.vertices.filter((w) => w !== v && tiene(grafo, v, w));
  const incidentes = (grafo, v) => grafo.aristas.filter((a) => a.includes(v));
  const error = (mensaje) => ({ valido: false, mensaje });
  const noEstan = (lista) => `${lista.join(', ')} no ${lista.length === 1 ? 'está' : 'están'} en G.`;

  // El vértice que se inserta (uno que no esté) o se borra (uno que esté).
  function leerVertice(texto, grafo, operacion) {
    const partes = partir(texto);
    if (partes.length !== 1) return error('Escriba un solo vértice.');
    const [v] = partes;
    if (!VERTICE.test(v)) return error(`«${v}» no es un vértice: use un número de hasta dos cifras o una letra.`);
    const esta = grafo.vertices.includes(v);
    if (operacion === TRANSFORMACIONES.INSERTAR_VERTICE) {
      return esta ? error(`El vértice ${v} ya está en G; elija uno que no esté.`) : { valido: true, vertice: v };
    }
    if (!esta) return error(`El vértice ${v} no está en G.`);
    if (grafo.vertices.length === 1) return error('G tiene un solo vértice: borrarlo lo dejaría sin ninguno.');
    return { valido: true, vertice: v };
  }

  // Los vecinos del vértice que se inserta. Vacío es aislado.
  function leerVecinos(texto, grafo) {
    const vecinos = [...new Set(partir(texto))];
    const fuera = vecinos.filter((v) => !grafo.vertices.includes(v));
    if (fuera.length) return error(noEstan(fuera));
    return { valido: true, vecinos: vecinos.sort(ordenNatural) };
  }

  // Los dos vértices de una arista, o los que se fusionan.
  function leerPar(texto, grafo, operacion) {
    const partes = partir(texto);
    if (partes.length !== 2) return error('Escriba dos vértices, por ejemplo «1 2».');
    const [u, v] = partes;
    const fuera = [...new Set(partes.filter((x) => !grafo.vertices.includes(x)))];
    if (fuera.length) return error(noEstan(fuera));
    if (u === v) return error('Son el mismo vértice: escriba dos distintos.');
    const hay = tiene(grafo, u, v);
    if (operacion === TRANSFORMACIONES.INSERTAR_ARISTA && hay) return error(`La arista ${u}–${v} ya está en G.`);
    if ([TRANSFORMACIONES.BORRAR_ARISTA, TRANSFORMACIONES.CONTRAER_ARISTA].includes(operacion) && !hay) {
      return error(`La arista ${u}–${v} no está en G.`);
    }
    return { valido: true, par: [u, v].sort(ordenNatural) };
  }

  // Fundir u y v en uno solo, que se llama «u,v». Cada arista que tocaba a
  // alguno se revisa: pasa al vértice nuevo, sería un lazo (la que unía a los
  // dos) o sería paralela (de un vecino que ya quedó unido).
  function fusionar(grafo, u, v) {
    const nuevo = `${u},${v}`;
    const unidos = new Set();
    const tocadas = grafo.aristas.filter((a) => a.includes(u) || a.includes(v));
    // Primero la que une a los dos, después las de u y después las de v.
    const orden = tocadas.filter((a) => mismos(a, [u, v]))
      .concat(tocadas.filter((a) => a.includes(u) && !a.includes(v)))
      .concat(tocadas.filter((a) => a.includes(v) && !a.includes(u)));
    const cambios = orden.map((arista) => {
      if (mismos(arista, [u, v])) return { arista, tipo: 'lazo' };
      const extremo = arista.includes(u) ? u : v;
      const otro = arista[0] === extremo ? arista[1] : arista[0];
      if (unidos.has(otro)) return { arista, extremo, otro, tipo: 'paralela' };
      unidos.add(otro);
      return { arista, extremo, otro, tipo: 'pasa', nueva: [nuevo, otro] };
    });
    const vertices = grafo.vertices.filter((x) => x !== u && x !== v).concat(nuevo);
    const base = grafo.aristas.filter((a) => !tocadas.includes(a));
    return {
      nuevo,
      cambios,
      base: { vertices, aristas: base },
      resultado: { vertices, aristas: base.concat(cambios.filter((c) => c.nueva).map((c) => c.nueva)) }
    };
  }

  // Las aristas que le faltan al grafo, por el primero de sus vértices.
  function complemento(grafo) {
    const grupos = grafo.vertices.slice(0, -1).map((u, i) => ({
      vertice: u,
      aristas: grafo.vertices.slice(i + 1).filter((v) => !tiene(grafo, u, v)).map((v) => [u, v])
    }));
    return { grupos, resultado: { vertices: grafo.vertices.slice(), aristas: grupos.flatMap((g) => g.aristas) } };
  }

  function transformar(grafo, operacion, datos = {}) {
    const { vertices, aristas } = grafo;
    switch (operacion) {
      case TRANSFORMACIONES.INSERTAR_VERTICE:
        return {
          vertices: vertices.concat(datos.vertice).sort(ordenNatural),
          aristas: aristas.concat(datos.vecinos.map((w) => [datos.vertice, w]))
        };
      case TRANSFORMACIONES.BORRAR_VERTICE:
        return { vertices: vertices.filter((v) => v !== datos.vertice), aristas: aristas.filter((a) => !a.includes(datos.vertice)) };
      case TRANSFORMACIONES.INSERTAR_ARISTA:
        return { vertices: vertices.slice(), aristas: aristas.concat([datos.par]) };
      case TRANSFORMACIONES.BORRAR_ARISTA:
        return { vertices: vertices.slice(), aristas: aristas.filter((a) => !mismos(a, datos.par)) };
      case TRANSFORMACIONES.COMPLEMENTO:
        return complemento(grafo).resultado;
      default:
        return fusionar(grafo, ...datos.par).resultado;
    }
  }

  window.CC2.dominio.transformaciones = {
    TRANSFORMACIONES, VERTICES_MAXIMOS, leer, leerVertice, leerVecinos, leerPar,
    transformar, fusionar, complemento, vecinosDe, incidentes, tiene, mismos
  };
})();
