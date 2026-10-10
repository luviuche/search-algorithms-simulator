(function () {
  const vista = window.CC2.vista;
  const { TIPOS_PASO } = window.CC2.algoritmos.traza;

  // Los árboles de búsqueda por residuo (CLAUDE.md 5.5 y 6.7): niveles,
  // aristas rotuladas con su bit y el encogimiento cuando no cabe junto al
  // cálculo. Exporta también las medidas y `seguirAristas`, que el bosque de
  // Huffman reutiliza.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoArbol({ estado, dom, config, formaArbol, renderizarLienzoVacio, comunes }) {
    const { esArbol, llevarALaVista } = comunes;

    // ── Árbol (CLAUDE.md 5.5 y 6.7) ─────────────────────────────────────────
    //
    // El árbol no cabe en la vista de casillas en fila: se dibuja por niveles,
    // con las aristas rotuladas con el bit que lleva a cada hijo —0 izquierda,
    // 1 derecha—. El porqué de cada bajada se lee en el panel del cálculo, al
    // lado, como en las funciones hash (decisión del usuario, 2026-08-29).
    const SEPARACION_NIVEL = 68;
    const SEPARACION_HERMANOS = 24;
    const ALTO_CASILLA = 40;
    // El nodo de un árbol es redondo y algo mayor que la casilla: una caja
    // redonda pierde las esquinas, y con 40 px la clave con su marca quedaba
    // pegada al borde. Acompaña a `--diametro-nodo` en `tokens.css`: si uno
    // cambia, el otro tiene que seguirlo.
    const DIAMETRO_NODO = 44;
    const DIAMETRO_BIFURCACION = 10;
    // El punto de bifurcación no pide el mismo aire que una casilla: con el
    // hueco de casilla el árbol de «prueba» no cabía a lo ancho del lienzo y
    // se ponía a scrollear, que es justo lo que la pantalla anclada al
    // viewport existe para evitar (CLAUDE.md 6.1). En residuos múltiples son
    // 21 puntos para 6 claves, así que lo que se ahorre aquí es lo que decide
    // si el panel del cálculo cabe al lado o se sale del lienzo.
    const SEPARACION_BIFURCACION = 4;

    // En residuos las claves solo viven en las hojas y los nodos de en medio
    // no guardan nada ni podrán guardarlo nunca (CLAUDE.md 5.5): se dibujan
    // como un punto y no como una casilla, porque en todos los demás temas una
    // casilla vacía significa «aquí cabe una clave» y aquí sería mentira
    // (decisión del usuario sobre maqueta, 2026-08-30).
    //
    // La excepción es la posición vacía en la que **termina** un paso: una
    // búsqueda que corta camino acaba justo ahí, y hay que verla como el sitio
    // donde la clave tendría que estar. El nodo por el que se está *bajando*
    // no: hincharlo a casilla en cada paso recolocaría el árbol entero debajo
    // del reproductor, así que se queda como punto y solo se resalta.
    function esBifurcacion(indice, paso) {
      if (!config.clavesSoloEnHojas) return false;
      if (estado.estructura.claves[indice - 1] !== undefined) return false;
      return !(paso && paso.casilla === indice && paso.tipo !== TIPOS_PASO.RAMIFICACION);
    }

    // Con identidad propia, como las casillas: sin ella el FLIP no la veía, y
    // al recolocarse el árbol los puntos saltaban a su sitio mientras los
    // nodos con clave viajaban al suyo.
    function crearBifurcacion(activa, indice) {
      const el = document.createElement('div');
      el.className = 'arbol__bifurcacion' + (activa ? ' arbol__bifurcacion--activa' : '');
      el.dataset.clave = `bifurcacion-${indice}`;
      return el;
    }

    // Coordenadas de cada posición: la columna sale de un recorrido en orden y
    // la fila es el nivel, que es el bit —o el bloque de bits— que se miró para
    // llegar hasta ahí.
    //
    // El nodo se coloca a la **mitad de sus huecos**, dibujados o no: con dos
    // hijos eso es exactamente «izquierda, nodo, derecha», que es lo que hacían
    // el árbol digital y residuos, y con cuatro deja al padre centrado entre
    // las ramas 01 y 10. Contar los huecos y no los hijos dibujados es lo que
    // mantiene idéntica la retícula de los dos temas binarios.
    //
    // Cada posición ocupa lo que ocupa su dibujo y no una columna fija: en
    // residuos los puntos de bifurcación son la mayoría del árbol, y darles el
    // ancho de una casilla lo estiraría al doble sin necesidad. Con un solo
    // ancho —el de los temas que dibujan casillas en todos los nodos— sale la
    // misma retícula de antes.
    function distribuir(dibujadas, anchoDe) {
      const posiciones = new Map();
      let x = 0;
      (function enOrden(indice) {
        if (!dibujadas.has(indice)) return;
        const huecos = formaArbol.hijos(indice);
        const mitad = Math.floor(huecos.length / 2);
        for (let k = 0; k < mitad; k++) enOrden(huecos[k]);
        const ancho = anchoDe(indice);
        posiciones.set(indice, { izquierda: x, centro: x + ancho / 2 });
        x += ancho;
        for (let k = mitad; k < huecos.length; k++) enOrden(huecos[k]);
      })(formaArbol.RAIZ);
      return { posiciones, ancho: x };
    }

    // `vacia` dice si una arista lleva a un subárbol sin claves, y `descartada`
    // si queda fuera del camino del paso (ver `renderizarArbol`).
    //
    // Crea las aristas sin colocarlas y devuelve `trazar`, que las coloca a
    // partir de dónde está cada nodo: `centroDe(indice)` da su centro `x`, su
    // borde de arriba y su pie. Al terminar el dibujo se trazan con la
    // retícula; mientras el FLIP mueve los nodos, con dónde van pasando (ver
    // `seguirAristas`).
    function crearAristas(posiciones, ancho, alto, { vacia = () => false, descartada = () => false } = {}) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'arbol__aristas');
      svg.setAttribute('width', ancho);
      svg.setAttribute('height', alto);
      svg.setAttribute('aria-hidden', 'true');

      const aristas = [];
      for (const indice of posiciones.keys()) {
        if (indice === formaArbol.RAIZ) continue;
        const padre = formaArbol.padre(indice);

        const linea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        linea.setAttribute('class', 'arbol__arista'
          + (vacia(indice) ? ' arbol__arista--vacia' : '')
          + (descartada(indice) ? ' arbol__arista--descartada' : ''));
        svg.appendChild(linea);

        // El rótulo va sobre la arista, del lado del hijo: es el bit —o el
        // bloque— que hubo que leer para bajar por ahí, y sin él el dibujo no
        // dice por qué la clave tomó ese camino.
        //
        // Cuánto se baja por la arista antes de escribirlo depende de cuántas
        // ramas abra el padre: con dos, a mitad de camino quedan bien separados;
        // con cuatro se amontonan todos en el mismo punto, porque de ahí es de
        // donde salen. Bajando hasta cerca del hijo se abren tanto como se
        // abran los hijos, que es lo que los separa.
        //
        // Y con cuatro ramas se escalonan además a dos alturas, alternando: dos
        // rótulos vecinos que llevan a posiciones vacías caen a menos de un
        // carácter uno de otro, y no hay ancho que repartir —el árbol y el
        // cálculo ya ocupan el escenario entero—.
        const hermanos = formaArbol.hijos(padre);
        const ramas = hermanos.length;
        const avance = ramas > 2
          ? (hermanos.indexOf(indice) % 2 === 0 ? 0.72 : 0.9)
          : 0.45;
        const rotulo = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        rotulo.setAttribute('class', 'arbol__bit');
        rotulo.textContent = formaArbol.rotuloDeArista(indice);
        if (descartada(indice)) rotulo.classList.add('arbol__bit--descartado');
        // **Solo llevan bit las ramas que conducen a una clave** (opción 1a de
        // la maqueta, elegida por el usuario el 2026-09-28). En residuos
        // múltiples el esqueleto abre todas las ramas, y los rótulos de las
        // vacías de dos subárboles vecinos se montaban —«11 01 01»— o se
        // salían del dibujo. La rama vacía sigue ahí, punteada, y con ella el
        // espacio sin usar que el tema enseña; su bit no dice nada. Es también
        // como rotula el docente en su tablero (CLAUDE.md 5.5).
        if (!vacia(indice)) svg.appendChild(rotulo);
        aristas.push({ indice, padre, linea, rotulo, avance });
      }

      // La arista sale del pie del padre —que mide distinto según sea una
      // casilla o un punto de bifurcación— y llega al borde de arriba del hijo.
      function trazar(centroDe) {
        for (const { indice, padre, linea, rotulo, avance } of aristas) {
          const desde = centroDe(padre);
          const hasta = centroDe(indice);
          linea.setAttribute('x1', desde.x);
          linea.setAttribute('y1', desde.pie);
          linea.setAttribute('x2', hasta.x);
          linea.setAttribute('y2', hasta.arriba);
          rotulo.setAttribute('x', desde.x + (hasta.x - desde.x) * avance + (hasta.x < desde.x ? -8 : 8));
          rotulo.setAttribute('y', desde.pie + (hasta.arriba - desde.pie) * avance);
        }
      }
      return { svg, aristas, trazar };
    }

    // **Las aristas siguen a los nodos mientras viajan** (pedido del usuario,
    // 2026-09-28: el árbol se conectaba «raro» al recolocarse). El FLIP mueve
    // los nodos con `transform` y el SVG no se entera: las aristas quedaban
    // ya en su sitio final, uniendo huecos, mientras los nodos iban de
    // camino. Cuadro a cuadro, mientras en el árbol haya algo animándose, se
    // retrazan desde donde cada nodo se ve; al terminar, con la retícula.
    //
    // `nodos` lleva de lo que `trazar` le pide —el índice del nodo, o el nodo
    // mismo en Huffman— a su elemento. `vigente` dice si el dibujo sigue
    // siendo el de la pantalla: un árbol solo lo es mientras sea
    // `dom.lienzoArbol`; los del bosque de Huffman son varios, y les basta con
    // seguir en el documento.
    function seguirAristas(lienzoArbol, trazar, nodos, centroFinal, vigente = () => dom.lienzoArbol === lienzoArbol) {
      const centroVivo = (indice) => {
        const nodo = nodos.get(indice);
        if (!nodo) return centroFinal(indice);
        // Con el árbol encogido (`zoom`), la pantalla mide en píxeles
        // encogidos y el SVG dibuja en los suyos. El zoom efectivo y no el del
        // propio lienzo: el bosque de Huffman lo pone en la caja de cada
        // árbol, que también escala su peso al pie.
        const factor = vista.animacion.zoomEfectivo(lienzoArbol);
        const lienzo = lienzoArbol.getBoundingClientRect();
        const caja = nodo.getBoundingClientRect();
        return {
          x: (caja.left + caja.width / 2 - lienzo.left) / factor,
          arriba: (caja.top - lienzo.top) / factor,
          pie: (caja.bottom - lienzo.top) / factor
        };
      };
      const enCurso = () => lienzoArbol.getAnimations({ subtree: true })
        .some((animacion) => animacion.playState === 'running' || animacion.pending);
      const cuadro = () => {
        if (!lienzoArbol.isConnected || !vigente()) return;
        if (!enCurso()) {
          trazar(centroFinal);
          return;
        }
        trazar(centroVivo);
        requestAnimationFrame(cuadro);
      };
      cuadro();
    }

    function renderizarArbol(paso, opciones) {
      const claves = estado.estructura.claves;
      const dibujadas = formaArbol.posicionesDibujadas(estado.estructura, paso);
      // **Sin claves, el lienzo dice qué hacer** en vez de quedar en blanco
      // (pedido del usuario, 2026-09-30), como Huffman con su palabra. El
      // árbol vacío no dibuja nada —ni siquiera el esqueleto de residuos
      // múltiples, que suelto no se entendía (2026-08-30)—, y el lienzo gris
      // y mudo no le decía al estudiante que le tocaba insertar.
      //
      // **Pero solo sin operación en curso** (visto por el usuario,
      // 2026-10-08): al insertar la primera clave, su primer paso es el
      // cálculo del código, con el árbol todavía vacío, y el lienzo seguía
      // pidiendo «Inserte una letra…» al lado del cálculo de esa misma letra.
      // Mientras se opera queda en blanco; el paso final —al eliminar la
      // última clave— vuelve a decir qué hacer.
      if (dibujadas.size === 0) {
        dom.lienzoArbol = null;
        if (paso && !paso.final) {
          dom.estructuraEl.className = 'estructura-arbol';
          dom.estructuraEl.removeAttribute('style');
          dom.estructuraEl.innerHTML = '';
          return;
        }
        renderizarLienzoVacio(config.palabra
          ? { titulo: 'Inserte una letra o una palabra para empezar', indicacion: 'Escríbala en el panel de la derecha' }
          : { titulo: 'Inserte una clave para empezar', indicacion: 'Escríbala en el panel de la derecha' });
        return;
      }
      // El nodo del árbol es redondo, así que mide de ancho lo que de alto y
      // no lo que mediría una casilla de `l` cifras. De paso el árbol se
      // estrecha, que en residuos múltiples —donde el esqueleto entra justo—
      // es aire ganado.
      const anchoDe = (indice) => (esBifurcacion(indice, paso)
        ? DIAMETRO_BIFURCACION + SEPARACION_BIFURCACION
        : DIAMETRO_NODO + SEPARACION_HERMANOS);
      const altoDe = (indice) => (
        esBifurcacion(indice, paso) ? DIAMETRO_BIFURCACION : DIAMETRO_NODO
      );

      const reparto = distribuir(dibujadas, anchoDe);
      const posiciones = reparto.posiciones;

      // **Lo que la búsqueda descarta se apaga** (opción 2b de la maqueta,
      // elegida por el usuario el 2026-09-28): todo lo que no está en el
      // camino hasta el nodo del paso ni cuelga de él, porque la clave ya no
      // puede estar ahí. Es la misma regla de toda la aplicación —apagado es
      // descartado, normal es «todavía puede estar» (CLAUDE.md 8.2)—, y el
      // camino queda encendido por contraste. El camino no viaja en la traza:
      // en un árbol son los ancestros del nodo del paso. El paso final no lo
      // tiene y el árbol vuelve entero.
      const ancestros = (indice) => {
        const lista = [];
        for (let i = indice; ; i = formaArbol.padre(i)) {
          lista.push(i);
          if (i === formaArbol.RAIZ) return lista;
        }
      };
      const actual = paso && !paso.final && paso.casilla && posiciones.has(paso.casilla) ? paso.casilla : null;
      const camino = new Set(actual ? ancestros(actual) : []);
      const descartada = (indice) => actual !== null && !camino.has(indice) && !ancestros(indice).includes(actual);
      // Una arista es vacía si no lleva a ninguna clave, salvo la del camino:
      // ahí es donde la clave está o tendría que estar.
      const conClave = (indice) => claves[indice - 1] !== undefined
        || formaArbol.hijos(indice).some((hijo) => posiciones.has(hijo) && conClave(hijo));
      const vacia = (indice) => !camino.has(indice) && !conClave(indice);
      const niveles = [...posiciones.keys()].reduce((mayor, i) => Math.max(mayor, formaArbol.nivelDe(i)), 1);
      const ancho = Math.max(reparto.ancho, 1);
      const alto = (niveles - 1) * SEPARACION_NIVEL + DIAMETRO_NODO;

      const centroFinal = (indice) => {
        const arriba = (formaArbol.nivelDe(indice) - 1) * SEPARACION_NIVEL;
        return { x: posiciones.get(indice).centro, arriba, pie: arriba + altoDe(indice) };
      };
      // Lo que ya estaba dibujado antes de este paso: lo que no, aparece.
      const previos = new Set([...dom.estructuraEl.querySelectorAll('[data-clave]')]
        .map((el) => el.dataset.clave));

      let seguido = null;
      let lienzo = null;
      let aristas = null;
      const nodos = new Map();
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = 'estructura-arbol';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';

        const lienzoArbol = document.createElement('div');
        lienzoArbol.className = 'arbol';
        lienzoArbol.style.width = `${ancho}px`;
        lienzoArbol.style.height = `${alto}px`;
        aristas = crearAristas(posiciones, ancho, alto, { vacia, descartada });
        aristas.trazar(centroFinal);
        lienzoArbol.appendChild(aristas.svg);

        for (const [indice, sitio] of posiciones) {
          const clave = claves[indice - 1];
          let nodoEl;
          if (esBifurcacion(indice, paso)) {
            nodoEl = crearBifurcacion(!!paso && paso.casilla === indice, indice);
            if (descartada(indice)) nodoEl.classList.add('arbol__bifurcacion--descartada');
          } else {
            const descripcion = config.describirCasilla({ paso, indice, ocupada: clave !== undefined });
            const sinResaltar = descripcion.estado === 'ocupada' || descripcion.estado === 'vacia';
            nodoEl = vista.componentes.casilla.crearCasilla({
              clave,
              indice,
              estado: sinResaltar && descartada(indice) ? 'descartada' : descripcion.estado,
              modificadores: descripcion.modificadores
            });
          }
          const hueco = esBifurcacion(indice, paso) ? SEPARACION_BIFURCACION : SEPARACION_HERMANOS;
          nodoEl.style.left = `${sitio.izquierda + hueco / 2}px`;
          nodoEl.style.top = `${(formaArbol.nivelDe(indice) - 1) * SEPARACION_NIVEL}px`;
          lienzoArbol.appendChild(nodoEl);
          nodos.set(indice, nodoEl);
          if (paso && paso.casilla === indice) seguido = nodoEl;
        }

        dom.estructuraEl.appendChild(lienzoArbol);
        dom.lienzoArbol = lienzoArbol;
        lienzo = lienzoArbol;
        nodoSeguido = seguido;
        ajustarArbol();
        // Si el panel del cálculo acaba de aparecer o irse, el árbol cambia de
        // tamaño, y la pantalla lo anima aquí, antes de que el FLIP mida
        // (`recentrarArbol` en tema-busqueda.js).
        if (dom.recentrarArbol) dom.recentrarArbol();
        llevarALaVista(seguido);
      }, opciones);

      if (vista.animacion.prefiereMovimientoReducido()) return;
      // **Lo nuevo aparece, no salta**: el nodo que entra y la arista que
      // llega a él se desvanecen hacia dentro mientras el resto se recoloca.
      // En el primer dibujo no hay nada previo y no se anima nada.
      if (previos.size > 0) {
        const aparecer = (el) => el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: DURACION_APARICION_MS, delay: DURACION_APARICION_MS / 2, fill: 'backwards'
        });
        for (const [indice, nodo] of nodos) {
          if (previos.has(nodo.dataset.clave)) continue;
          aparecer(nodo);
          for (const arista of aristas.aristas) {
            if (arista.indice !== indice) continue;
            aparecer(arista.linea);
            aparecer(arista.rotulo);
          }
        }
      }
      seguirAristas(lienzo, aristas.trazar, nodos, centroFinal);
    }
    const DURACION_APARICION_MS = 300;

    // **El árbol se ajusta al lienzo: encoge si no cabe y crece si sobra**.
    //
    // Encoger (maqueta elegida por el usuario, 2026-09-28): cuando el árbol y
    // el cálculo no caben juntos, el árbol cede lo justo —pasaba con residuos
    // múltiples, el dibujo más ancho—. Antes cedía el cálculo, y cedía
    // cortándose. No baja de `ENCOGIMIENTO_MINIMO`: más chico los bits dejan de
    // leerse, y entonces vuelve a desplazarse.
    //
    // Crecer (revisión de diseño, 2026-10-04): con medidas fijas, en la
    // pantalla de referencia (1920 × 950, CLAUDE.md 6.9) el árbol ocupaba una
    // fracción del lienzo, y sus bits —la lección del tema— quedaban chicos.
    // Crece hasta `CRECIMIENTO_MAXIMO`, y solo si cabe también a lo alto.
    //
    // **A lo alto también encoge** (2026-10-08), hasta el mismo mínimo. Antes
    // no hacía falta: con el sitio del cálculo siempre reservado, el ancho ya
    // lo achicaba por debajo de lo que pedía el alto. Sin la reserva, a 150 %
    // de zoom el árbol de residuos quedaba a 1× en reposo y se salía por abajo.
    //
    // **El sitio del cálculo se reserva solo durante una operación** (opción B
    // de las maquetas, elegida por el usuario el 2026-10-08). Se reservaba
    // siempre, para que el árbol no cambiara de tamaño al aparecer o irse el
    // panel; pero con el zoom del navegador a 150 % eso dejaba los árboles de
    // residuos a 0,64× en reposo, corridos a la izquierda junto a un tercio de
    // lienzo vacío. Ahora en reposo el árbol usa todo el lienzo, y el cambio
    // de tamaño al empezar y al terminar lo anima `aplicarVisibilidadCalculo`
    // junto con el recentrado. Mientras el panel se desvanece ya no cuenta:
    // el árbol se mide contra donde va a quedar.
    //
    // **Dentro de una operación el tamaño no cambia**: se reserva el ancho
    // del panel más ancho de toda la traza, medido por adelantado. El panel
    // crece a medida que se revelan líneas, y una palabra son seis letras
    // seguidas con su cálculo cada una; medido paso a paso, el árbol se
    // encogería un poco con cada línea más larga.
    const ENCOGIMIENTO_MINIMO = 0.6;
    const CRECIMIENTO_MAXIMO = 1.5;
    //
    // **Y si ni a `ENCOGIMIENTO_MINIMO` caben juntos, se estrecha y se
    // desplaza** (opción D de las maquetas, elegida por el usuario el
    // 2026-10-09), la regla que ya siguen índices, Huffman y las tablas
    // dispersas cuando algo no cabe. Pasaba en un proyector de 1024 × 650: el
    // panel del cálculo se salía por la derecha y se perdían sus resultados.
    // El panel se angosta como la derivación de índices
    // (`.lienzo__escenario--apretado`), el árbol se queda en el mínimo, y su
    // caja se estrecha y se desplaza hasta el nodo del paso (`llevarALaVista`)
    // con el borde desvanecido del lado por donde sigue.
    const APRETADO = 'lienzo__escenario--apretado';
    // El nodo del paso, que `llevarALaVista` mantiene a la vista.
    let nodoSeguido = null;
    let pasosMedidos = null;
    const anchosDeLaTraza = new Map();
    function anchoDelCalculo(panel, apretado) {
      if (estado.pasos !== pasosMedidos) {
        pasosMedidos = estado.pasos;
        anchosDeLaTraza.clear();
      }
      if (!anchosDeLaTraza.has(apretado)) {
        const clases = dom.escenario.classList;
        const antes = clases.contains(APRETADO);
        clases.toggle(APRETADO, apretado);
        let ancho = 0;
        const pasos = (estado.pasos || []).filter((paso) => paso.calculo && paso.calculo.length);
        for (const paso of pasos) {
          dom.calculo.actualizar(paso.calculo, paso.saltos, paso.tituloCalculo);
          ancho = Math.max(ancho, panel.offsetWidth);
        }
        // Se deja como lo tenía el paso en curso.
        const actual = estado.pasoActual;
        if (pasos.length) dom.calculo.actualizar(actual ? actual.calculo : null, actual ? actual.saltos : null, actual ? actual.tituloCalculo : null);
        anchosDeLaTraza.set(apretado, ancho || panel.offsetWidth);
        clases.toggle(APRETADO, antes);
      }
      return anchosDeLaTraza.get(apretado);
    }
    // Si el árbol en su mínimo y el panel a su ancho natural no caben, el
    // panel se aprieta. Se decide con el ancho de toda la traza, así que no
    // cambia a mitad de la operación. Mientras el panel se desvanece al irse
    // conserva su forma; la suelta `soltarApretado`, al terminar de irse.
    //
    // **La clase solo se toca si cambia**: quitarla y ponerla en cada ajuste
    // devolvía la caja un instante a su ancho entero, y perdía el
    // desplazamiento hasta el nodo del paso.
    function apretarCalculo(panel, disponible, separacion) {
      if (!panel) {
        if (!dom.salidaCalculo) soltarApretado();
        return 0;
      }
      const apretar = dom.lienzoArbol.offsetWidth * ENCOGIMIENTO_MINIMO + separacion
        + anchoDelCalculo(panel, false) > disponible;
      if (dom.escenario.classList.contains(APRETADO) !== apretar) dom.escenario.classList.toggle(APRETADO, apretar);
      return anchoDelCalculo(panel, apretar);
    }
    function soltarApretado() {
      if (esArbol() && dom.escenario) dom.escenario.classList.remove(APRETADO);
    }
    function ajustarArbol() {
      const lienzoArbol = dom.lienzoArbol;
      if (!esArbol() || !lienzoArbol || !lienzoArbol.isConnected) return;
      lienzoArbol.style.zoom = '';
      const escenario = getComputedStyle(dom.escenario);
      const caja = getComputedStyle(dom.estructuraEl);
      // `calculoVisible` es a dónde va el panel, no dónde está: al irse sigue
      // a la vista mientras se desvanece.
      const panel = dom.calculo && dom.calculoVisible && !dom.calculo.el.hidden ? dom.calculo.el : null;
      const separacion = panel ? parseFloat(escenario.columnGap || 0) : 0;
      const sinPanel = dom.escenario.clientWidth
        - parseFloat(escenario.paddingLeft) - parseFloat(escenario.paddingRight)
        - parseFloat(caja.paddingLeft) - parseFloat(caja.paddingRight);
      const disponibleAncho = sinPanel - separacion - apretarCalculo(panel, sinPanel, separacion);
      const disponibleAlto = dom.escenario.clientHeight
        - parseFloat(escenario.paddingTop) - parseFloat(escenario.paddingBottom)
        - parseFloat(caja.paddingTop) - parseFloat(caja.paddingBottom);
      const porAncho = disponibleAncho / lienzoArbol.offsetWidth;
      const porAlto = disponibleAlto / lienzoArbol.offsetHeight;
      let factor = Math.max(ENCOGIMIENTO_MINIMO, Math.min(CRECIMIENTO_MAXIMO, porAncho, porAlto));
      if (factor !== 1) lienzoArbol.style.zoom = String(factor);
      // El alto que de verdad le queda es el de su caja (`max-height: 100%`), y
      // no siempre coincide con el del escenario: en vez de deducirlo, se mira
      // el resultado. Si se sale, se achica lo justo, sin bajar del mínimo.
      const contenedor = dom.estructuraEl;
      if (factor > ENCOGIMIENTO_MINIMO && contenedor.scrollHeight > contenedor.clientHeight + 1) {
        const relleno = parseFloat(caja.paddingTop) + parseFloat(caja.paddingBottom);
        const cabe = (contenedor.clientHeight - relleno) / (contenedor.scrollHeight - relleno);
        factor = Math.max(ENCOGIMIENTO_MINIMO, factor * cabe);
        lienzoArbol.style.zoom = factor === 1 ? '' : String(factor);
      }
      // Reiniciar el zoom de arriba acorta un instante lo que se puede
      // desplazar, y el navegador recorta el desplazamiento: se vuelve a
      // llevar el nodo del paso a la vista.
      if (nodoSeguido && nodoSeguido.isConnected) llevarALaVista(nodoSeguido);
    }

    return { DIAMETRO_NODO, DURACION_APARICION_MS, SEPARACION_HERMANOS, SEPARACION_NIVEL, ajustarArbol, renderizarArbol, seguirAristas, soltarApretado };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.arbol = crearDibujoArbol;
})();
