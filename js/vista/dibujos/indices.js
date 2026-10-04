(function () {
  const dominio = window.CC2.dominio;
  const vista = window.CC2.vista;

  // Índices primarios, secundarios y multinivel (CLAUDE.md 5.10 y 6.4): una
  // columna por nivel de índice más el archivo, y las flechas en SVG entre
  // ellas.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoIndices({ estado, dom, config, renderizarLienzoVacio, comunes }) {
    const { llevarALaVista } = comunes;

    // Índices primarios, secundarios y multinivel (CLAUDE.md 5.x): sexta
    // orientación de la pantalla, y la única que no dibuja ni una casilla con
    // clave dentro. Lo que se dibuja son **estructuras enteras una al lado de
    // otra** —de la raíz del índice al archivo de datos— unidas por flechas,
    // que es como el docente las dibuja a mano y como lo pidió el usuario
    // (2026-09-17).
    //
    // Tres decisiones que conviene no deshacer sin saber por qué están:
    //
    //   · **Las columnas se dibujan todas desde el primer paso**, apagadas las
    //     que la derivación aún no definió. Ir añadiéndolas cambiaría el ancho
    //     a cada paso, y con el lienzo desplazándose eso es imposible de
    //     seguir.
    //   · **El SVG de las flechas vive dentro de la pista**, no del contenedor
    //     que scrollea: fuera, las flechas se quedarían quietas mientras las
    //     columnas se mueven por debajo.
    //   · **No lleva viewBox**, para que una unidad del SVG sea un píxel de
    //     CSS y las flechas se puedan trazar con lo que mide el DOM.
    const NS_SVG = 'http://www.w3.org/2000/svg';
    // B1 y B2 siempre a la vista: con uno solo no se lee que es una pila.
    const BLOQUES_CABECERA = 2;

    function esIndices() {
      return config.orientacion === 'indices';
    }

    // La estructura que toca dibujar. Durante la derivación viaja en el paso;
    // fuera de ella se recalcula de los parámetros, que es lo que hay recién
    // creada la estructura y al retroceder hasta antes del primer paso.
    function estructuraDeIndices(paso) {
      if (paso && paso.estructura) return paso.estructura;
      const p = (estado.estructura && estado.estructura.parametros) || {};
      if (p.r === undefined) return null;
      return dominio.indices.estructuraDeIndices({
        r: p.r, R: p.R, Ri: p.Ri, B: p.B, tipo: p.tipo, niveles: p.niveles
      });
    }

    // Qué bloques de una columna se dibujan. Los dos primeros y el último
    // siempre, y además **la frontera**: cuántos bloques de esta columna
    // abarca un bloque de la anterior. Ese es el bloque que el docente dibuja
    // con nombre propio —el B273 de su hoja— porque es el que enseña cuánto
    // cubre un solo bloque de índice.
    function segmentosDeColumna(columna) {
      const relevantes = [1, BLOQUES_CABECERA, columna.bloques];
      if (columna.frontera) relevantes.push(columna.frontera);
      return vista.elision.calcularSegmentos({
        n: columna.bloques,
        relevantes: relevantes.filter((i) => i >= 1 && i <= columna.bloques),
        orientacion: 'vertical',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });
    }

    function crearColumnaDeIndice(columna, definida, activa) {
      const mil = dominio.indices.mil;
      const el = document.createElement('div');
      el.className = `columna-indice${definida ? '' : ' columna-indice--pendiente'}`;

      const regla = document.createElement('div');
      regla.className = 'columna-indice__regla';
      for (let i = 0; i < 6; i++) regla.appendChild(document.createElement('span'));
      const bytes = document.createElement('div');
      bytes.className = 'columna-indice__bytes';
      bytes.textContent = `${columna.longitudRegistro} B`;

      const escala = document.createElement('div');
      escala.className = 'columna-indice__escala';
      const bloques = document.createElement('div');
      bloques.className = 'columna-indice__bloques';

      const puestos = new Map();
      for (const segmento of segmentosDeColumna(columna)) {
        if (segmento.tipo === 'tramo') {
          const hueco = () => {
            const div = document.createElement('div');
            div.className = 'columna-indice__hueco';
            return div;
          };
          escala.appendChild(hueco());
          const tramo = document.createElement('div');
          tramo.className = 'tramo-indices';
          tramo.textContent = `⋯ ${mil(segmento.cantidad)} ⋯`;
          bloques.appendChild(tramo);
          continue;
        }

        const rango = dominio.indices.rangoDelBloque(columna, segmento.indice);
        // **El último bloque se parte donde termina lo que se usa**, como en
        // la hoja del docente (pedido del usuario, 2026-09-30): una línea en
        // la última entrada ocupada —14.706 en B54, que son los bloques del
        // archivo; 54 en la raíz, que son los bloques del nivel de abajo—, y
        // debajo una franja con las libres hasta la capacidad. La flecha sale
        // de esa línea, así que el número escrito y el bloque al que llega
        // coinciden y la relación se lee sin deducirla.
        const esUltimo = segmento.indice === columna.bloques;
        const conLibres = esUltimo && columna.libres > 0;
        const par = document.createElement('div');
        par.className = 'columna-indice__rango';
        const desde = document.createElement('span');
        desde.textContent = mil(rango.primero);
        const hasta = document.createElement('span');
        hasta.textContent = mil(conLibres ? columna.entradas : rango.ultimo);
        if (conLibres) hasta.className = 'columna-indice__usadas';
        par.append(desde, hasta);
        escala.appendChild(par);

        // El rótulo va **dentro** del bloque (pedido del usuario sobre
        // maqueta, 2026-09-27): a su derecha quedaba justo donde salen las
        // flechas, y la columna era 46 px más ancha para nada.
        const bloque = document.createElement('div');
        bloque.className = `columna-indice__bloque columna-indice__bloque--${columna.clase}`
          + (activa ? ' columna-indice__bloque--en-curso' : '');
        bloque.textContent = `B${segmento.indice}`;
        bloques.appendChild(bloque);
        puestos.set(segmento.indice, bloque);

        if (conLibres) {
          // La franja de las libres y, en la escala, la capacidad a su pie.
          // Van como un renglón más de cada lado, para que escala y pila sigan
          // avanzando al mismo paso.
          const parLibres = document.createElement('div');
          parLibres.className = 'columna-indice__rango columna-indice__rango--libres';
          const capacidad = document.createElement('span');
          capacidad.textContent = mil(rango.ultimo);
          parLibres.appendChild(capacidad);
          escala.appendChild(parLibres);
          const libres = document.createElement('div');
          libres.className = 'columna-indice__libres';
          libres.title = `${mil(columna.libres)} ${columna.libres === 1 ? 'libre' : 'libres'}`;
          bloques.appendChild(libres);
        }
      }

      const titulo = document.createElement('div');
      titulo.className = 'columna-indice__titulo';
      titulo.textContent = columna.titulo;
      const detalle = document.createElement('div');
      detalle.className = 'columna-indice__detalle';
      // Definida dice sus números; pendiente no finge saberlos todavía.
      detalle.textContent = definida
        ? `${mil(columna.bloques)} bloq. · ${mil(columna.porBloque)} ${columna.unidad}`
        : 'sin calcular';

      el.append(regla, bytes, escala, bloques, titulo, detalle);
      return { el, columna, puestos };
    }

    // Las flechas van de la entrada del índice al bloque que señala. Tres por
    // unión, y las tres son verdad sin depender de qué bloques quedaron
    // dibujados tras elidir:
    //
    //   · la primera entrada, al primer bloque;
    //   · la última entrada del primer bloque, al bloque `frontera` —el B273
    //     del ejercicio—, que es la que enseña cuánto abarca un bloque;
    //   · la última entrada del último bloque, al último bloque.
    //
    // **Que se vea dónde conecta cada una** (opción B de la maqueta, elegida
    // por el usuario el 2026-09-27). Antes salían del borde de la columna, en
    // curva, y llegaban por detrás de los números: no se leía de qué entrada
    // salían ni en qué bloque terminaban. Ahora:
    //
    //   · **salen de la entrada**: una raya dentro del bloque índice, arriba si
    //     es su primera entrada y abajo si es la última, y un punto en el borde;
    //   · **van en codo**: en horizontal, bajan por su propio carril entre las
    //     columnas —uno por flecha, para que no se monten— y vuelven a la
    //     horizontal;
    //   · **llegan con la punta tocando el bloque**, a media altura, que es el
    //     hueco entre sus dos números. Por eso pueden ir por encima de las
    //     columnas sin tachar ninguno.
    const CARRIL_INICIAL = 14;
    const ENTRE_CARRILES = 9;
    const RAYA_DE_ENTRADA = 16;
    const MARGEN_DE_ENTRADA = 7;
    const RADIO_DEL_CODO = 5;

    function trazarFlechas(svg, pista, dibujadas, definidas, tipo) {
      svg.innerHTML = '';
      const base = pista.getBoundingClientRect();
      const caja = (el) => {
        const r = el.getBoundingClientRect();
        return {
          izq: r.left - base.left,
          der: r.right - base.left,
          centro: r.top - base.top + r.height / 2,
          primera: r.top - base.top + MARGEN_DE_ENTRADA,
          ultima: r.bottom - base.top - MARGEN_DE_ENTRADA,
          // La línea donde terminan las entradas que se usan: el borde de
          // abajo del bloque, porque debajo empieza la franja de las libres.
          usadas: r.bottom - base.top
        };
      };

      const defs = document.createElementNS(NS_SVG, 'defs');
      const marca = document.createElementNS(NS_SVG, 'marker');
      marca.setAttribute('id', 'punta-indices');
      marca.setAttribute('markerWidth', '8');
      marca.setAttribute('markerHeight', '8');
      marca.setAttribute('refX', '7.5');
      marca.setAttribute('refY', '4');
      marca.setAttribute('orient', 'auto');
      // En píxeles y no en múltiplos del trazo: la punta mide lo mismo aunque
      // cambie el grosor de la línea.
      marca.setAttribute('markerUnits', 'userSpaceOnUse');
      const punta = document.createElementNS(NS_SVG, 'path');
      punta.setAttribute('d', 'M0,0 L8,4 L0,8 z');
      punta.setAttribute('fill', 'currentColor');
      marca.appendChild(punta);
      defs.appendChild(marca);
      svg.appendChild(defs);

      const grupo = document.createElementNS(NS_SVG, 'g');
      grupo.setAttribute('stroke', 'currentColor');
      grupo.setAttribute('stroke-width', '1.4');
      svg.appendChild(grupo);

      const nuevo = (tipo, atributos) => {
        const el = document.createElementNS(NS_SVG, tipo);
        for (const [nombre, valor] of Object.entries(atributos)) el.setAttribute(nombre, valor);
        grupo.appendChild(el);
        return el;
      };

      // La entrada del índice: su raya dentro del bloque y el punto de salida.
      const entrada = (x, y) => {
        nuevo('line', { x1: x - RAYA_DE_ENTRADA, y1: y, x2: x, y2: y, class: 'indices__entrada' });
        nuevo('circle', { cx: x, cy: y, r: 3.2, fill: 'currentColor', stroke: 'none' });
      };

      const codo = (x1, y1, carril, x2, y2) => {
        const r = RADIO_DEL_CODO;
        const sentido = y2 > y1 ? 1 : -1;
        const recorrido = Math.abs(y2 - y1) < 2 * r
          ? `M ${x1} ${y1} L ${carril} ${y1} L ${carril} ${y2} L ${x2} ${y2}`
          : `M ${x1} ${y1} L ${carril - r} ${y1} Q ${carril} ${y1} ${carril} ${y1 + sentido * r}`
            + ` L ${carril} ${y2 - sentido * r} Q ${carril} ${y2} ${carril + r} ${y2} L ${x2} ${y2}`;
        nuevo('path', { d: recorrido, fill: 'none', 'marker-end': 'url(#punta-indices)' });
      };

      for (let i = 0; i < dibujadas.length - 1; i++) {
        const origen = dibujadas[i];
        const destino = dibujadas[i + 1];
        // Una unión solo se dibuja cuando sus dos extremos están definidos: una
        // flecha hacia una columna que aún no se ha calculado afirmaría algo
        // que la derivación todavía no dijo.
        if (!definidas.includes(origen.columna.id) || !definidas.includes(destino.columna.id)) continue;

        const primeroOrigen = origen.puestos.get(1);
        const ultimoOrigen = origen.puestos.get(origen.columna.bloques);
        const primeroDestino = destino.puestos.get(1);
        const ultimoDestino = destino.puestos.get(destino.columna.bloques);
        const fronteraDestino = destino.puestos.get(destino.columna.frontera);

        const uniones = [];
        if (primeroOrigen && primeroDestino) {
          uniones.push({ desde: primeroOrigen, entrada: 'primera', hasta: primeroDestino });
        }
        if (primeroOrigen && fronteraDestino && destino.columna.frontera > 1) {
          uniones.push({ desde: primeroOrigen, entrada: 'ultima', hasta: fronteraDestino });
        }
        // La última entrada **que se usa**, desde su línea, al último bloque
        // de la columna siguiente. También desde la raíz, que es un solo
        // bloque: su 54 —o su 7— va a b54 —o a B7—, que es la flecha que el
        // docente dibuja y que antes no salía (2026-09-30). Cuando las
        // entradas son registros (el secundario, hacia los datos) llega al
        // registro mismo, la línea de los usados del último bloque de datos:
        // la entrada 500.000 apunta al registro 500.000.
        if (ultimoOrigen && ultimoDestino && destino.columna.bloques > 1) {
          uniones.push({
            desde: ultimoOrigen,
            entrada: origen.columna.libres > 0 ? 'usadas' : 'ultima',
            hasta: ultimoDestino,
            alRegistro: destino.columna.clase === 'datos' && tipo !== dominio.indices.TIPOS.PRIMARIO
          });
        }

        uniones.forEach((union, k) => {
          const salida = caja(union.desde);
          const llegada = caja(union.hasta);
          const x1 = salida.der;
          const y1 = salida[union.entrada];
          const y2 = union.alRegistro && destino.columna.libres > 0 ? llegada.usadas : llegada.centro;
          entrada(x1, y1);
          codo(x1, y1, x1 + CARRIL_INICIAL + k * ENTRE_CARRILES, llegada.izq, y2);
        });
      }
    }

    function renderizarIndices(paso, opciones) {
      const estructura = estructuraDeIndices(paso);
      if (!estructura) {
        renderizarLienzoVacio();
        return;
      }
      // Sin paso —recién creada la estructura, o retrocediendo hasta antes del
      // primer paso— se dibuja entera: es el resultado, no la derivación.
      const definidas = paso ? paso.definidas : estructura.columnas.map((c) => c.id);
      const activa = paso ? paso.columnaActiva : null;

      let seguida = null;
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = 'estructura-indices';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';

        const pista = document.createElement('div');
        pista.className = 'indices__pista';
        const svg = document.createElementNS(NS_SVG, 'svg');
        svg.setAttribute('class', 'indices__flechas');
        pista.appendChild(svg);

        const dibujadas = estructura.columnas.map((columna) => {
          const dibujada = crearColumnaDeIndice(
            columna, definidas.includes(columna.id), columna.id === activa
          );
          pista.appendChild(dibujada.el);
          if (columna.id === activa) seguida = dibujada.el;
          return dibujada;
        });
        dom.estructuraEl.appendChild(pista);

        // Después de insertar, no antes: las flechas se trazan con lo que el
        // DOM mide de verdad, y hasta que la pista no está en el documento no
        // mide nada.
        trazarFlechas(svg, pista, dibujadas, definidas, estructura.tipo);
        llevarALaVista(seguida);
        // Si la pista cambia de tamaño después —la derivación que se angosta,
        // la ventana que cambia—, las flechas se vuelven a trazar con lo que
        // el DOM mida entonces.
        if (window.ResizeObserver) {
          new ResizeObserver(() => {
            if (pista.isConnected) trazarFlechas(svg, pista, dibujadas, definidas, estructura.tipo);
          }).observe(pista);
        }
      }, opciones);
      apretarDerivacion();
    }

    // **Cuando la estructura y la derivación no caben juntas, la derivación
    // se angosta** a 300 px, con la fórmula en su renglón y el resultado
    // debajo (opción B de la maqueta de externas, elegida por el usuario el
    // 2026-09-30). Pasa en el portátil: el panel se encogía por debajo de sus
    // fórmulas, las partía a media expresión y tapaba la columna de datos
    // del multinivel. La estructura sigue desplazándose como se decidió el
    // 2026-09-17 («estrechar y desplazar», CLAUDE.md 5.10). Solo cuando no
    // cabe: en una ventana ancha, angosta, la derivación se alargaba y había
    // que desplazarla.
    function apretarDerivacion() {
      if (!esIndices() || !dom.calculo || !dom.escenario) return;
      const escenario = dom.escenario;
      const panel = dom.calculo.el;
      escenario.classList.remove('lienzo__escenario--apretado');
      if (panel.hidden) return;
      const estilo = getComputedStyle(escenario);
      const disponible = escenario.clientWidth
        - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight)
        - (parseFloat(estilo.columnGap) || 0);
      // Lo que la derivación pide si se la deja: su ancho natural, con el
      // tope que ya le pone la hoja de estilos.
      panel.style.width = 'max-content';
      const natural = Math.min(panel.offsetWidth, parseFloat(getComputedStyle(panel).maxWidth) || Infinity);
      panel.style.width = '';
      if (dom.estructuraEl.scrollWidth + natural > disponible) {
        escenario.classList.add('lienzo__escenario--apretado');
      }
    }

    return { apretarDerivacion, esIndices, renderizarIndices };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.indices = crearDibujoIndices;
})();
