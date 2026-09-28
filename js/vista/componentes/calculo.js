(function () {
  // Panel del cálculo de la dirección: el contenido didáctico central de la
  // transformación de claves (CLAUDE.md 5.3). Vive junto a la estructura y no
  // en el panel lateral, porque lo que se enseña es la correspondencia entre
  // la cuenta y la casilla a la que apunta.
  //
  // No recuerda nada: recibe las líneas ya reveladas por el paso actual y
  // redibuja. Retroceder un paso es, por eso, gratis.
  // El rótulo lo pone el tema: en la transformación de claves lo que se
  // desarrolla es la dirección, y en los árboles de bits el código de la letra
  // y el camino que abre (CLAUDE.md 5.5).
  function crearPanelCalculo({ titulo = 'Cálculo de la dirección' } = {}) {
    const el = document.createElement('section');
    el.className = 'calculo';

    const tituloEl = document.createElement('h3');
    tituloEl.className = 'calculo__titulo texto-nivel-4';
    tituloEl.textContent = titulo;

    const lista = document.createElement('ol');
    lista.className = 'calculo__lineas';

    const seccion = document.createElement('div');
    seccion.className = 'calculo__saltos';
    const tituloSaltos = document.createElement('p');
    tituloSaltos.className = 'calculo__saltos-titulo';
    const listaSaltos = document.createElement('ol');
    listaSaltos.className = 'calculo__lineas';
    seccion.append(tituloSaltos, listaSaltos);

    el.append(tituloEl, lista, seccion);

    // Una tabla con muchas colisiones da una lista de saltos más alta que el
    // lienzo. Se elide como todo lo demás (CLAUDE.md 6.2): el primer salto,
    // los últimos y un renglón que dice cuántos se resumieron en medio.
    const SALTOS_VISIBLES = 5;
    const SALTOS_AL_FINAL = 3;

    function renglon(linea, { activa = false } = {}) {
      const item = document.createElement('li');
      item.className = 'calculo__linea'
        + (activa ? ' calculo__linea--activa' : '')
        + (linea.nota ? ' calculo__linea--descartada' : '');

      const etiqueta = document.createElement('span');
      etiqueta.className = 'calculo__etiqueta texto-nivel-5';
      etiqueta.textContent = linea.etiqueta;

      const expresion = document.createElement('span');
      expresion.className = 'calculo__expresion texto-mono';
      expresion.textContent = linea.expresion;
      // Por qué el salto no sirvió —la clave que ocupaba la casilla—, debajo
      // de la cuenta y no en su lugar: la cuenta es lo que se enseña.
      if (linea.nota) {
        const nota = document.createElement('span');
        nota.className = 'calculo__nota';
        nota.textContent = linea.nota;
        expresion.appendChild(nota);
      }

      const resultado = document.createElement('span');
      resultado.className = 'calculo__resultado texto-mono';
      resultado.textContent = linea.resultado;

      item.append(etiqueta, expresion, resultado);
      return item;
    }

    // `saltos` es la reasignación (CLAUDE.md 5.4): va en una sección aparte,
    // debajo de la dirección, para que el cálculo de la función hash quede
    // intacto y se vea qué dio ella y qué hizo el tratamiento cuando esa
    // dirección estaba ocupada.
    //
    // `tituloDelPaso` lo pone un algoritmo que cambia de fase a media traza
    // —binaria externa: primero por bloques, después dentro de uno (CLAUDE.md
    // 5.11)—. Sin él vuelve el del tema.
    function actualizar(lineas, saltos = null, tituloDelPaso = null) {
      tituloEl.textContent = tituloDelPaso || titulo;
      lista.innerHTML = '';
      seccion.hidden = true;
      if (!lineas || lineas.length === 0) {
        const vacio = document.createElement('li');
        vacio.className = 'calculo__vacio texto-nivel-5';
        vacio.textContent = 'Sin operación en curso.';
        lista.appendChild(vacio);
        return;
      }

      // La última revelada es la que el paso acaba de producir: marcarla es
      // lo que hace legible el avance cuando la reproducción va rápido. Con
      // saltos, la última revelada es el último salto.
      const haySaltos = Boolean(saltos && saltos.lineas.length);
      lineas.forEach((linea, indice) => {
        lista.appendChild(renglon(linea, { activa: !haySaltos && indice === lineas.length - 1 }));
      });

      if (!saltos) return;
      seccion.hidden = false;
      tituloSaltos.textContent = saltos.titulo;
      listaSaltos.innerHTML = '';
      const total = saltos.lineas.length;
      const elidir = total > SALTOS_VISIBLES;
      saltos.lineas.forEach((linea, indice) => {
        if (elidir && indice > 0 && indice < total - SALTOS_AL_FINAL) {
          if (indice === 1) {
            const resumidos = total - 1 - SALTOS_AL_FINAL;
            const elision = document.createElement('li');
            elision.className = 'calculo__elision texto-nivel-5';
            elision.textContent = `⋯ ${resumidos} saltos más ⋯`;
            listaSaltos.appendChild(elision);
          }
          return;
        }
        listaSaltos.appendChild(renglon(linea, { activa: indice === total - 1 }));
      });
    }

    actualizar(null);
    return { el, actualizar };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.calculo = { crearPanelCalculo };
})();
