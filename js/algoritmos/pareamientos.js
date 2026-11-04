(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const pareamientos = window.CC2.dominio.pareamientos;
  const { MODOS } = pareamientos;

  // Pareamientos (CLAUDE.md 5.17): la traza, como las hojas 9 y 10 del
  // docente. Para llegar al máximo, cada vuelta son dos pasos: se muestra el
  // camino M-aumentado, y se invierte «para saturar más vértices». Termina
  // cuando ya no hay camino, que es lo que prueba que M es máximo.
  //
  // Los caminos pueden venir escritos, para reproducir una hoja: desde {b} hay
  // ocho, y el docente elige uno de tres aristas sin una regla que se pueda
  // deducir. Sin escribirlos, la aplicación toma el más corto.

  const lista = (cosas) => (cosas.length === 1 ? String(cosas[0])
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`);
  const llaves = (cosas) => `{${cosas.join(', ')}}`;
  const ordenadas = (grafo, M) => grafo.aristas.map((a) => a.nombre).filter((n) => M.includes(n));

  function recorrer(grafo, { modo, pareamiento = [], caminos = [] }) {
    return modo === MODOS.COMPROBAR
      ? pasosDeComprobar(grafo, ordenadas(grafo, pareamiento))
      : pasosDelMaximo(grafo, ordenadas(grafo, pareamiento), caminos);
  }

  // ── Comprobar: arista por arista, con quién comparte, como la hoja 5 ─────
  function pasosDeComprobar(grafo, M) {
    const tabla = M.map((nombre) => {
      const a = pareamientos.arista(grafo, nombre);
      const vecinas = grafo.aristas.filter((b) => b.nombre !== nombre && pareamientos.comparten(a, b).length).map((b) => b.nombre);
      return { arista: nombre, extremos: `${a.origen}–${a.destino}`, comparte: vecinas, choca: vecinas.filter((n) => M.includes(n)) };
    });
    const comun = { modo: MODOS.COMPROBAR, M, tabla };
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      ...comun, filasLlenas: 0, saturadosHasta: [],
      mensaje: `M = ${llaves(M)}: se revisa cada arista. Un pareamiento no puede tener dos aristas con un vértice en común.`
    })];
    const vistos = [];
    tabla.forEach((fila, i) => {
      vistos.push(...fila.extremos.split('–'));
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun, filasLlenas: i + 1, saturadosHasta: vistos.slice(), actual: fila.arista,
        calculo: [
          { etiqueta: `${fila.arista} –`, expresion: llaves(fila.comparte), resultado: fila.choca.length ? 'choca' : 'bien', activa: true }
        ],
        tituloCalculo: 'Con quién comparte vértice',
        mensaje: fila.choca.length
          ? `${fila.arista} (${fila.extremos}) comparte vértice con ${lista(fila.choca)}, que ${fila.choca.length === 1 ? 'está' : 'están'} en M.`
          : `${fila.arista} (${fila.extremos}) satura ${lista(fila.extremos.split('–'))}. Comparte vértice con ${fila.comparte.length ? lista(fila.comparte) : 'ninguna'}, y ninguna de ellas está en M.`
      }));
    });
    pasos.push(conclusion(grafo, comun, { filasLlenas: tabla.length }));
    return pasos;
  }

  // ── Máximo: invertir caminos M-aumentados hasta que no quede ninguno ─────
  function pasosDelMaximo(grafo, inicial, escritos) {
    const tabla = [];
    const pasos = [];
    let M = inicial;
    const comun = () => ({ modo: MODOS.MAXIMO, M: M.slice(), tabla: tabla.slice() });
    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun(),
      mensaje: M.length
        ? `Pareamiento inicial: M = ${llaves(M)}. Se busca un camino M-aumentado: alternado, de un vértice libre a otro libre.`
        : 'Se empieza sin ninguna arista en M. Se busca un camino M-aumentado: alternado, de un vértice libre a otro libre.'
    }));
    for (let vuelta = 0; ; vuelta++) {
      const camino = vuelta < escritos.length
        ? pareamientos.comprobarCamino(grafo, M, escritos[vuelta]).camino
        : pareamientos.primerCamino(grafo, M);
      if (!camino) break;
      const entran = camino.aristas.filter((n) => !M.includes(n));
      const salen = camino.aristas.filter((n) => M.includes(n));
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun(), camino, fase: 'camino',
        calculo: [
          { etiqueta: 'Vértices', expresion: camino.vertices.join(', '), resultado: '', activa: false },
          { etiqueta: 'Aristas', expresion: camino.aristas.join(', '), resultado: `${camino.aristas.length}`, activa: true }
        ],
        tituloCalculo: `Camino ${vuelta + 1}`,
        mensaje: `Camino M-aumentado ${llaves(camino.vertices)} → ${llaves(camino.aristas)}: va de ${camino.vertices[0]} a ${camino.vertices[camino.vertices.length - 1]}, los dos libres, y alterna. Se invierte para saturar más vértices.`
      }));
      const nuevo = ordenadas(grafo, pareamientos.invertir(M, camino));
      tabla.push({ camino: camino.aristas, entran, salen, resultado: nuevo });
      M = nuevo;
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun(), camino, fase: 'invertido', entran, salen,
        calculo: [
          { etiqueta: 'Salen', expresion: salen.join(', ') || 'ninguna', resultado: '', activa: false },
          { etiqueta: 'Entran', expresion: entran.join(', '), resultado: '', activa: false },
          { etiqueta: 'M', expresion: llaves(M), resultado: `${M.length}`, activa: true }
        ],
        tituloCalculo: `Camino ${vuelta + 1} invertido`,
        mensaje: `Se invierte: ${salen.length ? `sale${salen.length === 1 ? '' : 'n'} ${lista(salen)}, y ` : ''}entra${entran.length === 1 ? '' : 'n'} ${lista(entran)}. M = ${llaves(M)}: una arista más.`
      }));
    }
    pasos.push(conclusion(grafo, comun(), {}));
    return pasos;
  }

  // Al terminar: qué es M, propiedad por propiedad, y ν(G).
  function conclusion(grafo, comun, extra) {
    const { M, modo } = comun;
    const c = pareamientos.clasificar(grafo, M);
    const aplica = (valor) => (c.esPareamiento ? valor : null);
    const propiedades = [
      {
        nombre: 'Pareamiento', valor: c.esPareamiento,
        detalle: c.esPareamiento ? 'ningún par de aristas comparte vértice'
          : c.choques.map((x) => `${x.aristas[0]} y ${x.aristas[1]} comparten ${x.vertice}`).join('; ')
      },
      {
        nombre: 'Maximal', valor: aplica(c.maximal),
        detalle: !c.esPareamiento ? 'no es pareamiento' : c.maximal ? 'inextensible: no le cabe ninguna arista más' : `le cabe la arista ${c.cabe}`
      },
      {
        nombre: 'Máximo', valor: aplica(c.maximo),
        detalle: !c.esPareamiento ? 'no es pareamiento' : c.maximo ? 'no hay ningún camino M-aumentado' : `tiene ${M.length} y ν(G) = ${c.nu}`
      },
      {
        nombre: 'Perfecto', valor: aplica(c.perfecto),
        detalle: !c.esPareamiento ? 'no es pareamiento' : c.perfecto ? 'satura todos los vértices: también es óptimo' : `quedan libres ${lista(c.libres)}`
      }
    ];
    const que = [c.perfecto && 'perfecto', c.maximo && 'máximo', c.maximal && 'maximal'].filter(Boolean);
    return crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun, ...extra, propiedades, nu: c.nu,
      vs: c.saturados, vl: c.libres, al: c.aristasLibres,
      calculo: [
        { etiqueta: 'Saturados', expresion: llaves(c.saturados), resultado: '', activa: false },
        { etiqueta: 'Libres', expresion: llaves(c.libres), resultado: '', activa: false },
        { etiqueta: 'ν(G)', expresion: 'número de matching', resultado: String(c.nu), activa: true }
      ],
      tituloCalculo: 'Conclusión',
      mensaje: !c.esPareamiento
        ? `M = ${llaves(M)} no es un pareamiento: ${propiedades[0].detalle}.`
        : `${modo === MODOS.MAXIMO ? 'No hay más caminos M-aumentados. ' : ''}M = ${llaves(M)}, ${M.length} ${M.length === 1 ? 'arista' : 'aristas'}: ${que.length ? `es ${lista(que)}` : 'no es maximal'}. ν(G) = ${c.nu}.`
    });
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.pareamientos = { recorrer };
})();
