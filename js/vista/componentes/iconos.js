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
    construido: ['M4 12.5l5 5L20 6.5']
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
