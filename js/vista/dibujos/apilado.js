(function () {
  const vista = window.CC2.vista;

  // La vista apilada de binaria (CLAUDE.md 6.3): una fila por cada vez que
  // se parte el rango, alineadas en un solo grid.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoApilado({ estado, dom, config, comunes }) {
    const { crearMarca, crearTramo } = comunes;

    // Vista apilada: una estructura por paso (pedido del docente). **Cada fila
    // es la estructura entera, con lo descartado apagado en su sitio** y no
    // recortado (pedido del usuario sobre maqueta, 2026-09-27): así se ve cómo
    // se van apagando los tramos que ya no se usan, fila a fila. Todas las
    // filas comparten
    // un único grid —no un grid por fila— porque es lo que alinea cada casilla
    // con su posición real en la estructura original; con grids independientes
    // las columnas no se corresponden entre filas.
    //
    // Los segmentos se calculan una sola vez, sobre las casillas relevantes de
    // la traza completa, para que las columnas no se muevan mientras el
    // estudiante avanza los pasos.
    //
    // «Entera» es el rango del primer paso —de la casilla 1 a la última clave—:
    // si las filas deben mostrar también las vacías del final sigue pendiente
    // del docente (CLAUDE.md 6.3).
    function renderizarApilado(indicePaso) {
      const claves = estado.estructura.claves;
      const n = estado.estructura.n;
      const segmentos = estado.segmentosApilado;
      const extension = config.apilada.rangoDePaso(estado.pasos[0]);

      dom.estructuraEl.className = 'estructura-apilada';
      // Una pista por segmento, del ancho único de casilla; el tramo elidido
      // se dimensiona por su conteo, que no es una clave.
      const pistas = segmentos.map(
        (segmento) => (segmento.tipo === 'tramo' ? 'max-content' : 'var(--ancho-casilla)')
      );
      dom.estructuraEl.style.gridTemplateColumns = ['auto', ...pistas].join(' ');
      dom.estructuraEl.innerHTML = '';

      const elementosUltimaFila = [];
      const agregar = (orden, ...elementos) => {
        dom.estructuraEl.append(...elementos);
        if (orden === indicePaso) elementosUltimaFila.push(...elementos);
      };

      for (let orden = 0; orden <= indicePaso; orden++) {
        const paso = estado.pasos[orden];
        const rango = config.apilada.rangoDePaso(paso);
        const filaCasillas = orden * 2 + 1;

        // **En la fila de las casillas y no a caballo entre ella y la escala**
        // (defecto visto por el usuario, 2026-09-11). Abarcando las dos, el
        // rótulo se centraba entre ambas y quedaba 16 px por debajo del centro
        // de la fila que nombra — más cerca de la escala que de las casillas.
        const rotulo = document.createElement('span');
        rotulo.className = 'apilada__rotulo texto-nivel-5';
        rotulo.textContent = `Paso ${orden + 1}`;
        rotulo.style.gridColumn = '1';
        rotulo.style.gridRow = String(filaCasillas);
        agregar(orden, rotulo);

        // Sin extensión la estructura no tenía claves: no hay fila que dibujar,
        // y decirlo es más claro que una fila vacía. Una búsqueda que se agotó
        // sí dibuja la suya, entera y toda apagada.
        if (!extension) {
          const cierre = document.createElement('span');
          cierre.className = 'apilada__cierre texto-nivel-5';
          cierre.textContent = 'Rango vacío: no quedan casillas por examinar.';
          cierre.style.gridColumn = `2 / span ${segmentos.length}`;
          cierre.style.gridRow = String(filaCasillas);
          agregar(orden, cierre);
          continue;
        }

        segmentos.forEach((segmento, posicion) => {
          const columna = String(posicion + 2);

          if (segmento.tipo === 'tramo') {
            const desde = Math.max(segmento.desde, extension.desde);
            const hasta = Math.min(segmento.hasta, extension.hasta);
            if (desde > hasta) return;

            const tramoEl = crearTramo(desde, hasta);
            // Un tramo que cae entero fuera del rango se apaga como las
            // casillas que resume: si no, «⋯ 2 ⋯» brillaría en medio de lo
            // descartado.
            if (!rango || hasta < rango.desde || desde > rango.hasta) {
              tramoEl.classList.add('tramo-elidido--descartado');
            }
            tramoEl.style.gridColumn = columna;
            tramoEl.style.gridRow = String(filaCasillas);

            // La fila de la escala queda vacía en esta columna: su alto lo
            // sostienen las marcas de las casillas, que nunca faltan —una fila
            // del apilado siempre dibuja las relevantes de su paso.
            agregar(orden, tramoEl);
            return;
          }

          const indice = segmento.indice;
          if (indice < extension.desde || indice > extension.hasta) return;

          const clave = claves[indice - 1];
          const descripcion = config.describirCasilla({ paso, indice, ocupada: clave !== undefined });
          // Sin corchete de rango: el azul ya lo marca, y lo de fuera está
          // apagado.
          const casillaEl = vista.componentes.casilla.crearCasilla({
            clave,
            indice,
            estado: descripcion.estado
          });
          casillaEl.style.gridColumn = columna;
          casillaEl.style.gridRow = String(filaCasillas);

          const marcaEl = crearMarca(indice, n);
          marcaEl.style.gridColumn = columna;
          marcaEl.style.gridRow = String(filaCasillas + 1);

          agregar(orden, casillaEl, marcaEl);
        });
      }

      // Solo la fila recién agregada entra animada; las anteriores ya estaban.
      if (!vista.animacion.prefiereMovimientoReducido()) {
        for (const el of elementosUltimaFila) {
          vista.animacion.reemplazarAnimacion(el, [
            { opacity: 0, transform: 'translateY(-6px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ], { duration: 180, easing: 'ease-out' });
        }
      }

      dom.estructuraEl.scrollTop = dom.estructuraEl.scrollHeight;
    }

    return { renderizarApilado };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.apilado = crearDibujoApilado;
})();
