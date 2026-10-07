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
  //
  // `capacidad` es cuántas casillas caben de verdad en el lienzo, medido por
  // quien dibuja. Si la da, reemplaza al umbral fijo: las estructuras
  // ordenadas se eliden **solo cuando no caben** (revisión de diseño,
  // 2026-10-04), porque con el umbral una pantalla ancha escondía el
  // recorrido casilla por casilla que el tema enseña. Las dispersas no la dan
  // y siguen con el umbral y la regla del docente.
  function calcularSegmentos({
    n,
    relevantes,
    orientacion = 'horizontal',
    mostrarCompleta = false,
    vecinas = true,
    capacidad = null
  }) {
    const umbral = capacidad !== null
      ? capacidad
      : (orientacion === 'horizontal' ? UMBRAL_HORIZONTAL : UMBRAL_VERTICAL);
    if (mostrarCompleta || n <= umbral) {
      const todas = [];
      for (let i = 1; i <= n; i++) todas.push({ tipo: 'casilla', indice: i });
      return todas;
    }

    const visibles = indicesSiempreVisibles(n, relevantes, vecinas);
    if (capacidad !== null) llenarHastaLaCapacidad(n, relevantes, visibles, capacidad);
    return segmentosDe(n, visibles);
  }

  // Con la capacidad medida, elidir no tiene por qué quedarse en el mínimo:
  // se destapan casillas alrededor de las relevantes, anillo por anillo,
  // mientras el dibujo quepa. Así una pantalla en la que caben nueve muestra
  // «1 … 7 ⋯ 24» y no «1 … 5 ⋯ 24», y lo que se esconde es solo lo que de
  // verdad no cabe. El tramo cuenta como una casilla: su «⋯ 18 ⋯» mide más o
  // menos lo mismo, y el margen que deja quien mide cubre la diferencia.
  function llenarHastaLaCapacidad(n, relevantes, visibles, capacidad) {
    const centros = relevantes.length ? relevantes : [1];
    for (let distancia = 1; distancia < n; distancia++) {
      for (const centro of centros) {
        for (const indice of [centro - distancia, centro + distancia]) {
          if (indice < 1 || indice > n || visibles.has(indice)) continue;
          visibles.add(indice);
          if (segmentosDe(n, visibles).length > capacidad) {
            visibles.delete(indice);
            return;
          }
        }
      }
    }
  }

  function segmentosDe(n, visibles) {
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
