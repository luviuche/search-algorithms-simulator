(function () {
  const dominio = window.CC2.dominio;
  const vista = window.CC2.vista;

  // Piezas que comparten los dibujos de la estructura (CLAUDE.md 6): las
  // marcas de índice y los tramos elididos, las casillas de los arreglos
  // anidados y de las cadenas, qué casillas son relevantes para la elisión, y
  // `llevarALaVista`, que desplaza el lienzo hasta lo que el paso señala.
  // También las preguntas por la orientación del tema (`esVertical`,
  // `esArbol`) y el ancho de casilla, que la pantalla usa para armarse.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearPiezasComunes({ estado, dom, config }) {

    function esMarcaMayor(indice, n) {
      return indice === 1 || indice === n || indice % 5 === 0;
    }

    // Otras búsquedas dinámicas numera sus cubetas desde 0 (pedido del
    // usuario, 2026-09-06): es la única excepción a "toda salida visible
    // numera desde 1" (CLAUDE.md 3.1), porque así las dibuja el docente y
    // así calcula la dirección `H(k) = k mod n`. El índice interno sigue
    // siendo base 1 —arreglos, cálculo, bitácora— y solo cambia el texto que
    // se muestra en la escala.
    function crearMarca(indice, n) {
      const el = document.createElement('span');
      el.className = 'escala__marca' + (esMarcaMayor(indice, n) ? ' escala__marca--mayor' : '');
      el.textContent = String(config.numerarDesdeCero ? indice - 1 : indice);
      return el;
    }

    // Los renglones de una cubeta sí numeran desde 1: la excepción de arriba
    // es solo para las cubetas. Sin marca propia hoy —la matriz solo rotulaba
    // la cubeta—, así que se dibuja una columna de etiquetas a la izquierda,
    // alineada con el mismo `--espacio-1` que separa los renglones dentro de
    // cada cubeta.
    function crearEtiquetasRenglones(segmentosDelAnidado, hayRechazada) {
      const columna = document.createElement('div');
      columna.className = 'columna-casilla columna-etiquetas';

      // Ocupa el mismo lugar que la marca de la cubeta en las columnas reales,
      // para que el primer renglón quede a la misma altura en todas. **Lleva
      // un espacio duro dentro**: vacío, el navegador le da alto cero —no hay
      // línea que medir— y toda la columna de números subía 16 px, un renglón
      // entero desalineada respecto de las cubetas que rotula.
      const espaciador = document.createElement('span');
      espaciador.className = 'escala__marca';
      espaciador.setAttribute('aria-hidden', 'true');
      espaciador.textContent = '\u00A0';
      columna.appendChild(espaciador);

      const principal = document.createElement('span');
      principal.className = 'renglon__marca';
      principal.textContent = '1';
      columna.appendChild(principal);

      for (const segmento of segmentosDelAnidado) {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'renglon__marca';
        // Un tramo compacta varios renglones: no hay un número propio que darle.
        etiqueta.textContent = segmento.tipo === 'tramo' ? '⋯' : String(segmento.indice + 1);
        columna.appendChild(etiqueta);
      }
      // La fila de la clave rechazada no es un renglón más de la cubeta: es
      // donde espera lo que no cupo, y por eso se rotula «Col» y no con un
      // número (así lo escribe el docente en el taller, CLAUDE.md 5.7).
      if (hayRechazada) {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'renglon__marca renglon__marca--col';
        etiqueta.textContent = 'Col';
        columna.appendChild(etiqueta);
      }
      return columna;
    }

    // El tramo dice cuántas casillas resume y no entre qué direcciones va
    // (pedido del usuario, 2026-08-29). El rótulo `6–8` en la escala se
    // multiplicaba: cada clave insertada parte un tramo en dos, y la tabla
    // terminaba con más números de escala que claves. Lo que el tema enseña es
    // dónde cayó cada clave; el rango elidido no aporta a eso, y el conteo
    // basta para que la escala no parezca que pierde casillas.
    function tramoDescartado(paso, segmento) {
      const claves = estado.estructura.claves;
      for (let indice = segmento.desde; indice <= segmento.hasta; indice++) {
        const descripcion = config.describirCasilla({ paso, indice, ocupada: claves[indice - 1] !== undefined });
        if (descripcion.estado !== 'descartada') return false;
      }
      return true;
    }

    // En una estructura ordenada el tramo se dibuja como lo que resume: las
    // vacías del final, punteado; las claves escondidas, con el borde de una
    // casilla ocupada (ver `calcularSegmentos`).
    function crearTramo(desde, hasta, { vacias = false, claves = false } = {}) {
      const el = document.createElement('div');
      el.className = 'tramo-elidido'
        + (vacias ? ' tramo-elidido--vacias' : '')
        + (claves ? ' tramo-elidido--claves' : '');
      el.textContent = `⋯ ${hasta - desde + 1} ⋯`;
      return el;
    }

    function esVertical() {
      return config.orientacion === 'vertical';
    }

    // El árbol se dibuja por niveles y no como una fila de casillas: es la
    // tercera orientación de la pantalla (CLAUDE.md 6.7).
    function esArbol() {
      return config.orientacion === 'arbol';
    }

    // Todas las casillas de la pantalla miden lo mismo, y lo que miden sale de
    // `l`: una casilla que crece cuando le entra una clave deforma la fila y,
    // en la matriz de arreglos anidados, descoloca todas las columnas a su
    // derecha. El ancho se fija en la raíz de la pantalla para que lo hereden
    // por igual la tabla, sus arreglos y el apilado.
    //
    // **Nunca más angosta que la de cuatro cifras** (opción C de las maquetas,
    // elegida por el usuario el 2026-10-09). Con `l = 2` la casilla medía unos
    // 45 px: la tabla vertical quedaba amontonada, con el conteo de los tramos
    // apretado en «⋯22⋯», y la fila de secuencial y binaria, igual de
    // estrecha. Vale para todo lo que se dibuja con casillas.
    const CIFRAS_MINIMAS = 4;
    function ajustarAnchoDeCasilla(l) {
      const cifras = Math.max(l, CIFRAS_MINIMAS);
      dom.pantalla.style.setProperty('--ancho-casilla', `${vista.componentes.casilla.anchoParaCifras(cifras)}px`);
    }

    // **Y si sobra lienzo, la estructura crece** (opción C, 2026-10-09), como
    // ya hacen los árboles y el bosque de Huffman: hasta `CRECIMIENTO_MAXIMO`,
    // y solo si cabe a lo ancho —con el panel del cálculo, si está en el
    // flujo— y a lo alto. Nunca encoge: lo que no cabe se desplaza, como
    // siempre. Casillas, números y tramos crecen juntos, con `zoom` en la caja.
    //
    // **Dentro de una operación no crece, solo se achica** si algo dejó de
    // caber —el apilado de binaria suma una fila por paso, la tabla hash le
    // hace sitio al cálculo—: medida paso a paso, la escala cambiaba con cada
    // tramo que la elisión abría o cerraba. Se vuelve a medir en reposo, en el
    // paso final y al cambiar la ventana.
    //
    // La llaman la fila y el apilado; los árboles, el bosque, los bloques y los
    // índices tienen su propio ajuste o se desplazan.
    const CRECIMIENTO_MAXIMO = 1.5;
    function ajustarEscala(paso) {
      const caja = dom.estructuraEl;
      if (!caja || !dom.escenario || !caja.isConnected) return;
      caja.style.zoom = '';
      const escenario = getComputedStyle(dom.escenario);
      const panel = dom.calculo && !dom.calculo.el.hidden && dom.calculo.el.parentNode === dom.escenario
        && dom.calculo.el.style.position !== 'absolute' ? dom.calculo.el : null;
      const ancho = dom.escenario.clientWidth
        - parseFloat(escenario.paddingLeft) - parseFloat(escenario.paddingRight)
        - (panel ? panel.offsetWidth + (parseFloat(escenario.columnGap) || 0) : 0);
      const alto = dom.escenario.clientHeight
        - parseFloat(escenario.paddingTop) - parseFloat(escenario.paddingBottom);
      if (caja.scrollWidth <= 0 || caja.scrollHeight <= 0) return;
      let factor = Math.max(1, Math.min(CRECIMIENTO_MAXIMO, ancho / caja.scrollWidth, alto / caja.scrollHeight));
      const anterior = estado.escalaEstructura || 1;
      // El tope de la operación: lo que medía en el paso anterior, o en reposo
      // antes de empezarla. Lo suelta
      // «Ver estructura completa», que cambia lo que se ve, con
      // `soltarTopeDeEscala`: con la estructura completa la
      // escala bajaba a 1×, y al volver a elidir se quedaba lejos hasta que
      // terminaba la búsqueda (visto por el usuario, 2026-10-09).
      const enOperacion = paso && !paso.final;
      if (enOperacion && estado.topeDeEscala != null) factor = Math.min(factor, estado.topeDeEscala);
      estado.topeDeEscala = factor;
      estado.escalaEstructura = factor;
      if (factor > 1.001) caja.style.zoom = String(factor);
      // **El cambio de escala se anima como un bloque**, como el del árbol al
      // aparecer el cálculo: la caja arranca con el tamaño que tenía y llega al
      // nuevo. Sin esto, el FLIP deslizaba las casillas a su sitio mientras la
      // numeración —que no son casillas— saltaba de golpe, y por 400 ms quedaban
      // descuadradas (lo vio la prueba de humo en cubetas, tras la expansión).
      // Se suma (`composite: 'add'`) al corrimiento que ya pudiera llevar la
      // caja, el de cuando aparece o se va el cálculo, en vez de cancelarlo.
      if (Math.abs(factor - anterior) > 0.001 && caja.childElementCount > 0
        && !vista.animacion.prefiereMovimientoReducido()) {
        caja.animate(
          [{ transform: `scale(${anterior / factor})` }, { transform: 'none' }],
          { duration: DURACION_CAMBIO_DE_ESCALA_MS, easing: 'ease-in-out', composite: 'add' }
        );
      }
    }
    const DURACION_CAMBIO_DE_ESCALA_MS = 400;

    function soltarTopeDeEscala() {
      estado.topeDeEscala = null;
    }

    // Los píxeles de la caja de la estructura, que puede llevar `zoom` (ver
    // `ajustarEscala`): lo que se mide en la pantalla hay que dividirlo.
    function escalaDeLaCaja() {
      return parseFloat(dom.estructuraEl && dom.estructuraEl.style.zoom) || 1;
    }

    // Cuántas columnas de arreglo anidado dibuja cada dirección (CLAUDE.md 5.4).
    // Cero cuando el tratamiento elegido no tiene estructuras secundarias, que
    // es el caso de los demás y de todos los temas que no son hash.
    function columnasAnidadas() {
      return (config.anidados && estado.estructura) ? config.anidados.columnas(estado.estructura) : 0;
    }

    // Las columnas del arreglo anidado, elididas con la misma regla que la
    // tabla (CLAUDE.md 6.2): la primera, la última, y las posiciones que hay
    // que ver, con un tramo diciendo cuánto se resumió.
    //
    // **Se calculan una sola vez para todas las filas**, sobre las posiciones
    // ocupadas de la estructura entera. Si cada fila elidiera por su cuenta,
    // tendrían distinta cantidad de columnas y la matriz dejaría de estar
    // alineada, que es justo lo que la hace legible.
    function segmentosAnidados(paso) {
      const columnas = columnasAnidadas();
      if (columnas === 0) return [];

      const relevantes = [];
      for (let indice = 1; indice <= estado.estructura.n; indice++) {
        const anidado = dominio.estructura.anidadoDe(estado.estructura, indice);
        for (let posicion = 1; posicion <= anidado.length; posicion++) {
          if (anidado[posicion - 1] !== undefined) relevantes.push(posicion);
        }
      }
      if (paso && paso.posicion) relevantes.push(paso.posicion);

      return vista.elision.calcularSegmentos({
        n: columnas,
        relevantes,
        // El arreglo se dibuja a lo ancho de la fila, así que su umbral es el
        // horizontal: con n = 10 sus nueve columnas caben y no se elide nada.
        orientacion: 'horizontal',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });
    }

    // La fila de una dirección con arreglo anidado se lee como una matriz: la
    // primera columna es la tabla —donde aterrizó la clave que obtuvo la
    // dirección— y las demás son su arreglo, en orden de llegada. Las vacías
    // se dibujan a propósito: ver cuánto espacio queda antes de que el método
    // se agote es lo que el tema enseña.
    function casillasAnidadas(paso, indice, segmentos) {
      const anidado = dominio.estructura.anidadoDe(estado.estructura, indice);
      return segmentos.map((segmento) => {
        // Un tramo solo esconde posiciones vacías: las ocupadas son relevantes
        // en todas las filas, así que ninguna cae dentro de un tramo. Por eso
        // va punteado, como ellas.
        if (segmento.tipo === 'tramo') {
          const tramoEl = crearTramo(segmento.desde, segmento.hasta, { vacias: true });
          tramoEl.classList.add('tramo-elidido--anidado');
          return tramoEl;
        }
        const posicion = segmento.indice;
        const clave = anidado[posicion - 1];
        const descripcion = config.describirCasilla({ paso, indice, posicion, ocupada: clave !== undefined });
        return vista.componentes.casilla.crearCasilla({
          clave,
          // Identidad propia por posición: dos casillas vacías con la misma
          // identidad dejarían al FLIP sin saber cuál se movió (CLAUDE.md 7).
          indice: `${indice}.${posicion}`,
          estado: descripcion.estado,
          // El trazo punteado de `anidada` dice "esto es la estructura
          // secundaria de la casilla de al lado", y eso solo es cierto en los
          // temas hash (CLAUDE.md 5.4). **En la matriz horizontal —cubetas— los
          // `r` renglones son todos lo mismo**: renglones de la misma cubeta,
          // y el primero no es más tabla que los otros. Marcarlo distinto hacía
          // que la primera fila se viera con otro borde (defecto visto por el
          // usuario, 2026-09-11).
          modificadores: esVertical()
            ? (descripcion.modificadores || []).concat('anidada')
            : (descripcion.modificadores || [])
        });
      });
    }

    // Encadenamiento secuencial (CLAUDE.md 5.4): la dirección no cuelga un
    // arreglo de tamaño fijo sino una cadena que crece. Se dibuja aparte de la
    // matriz por las dos cosas que la distinguen.
    function esEncadenada() {
      return !!(config.anidados && config.anidados.cadena && estado.estructura
        && config.anidados.cadena(estado.estructura));
    }

    function crearEnlace() {
      const el = document.createElement('span');
      el.className = 'cadena__enlace';
      // La flecha es lo que separa a simple vista la cadena del arreglo
      // anidado: sin ella los dos tratamientos se verían casi igual y lo que
      // los diferencia dejaría de verse en el dibujo.
      el.textContent = '→';
      el.setAttribute('aria-hidden', 'true');
      return el;
    }

    // La cadena de una dirección, enlazada con flechas. Devuelve un solo
    // elemento —no una casilla por columna— porque aquí no hay matriz que
    // alinear: **cada fila elide por su cuenta**, ya que la posición en una
    // cadena es orden de llegada y no el resultado del algoritmo. Una
    // dirección sin colisiones no dibuja cadena.
    function casillasEncadenadas(paso, indice) {
      const cadena = dominio.estructura.anidadoDe(estado.estructura, indice);
      if (cadena.length === 0) return null;

      // Aquí sí se pueden comprimir posiciones ocupadas, al revés que en la
      // tabla dispersa (§6.2): comprimir el medio de una cadena no esconde
      // ninguna decisión del algoritmo. Se conservan la cabeza, la cola y la
      // posición del paso.
      const segmentos = vista.elision.calcularSegmentos({
        n: cadena.length,
        relevantes: (paso && paso.casilla === indice && paso.posicion) ? [paso.posicion] : [],
        orientacion: 'horizontal',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });

      const contenedor = document.createElement('div');
      contenedor.className = 'cadena';
      for (const segmento of segmentos) {
        contenedor.appendChild(crearEnlace());
        if (segmento.tipo === 'tramo') {
          // Como en el arreglo anidado: solo esconde posiciones vacías.
          const tramoEl = crearTramo(segmento.desde, segmento.hasta, { vacias: true });
          tramoEl.classList.add('tramo-elidido--anidado');
          contenedor.appendChild(tramoEl);
          continue;
        }
        const posicion = segmento.indice;
        const clave = cadena[posicion - 1];
        const descripcion = config.describirCasilla({ paso, indice, posicion, ocupada: clave !== undefined });
        contenedor.appendChild(vista.componentes.casilla.crearCasilla({
          clave,
          indice: `${indice}.${posicion}`,
          estado: descripcion.estado,
          modificadores: descripcion.modificadores
        }));
      }
      return contenedor;
    }

    // `hasta` acota la elisión cuando el dibujo no llega a la n: el apilado de
    // binaria dibuja de la casilla 1 a la última clave, y las columnas de las
    // vacías de después quedaban reservadas y en blanco a la derecha, con las
    // filas corridas a la izquierda del lienzo (2026-10-09).
    function segmentosDe(relevantes, { hasta = estado.estructura.n } = {}) {
      const segmentos = vista.elision.calcularSegmentos({
        n: hasta,
        relevantes,
        orientacion: config.orientacion || 'horizontal',
        mostrarCompleta: estado.mostrarCompleta,
        // En una tabla dispersa grande se dibujan la 1, la n y las claves, y
        // nada más: es como el docente la dibuja en el tablero. Las vecinas
        // vacías se quedan para las estructuras ordenadas, donde acompañan a
        // una comparación y no a cada clave colocada.
        vecinas: config.modo !== dominio.estructura.MODOS.DISPERSA,
        // En las ordenadas las claves llenan el prefijo: se ve hasta dónde.
        ocupadas: estado.estructura.modo === dominio.estructura.MODOS.ORDENADA
          ? dominio.estructura.cantidadClaves(estado.estructura)
          : null
      });
      // En una dispersa toda casilla ocupada es relevante (ver
      // `relevantesDelPaso`): sus tramos solo esconden vacías, y se dibujan
      // punteados como ellas (2026-10-09, la regla de la fila llevada a hash).
      if (config.modo === dominio.estructura.MODOS.DISPERSA) {
        for (const segmento of segmentos) if (segmento.tipo === 'tramo') segmento.vacias = true;
      }
      return segmentos;
    }

    // En una estructura dispersa, dónde quedó cada clave *es* el resultado del
    // algoritmo: comprimir una casilla ocupada dentro de un tramo borra lo que
    // el tema enseña. En las ordenadas no hace falta, porque las claves ocupan
    // siempre el mismo prefijo y su posición no dice nada por sí sola.
    //
    // Estas van sin vecinas (ver `segmentosDe`): el sondeo de la reasignación
    // se sigue viendo entero porque `casillasRelevantes` ya trae las casillas
    // sondeadas, así que la vecina solo agregaría una casilla vacía por clave.
    function relevantesDelPaso(paso) {
      let relevantes = [];
      if (paso) relevantes = paso.vistas || config.casillasRelevantes(paso);
      if (config.modo !== dominio.estructura.MODOS.DISPERSA) return relevantes;

      const ocupadas = [];
      const claves = estado.estructura.claves;
      for (let indice = 1; indice <= estado.estructura.n; indice++) {
        if (claves[indice - 1] !== undefined) ocupadas.push(indice);
      }
      return relevantes.concat(ocupadas);
    }

    // Aun con la elisión al mínimo, una tabla con muchas claves no cabe en el
    // lienzo: cada clave suma unos 78 px y en una ventana de 700 px el lienzo
    // da para tres. Cuando no cabe, la casilla del paso se lleva al centro de
    // lo visible — el estudiante mira el cálculo y la casilla que resulta, y no
    // tiene por qué buscarla desplazando.
    //
    // El salto es instantáneo y no suave a propósito: se dispara dentro del
    // cambio que anima el FLIP, y un desplazamiento en curso dejaría las
    // casillas animándose hacia coordenadas que ya se movieron.
    function llevarALaVista(grupo) {
      if (!grupo) return;
      const caja = dom.estructuraEl;
      // Con getBoundingClientRect y no offsetTop: el lienzo no está posicionado,
      // así que offsetTop se mediría contra un ancestro cualquiera.
      const cajaRect = caja.getBoundingClientRect();
      const grupoRect = grupo.getBoundingClientRect();
      // Los rectángulos van en píxeles de pantalla y el desplazamiento en los
      // de la caja, que puede estar escalada (ver `ajustarEscala`).
      const z = escalaDeLaCaja();

      const centrar = (eje) => {
        const vertical = eje === 'vertical';
        const sobrante = vertical
          ? caja.scrollHeight - caja.clientHeight
          : caja.scrollWidth - caja.clientWidth;
        if (sobrante <= 0) return;
        const centrado = vertical
          ? (grupoRect.top - cajaRect.top) / z + caja.scrollTop - (caja.clientHeight - grupoRect.height / z) / 2
          : (grupoRect.left - cajaRect.left) / z + caja.scrollLeft - (caja.clientWidth - grupoRect.width / z) / 2;
        const destino = Math.max(0, Math.min(centrado, sobrante));
        if (vertical) caja.scrollTop = destino;
        else caja.scrollLeft = destino;
      };

      // El árbol crece en las dos direcciones —niveles hacia abajo, hermanos a
      // lo ancho—, así que puede tener que desplazarse por las dos.
      if (esArbol()) {
        centrar('vertical');
        centrar('horizontal');
        return;
      }
      // Los bloques crecen a lo ancho —una columna por bloque— y hacia abajo
      // los acota `r`, así que se desplazan como la horizontal.
      centrar(esVertical() ? 'vertical' : 'horizontal');
    }

    return { ajustarAnchoDeCasilla, ajustarEscala, soltarTopeDeEscala, casillasAnidadas, casillasEncadenadas, columnasAnidadas, crearEtiquetasRenglones, crearMarca, crearTramo, esArbol, esEncadenada, esVertical, escalaDeLaCaja, llevarALaVista, relevantesDelPaso, segmentosAnidados, segmentosDe, tramoDescartado };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.comun = crearPiezasComunes;
})();
