(function () {
  // **Íconos dibujados, no caracteres** (2026-10-06). Acompañan al color en los
  // avisos y en el mensaje de cada paso: proyectado, el naranja de una
  // colisión y el verde de una clave hallada se lavan hasta parecerse, y hay
  // estudiantes que no distinguen el rojo del verde. La forma no se pierde.
  //
  // En SVG y no con `✓` o `⇄`: el computador del aula tiene fuentes que no se
  // conocen (CLAUDE.md 6.9), y un carácter que su fuente no trae sale como un
  // cuadro vacío. El trazo toma el color del texto (`currentColor`), así que
  // el CSS los pinta como pinta el resto del aviso.
  //
  // Cada ícono es una lista de trazos sobre una cuadrícula de 24 × 24.
  const TRAZOS = Object.freeze({
    // Gravedad de un aviso general.
    exito: ['M4 12.5l5 5L20 6.5'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 11v6', 'M12 7.5v.01'],
    advertencia: ['M12 3 2 20h20L12 3z', 'M12 10v4.5', 'M12 17.5v.01'],
    error: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9 9l6 6', 'M15 9l-6 6'],

    // Tipos de paso (algoritmos/traza.js).
    // Comparar: la clave buscada contra la de la casilla, en los dos sentidos.
    comparacion: ['M4 8h14', 'M14 4l4 4-4 4', 'M20 16H6', 'M10 12l-4 4 4 4'],
    encontrada: ['M4 12.5l5 5L20 6.5'],
    // Una lupa que no halló nada.
    'no-encontrada': ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.5 15.5 21 21', 'M8.5 8.5l4 4', 'M12.5 8.5l-4 4'],
    calculo: ['M5 9h14', 'M5 15h14'],
    // Una casilla que gana o pierde su clave.
    insercion: ['M4 4h16v16H4z', 'M12 8v8', 'M8 12h8'],
    eliminacion: ['M4 4h16v16H4z', 'M8 12h8'],
    // Dos claves que caen en la misma casilla.
    colision: ['M3 3h11v11H3z', 'M10 10h11v11H10z'],
    // Se avanza a la siguiente casilla del sondeo.
    sondeo: ['M4 12h15', 'M14 7l5 5-5 5'],
    // Las de atrás se corren hacia el hueco.
    desplazamiento: ['M20 12H5', 'M10 7l-5 5 5 5'],
    // Una clave que sale de su casilla para volver a pasar por la función.
    extraccion: ['M4 12v8h16v-8', 'M12 15V3', 'M7 8l5-5 5 5'],
    // Se baja por un nodo que solo bifurca.
    ramificacion: ['M12 3v7', 'M12 10 5 20', 'M12 10l7 10'],
    rechazada: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M5 5l14 14'],
    saturada: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M5 5l14 14'],
    // n crece o encoge.
    expansion: ['M3 12h18', 'M7 8l-4 4 4 4', 'M17 8l4 4-4 4'],
    reduccion: ['M3 12h7', 'M14 12h7', 'M6 8l4 4-4 4', 'M18 8l-4 4 4 4'],
    // Dos nodos de Huffman que se vuelven uno: un árbol mínimo, dos nodos y su
    // padre, y no una «Y», que entre claves que son letras se leía como una.
    union: ['M6 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
      'M12 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M7.3 7.6l3.6 8.6', 'M16.7 7.6l-3.6 8.6'],
    construido: ['M4 12.5l5 5L20 6.5'],

    // Acciones de la cinta y del menú (cinta.js, menu.js; 2026-11-25).
    crear: ['M4 20l1-5L16 4l4 4L9 19z', 'M13 7l4 4'],
    insertar: ['M4 4h16v16H4z', 'M12 8v8', 'M8 12h8'],
    buscar: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.5 15.5 21 21'],
    eliminar: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v5', 'M14 11v5'],
    llenar: ['M4 20 15 9', 'M13 7l4 4', 'M18 2v4', 'M16 4h4', 'M20 12v3', 'M18.5 13.5h3', 'M8 3v3', 'M6.5 4.5h3'],
    palabra: ['M3 17 7 7l4 10', 'M4.5 14h5', 'M14 17V7h3a2.5 2.5 0 0 1 0 5h-3', 'M17 12h.5a2.5 2.5 0 0 1 0 5H14'],
    reproducir: ['M7 4l13 8-13 8z'],
    pausar: ['M7 4h3v16H7z', 'M14 4h3v16h-3z'],
    anterior: ['M18 5 8 12l10 7z', 'M5 5v14'],
    siguiente: ['M6 5l10 7-10 7z', 'M19 5v14'],
    abrir: ['M3 19V5h6l2 3h9v3', 'M3 19l3-8h16l-3 8z'],
    guardar: ['M4 4h12l4 4v12H4z', 'M8 4v5h7V4', 'M8 20v-6h8v6'],
    vaciar: ['M8 20l-4-4L14 4l6 6-8 10z', 'M9.5 9.500l7 6', 'M8 20h13'],
    completa: ['M2 12c3-5 6.5-7 10-7s7 2 10 7c-3 5-6.5 7-10 7s-7-2-10-7z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    bitacora: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6v.01', 'M4 12v.01', 'M4 18v.01'],
    cerrar: ['M6 6l12 12', 'M18 6 6 18'],
    plegar: ['M6 15l6-6 6 6'],
    inicio: ['M4 11l8-7 8 7', 'M6 10v10h12V10', 'M10 20v-6h4v6'],
    volver: ['M20 12H5', 'M11 6l-6 6 6 6'],
    entrar: ['M5 12h14', 'M13 6l6 6-6 6'],
    miga: ['M9 5l7 7-7 7'],
    reloj: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3.5 2'],
    escribir: ['M3 6h9', 'M3 12h7', 'M3 18h6', 'M13 20l.6-3.500L20 10l2.500 2.500-6 6.500z'],
    puntos: ['M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0', 'M14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0', 'M21 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0'],

    // Opciones de los temas.
    dirigido: ['M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M22 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7.5 15 15 9.500', 'M11 9.300l4 .2-1 4'],
    'no-dirigido': ['M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M22 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7.500 15.300l9-7.600'],
    floyd: ['M4 4h16v16H4z', 'M4 9.300h16', 'M4 14.600h16', 'M9.300 4v16', 'M14.600 4v16'],
    dijkstra: ['M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M15 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M23 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M5.500 15.500l5-7', 'M13.500 8.500l5 7', 'M7 18h10'],
    bellman: ['M6 16a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0', 'M14.500 16a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0', 'M23 16a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0', 'M6 16h3.500', 'M14.500 16H18', 'M4 13.500c3-8 13-8 16 0', 'M20.800 9.800 20 13.500l-3.600-1.300'],
    incidencia: ['M7 3H4v18h3', 'M17 3h3v18h-3', 'M9 8h.01', 'M15 8h.01', 'M12 12h.01', 'M9 16h.01', 'M15 16h.01'],
    'de-vertices': ['M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M21 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M15 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
    'de-aristas': ['M6 6h12', 'M5 7l6 11', 'M19 7l-6 11'],
    'insertar-vertice': ['M9 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'M9 13l4-2.500', 'M18 4v8', 'M14 8h8'],
    'borrar-vertice': ['M9 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'M9 13l4-2.500', 'M15 5l6 6', 'M21 5l-6 6'],
    'insertar-arista': ['M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M23 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 18h10', 'M12 4v8', 'M8 8h8'],
    'borrar-arista': ['M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M23 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 18h10', 'M9 5l6 6', 'M15 5l-6 6'],
    'fusionar-vertices': ['M7 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 7l7 4', 'M7 17l7-4', 'M22 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
    'contraer-arista': ['M5 12a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0', 'M24 12a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0', 'M5 12h5', 'M7.500 9l3 3-3 3', 'M19 12h-5', 'M16.500 9l-3 3 3 3'],
    complemento: ['M5 5h14v14H5z', 'M5 5l14 14', 'M19 5 5 19'],
    emparejar: ['M7 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M23 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 6h10', 'M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M23 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 18h10'],
    comprobar: ['M9 4H5v16h14v-9', 'M9 12l3 3 8-10'],
    envolvente: ['M4 14 7 5l9-2 5 8-6 10z', 'M11 10h.01', 'M13 14h.01'],
    divide: ['M12 2v20', 'M5 7v.01', 'M7 14v.01', 'M4 18v.01', 'M18 6v.01', 'M20 12v.01', 'M17 18v.01'],
    quickhull: ['M12 3 21 12l-9 9-9-9z', 'M12 12h.01'],
    graham: ['M4 20h17', 'M4 20 18 10', 'M4 20 11 4', 'M4 20h.01'],
    jarvis: ['M5 17 4 8l8-5 7 5', 'M16 4.500 19 8l-4.500.5', 'M19 14l-6 7', 'M11 12h.01'],
    menor: ['M12 4v15', 'M6 13l6 6 6-6'],
    mayor: ['M12 20V5', 'M6 11l6-6 6 6'],
    kruskal: ['M4 6h5', 'M4 12h9', 'M4 18h14', 'M19 4v8', 'M16 9l3 3 3-3'],
    prim: ['M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M7 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M23 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M10.500 7.500l-5 9', 'M13.500 7.500l5 9'],
    primario: ['M3 5h5v5H3z', 'M3 14h5v5H3z', 'M8 7.500h5', 'M8 16.500h5', 'M13 4h8v7h-8z', 'M13 13h8v7h-8z'],
    secundario: ['M3 4h5', 'M3 9h5', 'M3 14h5', 'M3 19h5', 'M8 4l6 10', 'M8 9l6 10', 'M8 14l6-10', 'M8 19l6-10', 'M14 4h7', 'M14 9h7', 'M14 14h7', 'M14 19h7'],
    'un-nivel': ['M4 5h5v14H4z', 'M9 12h6', 'M15 5h5v14h-5z'],
    multinivel: ['M2 9h4v6H2z', 'M9 6h4v12H9z', 'M16 3h5v18h-5z', 'M6 12h3', 'M13 12h3'],
    total: ['M3 8h6v8H3z', 'M13 8h4v8h-4z', 'M17 8h4v8h-4z', 'M9 12h4'],
    parcial: ['M3 8h6v8H3z', 'M12 8h3v8h-3z', 'M17 8h3v8h-3z'],
    // Grupos de la guía del lienzo vacío.
    operar: ['M4 4h16v16H4z', 'M12 8v8', 'M8 12h8']
  });

  function existe(nombre) {
    return Object.prototype.hasOwnProperty.call(TRAZOS, nombre);
  }

  function crearIcono(nombre) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icono');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of TRAZOS[existe(nombre) ? nombre : 'info']) {
      const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      trazo.setAttribute('d', d);
      svg.appendChild(trazo);
    }
    return svg;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.iconos = { crearIcono, existe };
})();
