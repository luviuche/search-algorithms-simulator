(function () {
  const UMBRAL_HORIZONTAL = 12;
  const UMBRAL_VERTICAL = 10;

  // Casillas siempre visibles (CLAUDE.md 6.2): 1, n y las relevantes del paso,
  // más una vecina a cada lado cuando `vecinas` está activo.
  //
  // La vecina da contexto a una comparación —se ve contra qué se comparó y qué
  // había al lado—, pero en una tabla dispersa lo relevante son todas las
  // claves colocadas, y darle dos casillas vacías a cada una llena la pantalla
  // sin decir nada. Por eso quien dibuja decide si la regla aplica.
  function indicesSiempreVisibles(n, relevantes, vecinas) {
    const conjunto = new Set([1, n]);
    for (const indice of relevantes) {
      conjunto.add(indice);
      if (!vecinas) continue;
      if (indice - 1 >= 1) conjunto.add(indice - 1);
      if (indice + 1 <= n) conjunto.add(indice + 1);
    }
    return conjunto;
  }

  // Devuelve una lista de segmentos { tipo: 'casilla', indice } o
  // { tipo: 'tramo', desde, hasta, cantidad } que la vista dibuja en orden.
  function calcularSegmentos({
    n,
    relevantes,
    orientacion = 'horizontal',
    mostrarCompleta = false,
    vecinas = true
  }) {
    const umbral = orientacion === 'horizontal' ? UMBRAL_HORIZONTAL : UMBRAL_VERTICAL;
    if (mostrarCompleta || n <= umbral) {
      const todas = [];
      for (let i = 1; i <= n; i++) todas.push({ tipo: 'casilla', indice: i });
      return todas;
    }

    const visibles = indicesSiempreVisibles(n, relevantes, vecinas);
    const segmentos = [];
    let inicioOculto = null;

    // Comprimir una sola casilla no ahorra espacio —el rótulo "⋯ 1 ⋯" ocupa más
    // que la casilla— y rompe la continuidad de la escala sin ganar nada.
    function cerrarTramo(desde, hasta) {
      if (desde === hasta) {
        segmentos.push({ tipo: 'casilla', indice: desde });
        return;
      }
      segmentos.push({ tipo: 'tramo', desde, hasta, cantidad: hasta - desde + 1 });
    }

    for (let i = 1; i <= n; i++) {
      if (visibles.has(i)) {
        if (inicioOculto !== null) {
          cerrarTramo(inicioOculto, i - 1);
          inicioOculto = null;
        }
        segmentos.push({ tipo: 'casilla', indice: i });
      } else if (inicioOculto === null) {
        inicioOculto = i;
      }
    }
    if (inicioOculto !== null) {
      cerrarTramo(inicioOculto, n);
    }
    return segmentos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.elision = { UMBRAL_HORIZONTAL, UMBRAL_VERTICAL, calcularSegmentos };
})();
