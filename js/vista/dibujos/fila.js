(function () {
  const vista = window.CC2.vista;

  // La vista de una sola estructura (CLAUDE.md 6.1 y 6.2): una fila
  // horizontal, o la tabla vertical de los temas hash con sus arreglos
  // anidados o sus cadenas al lado. La usan los temas que no acumulan filas,
  // y binaria mientras no hay una búsqueda en curso.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoFila({ estado, dom, config, comunes }) {
    const { casillasAnidadas, casillasEncadenadas, columnasAnidadas, crearEtiquetasRenglones, crearMarca, crearTramo, esEncadenada, esVertical, llevarALaVista, relevantesDelPaso, segmentosAnidados, segmentosDe, tramoDescartado } = comunes;

    // Vista de una sola estructura: la que usan los temas que no acumulan
    // (secuencial, transformación de claves), y también binaria mientras no hay
    // una búsqueda en curso.
    function renderizarFilaUnica(paso, opciones) {
      const claves = estado.estructura.claves;
      const n = estado.estructura.n;
      const segmentos = segmentosDe(relevantesDelPaso(paso));
      const vertical = esVertical();
      // La primera relevante es la casilla que el paso está evaluando en los
      // temas que usan esta vista (`paso.casilla` en secuencial y en hash).
      // Binaria no entra aquí con un paso: cuando hay traza usa el apilado,
      // que se desplaza solo al final porque lo nuevo siempre va abajo.
      const relevantesDelPasoActual = paso ? config.casillasRelevantes(paso) : [];
      const indiceSeguido = relevantesDelPasoActual[0];
      let grupoSeguido = null;
      // Una sola vez para todas las filas o columnas: es lo que mantiene la
      // matriz alineada. No depende de la orientación —`segmentosAnidados`
      // devuelve `[]` sin más si el tema no declara `config.anidados`—, así
      // que calcularla siempre no cambia nada en los temas horizontales que
      // no tienen arreglo secundario (secuencial, binaria).
      const columnasDelAnidado = segmentosAnidados(paso);
      // Horizontal con arreglo secundario: la única forma hoy es otras
      // búsquedas dinámicas (CLAUDE.md 5.7), donde la cubeta es la columna y
      // sus renglones bajan dentro. Ahí la marca de la cubeta va arriba, no
      // al pie, y hace falta una columna aparte que numere los renglones.
      const esMatrizHorizontal = !vertical && columnasDelAnidado.length > 0;

      // Casilla y marca de la escala se dibujan en la misma línea: es lo que
      // mantiene la numeración alineada con lo que rotula cuando hay elisión
      // y los tramos comprimidos tienen ancho propio (CLAUDE.md 6.4). En
      // vertical la marca va antes, a la izquierda, que es como se rotula una
      // tabla de direcciones.
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = vertical ? 'estructura-vertical' : 'estructura-horizontal';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';
        // Una sola columna de etiquetas para toda la matriz, no una por
        // cubeta: los renglones son los mismos en todas (CLAUDE.md 5.7).
        // La clave que chocó vive en el paso, no en la estructura: no está
        // colocada en ningún sitio, está esperando a que la expansión le haga
        // hueco. Por eso se dibuja desde aquí y no desde `claves`.
        const rechazada = (paso && paso.rechazada) || null;
        if (esMatrizHorizontal) {
          dom.estructuraEl.appendChild(crearEtiquetasRenglones(columnasDelAnidado, !!rechazada));
        }

        for (const segmento of segmentos) {
          const grupo = document.createElement('div');
          grupo.className = vertical ? 'fila-casilla' : 'columna-casilla';

          if (segmento.tipo === 'tramo') {
            const tramoEl = crearTramo(segmento.desde, segmento.hasta);
            // Si todo lo que resume está descartado, se apaga con ello: el
            // «⋯ 2 ⋯» del rastro de secuencial no puede brillar en medio de
            // lo ya recorrido (igual que en el apilado de binaria).
            if (paso && tramoDescartado(paso, segmento)) tramoEl.classList.add('tramo-elidido--descartado');
            // Sin rótulo, el grupo tiene un solo hijo: en vertical el grid lo
            // metería en la columna de la escala, así que se lo manda a la de
            // las casillas a mano. Con arreglos anidados cruza la matriz
            // entera, que es lo que dice que se saltaron filas completas.
            if (vertical) tramoEl.style.gridColumn = columnasAnidadas() > 0 ? '2 / -1' : '2';
            grupo.appendChild(tramoEl);
            dom.estructuraEl.appendChild(grupo);
            continue;
          }

          const indice = segmento.indice;
          const clave = claves[indice - 1];
          const descripcion = config.describirCasilla({ paso, indice, ocupada: clave !== undefined });
          const casillaEl = vista.componentes.casilla.crearCasilla({
            clave,
            indice,
            estado: descripcion.estado,
            modificadores: descripcion.modificadores
          });
          const marcaEl = crearMarca(indice, n);
          // La cadena ocupa una sola columna del grid y se ordena por dentro:
          // no tiene un largo fijo con el que hacer pistas, y no hace falta
          // —una cadena no es una matriz y no hay columnas que alinear—.
          const cadenaEl = vertical && esEncadenada() ? casillasEncadenadas(paso, indice) : null;
          // No depende de `vertical`: en otras búsquedas dinámicas (CLAUDE.md
          // 5.7) la matriz se dibuja horizontal —una cubeta por columna, sus
          // renglones bajando dentro de ella, como lo dibuja el docente— y
          // `casillasAnidadas` ya es agnóstica a la orientación. Basta con que
          // haya columnas que dibujar (`columnasDelAnidado.length > 0`, que es
          // cero en secuencial y binaria, donde no hay arreglo secundario).
          const anidadas = !esEncadenada() && columnasDelAnidado.length > 0
            ? casillasAnidadas(paso, indice, columnasDelAnidado)
            : [];
          if (vertical && esEncadenada()) {
            grupo.style.gridTemplateColumns = '3ch var(--ancho-casilla) auto';
          } else if (vertical) {
            // Pistas de ancho fijo, una por casilla. Con `auto` cada fila era
            // un grid aparte que repartía el sobrante a su manera: la fila con
            // clave quedaba más ancha que la vacía y las columnas de la matriz
            // dejaban de coincidir entre filas. El tramo elidido es la
            // excepción —se dimensiona por su contenido— porque lleva dentro
            // un conteo y no una clave.
            const pistas = columnasDelAnidado.map((segmento, columna) => {
              if (segmento.tipo === 'tramo') return 'max-content';
              // La primera columna del arreglo lleva el canal que la separa de
              // la tabla: su pista tiene que contarlo, o la casilla se saldría
              // de ella y se montaría sobre la siguiente.
              return columna === 0
                ? 'calc(var(--ancho-casilla) + var(--espacio-3))'
                : 'var(--ancho-casilla)';
            });
            grupo.style.gridTemplateColumns = ['3ch', 'var(--ancho-casilla)', ...pistas].join(' ');
          }

          const secundarias = cadenaEl ? [cadenaEl] : anidadas;
          // Horizontal con matriz: la columna apila la marca de la cubeta
          // arriba (pedido del usuario, 2026-09-06), el renglón principal y
          // los secundarios debajo —`.columna-casilla` ya es un flex en
          // columna, así que apilarlos basta, sin pistas de grid—. Horizontal
          // sin matriz (secuencial, binaria) sigue con la marca al pie.
          // Bajo la cubeta que la rechazó va la clave que no cupo; bajo las
          // demás, un hueco del mismo alto, para que la fila «Col» quede a una
          // sola altura y la escala siga rotulando lo que rotula.
          const filaCol = [];
          if (rechazada) {
            const esLaSuya = rechazada.casilla === indice;
            const celda = esLaSuya
              ? vista.componentes.casilla.crearCasilla({
                clave: rechazada.clave,
                indice: `col-${indice}`,
                estado: 'colision',
                modificadores: ['anidada']
              })
              : document.createElement('span');
            if (!esLaSuya) {
              celda.className = 'casilla-hueca';
              celda.setAttribute('aria-hidden', 'true');
            }
            filaCol.push(celda);
          }

          grupo.append(...(vertical || esMatrizHorizontal
            ? [marcaEl, casillaEl, ...secundarias, ...filaCol]
            : [casillaEl, marcaEl]));
          dom.estructuraEl.appendChild(grupo);
          if (indice === indiceSeguido) grupoSeguido = grupo;
        }

        // Dentro del cambio y no después: así el FLIP mide las posiciones
        // finales, ya desplazadas, y no anima contra coordenadas viejas.
        llevarALaVista(grupoSeguido);
        // La fila y no la casilla: el FLIP mueve las casillas con `transform`
        // y medirlas en pleno viaje daría dónde van pasando, no dónde quedan.
        dom.filaSeguida = grupoSeguido;
      }, opciones);
    }

    return { renderizarFilaUnica };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.fila = crearDibujoFila;
})();
