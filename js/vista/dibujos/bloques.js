(function () {
  const dominio = window.CC2.dominio;
  const vista = window.CC2.vista;

  // Las búsquedas externas (CLAUDE.md 5.8, 5.11 y 6.1): el archivo en
  // columnas, una por bloque, con su rótulo arriba y los bloques ya
  // descartados comprimidos.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoBloques({ estado, dom, config, comunes }) {
    const { llevarALaVista } = comunes;

    // Búsquedas externas (CLAUDE.md 5.x): cuarta orientación de la pantalla.
    // El archivo es el mismo arreglo ordenado y denso de secuencial, y los
    // bloques son una **agrupación de posiciones consecutivas encima de él**:
    // por eso no hay un modelo aparte que mantener, y por eso insertar en
    // medio empuja el desbordamiento al bloque de al lado sin código propio —
    // las claves se corren en el arreglo y el FLIP las anima cruzando el
    // canal.
    //
    // Cuántos bloques ya comparados conservan su último registro antes de que
    // los anteriores se junten en un tramo. Dos: los suficientes para leer de
    // dónde viene la búsqueda sin gastar el ancho que necesita el bloque que
    // se está mirando (pedido del usuario sobre maqueta, 2026-09-11).
    const BLOQUES_RECIENTES = 2;

    function esBloques() {
      return config.orientacion === 'bloques';
    }

    function formaDelArchivo() {
      return dominio.externa.formaDelArchivo(estado.estructura.n);
    }

    // **Cuánto mide un tramo de renglones: una casilla y media**, aunque
    // esconda dieciocho (opción C de las maquetas, elegida por el usuario el
    // 2026-10-11). Hasta entonces medía los renglones que escondía, así que la
    // elisión no ahorraba alto: con N = 400 la columna medía sus 20 renglones
    // y a 950 px el final quedaba fuera. Una casilla y media, y no una, para
    // que el tramo partido en claves y libres tenga aire y para que un tramo
    // no se confunda con una casilla.
    const CASILLAS_POR_TRAMO = 1.5;

    // Lo que mide una lista de segmentos de renglón puestos uno bajo otro:
    // cada casilla, su alto; cada tramo, el alto fijo de un tramo; y los
    // huecos entre ellos. La escala y los bloques miden con esto, que es lo
    // que los mantiene alineados.
    function altoDeSegmentos(segmentos) {
      const tramos = segmentos.filter((segmento) => segmento.tipo === 'tramo').length;
      const unidades = segmentos.length - tramos + tramos * CASILLAS_POR_TRAMO;
      return `calc(${unidades} * var(--alto-casilla) + ${segmentos.length - 1} * var(--espacio-1))`;
    }

    // Numera los renglones una sola vez, a la izquierda de la matriz: todos
    // los bloques tienen los mismos `r`, así que una columna por bloque sería
    // repetir el mismo número B veces (decisión sobre maqueta, 2026-09-11).
    function crearEscalaRegistros(segmentosDelRenglon) {
      // La escala **se construye como un bloque más**: rótulo arriba —oculto,
      // porque no rotula ninguna cubeta— y sus marcas donde van las casillas.
      // Así hereda los mismos huecos y rellenos que un bloque de verdad y el
      // renglón 1 cae a la altura de la primera casilla sin un solo número
      // escrito a mano. Medir el hueco a ojo dejaba la escala dos o cuatro
      // píxeles arriba, poco por renglón y visible al acumularse.
      // No lleva la clase `bloque`: comparte su disposición desde el CSS, pero
      // no *es* un bloque, y quien cuente bloques —las pruebas, sin ir más
      // lejos— no tiene por qué encontrarse una columna de más.
      const columna = document.createElement('div');
      columna.className = 'escala-registros';

      const hueco = document.createElement('span');
      hueco.className = 'bloque__etiqueta bloque__etiqueta--hueco';
      hueco.setAttribute('aria-hidden', 'true');
      hueco.textContent = '\u00A0';
      columna.appendChild(hueco);

      const marcas = document.createElement('div');
      marcas.className = 'bloque__registros';
      for (const segmento of segmentosDelRenglon) {
        const marca = document.createElement('span');
        marca.className = 'renglon__marca';
        marca.textContent = segmento.tipo === 'tramo' ? '⋯' : String(segmento.indice);
        // Una marca alta como el tramo que rotula: si midiera lo de una
        // casilla, la escala se iría despegando de las casillas renglón a
        // renglón y acabaría numerando la que no es.
        if (segmento.tipo === 'tramo') marca.style.height = altoDeSegmentos([segmento]);
        marcas.appendChild(marca);
      }
      columna.appendChild(marcas);
      return columna;
    }

    function crearRotuloDeBloque(bloque, paso) {
      const el = document.createElement('div');
      const descartado = paso && paso.bloquesDescartados && paso.bloquesDescartados.includes(bloque);
      // El bloque en curso se marca en su rótulo y no pintando la columna: el
      // color ya está comprometido con los estados de la casilla y no se
      // reutiliza fuera de ella (CLAUDE.md 8.1).
      const estadoDelBloque = paso && paso.bloque === bloque
        ? ' bloque--en-curso'
        : (descartado ? ' bloque--descartado' : '');
      el.className = 'bloque__etiqueta' + estadoDelBloque;
      el.textContent = `B${bloque}`;
      return el;
    }

    // Una casilla del archivo, dibujada en el bloque que la contiene. `indice`
    // sigue siendo el registro dentro del arreglo —base 1, como en todo el
    // proyecto—: el bloque es solo dónde se dibuja.
    function crearCasillaDeRegistro(paso, registro, bloque) {
      const clave = estado.estructura.claves[registro - 1];
      // `bloque` viaja junto al registro porque el tema lo necesita para saber
      // si la casilla pertenece a un bloque ya descartado, y derivarlo de
      // nuevo desde el índice sería repetir el reparto que la vista ya hizo.
      const descripcion = config.describirCasilla({ paso, indice: registro, bloque, ocupada: clave !== undefined });
      return vista.componentes.casilla.crearCasilla({
        clave,
        indice: registro,
        estado: descripcion.estado,
        modificadores: descripcion.modificadores
      });
    }

    // Un tramo de registros **se parte donde terminan las claves** y cada
    // pedazo se dibuja como lo que resume (CLAUDE.md 6.2; opción B de las
    // maquetas de externas, elegida por el usuario el 2026-10-11): las claves
    // como un bloque sólido, las libres punteadas. Sin partirlo, «⋯ 13 ⋯» en
    // el bloque a medio llenar escondía 9 claves y 4 libres con el mismo
    // dibujo que un bloque vacío. Desde que la escala muestra dónde terminan
    // las claves del archivo ningún tramo mezcla las dos cosas, pero el
    // reparto queda por si alguno lo hiciera. Uno que cae entero en lo
    // descartado se apaga con sus casillas.
    function agregarTramoDeRegistros(contenedor, paso, bloque, desde, cantidad, alto) {
      const ocupado = (registro) => estado.estructura.claves[registro - 1] !== undefined;
      const grupo = document.createElement('div');
      grupo.className = 'tramo-registros__grupo';
      grupo.style.height = alto;
      let inicio = desde;
      const fin = desde + cantidad - 1;
      while (inicio <= fin) {
        let corte = inicio;
        while (corte + 1 <= fin && ocupado(corte + 1) === ocupado(inicio)) corte++;
        const largo = corte - inicio + 1;
        const tramo = document.createElement('div');
        let descartado = true;
        for (let registro = inicio; registro <= corte && descartado; registro++) {
          const descripcion = config.describirCasilla({ paso, indice: registro, bloque, ocupada: ocupado(registro) });
          if (descripcion.estado !== 'descartada') descartado = false;
        }
        tramo.className = 'tramo-registros ' + (ocupado(inicio) ? 'tramo-registros--claves' : 'tramo-registros--vacias')
          + (descartado ? ' tramo-registros--descartado' : '');
        // Los pedazos se reparten el alto del tramo según cuántos registros
        // esconde cada uno.
        tramo.style.flexGrow = String(largo);
        tramo.textContent = `⋯ ${largo} ⋯`;
        grupo.appendChild(tramo);
        inicio = corte + 1;
      }
      contenedor.appendChild(grupo);
    }

    // **Todos los bloques se dibujan sobre los mismos renglones** (opción C de
    // las maquetas, elegida por el usuario el 2026-10-11): cada renglón que la
    // escala numera tiene su casilla en todos los bloques, y solo se esconde
    // lo que la escala también esconde. Hasta entonces los bloques que no se
    // estaban mirando se comprimían a su primer y su último registro, y el
    // renglón que el paso destapaba —el 2 al comparar en B1— quedaba en los
    // demás dentro del tramo. El primero y el último siguen a la vista porque
    // la escala siempre los numera, y el último es el que el algoritmo compara.
    function crearBloqueDeRegistros(paso, bloque, forma, segmentosDelRenglon) {
      const rango = dominio.externa.rangoDelBloque(forma, bloque);
      const registros = dominio.externa.registrosDelBloque(forma, bloque);

      const contenedor = document.createElement('div');
      contenedor.className = 'bloque__registros';

      for (const segmento of segmentosDelRenglon) {
        if (segmento.tipo === 'tramo') {
          // El último renglón del bloque corto siempre es un renglón de la
          // escala (ver `renderizarBloques`), así que ningún tramo lo cruza.
          if (segmento.desde > registros) break;
          agregarTramoDeRegistros(contenedor, paso, bloque, rango.primero + segmento.desde - 1, segmento.cantidad,
            altoDeSegmentos([segmento]));
          continue;
        }
        // El último bloque se dibuja **corto**: sus posiciones de más no
        // existen, y una casilla vacía ahí diría «aquí cabe una clave», que es
        // mentira (pedido del usuario, 2026-09-11). La capacidad del archivo
        // es exactamente N.
        if (segmento.indice > registros) break;
        contenedor.appendChild(crearCasillaDeRegistro(paso, rango.primero + segmento.indice - 1, bloque));
      }
      return contenedor;
    }

    // Cuántos renglones con clave tiene un bloque, si está a medio llenar.
    // Lleno o vacío no hay frontera que mostrar.
    function ocupadasDelBloque(bloque, forma) {
      if (!bloque) return null;
      const rango = dominio.externa.rangoDelBloque(forma, bloque);
      let ocupadas = 0;
      for (let registro = rango.primero; registro <= rango.ultimo; registro++) {
        if (estado.estructura.claves[registro - 1] !== undefined) ocupadas++;
      }
      return ocupadas > 0 && ocupadas < rango.ultimo - rango.primero + 1 ? ocupadas : null;
    }

    function renderizarBloques(paso, opciones) {
      const forma = formaDelArchivo();

      // Los renglones se eliden con la regla de siempre (CLAUDE.md 6.2), una
      // sola vez para toda la matriz: si cada bloque elidiera por su cuenta,
      // sus renglones dejarían de corresponderse y la escala de la izquierda
      // dejaría de rotular lo que rotula.
      //
      // Los renglones relevantes son los de las casillas que el tema declara:
      // la del paso y, en binaria externa, los extremos del rango que está
      // estrechando dentro del bloque.
      const renglonDe = (registro) =>
        registro - dominio.externa.rangoDelBloque(forma, dominio.externa.bloqueDe(forma, registro)).primero + 1;
      //
      // El paso final no trae las suyas: lleva en `vistas` las del último
      // paso, para que la elisión no cambie al apagar los resaltados (§7).
      const casillasDelPaso = paso ? (paso.vistas || config.casillasRelevantes(paso)) : [];
      const renglonesRelevantes = casillasDelPaso.map(renglonDe);
      // El último renglón del bloque corto, siempre: es el registro que el
      // algoritmo compara, y sin esto caía dentro de un tramo.
      const registrosDelUltimo = dominio.externa.registrosDelBloque(forma, forma.bloques);
      if (registrosDelUltimo < forma.registrosPorBloque) renglonesRelevantes.push(registrosDelUltimo);
      // El bloque que el paso tiene abierto: el que lee o, si no lee ninguno,
      // el de la casilla que señala —insertar no lee bloques, y el paso final
      // tampoco—. Nunca se esconde en «⋯ k bloques ⋯» y la vista lo sigue.
      const bloqueAbierto = paso
        ? (paso.bloque || (casillasDelPaso.length ? dominio.externa.bloqueDe(forma, casillasDelPaso[0]) : null))
        : null;
      // Y dónde terminan las claves del archivo: la última clave y la primera
      // libre del bloque a medio llenar, el único que mezcla las dos cosas.
      // Sin esto su tramo se partía en un pedazo de claves aplastado contra
      // uno de libres. **Solo esas dos, aunque las claves del bloque quepan
      // todas** (visto por el usuario en el llenado automático, 2026-10-11):
      // con la regla 2 + 4 entera de la fila, sus renglones se abrían en toda
      // la matriz —con N = 120 llegaba a verse entera, como con «Ver
      // estructura completa»— y se cerraban de golpe al llegar al umbral, una
      // vez por bloque.
      const totalDeClaves = estado.estructura.claves.filter((clave) => clave !== undefined).length;
      const bloqueFrontera = totalDeClaves > 0 ? dominio.externa.bloqueDe(forma, totalDeClaves) : null;
      const clavesDeLaFrontera = ocupadasDelBloque(bloqueFrontera, forma);
      if (clavesDeLaFrontera) renglonesRelevantes.push(clavesDeLaFrontera, clavesDeLaFrontera + 1);
      // Un tramo de dos renglones se dibuja como sus dos casillas: con el
      // tramo a casilla y media no ahorraba casi nada.
      const segmentosDelRenglon = vista.elision.calcularSegmentos({
        n: forma.registrosPorBloque,
        relevantes: renglonesRelevantes,
        orientacion: 'vertical',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      }).flatMap((segmento) => (segmento.tipo === 'tramo' && segmento.cantidad === 2
        ? [{ tipo: 'casilla', indice: segmento.desde }, { tipo: 'casilla', indice: segmento.hasta }]
        : [segmento]));

      // Bloques que nunca se esconden dentro de un tramo: el primero y el
      // último —la regla de siempre—, el del paso, y los últimos comparados.
      // En secuencial externa los comparados son los descartados, en orden;
      // binaria externa descarta por los dos lados y dice cuáles leyó.
      const comparados = (paso && (paso.bloquesLeidos || paso.bloquesDescartados)) || [];
      const relevantes = comparados.slice(-BLOQUES_RECIENTES);
      if (bloqueAbierto) relevantes.push(bloqueAbierto);
      // Y los extremos del rango de binaria externa: sin ellos, un tramo
      // «⋯ 7 bloques ⋯» se tragaba el bloque donde empieza el rango, que es
      // lo que el paso está diciendo.
      if (paso && paso.rangoBloques) relevantes.push(paso.rangoBloques.inicio, paso.rangoBloques.fin);
      // Y el último bloque con claves: hasta ahí llega el archivo, y escondido
      // en «⋯ k bloques ⋯» se perdía dónde terminan los datos (la regla 2 + 4
      // de la fila, llevada a los bloques).
      if (bloqueFrontera) relevantes.push(bloqueFrontera);
      const segmentosDeBloques = vista.elision.calcularSegmentos({
        n: forma.bloques,
        relevantes,
        orientacion: 'horizontal',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });

      let grupoSeguido = null;
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = 'estructura-bloques';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';
        dom.estructuraEl.appendChild(crearEscalaRegistros(segmentosDelRenglon));

        for (const segmento of segmentosDeBloques) {
          if (segmento.tipo === 'tramo') {
            const tramo = document.createElement('div');
            tramo.className = 'tramo-bloques';
            tramo.textContent = `⋯ ${segmento.cantidad} bloques ⋯`;
            dom.estructuraEl.appendChild(tramo);
            continue;
          }

          const bloque = segmento.indice;
          const grupo = document.createElement('div');
          grupo.className = 'bloque';
          grupo.appendChild(crearRotuloDeBloque(bloque, paso));
          grupo.appendChild(crearBloqueDeRegistros(paso, bloque, forma, segmentosDelRenglon));
          dom.estructuraEl.appendChild(grupo);
          if (bloque === bloqueAbierto) grupoSeguido = grupo;
        }

        llevarALaVista(grupoSeguido);
      }, opciones);
    }

    return { esBloques, renderizarBloques };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.bloques = crearDibujoBloques;
})();
