(function () {
  const vista = window.CC2.vista;
  const dominio = window.CC2.dominio;

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
    const { ajustarEscala, casillasAnidadas, casillasEncadenadas, columnasAnidadas, crearEtiquetasRenglones, crearMarca, crearTramo, esEncadenada, esVertical, llevarALaVista, relevantesDelPaso, segmentosAnidados, segmentosDe, tramoDescartado } = comunes;

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
        // La fila «Col» (CLAUDE.md 5.7): las claves que chocaron con una
        // cubeta llena, guardadas en la estructura hasta que la densidad
        // expanda. Tiene tantos renglones como la cubeta que más guarda, para
        // que cada renglón de Col quede a una sola altura en toda la matriz.
        const renglonesCol = esMatrizHorizontal
          // Solo las cubetas que se dibujan: una escondida en un tramo no
          // puede pedir renglones que nadie va a llenar.
          ? Math.max(0, ...segmentos
            .filter((segmento) => segmento.tipo === 'casilla')
            .map((segmento) => dominio.estructura.colDe(estado.estructura, segmento.indice).length))
          : 0;
        if (esMatrizHorizontal) {
          dom.estructuraEl.appendChild(crearEtiquetasRenglones(columnasDelAnidado, renglonesCol));
        }

        for (const segmento of segmentos) {
          const grupo = document.createElement('div');
          grupo.className = vertical ? 'fila-casilla' : 'columna-casilla';

          if (segmento.tipo === 'tramo') {
            const cruzaLaMatriz = vertical && columnasAnidadas() > 0 && !esEncadenada();
            const tramoEl = crearTramo(segmento.desde, segmento.hasta, segmento);
            // Si todo lo que resume está descartado, se apaga con ello: el
            // «⋯ 2 ⋯» del rastro de secuencial no puede brillar en medio de
            // lo ya recorrido (igual que en el apilado de binaria).
            if (paso && tramoDescartado(paso, segmento)) tramoEl.classList.add('tramo-elidido--descartado');
            // Sin rótulo, el grupo tiene un solo hijo: en vertical el grid lo
            // metería en la columna de la escala, así que se lo manda a la de
            // las casillas a mano. Con arreglos anidados cruza la matriz
            // entera, que es lo que dice que se saltaron filas completas. Con
            // encadenamiento, no (pedido del usuario, 2026-10-09): lo que se
            // salta son direcciones de la tabla, y la cadena no es una matriz
            // —cada una mide lo suyo—, así que va solo en la primera columna.
            if (vertical) tramoEl.style.gridColumn = cruzaLaMatriz ? '2 / -1' : '2';
            if (cruzaLaMatriz) tramoEl.classList.add('tramo-elidido--matriz');
            // En la matriz horizontal de cubetas, el tramo es una columna más:
            // deja el sitio del número de arriba y baja por todos los
            // renglones, dibujado como las cubetas vacías que resume (revisión
            // con el usuario, 2026-10-14). Antes medía 40 px fijos y quedaba
            // como una cajita montada entre la numeración y el primer renglón.
            if (esMatrizHorizontal) {
              const lugarDelNumero = document.createElement('span');
              lugarDelNumero.className = 'escala__marca';
              lugarDelNumero.textContent = '\u00a0';
              lugarDelNumero.setAttribute('aria-hidden', 'true');
              grupo.appendChild(lugarDelNumero);
              const renglones = 1 + columnasDelAnidado.length;
              tramoEl.classList.add(segmento.claves ? 'tramo-elidido--claves' : 'tramo-elidido--vacias', 'tramo-elidido--cubetas');
              if (segmento.claves) tramoEl.classList.remove('tramo-elidido--vacias');
              tramoEl.style.height = `calc(${renglones} * var(--alto-casilla) + ${renglones - 1} * var(--espacio-1))`;
            }
            grupo.appendChild(tramoEl);
            dom.estructuraEl.appendChild(grupo);
            continue;
          }

          const indice = segmento.indice;
          const clave = claves[indice - 1];
          const descripcion = config.describirCasilla({ paso, indice, ocupada: clave !== undefined });
          // La clave insertada de una vez lleva la marca de insertada, como la
          // de los temas con inserción paso a paso (pedido del usuario,
          // 2026-10-09): sin pasos, sigue siendo una inserción. Es su paso
          // (`pasoDeInsercion`), a mano o en el llenado automático, y el paso
          // final la apaga.
          // Solo en la casilla principal: con arreglo anidado o cubetas la
          // clave puede haber entrado en un renglón (`posicion`), y ese lo
          // marca el tema.
          const recienInsertada = clave !== undefined && !!paso && !paso.final
            && paso.tipo === 'insercion' && paso.casilla === indice && paso.posicion === undefined;
          const casillaEl = vista.componentes.casilla.crearCasilla({
            clave,
            indice,
            estado: recienInsertada ? 'insertada' : descripcion.estado,
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
          // Bajo cada cubeta, lo que guarda en Col; donde no hay nada, un hueco
          // del mismo alto, para que cada renglón de Col quede a una sola
          // altura y la escala siga rotulando lo que rotula.
          const filaCol = [];
          const col = dominio.estructura.colDe(estado.estructura, indice);
          for (let k = 1; k <= renglonesCol; k++) {
            if (col[k - 1] === undefined) {
              const hueco = document.createElement('span');
              hueco.className = 'casilla-hueca';
              if (k === 1) hueco.classList.add('en-col--primera');
              hueco.setAttribute('aria-hidden', 'true');
              filaCol.push(hueco);
              continue;
            }
            const descripcion = config.describirCasilla({ paso, indice, col: k, ocupada: true });
            filaCol.push(vista.componentes.casilla.crearCasilla({
              clave: col[k - 1],
              // La identidad es la clave y no el lugar: al subir de Col a la
              // cubeta, el FLIP la sigue hasta su renglón nuevo.
              indice: `col-${col[k - 1]}`,
              estado: descripcion.estado,
              modificadores: ['anidada'].concat(descripcion.modificadores || [])
            }));
            if (k === 1) filaCol[filaCol.length - 1].classList.add('en-col--primera');
          }

          grupo.append(...(vertical || esMatrizHorizontal
            ? [marcaEl, casillaEl, ...secundarias, ...filaCol]
            : [casillaEl, marcaEl]));
          dom.estructuraEl.appendChild(grupo);
          if (indice === indiceSeguido) grupoSeguido = grupo;
        }

        // Dentro del cambio y no después: así el FLIP mide las posiciones
        // finales, ya desplazadas —y ya escaladas—, y no anima contra
        // coordenadas viejas.
        ajustarEscala(paso);
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
