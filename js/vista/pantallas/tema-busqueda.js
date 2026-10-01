(function () {
  const dominio = window.CC2.dominio;
  const vista = window.CC2.vista;
  const persistencia = window.CC2.persistencia;

  // Ritmo del llenado automático (CLAUDE.md 7). No reproduce la traza de cada
  // clave —llenar es preparar el escenario, no la lección— pero sí tiene que
  // dejar ver dónde se acomoda cada una.
  //
  // La regla que no se puede romper: **entre clave y clave tiene que caber la
  // animación entera**. Las animaciones se reemplazan en vez de encolarse
  // (CLAUDE.md 7), así que con un intervalo más corto que la animación cada
  // clave cancelaba el movimiento de la anterior a media carrera y las claves
  // parecían amontonarse en lugar de acomodarse. Era el caso: 150 ms de
  // intervalo contra 400 de animación (pedido del usuario, 2026-08-30).
  const MS_ANIMACION_LLENADO = 500;
  const MS_ENTRE_CLAVES = 700;

  // Ancho de casilla para los temas sin `l` (`config.sinLongitud`, CLAUDE.md
  // 5.7): sin una longitud fija que medir, se reserva sitio para varias
  // cifras en vez del ancho de una sola que daría `anchoParaCifras` por
  // defecto.
  const ANCHO_CIFRAS_SIN_LONGITUD = 6;

  // El deslizador se rotula «Velocidad», así que tiene que crecer hacia la
  // derecha: más a la derecha, más rápido (pedido del usuario, 2026-08-30).
  // El reproductor, en cambio, quiere el tiempo *entre* pasos, que crece al
  // revés. La suma de los extremos hace de espejo, y por eso la conversión es
  // su propia inversa: sirve para los dos sentidos.
  const PASO_MS_MINIMO = 200;
  const PASO_MS_MAXIMO = 4000;
  const PASO_MS_POR_OMISION = 1600;
  const espejarVelocidad = (valor) => PASO_MS_MINIMO + PASO_MS_MAXIMO - Number(valor);

  // Con la traza corriendo sola, el ritmo hay que poder leerlo y no solo
  // adivinarlo por dónde quedó el pulgar del deslizador.
  const segundosPorPaso = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

  // Pantalla de trabajo común a los temas de búsqueda interna. Secuencial la
  // estrenó; binaria y la transformación de claves la reutilizan (CLAUDE.md 12).
  // Lo único que cambia entre temas entra por `config`; todo lo demás
  // —configurar, insertar, llenar, reproducir, elidir, bitácora— vive aquí una
  // sola vez.
  //
  // config = {
  //   titulo, descripcion, orientacion, modo,     // orientacion: horizontal | vertical | arbol
  //   claveEsLetra: bool,                         // opcional: la clave es una letra, no un número
  //   sinTamano: bool, tamano() -> { n, l },      // opcional: n y l no se piden, los da el tema
  //   mensajeCreacion(estructura) -> string,      // opcional: qué registra la bitácora al crear
  //   insertarPalabra({ estructura, letras }),    // opcional: inserta las letras de una palabra
  //   buscar({ estructura, objetivo }) -> pasos,
  //   eliminar({ estructura, clave }) -> pasos,   // buscar y además sacar
  //   insertar({ estructura, clave }) -> pasos,   // opcional: inserción con traza
  //   tratamientos: [{ valor, etiqueta }],        // opcional: selector al crear
  //   calculo: bool,                              // opcional: panel de cálculo
  //   casillasRelevantes(paso) -> [indices base 1],
  //   describirCasilla({ paso, indice, ocupada }) -> { estado, modificadores },
  //   apilada: {                                  // opcional: una fila por paso
  //     rangoDePaso(paso),
  //     aplicaA(paso)                             // opcional: pasos sin fila
  //   },
  //   metricas: [{ id, etiqueta, valor({ estructura, paso }) -> string }]
  // }
  //
  // Ninguna operación toca la estructura al trazar (CLAUDE.md 4). Un paso puede
  // declarar el `efecto` que produce —colocar, retirar o eliminar— y es esta
  // pantalla la que lo aplica al llegar y lo deshace al retroceder, rehaciendo
  // desde el estado previo a la operación (ver `sincronizarEfectos`).
  function crearPantallaTema(config, alVolver) {
    const estado = {
      estructura: null,
      reproductor: null,
      pasoActual: null,
      indicePaso: -1,
      // Traza en curso y columnas del apilado; ambas viven mientras dure la
      // operación y se descartan al invalidarla.
      pasos: null,
      segmentosApilado: null,
      // Las claves tal como estaban antes de la operación en curso. Es lo que
      // permite reconstruir cualquier paso aplicando desde cero los efectos
      // que la traza declara hasta ahí (ver `sincronizarEfectos`).
      clavesBase: null,
      mostrarCompleta: false,
      // «Editar» abrió la configuración plegada (ver `sincronizarConfiguracion`).
      editandoConfiguracion: false
    };
    const dom = { metricas: {} };

    // En 24 horas y no en 12: "12:54:31 p. m." es el formato más largo posible,
    // y esta columna vive en el panel más estrecho de la pantalla.
    function horaActual() {
      return new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    }

    function registrarBitacora(mensaje) {
      vista.componentes.bitacora.agregarEntrada(dom.bitacora, { hora: horaActual(), mensaje });
    }

    function mostrarAlerta(tipo, mensaje) {
      // Repintar el mismo aviso lo haría anunciarse otra vez al lector de
      // pantalla y parpadear en cada paso: si no cambió, se deja como está.
      const vigente = dom.alertas.firstChild;
      if (vigente && vigente.dataset.tipo === tipo && vigente.dataset.mensaje === mensaje) return;

      dom.alertas.innerHTML = '';
      const icono = tipo === 'error' ? '✕' : tipo === 'advertencia' ? '!' : 'i';
      const el = vista.componentes.panel.crearAlerta({ tipo, mensaje, icono });
      el.dataset.tipo = tipo;
      el.dataset.mensaje = mensaje;
      dom.alertas.appendChild(el);
    }

    function limpiarAlerta() {
      dom.alertas.innerHTML = '';
    }

    // Qué pasos de una traza merecen un aviso, y con qué gravedad. La bitácora
    // registra todos; el aviso destaca los que deciden el resultado, para no
    // tener que leer la bitácora entera para saber qué pasó. Los pasos de
    // recorrido —comparación, sondeo, cálculo, desplazamiento— no avisan: son
    // el trámite, no la noticia.
    const AVISO_POR_PASO = Object.freeze({
      colision: 'advertencia',
      rechazada: 'error',
      saturada: 'error',
      'no-encontrada': 'advertencia',
      encontrada: 'info',
      insercion: 'info',
      eliminacion: 'info',
      // Otras búsquedas dinámicas (CLAUDE.md 5.x): que `n` acaba de cambiar es
      // justo la noticia que el tema enseña, así que también avisa.
      expansion: 'advertencia',
      reduccion: 'info',
      // El árbol de Huffman terminado —con su longitud media— es la noticia
      // del tema; las uniones de en medio son el trámite y no avisan.
      construido: 'info'
    });

    // El aviso se deduce del punto de la traza y no se acumula: al retroceder
    // vuelve a decir lo que correspondía ahí, igual que la estructura (ver
    // `sincronizarEfectos`). Se busca hacia atrás porque el paso en pantalla
    // suele ser de trámite y la noticia vigente es la última que hubo.
    function sincronizarAviso(indicePaso) {
      if (!estado.pasos) return;
      for (let i = Math.min(indicePaso, estado.pasos.length - 1); i >= 0; i--) {
        // El paso final no trae noticia propia, aunque se llame `encontrada`.
        if (estado.pasos[i].final) continue;
        const tipo = AVISO_POR_PASO[estado.pasos[i].tipo];
        if (tipo) {
          mostrarAlerta(tipo, estado.pasos[i].mensaje);
          return;
        }
      }
      limpiarAlerta();
    }

    function requiereEstructura() {
      if (!estado.estructura) {
        mostrarAlerta('error', 'Estructura no inicializada: no existen claves para procesar.');
        return false;
      }
      return true;
    }

    // Cómo se aplica cada efecto que un paso puede declarar (ver traza.js).
    // La **forma** del árbol —cuántas ramas abre un nodo, con qué se rotulan,
    // qué posiciones se pintan— entra por `config` y no está cableada aquí: el
    // árbol digital y residuos son binarios, y residuos múltiples ramifica por
    // bloques de bits (CLAUDE.md 5.5). Todo lo que la pantalla hace con un
    // árbol pasa por esta interfaz.
    const formaArbol = config.arbol || dominio.arbol;

    const APLICADORES = {
      colocar: (efecto) => dominio.estructura.colocarEn(estado.estructura, efecto.casilla, efecto.clave),
      retirar: (efecto) => dominio.estructura.retirarDe(estado.estructura, efecto.casilla),
      // En una estructura ordenada sacar la clave cierra el hueco: el dominio
      // desplaza las siguientes, y el FLIP lo anima (CLAUDE.md 7).
      eliminar: (efecto) => dominio.estructura.eliminar(estado.estructura, efecto.clave),
      // Arreglos anidados (CLAUDE.md 5.4): la estructura secundaria de una
      // dirección se toca con las mismas tres operaciones que la tabla.
      'colocar-anidado': (efecto) => dominio.estructura.colocarEnAnidado(
        estado.estructura, efecto.casilla, efecto.posicion, efecto.clave
      ),
      'retirar-anidado': (efecto) => dominio.estructura.retirarDeAnidado(
        estado.estructura, efecto.casilla, efecto.posicion
      ),
      'compactar-anidado': (efecto) => dominio.estructura.compactarAnidado(estado.estructura, efecto.casilla),
      // Otras búsquedas dinámicas (CLAUDE.md 5.x): una cubeta es una casilla
      // principal más su arreglo anidado, así que colocar y retirar son los
      // mismos dos verbos de arriba. El orden de llegada lo lleva el dominio
      // desde que hizo falta también para guardar en archivo (CLAUDE.md 10);
      // este tema fue el primero en necesitarlo. `redimensionar` sigue siendo
      // lo que ningún otro tema necesita: vacía la tabla al nuevo tamaño, y
      // son los pasos de `insercion` que le siguen los que la vuelven a
      // llenar en el mismo orden en que las claves llegaron.
      'colocar-cubeta': (efecto) => (efecto.posicion === undefined
        ? dominio.estructura.colocarEn(estado.estructura, efecto.casilla, efecto.clave)
        : dominio.estructura.colocarEnAnidado(estado.estructura, efecto.casilla, efecto.posicion, efecto.clave)),
      'retirar-cubeta': (efecto) => (efecto.posicion === undefined
        ? dominio.estructura.retirarDe(estado.estructura, efecto.casilla)
        : dominio.estructura.retirarDeAnidado(estado.estructura, efecto.casilla, efecto.posicion)),
      redimensionar: (efecto) => {
        estado.estructura.n = efecto.n;
        estado.estructura.claves = new Array(efecto.n);
        estado.estructura.anidados = new Array(efecto.n);
        estado.estructura.ordenLlegada = [];
        return { exito: true };
      },
      // Árboles de búsqueda por bits (CLAUDE.md 5.5): las claves viven en las
      // posiciones del árbol implícito, así que se colocan, se retiran y se
      // mueven de una posición a otra —eso último al subir una hoja al sitio
      // de la clave eliminada—.
      'colocar-nodo': (efecto) => formaArbol.colocarNodo(estado.estructura, efecto.nodo, efecto.clave),
      'retirar-nodo': (efecto) => formaArbol.retirarNodo(estado.estructura, efecto.nodo),
      'mover-nodo': (efecto) => formaArbol.moverNodo(estado.estructura, efecto.desde, efecto.hasta)
    };

    // La estructura visible siempre corresponde al paso en pantalla: se parte
    // de cómo estaba antes de la operación y se aplican, en orden, los efectos
    // de los pasos ya recorridos.
    //
    // Reconstruir en vez de deshacer paso a paso: una operación puede mover
    // varias claves —la redispersión de un grupo retira y recoloca todo un
    // tramo— y las inversas encadenadas son justo donde se cuelan los errores.
    // Rehacer desde el estado base no puede desincronizarse.
    function sincronizarEfectos(indicePaso) {
      if (!estado.clavesBase || !estado.pasos) return;
      estado.estructura.claves = estado.clavesBase.claves.slice();
      // Cada anidado se copia aparte: sin eso, compactar uno mutaría el propio
      // estado base y el paso siguiente rehacería sobre algo ya movido.
      estado.estructura.anidados = estado.clavesBase.anidados.map(
        (anidado) => (anidado ? anidado.slice() : anidado)
      );
      // Solo lo usan las otras búsquedas dinámicas (CLAUDE.md 5.x), donde `n`
      // puede cambiar dentro de la misma operación: sin restaurarlo, retroceder
      // antes de una expansión a medio reproducir dejaría el `n` ya crecido.
      if (estado.clavesBase.n !== undefined) estado.estructura.n = estado.clavesBase.n;
      if (estado.clavesBase.ordenLlegada) {
        estado.estructura.ordenLlegada = estado.clavesBase.ordenLlegada.slice();
      }
      const hasta = Math.min(indicePaso, estado.pasos.length - 1);
      for (let i = 0; i <= hasta; i++) {
        const efecto = estado.pasos[i].efecto;
        if (efecto) APLICADORES[efecto.tipo](efecto);
      }
    }

    // Abandonar una operación a medio reproducir no puede dejar la estructura
    // en el limbo: al invalidar, la operación se consuma antes de olvidarla.
    function invalidarReproduccion() {
      if (estado.reproductor) estado.reproductor.detener();
      sincronizarEfectos(Infinity);
      estado.clavesBase = null;
      estado.reproductor = null;
      estado.pasoActual = null;
      estado.indicePaso = -1;
      estado.pasos = null;
      estado.segmentosApilado = null;
      if (dom.seccionReproduccion) dom.seccionReproduccion.hidden = true;
      sincronizarCalculo(null);
      aplicarVisibilidadCalculo();
      alinearCalculo();
    }

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

    function crearTramo(desde, hasta) {
      const el = document.createElement('div');
      el.className = 'tramo-elidido';
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
    function ajustarAnchoDeCasilla(l) {
      pantalla.style.setProperty('--ancho-casilla', `${vista.componentes.casilla.anchoParaCifras(l)}px`);
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
        // en todas las filas, así que ninguna cae dentro de un tramo.
        if (segmento.tipo === 'tramo') {
          const tramoEl = crearTramo(segmento.desde, segmento.hasta);
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
          const tramoEl = crearTramo(segmento.desde, segmento.hasta);
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

    function segmentosDe(relevantes) {
      return vista.elision.calcularSegmentos({
        n: estado.estructura.n,
        relevantes,
        orientacion: config.orientacion || 'horizontal',
        mostrarCompleta: estado.mostrarCompleta,
        // En una tabla dispersa grande se dibujan la 1, la n y las claves, y
        // nada más: es como el docente la dibuja en el tablero. Las vecinas
        // vacías se quedan para las estructuras ordenadas, donde acompañan a
        // una comparación y no a cada clave colocada.
        vecinas: config.modo !== dominio.estructura.MODOS.DISPERSA
      });
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

      const centrar = (eje) => {
        const vertical = eje === 'vertical';
        const sobrante = vertical
          ? caja.scrollHeight - caja.clientHeight
          : caja.scrollWidth - caja.clientWidth;
        if (sobrante <= 0) return;
        const centrado = vertical
          ? grupoRect.top - cajaRect.top + caja.scrollTop - (caja.clientHeight - grupoRect.height) / 2
          : grupoRect.left - cajaRect.left + caja.scrollLeft - (caja.clientWidth - grupoRect.width) / 2;
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
      return !(paso && paso.casilla === indice && paso.tipo !== 'ramificacion');
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
        // encogidos y el SVG dibuja en los suyos.
        const factor = parseFloat(lienzoArbol.style.zoom) || 1;
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
        encogerArbol();
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

    // **Cuando el árbol y el cálculo no caben juntos, el árbol se encoge** lo
    // justo (maqueta elegida por el usuario, 2026-09-28). Pasa en el portátil
    // con residuos múltiples, el dibujo más ancho. Antes cedía el cálculo, y
    // cedía cortándose: sus valores quedaban fuera del lienzo. El panel se
    // queda con el ancho que su contenido pide y el árbol, con el resto. Solo
    // encoge, nunca agranda, y no por debajo de `ENCOGIMIENTO_MINIMO`: más
    // chico los bits dejan de leerse, y entonces vuelve a desplazarse.
    //
    // El panel que se está yendo cuenta todavía: el árbol no crece encima de
    // él mientras se desvanece, y se vuelve a medir cuando ya no está.
    const ENCOGIMIENTO_MINIMO = 0.6;
    function encogerArbol() {
      const lienzoArbol = dom.lienzoArbol;
      if (!esArbol() || !lienzoArbol || !lienzoArbol.isConnected) return;
      lienzoArbol.style.zoom = '';
      const escenario = getComputedStyle(dom.escenario);
      const caja = getComputedStyle(dom.estructuraEl);
      const panel = dom.calculo && !dom.calculo.el.hidden ? dom.calculo.el : null;
      const disponible = dom.escenario.clientWidth
        - parseFloat(escenario.paddingLeft) - parseFloat(escenario.paddingRight)
        - parseFloat(caja.paddingLeft) - parseFloat(caja.paddingRight)
        - (panel ? panel.offsetWidth + parseFloat(escenario.columnGap || 0) : 0);
      const factor = Math.min(1, Math.max(ENCOGIMIENTO_MINIMO, disponible / lienzoArbol.offsetWidth));
      if (factor < 1) lienzoArbol.style.zoom = String(factor);
    }

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

    // Lo que miden `k` renglones seguidos: `k` casillas más los huecos entre
    // ellas. Lo usan el tramo elidido y su marca en la escala, que tienen que
    // medir lo mismo para que la numeración no se despegue de las casillas.
    function altoDeRenglones(k) {
      return `calc(${k} * (var(--alto-casilla) + var(--espacio-1)) - var(--espacio-1))`;
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
        if (segmento.tipo === 'tramo') marca.style.height = altoDeRenglones(segmento.cantidad);
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

    // El bloque comprimido conserva **el único registro que el algoritmo llega
    // a mirar** —el último— y dice cuántos esconde. El tramo crece hasta
    // empujar esa casilla al renglón `r`, que es donde el registro está de
    // verdad: alineada con el último registro de los bloques completos y no
    // flotando a media altura (pedido del usuario sobre maqueta, 2026-09-11).
    function crearBloqueComprimido(paso, bloque, forma) {
      const rango = dominio.externa.rangoDelBloque(forma, bloque);
      const registros = dominio.externa.registrosDelBloque(forma, bloque);

      const contenedor = document.createElement('div');
      contenedor.className = 'bloque__registros';

      // El tramo mide los renglones que oculta, así que el último registro
      // cae solo en el renglón que le toca: en un bloque completo, a la altura
      // del último de los demás; en el último bloque —más corto—, en el suyo.
      if (registros > 1) {
        const tramo = document.createElement('div');
        tramo.className = 'tramo-registros';
        tramo.style.height = altoDeRenglones(registros - 1);
        tramo.textContent = `⋯ ${registros - 1} ⋯`;
        contenedor.appendChild(tramo);
      }
      contenedor.appendChild(crearCasillaDeRegistro(paso, rango.ultimo, bloque));
      return contenedor;
    }

    function crearBloqueCompleto(paso, bloque, forma, segmentosDelRenglon) {
      const rango = dominio.externa.rangoDelBloque(forma, bloque);
      const registros = dominio.externa.registrosDelBloque(forma, bloque);

      const contenedor = document.createElement('div');
      contenedor.className = 'bloque__registros';

      for (const segmento of segmentosDelRenglon) {
        if (segmento.tipo === 'tramo') {
          const tramo = document.createElement('div');
          tramo.className = 'tramo-registros';
          tramo.style.height = altoDeRenglones(segmento.cantidad);
          tramo.textContent = `⋯ ${segmento.cantidad} ⋯`;
          contenedor.appendChild(tramo);
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
      const renglonesRelevantes = paso ? config.casillasRelevantes(paso).map(renglonDe) : [];
      const segmentosDelRenglon = vista.elision.calcularSegmentos({
        n: forma.registrosPorBloque,
        relevantes: renglonesRelevantes,
        orientacion: 'vertical',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });
      // Cuando los renglones no caben, los bloques que no se están mirando se
      // comprimen a su último registro: es lo que hace que una búsqueda que se
      // va lejos siga cabiendo en el lienzo.
      const comprimirBloques = segmentosDelRenglon.some((segmento) => segmento.tipo === 'tramo');

      // Bloques que nunca se esconden dentro de un tramo: el primero y el
      // último —la regla de siempre—, el del paso, y los últimos comparados.
      // En secuencial externa los comparados son los descartados, en orden;
      // binaria externa descarta por los dos lados y dice cuáles leyó.
      const comparados = (paso && (paso.bloquesLeidos || paso.bloquesDescartados)) || [];
      const relevantes = comparados.slice(-BLOQUES_RECIENTES);
      if (paso && paso.bloque) relevantes.push(paso.bloque);
      // Y los extremos del rango de binaria externa: sin ellos, un tramo
      // «⋯ 7 bloques ⋯» se tragaba el bloque donde empieza el rango, que es
      // lo que el paso está diciendo.
      if (paso && paso.rangoBloques) relevantes.push(paso.rangoBloques.inicio, paso.rangoBloques.fin);
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
          grupo.appendChild(
            comprimirBloques && !(paso && paso.bloque === bloque)
              ? crearBloqueComprimido(paso, bloque, forma)
              : crearBloqueCompleto(paso, bloque, forma, segmentosDelRenglon)
          );
          dom.estructuraEl.appendChild(grupo);
          if (paso && paso.bloque === bloque) grupoSeguido = grupo;
        }

        llevarALaVista(grupoSeguido);
      }, opciones);
    }

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
        const par = document.createElement('div');
        par.className = 'columna-indice__rango';
        const desde = document.createElement('span');
        desde.textContent = mil(rango.primero);
        const hasta = document.createElement('span');
        hasta.textContent = mil(rango.ultimo);
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

    function trazarFlechas(svg, pista, dibujadas, definidas) {
      svg.innerHTML = '';
      const base = pista.getBoundingClientRect();
      const caja = (el) => {
        const r = el.getBoundingClientRect();
        return {
          izq: r.left - base.left,
          der: r.right - base.left,
          centro: r.top - base.top + r.height / 2,
          primera: r.top - base.top + MARGEN_DE_ENTRADA,
          ultima: r.bottom - base.top - MARGEN_DE_ENTRADA
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
        if (ultimoOrigen && ultimoDestino && origen.columna.bloques > 1) {
          uniones.push({ desde: ultimoOrigen, entrada: 'ultima', hasta: ultimoDestino });
        }

        uniones.forEach((union, k) => {
          const salida = caja(union.desde);
          const llegada = caja(union.hasta);
          const x1 = salida.der;
          const y1 = salida[union.entrada];
          entrada(x1, y1);
          codo(x1, y1, x1 + CARRIL_INICIAL + k * ENTRE_CARRILES, llegada.izq, llegada.centro);
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
        trazarFlechas(svg, pista, dibujadas, definidas);
        llevarALaVista(seguida);
      }, opciones);
    }

    // Árbol de Huffman (CLAUDE.md 5.x): quinta orientación de la pantalla. No
    // es un árbol —todavía—, sino **un bosque que se va uniendo**: la lista de
    // nodos tal como está en cada paso, las letras sueltas y los arbolitos ya
    // formados, cada uno con su peso debajo y en el orden en que se van a
    // reducir. La última unión deja un solo árbol, que es el árbol final: no
    // hay que redibujar nada al terminar, y eso es justo lo que el tema enseña
    // (decisión del usuario sobre maqueta, 2026-09-11).
    //
    // A diferencia de los otros árboles, aquí los nodos **no** salen de
    // `estructura.claves`: el bosque de cada paso viaja en el propio paso
    // (`paso.bosque`), porque se deduce entero de la construcción. Retroceder
    // es volver a dibujar, sin efectos que deshacer.

    const DIAMETRO_PESO = 36;

    function esBosque() {
      return config.orientacion === 'bosque';
    }

    const esHojaDeHuffman = (nodo) => nodo.letra !== undefined;

    // Reparto de un árbol de Huffman: cada hoja ocupa una columna y cada nodo
    // interno se centra entre sus dos hijos. No vale el reparto de los otros
    // árboles, que deriva la columna de la posición en el arreglo implícito:
    // aquí la forma la decidió la frecuencia y no hay arreglo del que leerla.
    function disponerHuffman(raiz, anchoNodo) {
      const puestos = [];
      let x = 0;
      let profundidad = 0;

      (function bajar(nodo, nivel) {
        profundidad = Math.max(profundidad, nivel);
        if (esHojaDeHuffman(nodo)) {
          const centro = x + anchoNodo / 2;
          x += anchoNodo;
          puestos.push({ nodo, centro, nivel });
          return centro;
        }
        const izquierda = bajar(nodo.izquierda, nivel + 1);
        const derecha = bajar(nodo.derecha, nivel + 1);
        const centro = (izquierda + derecha) / 2;
        puestos.push({ nodo, centro, nivel });
        return centro;
      })(raiz, 0);

      return {
        puestos,
        ancho: Math.max(x, anchoNodo),
        alto: profundidad * SEPARACION_NIVEL + DIAMETRO_NODO
      };
    }

    // El peso de un nodo interno va **dentro** del nodo, y por eso aquí no
    // vale el punto de bifurcación de residuos (CLAUDE.md 6.7): allí el nodo
    // interno no puede guardar nada y dibujarlo como caja sería mentir; aquí
    // el nodo interno *es* una suma, y el peso es lo que el método va
    // calculando. Un círculo con la fracción dentro dice las dos cosas: que no
    // es una clave, y cuánto pesa.
    function crearNodoDePeso(nodo, total, marcado) {
      const el = document.createElement('div');
      el.className = 'nodo-peso' + (marcado ? ' nodo-peso--en-curso' : '');
      el.textContent = `${nodo.peso}/${total}`;
      return el;
    }

    function crearHojaDeHuffman(nodo, marcado) {
      return vista.componentes.casilla.crearCasilla({
        clave: nodo.letra,
        indice: nodo.letra,
        estado: marcado ? 'en-evaluacion' : 'ocupada',
        modificadores: []
      });
    }

    // Como `crearAristas` en los otros árboles: las crea sin colocarlas y
    // devuelve `trazar`, que las coloca a partir de dónde está cada nodo, para
    // que puedan seguirlos mientras viajan (ver `seguirAristas`).
    function crearAristasHuffman(puestos, ancho, alto) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'arbol__aristas');
      svg.setAttribute('width', ancho);
      svg.setAttribute('height', alto);
      svg.setAttribute('aria-hidden', 'true');

      const aristas = [];
      for (const { nodo } of puestos) {
        if (esHojaDeHuffman(nodo)) continue;
        for (const [hijo, bit] of [[nodo.izquierda, '0'], [nodo.derecha, '1']]) {
          const linea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          linea.setAttribute('class', 'arbol__arista');
          svg.appendChild(linea);

          const rotulo = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          rotulo.setAttribute('class', 'arbol__bit');
          rotulo.textContent = bit;
          svg.appendChild(rotulo);
          aristas.push({ padre: nodo, hijo, linea, rotulo });
        }
      }

      function trazar(centroDe) {
        for (const { padre, hijo, linea, rotulo } of aristas) {
          const desde = centroDe(padre);
          const hasta = centroDe(hijo);
          linea.setAttribute('x1', desde.x);
          linea.setAttribute('y1', desde.pie);
          linea.setAttribute('x2', hasta.x);
          linea.setAttribute('y2', hasta.arriba);
          rotulo.setAttribute('x', desde.x + (hasta.x - desde.x) * 0.45 + (hasta.x < desde.x ? -8 : 8));
          rotulo.setAttribute('y', desde.pie + (hasta.arriba - desde.pie) * 0.45);
        }
      }
      return { svg, aristas, trazar };
    }

    // La identidad de un nodo para el FLIP: la letra en una hoja, y en un nodo
    // interno las letras que cuelgan de él —cada letra está en un solo
    // subárbol, así que no se repite—. Sin ella solo viajaban las letras: los
    // círculos de peso y las aristas saltaban a su sitio mientras las letras
    // iban de camino, y la unión se veía como un salto (visto por el usuario,
    // 2026-09-30).
    const letrasDe = (nodo) => (esHojaDeHuffman(nodo)
      ? nodo.letra
      : letrasDe(nodo.izquierda) + letrasDe(nodo.derecha));

    // Un árbol del bosque, con su peso debajo: el peso del nodo raíz es lo que
    // ordena la lista, así que se lee al pie de cada uno sin tener que buscarlo
    // dentro del dibujo.
    function crearArbolDelBosque(raiz, total, marcados) {
      // Mismo ancho de nodo que en los demás árboles: el nodo es redondo y
      // mide de ancho lo que de alto.
      const anchoNodo = DIAMETRO_NODO + SEPARACION_HERMANOS;
      const { puestos, ancho, alto } = disponerHuffman(raiz, anchoNodo);

      const caja = document.createElement('div');
      caja.className = 'bosque__arbol' + (marcados.includes(raiz) ? ' bosque__arbol--en-curso' : '');

      const lienzoArbol = document.createElement('div');
      lienzoArbol.className = 'arbol';
      lienzoArbol.style.width = `${ancho}px`;
      lienzoArbol.style.height = `${alto}px`;
      const aristas = crearAristasHuffman(puestos, ancho, alto);
      const sitioDe = new Map(puestos.map((p) => [p.nodo, p]));
      const centroFinal = (nodo) => {
        const { centro, nivel } = sitioDe.get(nodo);
        const arriba = nivel * SEPARACION_NIVEL;
        return { x: centro, arriba, pie: arriba + (esHojaDeHuffman(nodo) ? DIAMETRO_NODO : DIAMETRO_PESO) };
      };
      aristas.trazar(centroFinal);
      lienzoArbol.appendChild(aristas.svg);

      const nodos = new Map();
      for (const { nodo, centro, nivel } of puestos) {
        const marcado = marcados.includes(nodo);
        const el = esHojaDeHuffman(nodo)
          ? crearHojaDeHuffman(nodo, marcado)
          : crearNodoDePeso(nodo, total, marcado);
        el.dataset.clave = esHojaDeHuffman(nodo) ? nodo.letra : `peso-${letrasDe(nodo)}`;
        const anchoEl = esHojaDeHuffman(nodo) ? DIAMETRO_NODO : DIAMETRO_PESO;
        el.style.position = 'absolute';
        el.style.left = `${centro - anchoEl / 2}px`;
        el.style.top = `${nivel * SEPARACION_NIVEL}px`;
        lienzoArbol.appendChild(el);
        nodos.set(nodo, el);
      }

      // El peso solo se escribe al pie cuando el árbol es **una letra suelta**:
      // en cuanto tiene raíz, la raíz ya lo lleva dentro de su círculo y
      // repetirlo debajo era decir dos veces lo mismo —en el árbol final se
      // leía `8/8` arriba y `8/8` abajo— (revisión de diseño, 2026-09-11).
      caja.appendChild(lienzoArbol);
      if (esHojaDeHuffman(raiz)) {
        const peso = document.createElement('span');
        peso.className = 'bosque__peso';
        peso.textContent = `${raiz.peso}/${total}`;
        caja.appendChild(peso);
      }
      return { caja, lienzo: lienzoArbol, aristas, nodos, centroFinal };
    }

    // La tabla de codificación, que aparece solo al terminar (pedido del
    // usuario, 2026-09-11): antes ninguna letra tendría código que poner en
    // ella. Ocupa el sitio del panel de reducciones, así que el lienzo no
    // cambia de forma al acabar la construcción.
    function crearTablaDeCodigos(tabla) {
      const el = document.createElement('table');
      el.className = 'tabla-codigos';
      const filas = tabla.filas.map((fila) => `
        <tr>
          <td class="tabla-codigos__clave">${fila.letra}</td>
          <td>${fila.codigo}</td>
          <td>${fila.longitud}</td>
          <td>${fila.veces}/${tabla.total}</td>
          <td>${fila.producto}/${tabla.total}</td>
        </tr>`).join('');
      const media = (tabla.suma / tabla.total).toString().replace('.', ',');
      el.innerHTML = `
        <thead>
          <tr>
            <th class="tabla-codigos__clave">k</th><th>Código</th><th>Li</th><th>Pi</th><th>Pi × Li</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td class="tabla-codigos__clave" colspan="4">Σ Pi × Li</td>
            <td>${tabla.suma}/${tabla.total} = ${media}</td>
          </tr>
        </tfoot>`;
      return el;
    }

    function renderizarBosque(paso, opciones) {
      const bosque = (paso && paso.bosque) || [];
      const total = (paso && paso.total) || 0;
      const marcados = (paso && paso.uniendo) || [];
      // Lo que ya estaba dibujado antes de este paso: lo que no, aparece.
      const previos = new Set([...dom.estructuraEl.querySelectorAll('[data-clave]')]
        .map((el) => el.dataset.clave));

      const arboles = [];
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = 'estructura-bosque';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';

        if (bosque.length === 0) {
          const vacio = document.createElement('p');
          vacio.className = 'texto-nivel-5';
          vacio.textContent = 'Escriba una palabra para construir su árbol.';
          dom.estructuraEl.appendChild(vacio);
          return;
        }
        for (const raiz of bosque) {
          const arbol = crearArbolDelBosque(raiz, total, marcados);
          dom.estructuraEl.appendChild(arbol.caja);
          arboles.push(arbol);
        }
      }, opciones);

      // La tabla sustituye al panel del desarrollo en el último paso, y no se
      // suma a él: los dos dicen lo mismo desde dos sitios, y el lienzo no da
      // para ambos.
      if (dom.tabla) dom.tabla.remove();
      dom.tabla = null;
      if (paso && paso.tabla) {
        dom.tabla = crearTablaDeCodigos(paso.tabla);
        dom.escenario.appendChild(dom.tabla);
        if (dom.calculo) dom.calculo.el.hidden = true;
      } else if (dom.calculo) {
        dom.calculo.el.hidden = false;
      }

      // Como en los otros árboles: **lo nuevo aparece, no salta**. En cada
      // unión lo nuevo es el círculo de la suma y sus dos aristas, que se
      // desvanecen hacia dentro mientras los dos hijos bajan a su sitio; y
      // las aristas siguen a los nodos mientras viajan.
      if (vista.animacion.prefiereMovimientoReducido()) return;
      const aparecer = (el) => el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: DURACION_APARICION_MS, delay: DURACION_APARICION_MS / 2, fill: 'backwards'
      });
      for (const { lienzo, aristas, nodos, centroFinal } of arboles) {
        if (previos.size > 0) {
          for (const [nodo, el] of nodos) {
            if (previos.has(el.dataset.clave)) continue;
            aparecer(el);
            for (const arista of aristas.aristas) {
              if (arista.padre !== nodo) continue;
              aparecer(arista.linea);
              aparecer(arista.rotulo);
            }
          }
        }
        seguirAristas(lienzo, aristas.trazar, nodos, centroFinal, () => true);
      }
    }

    // El apilado es el dispositivo de la búsqueda: una fila por descarte. Los
    // pasos que sacan una clave no descartan nada y además cambian la
    // estructura bajo las filas ya dibujadas —que se leen del mismo arreglo—,
    // así que el tema puede declarar que no le aplican y esos pasos se dibujan
    // sobre la estructura completa, que es donde se ve el desplazamiento.
    // `opciones.duracionMs` alarga el reordenamiento: lo usa el llenado
    // automático, que va más despacio que una inserción suelta.
    function renderizarEstructura(paso, indicePaso, opciones) {
      // Sin estructura no hay nada que dibujar, pero un rectángulo gris y mudo
      // no le dice al estudiante que le toca crearla (defecto visto al revisar
      // el diseño, 2026-09-11). Es lo primero que se ve al entrar a cualquier
      // tema con configuración.
      if (!estado.estructura) {
        renderizarLienzoVacio();
        return;
      }
      dibujar(paso, indicePaso, opciones);
      actualizarControlElision();
      marcarDesbordeAlAsentarse(dom.estructuraEl);
      alinearCalculo();
    }

    // El panel del cálculo con lo que el paso revela. Donde el tema lo declara
    // (`calculoSoloEnOperacion`: transformación de claves y los árboles de
    // bits), sin operación el panel no se dibuja: «Sin operación en curso»
    // ocupaba el ancho que la matriz de anidados y el árbol necesitan, y no
    // enseñaba nada (maquetas elegidas por el usuario, 2026-09-28).
    function sincronizarCalculo(paso) {
      if (!dom.calculo) return;
      dom.calculo.actualizar(paso ? paso.calculo : null, paso ? paso.saltos : null, paso ? paso.tituloCalculo : null);
      if (config.calculoSoloEnOperacion) {
        dom.calculoVisible = Boolean(paso && paso.calculo && paso.calculo.length);
      }
      marcarDesborde(dom.calculo.el);
    }

    // El panel que aparece o se va recentra la estructura en el lienzo. **La
    // estructura se desliza entera, como un bloque** (pedido del usuario,
    // 2026-09-28): antes el corrimiento lo animaba el FLIP de las casillas, y
    // la numeración, los tramos elididos y el borde de la tabla —que no son
    // casillas— saltaban de golpe mientras las casillas viajaban, y la tabla
    // se veía descuadrada durante el viaje.
    //
    // Por eso se hace antes de dibujar el paso y no dentro de su FLIP: la
    // estructura ya lleva el desplazamiento puesto cuando el FLIP mide, y las
    // casillas solo animan lo que les pasa a ellas.
    //
    // El panel aparece desvaneciéndose en su sitio, ya alineado —sin viajar en
    // vertical desde el centro—, y al irse sale del flujo donde está y se
    // desvanece. **Panel y estructura nunca se ven encima uno del otro**
    // (pedido del usuario, 2026-09-28: al irse, «se intersectan»): la tabla
    // queda a solo un canal del panel, así que cualquier corrimiento la mete
    // en su sitio. Al entrar, la estructura se corre primero y el panel se
    // funde cuando le falta menos que el canal; al irse, en espejo, el panel
    // se funde primero y la estructura arranca cuando ya no se ve.
    const DURACION_RECENTRADO_MS = 400;
    const DURACION_FUNDIDO_MS = 150;
    function aplicarVisibilidadCalculo() {
      if (!config.calculoSoloEnOperacion || !dom.calculo) return;
      const panel = dom.calculo.el;
      const saliendo = Boolean(dom.salidaCalculo);
      const visibleAhora = !panel.hidden && !saliendo;
      if (visibleAhora === dom.calculoVisible) return;

      const animar = !vista.animacion.prefiereMovimientoReducido();
      const antes = dom.estructuraEl.getBoundingClientRect().left;

      if (dom.calculoVisible) {
        if (saliendo) terminarSalidaCalculo();
        panel.hidden = false;
        dom.calculoRecienAparecido = true;
        // Al final del recentrado: con `ease-in-out`, a los 350 ms de 400 a la
        // estructura le quedan unos 6 px, menos que el canal que la separa.
        if (animar) {
          for (const el of [panel, dom.picoCalculo].filter(Boolean)) {
            vista.animacion.reemplazarAnimacion(el, [{ opacity: 0 }, { opacity: 1 }], {
              duration: DURACION_FUNDIDO_MS,
              delay: DURACION_RECENTRADO_MS - 50,
              fill: 'backwards'
            });
          }
        }
      } else if (animar) {
        // Fuera del flujo en el sitio exacto en que está, con su alineado.
        const { offsetLeft, offsetTop } = panel;
        panel.style.position = 'absolute';
        panel.style.left = `${offsetLeft}px`;
        panel.style.top = `${offsetTop}px`;
        if (dom.picoCalculo && !dom.picoCalculo.hidden) {
          vista.animacion.reemplazarAnimacion(dom.picoCalculo, [{ opacity: 1 }, { opacity: 0 }], {
            duration: DURACION_FUNDIDO_MS, fill: 'forwards'
          });
        }
        dom.salidaCalculo = vista.animacion.reemplazarAnimacion(panel, [{ opacity: 1 }, { opacity: 0 }], {
          duration: DURACION_FUNDIDO_MS, fill: 'forwards'
        });
        dom.salidaCalculo.addEventListener('finish', terminarSalidaCalculo);
      } else {
        panel.hidden = true;
      }

      // Al irse el panel, la estructura espera a que se haya fundido; hasta
      // entonces se queda donde estaba (`fill: 'backwards'`).
      const corrimiento = antes - dom.estructuraEl.getBoundingClientRect().left;
      if (animar && Math.abs(corrimiento) > 0.5) {
        vista.animacion.reemplazarAnimacion(dom.estructuraEl, [
          { transform: `translateX(${corrimiento}px)` },
          { transform: 'none' }
        ], {
          duration: DURACION_RECENTRADO_MS,
          delay: dom.calculoVisible ? 0 : DURACION_FUNDIDO_MS,
          easing: 'ease-in-out',
          fill: 'backwards'
        });
      }
    }

    function terminarSalidaCalculo() {
      const panel = dom.calculo.el;
      if (dom.salidaCalculo) dom.salidaCalculo.cancel();
      dom.salidaCalculo = null;
      // El fundido del pico se quedó en cero (`fill: 'forwards'`): se suelta
      // para que la próxima vez aparezca.
      if (dom.picoCalculo) {
        for (const animacion of dom.picoCalculo.getAnimations()) animacion.cancel();
        dom.picoCalculo.hidden = true;
      }
      panel.style.position = '';
      panel.style.left = '';
      panel.style.top = '';
      panel.hidden = !dom.calculoVisible;
      if (panel.hidden) panel.style.transform = '';
      encogerArbol();
    }

    // La línea activa del cálculo, a la altura de la casilla que el paso sigue
    // (maqueta elegida por el usuario, 2026-09-28, CLAUDE.md 6.5): lo que se
    // enseña es qué cuenta lleva a qué casilla, y centrado en el lienzo el
    // «Dirección … 57» caía a 40 px de la 57. Un pico en el borde del panel
    // señala la fila.
    //
    // Se mide contra el escenario y sin el desplazamiento puesto: la fila por
    // su caja —no se transforma—, el panel por `offsetTop` —que no ve el
    // `transform`, ni el que está a medio transicionar— y la línea por su
    // distancia al borde del panel, que el `transform` mueve con él.
    //
    // Si la fila queda donde el panel no llega sin salirse del lienzo —la
    // línea activa al pie de un panel alto y la fila arriba, en una ventana
    // baja—, el panel se queda en el borde y el pico se esconde: señalaría la
    // fila desde un renglón que no es el que la produjo.
    function alinearCalculo() {
      if (!config.calculoSenalaCasilla || !dom.calculo) return;
      const panel = dom.calculo.el;
      const activa = panel.querySelector('.calculo__linea--activa');
      const fila = dom.filaSeguida;
      // Mientras se desvanece al irse, el panel y su pico se quedan donde
      // estaban.
      if (dom.salidaCalculo) return;
      if (panel.hidden || !activa || !fila || !fila.isConnected) {
        panel.style.transform = '';
        dom.picoCalculo.hidden = true;
        return;
      }

      const escenario = dom.escenario;
      const escenarioRect = escenario.getBoundingClientRect();
      const filaRect = fila.getBoundingClientRect();
      const caja = dom.estructuraEl.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const activaRect = activa.getBoundingClientRect();

      const origen = escenarioRect.top + escenario.clientTop;
      const centroFila = filaRect.top + filaRect.height / 2 - origen;
      const centroLinea = panel.offsetTop + (activaRect.top - panelRect.top) + activaRect.height / 2;

      const minimo = -panel.offsetTop;
      const maximo = escenario.clientHeight - panel.offsetTop - panel.offsetHeight;
      const deseado = centroFila - centroLinea;
      const desplazamiento = minimo <= maximo ? Math.max(minimo, Math.min(maximo, deseado)) : 0;
      // Recién aparecido, el panel toma su altura sin transición —y el pico
      // con él—: se desvanece ya en su sitio, en vez de bajar desde el centro.
      const sinTransicion = dom.calculoRecienAparecido;
      dom.calculoRecienAparecido = false;
      if (sinTransicion) {
        panel.style.transition = 'none';
        dom.picoCalculo.style.transition = 'none';
      }
      panel.style.transform = desplazamiento ? `translateY(${desplazamiento}px)` : '';

      const MEDIO_PICO = 8;
      const filaVisible = filaRect.bottom > caja.top && filaRect.top < caja.bottom;
      dom.picoCalculo.hidden = !filaVisible || Math.abs(desplazamiento - deseado) > 1;
      dom.picoCalculo.style.top = `${centroFila - MEDIO_PICO}px`;
      // Por la derecha: el pico escondido no mide nada, y su ancho no hace falta.
      dom.picoCalculo.style.right = `${escenario.clientWidth - panel.offsetLeft}px`;
      if (sinTransicion) {
        // Se fuerza el estilo antes de devolver la transición.
        void panel.offsetHeight;
        panel.style.transition = '';
        dom.picoCalculo.style.transition = '';
      }
    }

    // El borde desvanecido (CLAUDE.md 6.2): el lienzo no muestra barras, así
    // que el lado por donde sigue la estructura se desvanece. Se mide el
    // desplazamiento y no las cajas: con `scrollLeft` y `scrollWidth` da igual
    // qué vista sea —fila, tabla, árbol, bloques, columnas de índices—.
    function marcarDesborde(el) {
      if (!el) return;
      const lados = {
        'desborda-izq': el.scrollLeft > 1,
        'desborda-der': el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
        'desborda-arr': el.scrollTop > 1,
        'desborda-aba': el.scrollTop < el.scrollHeight - el.clientHeight - 1
      };
      let alguno = false;
      for (const [clase, desborda] of Object.entries(lados)) {
        el.classList.toggle(clase, desborda);
        alguno = alguno || desborda;
      }
      el.classList.toggle('desborda', alguno);
    }

    // **Con la estructura asentada, no a media animación.** Las casillas del
    // FLIP viajan con `transform` y mientras tanto ensanchan el desborde: medir
    // entonces encendía el desvanecido a destellos, que es el mismo defecto por
    // el que se quitó la barra. Cada dibujo reescribe la clase de la estructura
    // y con ella borra el desvanecido; aquí se vuelve a poner cuando termina lo
    // que se esté moviendo, o en el acto si no se mueve nada.
    function marcarDesbordeAlAsentarse(el) {
      const enCurso = el.getAnimations ? el.getAnimations({ subtree: true }) : [];
      if (enCurso.length === 0) {
        marcarDesborde(el);
        return;
      }
      Promise.all(enCurso.map((animacion) => animacion.finished.catch(() => null)))
        .then(() => marcarDesborde(el));
    }

    // Desplazar a mano o cambiar el tamaño de la ventana también mueve los
    // bordes: el que llega al final deja de desvanecerse. También se espera a
    // que la estructura se asiente: `llevarALaVista` desplaza en medio de la
    // animación, y su evento llega con las casillas todavía viajando.
    function vigilarDesborde(el) {
      el.addEventListener('scroll', () => marcarDesbordeAlAsentarse(el), { passive: true });
      if (window.ResizeObserver) new ResizeObserver(() => marcarDesbordeAlAsentarse(el)).observe(el);
    }

    function renderizarLienzoVacio() {
      dom.estructuraEl.className = 'estructura-vacia';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      const aviso = document.createElement('p');
      aviso.className = 'texto-nivel-5';
      aviso.textContent = config.mensajeLienzoVacio
        || 'Cree una estructura para empezar: elija su tamaño en el panel de la derecha.';
      dom.estructuraEl.appendChild(aviso);
      if (dom.controlElision) dom.controlElision.hidden = true;
    }

    function dibujar(paso, indicePaso, opciones) {
      if (esArbol()) {
        renderizarArbol(paso, opciones);
        return;
      }
      if (esBloques()) {
        renderizarBloques(paso, opciones);
        return;
      }
      if (esBosque()) {
        renderizarBosque(paso, opciones);
        return;
      }
      if (esIndices()) {
        renderizarIndices(paso, opciones);
        return;
      }
      // El paso final no apila (`aplicaA`): el apilado se va y queda la
      // estructura como queda, con la clave hallada en verde, como si todo se
      // hubiera reiniciado (pedido del usuario, 2026-09-27). Lo apagado fila
      // por fila se ve un paso antes, en el último del algoritmo.
      const aplicaApilado = !config.apilada || !config.apilada.aplicaA || !paso
        || config.apilada.aplicaA(paso);
      if (config.apilada && estado.pasos && indicePaso >= 0 && aplicaApilado) {
        renderizarApilado(indicePaso);
        return;
      }
      renderizarFilaUnica(paso, opciones);
    }

    // Las columnas del apilado se fijan una vez por búsqueda, con las casillas
    // relevantes de la traza entera: si se recalcularan paso a paso, las
    // columnas se moverían bajo las filas ya dibujadas.
    function calcularSegmentosApilado() {
      if (!config.apilada || !estado.pasos) return;
      const relevantes = [];
      for (const paso of estado.pasos) {
        relevantes.push(...config.casillasRelevantes(paso));
      }
      estado.segmentosApilado = segmentosDe(relevantes);
    }

    function actualizarMetricas(paso) {
      for (const metrica of config.metricas) {
        dom.metricas[metrica.id].textContent = metrica.valor({ estructura: estado.estructura, paso });
      }
    }

    // Lo que el deslizador pide, ya en tiempo entre pasos.
    function msPorPaso() {
      return espejarVelocidad(dom.controlVelocidad.value);
    }

    // El paso que cierra toda operación (pedido del usuario, 2026-09-24): la
    // estructura como queda para la siguiente, sin casilla marcada, sin
    // sondeo ni rango, y con el panel del cálculo vacío. Hereda del último
    // paso solo lo que no resalta nada: los contadores, que son el resultado
    // de la operación, y lo que el tema declare en `conservarAlFinal` porque
    // su dibujo sale del paso y no de la estructura —el bosque de Huffman, la
    // derivación de índices—.
    //
    // Guarda además qué casillas dibujaba el último paso (`vistas`), para que
    // la elisión deje a la vista las mismas: la estructura no salta, solo se
    // apagan los resaltados. Sin eso, una ordenada volvía a sus extremos
    // —«10 ⋯ 22 ⋯ 24»— y la clave recién hallada desaparecía en un tramo.
    //
    // **Una búsqueda que halló la clave la deja marcada** (pedido del usuario,
    // 2026-09-24): ahí lo que se buscaba es dónde está, y apagarla era hacerla
    // desaparecer justo al terminar. El paso final se vuelve entonces un
    // `encontrada` que solo sabe dónde está la clave —`casilla`, `posicion` en
    // anidados y cubetas, `medio` en binaria—, sin rango, descartes ni
    // recorrido; `final: true` lo distingue del paso del algoritmo.
    const CONSERVAR_SIEMPRE = ['comparaciones', 'accesos'];
    const UBICACION_DE_LA_CLAVE = ['casilla', 'posicion', 'medio'];
    function pasoFinal(ultimo) {
      const { TIPOS_PASO } = window.CC2.algoritmos.traza;
      const hallada = ultimo.tipo === TIPOS_PASO.ENCONTRADA;
      const final = {
        tipo: hallada ? TIPOS_PASO.ENCONTRADA : TIPOS_PASO.FINAL,
        final: true,
        vistas: config.casillasRelevantes ? config.casillasRelevantes(ultimo) : []
      };
      const campos = CONSERVAR_SIEMPRE.concat(config.conservarAlFinal || [], hallada ? UBICACION_DE_LA_CLAVE : []);
      for (const campo of campos) {
        if (ultimo[campo] !== undefined) final[campo] = ultimo[campo];
      }
      return final;
    }

    // Reproduce cualquier operación con traza —buscar o insertar—, que es lo
    // único que las diferencia desde aquí: el reproductor solo recorre pasos.
    function reproducirOperacion(pasosDelAlgoritmo, mensajeInicial) {
      const ultimo = pasosDelAlgoritmo[pasosDelAlgoritmo.length - 1];
      const pasos = ultimo ? pasosDelAlgoritmo.concat(pasoFinal(ultimo)) : pasosDelAlgoritmo;
      estado.pasos = pasos;
      estado.clavesBase = {
        claves: estado.estructura.claves.slice(),
        anidados: (estado.estructura.anidados || []).map((anidado) => (anidado ? anidado.slice() : anidado)),
        n: estado.estructura.n,
        ordenLlegada: (estado.estructura.ordenLlegada || []).slice()
      };
      calcularSegmentosApilado();
      dom.seccionReproduccion.hidden = false;
      registrarBitacora(mensajeInicial);

      estado.reproductor = vista.reproductor.crearReproductor({
        pasos,
        velocidadMs: msPorPaso(),
        alCambiarReproduccion: (reproduciendo) => {
          dom.alternarReproduccion.textContent = reproduciendo ? 'Pausar' : 'Reproducir';
        },
        alCambiarPaso: (paso, indice) => {
          estado.pasoActual = paso;
          estado.indicePaso = indice;
          sincronizarEfectos(indice);
          // Antes de dibujar: la estructura alinea el cálculo al terminar, y
          // tiene que encontrar ya la línea que este paso revela.
          sincronizarCalculo(paso);
          aplicarVisibilidadCalculo();
          renderizarEstructura(paso, indice);
          actualizarMetricas(paso);
          sincronizarAviso(indice);
          // El paso final no dice nada: el aviso sigue con la noticia de la
          // operación, y repetirla en la bitácora solo sería ruido.
          if (paso && paso.mensaje && !paso.final) registrarBitacora(paso.mensaje);
        }
      });
      // Toda operación arranca reproduciéndose sola (pedido del usuario,
      // 2026-08-30): tener que pedir cada paso a mano estorba en el salón,
      // donde lo normal es querer ver la operación entera. Los controles
      // siguen ahí y cualquiera de ellos —avanzar, retroceder, detener—
      // corta la reproducción, porque todos pasan por `irAPaso`.
      estado.reproductor.reproducirContinuo();
    }

    // La clave que se digita no siempre es un número: los temas de búsqueda
    // por bits trabajan con letras (CLAUDE.md 5.5). Una sola puerta de entrada
    // para las tres operaciones, que validan igual.
    function validarClaveDigitada(texto) {
      if (config.claveEsLetra) return dominio.clave.validarLetra(texto);
      // Otras búsquedas dinámicas (CLAUDE.md 5.7) no pide l: sus claves no
      // tienen una longitud fija que exigir.
      return config.sinLongitud
        ? dominio.clave.validarClaveNumericaLibre(texto)
        : dominio.clave.validarClaveNumerica(texto, estado.estructura.l);
    }

    function insertarClave(texto) {
      const validacion = validarClaveDigitada(texto);
      if (!validacion.valido) {
        mostrarAlerta('error', validacion.mensaje);
        return;
      }

      // La unicidad y la saturación se comprueban antes de trazar: son estados
      // de la estructura, no pasos del algoritmo, y merecen alerta inmediata
      // en vez de una reproducción que no lleva a ninguna parte (CLAUDE.md 3.2).
      if (dominio.estructura.estaLlena(estado.estructura)) {
        mostrarAlerta('error', `Estructura saturada: capacidad máxima de ${estado.estructura.n} casillas alcanzada.`);
        return;
      }
      const casillaExistente = dominio.estructura.casillaDe(estado.estructura, validacion.valor);
      if (casillaExistente !== 0) {
        mostrarAlerta('error', `Clave duplicada: la clave ya reside en la posición ${casillaExistente}.`);
        return;
      }

      limpiarAlerta();
      invalidarReproduccion();

      // Temas sin inserción trazada: la clave entra de una vez, como siempre.
      if (!config.insertar) {
        const resultado = dominio.estructura.insertar(estado.estructura, validacion.valor);
        if (!resultado.exito) {
          mostrarAlerta('error', resultado.mensaje);
          return;
        }
        registrarBitacora(`Clave insertada: ${validacion.valor} en la casilla ${resultado.indice}.`);
        renderizarEstructura(null);
        actualizarMetricas(null);
        return;
      }

      reproducirOperacion(
        config.insertar({ estructura: estado.estructura, clave: validacion.valor }),
        `Inserción iniciada: clave ${validacion.valor}.`
      );
    }

    // Insertar una palabra es insertar sus letras en orden (CLAUDE.md 5.5), y
    // llega como **una sola traza**: avanzar y retroceder van letra por letra,
    // igual que en cualquier otra operación. No es un llenado —que prepara el
    // escenario sin reproducir nada—: aquí el recorrido de cada letra por el
    // árbol es justamente la lección.
    //
    // Una letra repetida no se comprueba antes: la traza la descubre y levanta
    // su aviso, como la inserción de un duplicado en los demás temas.
    function insertarPalabra(texto) {
      // Un tema puede pedirle más a la palabra que ser letras: Huffman exige
      // al menos dos distintas, porque con una sola no hay reducción posible.
      const validacion = (config.validarPalabra || dominio.clave.validarPalabra)(texto);
      if (!validacion.valido) {
        mostrarAlerta('error', validacion.mensaje);
        return;
      }
      limpiarAlerta();
      invalidarReproduccion();
      reproducirOperacion(
        config.insertarPalabra({ estructura: estado.estructura, letras: validacion.letras }),
        `Inserción iniciada: palabra ${validacion.valor}.`
      );
    }

    // Llenado numérico (CLAUDE.md 12: el alfabético queda diferido). Inserta de
    // a una para que la animación de inserción se vea, no un salto al estado
    // final. No reproduce la traza de cada clave: llenar es preparar el
    // escenario, no la lección; la lección es la clave que se inserta a mano.
    function llenarAutomaticamente() {
      // Sin l no hay un rango que derivar (CLAUDE.md 5.7): se llena con un
      // rango fijo, generoso frente a lo que suele caber en el salón.
      const { min, max } = config.sinLongitud
        ? { min: 1, max: 9999 }
        : dominio.limites.rangoValido(estado.estructura.l);
      const objetivo = estado.estructura.n - dominio.estructura.cantidadClaves(estado.estructura);
      if (objetivo <= 0) {
        mostrarAlerta('error', `Estructura saturada: capacidad máxima de ${estado.estructura.n} casillas alcanzada.`);
        return;
      }
      limpiarAlerta();
      invalidarReproduccion();
      let insertadas = 0;
      let intentos = 0;

      function insertarSiguiente() {
        if (insertadas >= objetivo || intentos >= objetivo * 50) {
          registrarBitacora(`Llenado automático: ${insertadas} claves insertadas.`);
          return;
        }
        intentos++;
        const candidato = Math.floor(Math.random() * (max - min + 1)) + min;
        const resultado = colocarSinTraza(candidato);
        if (resultado.exito) {
          insertadas++;
          renderizarEstructura(null, -1, { duracionMs: MS_ANIMACION_LLENADO });
          actualizarMetricas(null);
          setTimeout(insertarSiguiente, MS_ENTRE_CLAVES);
          return;
        }
        setTimeout(insertarSiguiente, 0);
      }

      insertarSiguiente();
    }

    function iniciarBusqueda(texto) {
      const validacion = validarClaveDigitada(texto);
      if (!validacion.valido) {
        mostrarAlerta('error', validacion.mensaje);
        return;
      }
      if (dominio.estructura.estaVacia(estado.estructura)) {
        mostrarAlerta('error', 'Estructura no inicializada: no existen claves para procesar.');
        return;
      }
      limpiarAlerta();
      invalidarReproduccion();
      reproducirOperacion(
        config.buscar({ estructura: estado.estructura, objetivo: validacion.valor }),
        `Búsqueda iniciada: clave objetivo ${validacion.valor}.`
      );
    }

    // Eliminar es buscar y además sacar (CLAUDE.md 5.6): la clave se localiza
    // con el algoritmo del tema, así que la traza empieza siendo la de una
    // búsqueda. Que la clave no esté **no** se comprueba antes: descubrirlo es
    // justamente el trabajo de la búsqueda, y el estudiante tiene que verla
    // recorrer hasta concluirlo. Es la diferencia con la inserción, donde el
    // duplicado sí es un estado de la estructura y se avisa de una vez.
    function eliminarClave(texto) {
      const validacion = validarClaveDigitada(texto);
      if (!validacion.valido) {
        mostrarAlerta('error', validacion.mensaje);
        return;
      }
      if (dominio.estructura.estaVacia(estado.estructura)) {
        mostrarAlerta('error', 'Estructura no inicializada: no existen claves para procesar.');
        return;
      }
      limpiarAlerta();
      invalidarReproduccion();
      reproducirOperacion(
        config.eliminar({ estructura: estado.estructura, clave: validacion.valor }),
        `Eliminación iniciada: clave ${validacion.valor}.`
      );
    }

    function crearFormularioConfiguracion() {
      const contenedor = document.createElement('form');
      contenedor.className = 'panel';
      // El tratamiento de colisiones se elige al crear y no después: no cambia
      // solo el comportamiento sino la forma de la estructura, así que
      // cambiarlo con claves ya colocadas obligaría a redispersarla entera.
      const selectorTratamiento = config.tratamientos ? `
        <label class="texto-nivel-3">Tratamiento de colisiones
          <select name="tratamiento">
            ${config.tratamientos.map((t) => `<option value="${t.valor}">${t.etiqueta}</option>`).join('')}
          </select>
        </label>
      ` : '';

      // Parámetros propios del tema —las posiciones del truncamiento, la base
      // de la conversión— junto a n y l, por la misma razón que el tratamiento:
      // definen cómo se dispersa la estructura y cambiarlos con claves ya
      // colocadas dejaría direcciones que no corresponden a ninguna cuenta.
      const camposParametros = (config.parametros || []).map((parametro) => {
        // Un parámetro con `opciones` se digita eligiendo, no escribiendo: la
        // operación del plegamiento es una de dos y no tiene por qué validarse
        // contra erratas del estudiante.
        const control = parametro.opciones
          ? `<select name="${parametro.nombre}">
               ${parametro.opciones.map((o) => `<option value="${o.valor}">${o.etiqueta}</option>`).join('')}
             </select>`
          : `<input type="${parametro.tipo === 'numero' ? 'number' : 'text'}"
                    name="${parametro.nombre}"
                    placeholder="${parametro.marcador || ''}">`;
        // Un parámetro puede ser del tratamiento y no del tema —el tamaño del
        // arreglo anidado lo es—: entonces solo se muestra cuando ese
        // tratamiento está elegido. Sigue existiendo en el formulario aunque
        // esté oculto, y su validación resuelve el vacío como el valor por
        // defecto, así que no hace falta un camino aparte para leerlo.
        const alcance = parametro.soloConTratamiento
          ? ` data-solo-con-tratamiento="${parametro.soloConTratamiento}"`
          : '';
        return `
        <label class="texto-nivel-3"${alcance}>${parametro.etiqueta}
          ${control}
          <span class="campo__ayuda texto-nivel-5">${parametro.ayuda || ''}</span>
        </label>
      `;
      }).join('');
      // Un árbol de bits no tiene tamaño que elegir: cuántas posiciones caben
      // sale de la profundidad que dan los bits del código, y la clave es
      // siempre una letra. Pedir n y l ahí sería pedir un dato que el tema no
      // usa (CLAUDE.md 5.5).
      //
      // Otras búsquedas dinámicas (CLAUDE.md 5.7) sí pide n, pero no l: sus
      // claves no tienen una longitud fija —el ejercicio mezcla libremente
      // cifras de distinto tamaño—, así que ese campo se omite aparte.
      // Las búsquedas externas llaman `N` al tamaño y "registros" a lo que
      // guarda cada posición: no es un sinónimo cosmético, es como el docente
      // plantea el ejercicio y de dónde sale la forma del archivo. El campo es
      // el mismo `n` de siempre por dentro (CLAUDE.md 5.x).
      const camposTamano = config.sinTamano ? '' : `
        <label class="texto-nivel-3">${config.etiquetaTamano || 'Tamaño de la estructura (n)'}
          <input type="number" name="n" min="1" required>
        </label>
        ${config.sinLongitud ? '' : `
        <label class="texto-nivel-3">Longitud de clave (l)
          <input type="number" name="l" min="1" required>
        </label>`}`;
      contenedor.innerHTML = `
        <h2 class="panel__titulo texto-nivel-2">Configuración de la estructura</h2>
        ${camposTamano}
        ${camposParametros}
        ${selectorTratamiento}
        <div class="pantalla-tema__controles">
          <button type="submit" class="boton boton--primario">Crear estructura</button>
          <button type="button" class="boton" data-accion="cancelar-configuracion" hidden>Cancelar</button>
        </div>
      `;
      // Cancelar vuelve a plegarla sin tocar la estructura: solo existe cuando
      // hay una que conservar (ver `sincronizarConfiguracion`).
      contenedor.querySelector('[data-accion="cancelar-configuracion"]').addEventListener('click', () => {
        estado.editandoConfiguracion = false;
        sincronizarConfiguracion();
      });
      // Los campos que pertenecen a un tratamiento aparecen y desaparecen con
      // él, para que el formulario no pida un dato que no se va a usar.
      const camposDelTratamiento = [...contenedor.querySelectorAll('[data-solo-con-tratamiento]')];
      const selector = contenedor.querySelector('[name="tratamiento"]');
      function sincronizarCamposDelTratamiento() {
        const elegido = selector ? selector.value : null;
        for (const campo of camposDelTratamiento) {
          campo.hidden = campo.dataset.soloConTratamiento !== elegido;
        }
      }
      if (selector) selector.addEventListener('change', sincronizarCamposDelTratamiento);
      sincronizarCamposDelTratamiento();

      contenedor.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const datos = new FormData(contenedor);
        const tamano = config.sinTamano
          ? config.tamano()
          : { n: Number(datos.get('n')), l: config.sinLongitud ? undefined : Number(datos.get('l')) };
        const tratamiento = config.tratamientos ? String(datos.get('tratamiento')) : null;

        // Los parámetros se validan contra n y l, así que no pueden validarse
        // antes de tenerlos: por eso ocurre aquí y no en el campo.
        const lectura = leerParametros(datos, tamano);
        if (!lectura.valido) {
          mostrarAlerta('error', lectura.mensaje);
          return;
        }
        const parametros = lectura.parametros;
        const advertenciasParametros = lectura.advertencias;

        crearYRegistrar({
          n: tamano.n,
          l: tamano.l,
          tratamiento,
          parametros,
          advertencia: advertenciasParametros[0]
        });
      });
      return contenedor;
    }

    // Crear una estructura y reiniciarla son lo mismo: la nueva nace vacía y
    // la pantalla vuelve a su estado inicial. Por eso hay una sola función,
    // que el formulario llama con lo que el estudiante digitó y el botón de
    // reiniciar con lo que la estructura ya tenía.
    function establecerEstructura({ n, l, tratamiento, parametros, advertencia }) {
      const resultado = dominio.estructura.crearEstructura({
        n,
        l,
        tipoClave: config.claveEsLetra ? 'alfabetica' : 'numerica',
        modo: config.modo || dominio.estructura.MODOS.ORDENADA,
        tratamiento
      });
      if (!resultado.exito) {
        mostrarAlerta('error', resultado.mensaje);
        return null;
      }
      // Invalidar antes de cambiar la estructura, no después: si quedaba una
      // inserción a medio reproducir, consumarla sobre la estructura nueva
      // colocaría en ella una clave que nunca se le insertó.
      invalidarReproduccion();
      resultado.estructura.parametros = parametros;
      // El `n` con que se creó, aparte del `n` con que quede la estructura:
      // en casi todos los temas son siempre el mismo valor, pero en otras
      // búsquedas dinámicas (CLAUDE.md 5.x) `n` cambia con las expansiones y
      // reducciones, y reiniciar tiene que volver a este, no al que alcanzó.
      resultado.estructura.parametros.n0 = n;
      // El tamaño de la estructura secundaria no se pide: es forma de la
      // estructura y sale de `n` —o no tiene tope, con encadenamiento—. El
      // dominio lo necesita para saber cuánto cabe, y la vista para saber
      // cuántas columnas tiene la matriz.
      resultado.estructura.tamanoAnidado = config.anidados
        ? config.anidados.tamano(resultado.estructura)
        : 0;
      estado.estructura = resultado.estructura;
      // Sin `l` no hay cifras que medir (CLAUDE.md 5.7): se reserva un ancho
      // generoso y fijo, en vez del de una sola cifra que daría por defecto.
      ajustarAnchoDeCasilla(config.sinLongitud ? ANCHO_CIFRAS_SIN_LONGITUD : l);
      limpiarAlerta();
      // Las advertencias del tema pesan más que la del tamaño: hablan de una
      // decisión que el estudiante acaba de tomar y puede rehacer.
      const aviso = advertencia || resultado.advertencia;
      if (aviso) mostrarAlerta('advertencia', aviso);
      if (dom.reiniciar) dom.reiniciar.hidden = false;
      // Guardar aparece con la estructura: sin ella no hay nada que guardar.
      if (dom.guardar) dom.guardar.hidden = false;
      renderizarEstructura(null);
      actualizarMetricas(null);
      estado.editandoConfiguracion = false;
      sincronizarConfiguracion();
      return resultado.estructura;
    }

    // **La configuración se pliega en cuanto hay estructura** (opción B de la
    // maqueta, elegida por el usuario el 2026-09-27). Abierta todo el tiempo
    // ocupaba unos 250 px del panel lateral para algo que casi no se vuelve a
    // tocar, y en un portátil (1366×640) dejaba la reproducción y las métricas
    // fuera de la vista. Plegada, lo que queda de ella es un resumen en la
    // cabecera de Operaciones —«n = 24 · l = 2  Editar»—, y «Editar» la
    // vuelve a abrir en su sitio con los valores de siempre.
    //
    // No se pliega en los temas sin operaciones (índices): ahí la
    // configuración *es* la operación, y sin panel de Operaciones no habría
    // dónde poner el resumen.
    function resumenDeEstructura(estructura) {
      if (config.detalleReciente) return config.detalleReciente(estructura);
      return config.sinLongitud ? `n = ${estructura.n}` : `n = ${estructura.n} · l = ${estructura.l}`;
    }

    function sincronizarConfiguracion() {
      if (!dom.configuracion || !dom.resumenEstructura) return;
      const plegada = Boolean(estado.estructura) && !estado.editandoConfiguracion;
      dom.configuracion.hidden = plegada;
      dom.resumenEstructura.hidden = !plegada;
      if (estado.estructura) dom.resumenTexto.textContent = resumenDeEstructura(estado.estructura);
      dom.configuracion.querySelector('[data-accion="cancelar-configuracion"]').hidden = !estado.estructura;
    }

    // Los parámetros propios del tema, leídos de un `FormData` y validados
    // contra `n` y `l`. Vive aparte porque lo necesitan dos caminos: crear la
    // estructura desde el formulario, y abrir un archivo **de otro tema**, que
    // no trae estos datos y tiene que tomarlos de lo que haya en pantalla.
    function leerParametros(datos, tamano) {
      const parametros = {};
      const advertencias = [];
      for (const parametro of config.parametros || []) {
        // `parametros` lleva los ya leídos, en el orden en que el tema los
        // declara: es lo que permite validar un campo contra otro —en índices,
        // que el registro quepa en el bloque— sin sacar la comprobación del
        // formulario. Los temas que no lo necesitan ignoran el tercer dato.
        const validacion = parametro.validar(
          String(datos.get(parametro.nombre) || ''), { n: tamano.n, l: tamano.l, parametros }
        );
        if (!validacion.valido) return { valido: false, mensaje: validacion.mensaje };
        parametros[parametro.nombre] = validacion.valor;
        if (validacion.advertencia) advertencias.push(validacion.advertencia);
      }
      return { valido: true, parametros, advertencias };
    }

    // Coloca una clave **sin reproducir su traza**. La usan las dos operaciones
    // que preparan el escenario en vez de enseñarlo: el llenado automático y
    // abrir un archivo (CLAUDE.md 6.5).
    //
    // No basta con aplicar el paso de `insercion` de la clave: en otras
    // búsquedas dinámicas (CLAUDE.md 5.7) una sola inserción puede traer
    // además una expansión entera, con su `redimensionar` y una reubicación
    // por cada clave viva — perderse esos pasos dejaría la tabla a medio
    // crecer. Por eso se aplican todos los efectos de la traza.
    function colocarSinTraza(candidato) {
      if (!config.insertar) return dominio.estructura.insertar(estado.estructura, candidato);
      if (dominio.estructura.casillaDe(estado.estructura, candidato) !== 0) {
        return { exito: false };
      }
      const pasos = config.insertar({ estructura: estado.estructura, clave: candidato });
      const huboColocacion = pasos.some((paso) => paso.efecto);
      if (!huboColocacion) return { exito: false };
      for (const paso of pasos) {
        if (paso.efecto) APLICADORES[paso.efecto.tipo](paso.efecto);
      }
      return { exito: true };
    }

    // Guardar y abrir archivos `.cc2` (CLAUDE.md 10). Lo que viaja son las
    // claves en su orden de llegada; la tabla se rehace al abrir reinsertando
    // en ese orden, que es lo único que reproduce las colisiones tal como
    // quedaron.
    function guardarArchivo() {
      if (!requiereEstructura()) return;
      const datos = persistencia.archivo.serializar({
        tema: config.id,
        estructura: estado.estructura,
        titulo: config.titulo,
        sinClaves: !!config.sinClaves
      });
      const nombre = persistencia.archivo.nombreSugerido({
        tema: config.id,
        estructura: estado.estructura,
        detalle: config.nombreArchivo ? config.nombreArchivo(estado.estructura) : null
      });
      persistencia.archivo.guardar({ datos, nombre }).then((resultado) => {
        if (!resultado.exito) return;
        const donde = resultado.via === 'dialogo'
          ? `Estructura guardada en ${resultado.nombre}.`
          : `Estructura descargada como ${resultado.nombre}. `
            + 'Para elegir carpeta y nombre, active «preguntar dónde guardar cada archivo» en el navegador.';
        mostrarAlerta('info', donde);
        // Decir "0 clave(s)" en un tema que no tiene claves sería contar lo que
        // no hay: ahí lo que se guardó son los parámetros.
        registrarBitacora(config.sinClaves
          ? `Estructura guardada: sus parámetros, en ${resultado.nombre}.`
          : `Estructura guardada: ${datos.claves.length} clave(s) en ${resultado.nombre}.`);
      });
    }

    function abrirArchivo(archivo) {
      persistencia.archivo.leer(archivo).then((lectura) => {
        if (!lectura.exito) {
          mostrarAlerta('error', lectura.mensaje);
          return;
        }
        const validacion = persistencia.archivo.validar(lectura.datos);
        if (!validacion.valido) {
          // Nada se toca si el archivo no cuadra: la estructura que está en
          // pantalla se queda como está (CLAUDE.md 10.5).
          mostrarAlerta('error', validacion.mensaje);
          return;
        }
        // Un archivo de otro tema sí se abre, si sus claves valen aquí: es lo
        // que permite ver las mismas claves en secuencial y en binaria.
        const cruce = persistencia.archivo.compatibilidad(validacion.datos, {
          tema: config.id,
          modo: config.modo || dominio.estructura.MODOS.ORDENADA,
          tipoClave: config.claveEsLetra ? 'alfabetica' : 'numerica',
          sinClaves: !!config.sinClaves
        });
        if (!cruce.abre) {
          mostrarAlerta('error', cruce.mensaje);
          return;
        }
        cargarDatos(validacion.datos, cruce);
      });
    }

    function reflejarEnConfiguracion(datos) {
      if (!dom.configuracion) return;
      const poner = (nombre, valor) => {
        const campo = dom.configuracion.querySelector(`[name="${nombre}"]`);
        if (campo && valor !== undefined && valor !== null) {
          campo.value = valor;
          campo.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      poner('n', datos.n);
      poner('l', datos.l);
      poner('tratamiento', datos.tratamiento);
      for (const [nombre, valor] of Object.entries(datos.parametros || {})) poner(nombre, valor);
    }

    // Rehace la estructura y vuelve a meter las claves **en el orden en que
    // llegaron**, sin traza: abrir un archivo es preparar el escenario, no la
    // lección — el mismo criterio que el llenado automático (CLAUDE.md 6.5).
    function cargarDatos(datos, cruce) {
      invalidarReproduccion();

      // **Del archivo salen las claves; lo demás depende de quién lo abra.**
      // Si es su propio tema, el archivo trae sus parámetros y se respetan.
      // Si viene de otro, esos parámetros no significan nada aquí —un archivo
      // de secuencial no sabe de `r` ni de umbrales— y se toman de lo que haya
      // configurado en pantalla, validado igual que al crear.
      const propio = datos.tema === config.id;
      const tamano = config.sinTamano
        ? config.tamano()
        : { n: datos.n, l: config.sinLongitud ? undefined : datos.l };

      let parametros = datos.parametros || {};
      let tratamiento = datos.tratamiento || null;
      if (!propio) {
        const desdePantalla = dom.configuracion
          ? leerParametros(new FormData(dom.configuracion), tamano)
          : { valido: true, parametros: {} };
        if (!desdePantalla.valido) {
          mostrarAlerta('error',
            `Complete la configuración de este tema antes de abrir el archivo: ${desdePantalla.mensaje}`);
          return;
        }
        parametros = desdePantalla.parametros;
        tratamiento = config.tratamientos && dom.configuracion
          ? String(new FormData(dom.configuracion).get('tratamiento'))
          : null;
      }

      const estructura = establecerEstructura({
        n: tamano.n,
        l: tamano.l,
        tratamiento,
        parametros
      });
      if (!estructura) return;

      // El panel de configuración refleja lo que se acaba de abrir: si siguiera
      // mostrando los valores anteriores, diría una cosa mientras el lienzo
      // dibuja otra, y bastaría pulsar "Crear estructura" para tirar sin querer
      // lo recién abierto.
      reflejarEnConfiguracion({ n: tamano.n, l: tamano.l, tratamiento, parametros });

      // En un tema sin claves no hay nada que reinsertar: la estructura ya
      // quedó definida al establecerla con sus parámetros. Lo que falta es
      // volver a contar de dónde sale, que es lo que el tema enseña — la misma
      // derivación que dispara crearla.
      if (config.sinClaves) {
        vista.componentes.bitacora.vaciar(dom.bitacora);
        registrarBitacora(`Archivo abierto: ${config.detalleReciente
          ? config.detalleReciente(estructura)
          : `n = ${datos.n}`}.`);
        limpiarAlerta();
        mostrarAlerta('info', 'Estructura abierta: sus parámetros, listos para recorrer la derivación.');
        if (config.alCrear) {
          reproducirOperacion(config.alCrear({ estructura }), config.mensajeDerivacion || 'Derivación iniciada.');
        }
        return;
      }

      let colocadas = 0;
      for (const clave of datos.claves) {
        if (colocarSinTraza(clave).exito) colocadas++;
      }
      vista.componentes.bitacora.vaciar(dom.bitacora);
      registrarBitacora(`Archivo abierto: n = ${datos.n}, ${colocadas} clave(s).`);
      renderizarEstructura(null);
      actualizarMetricas(null);
      limpiarAlerta();
      if (colocadas < datos.claves.length) {
        mostrarAlerta('advertencia',
          `Se colocaron ${colocadas} de ${datos.claves.length} claves: el resto no cupo o no era válido.`);
      } else if (cruce && cruce.recoloca) {
        // Las claves son las mismas; su sitio no. Decirlo, o parecerá que el
        // archivo se abrió mal.
        mostrarAlerta('advertencia',
          `Estructura abierta: ${colocadas} clave(s) del archivo, recolocadas con las reglas de este tema.`);
      } else {
        mostrarAlerta('info', `Estructura abierta: ${colocadas} clave(s) listas para operar.`);
      }
    }

    // Crear: además de establecerla, la registra en la bitácora y en las
    // recientes. Reiniciar no hace ni lo uno ni lo otro —la bitácora se vacía
    // y la reciente ya está anotada—, y por eso son dos entradas distintas a
    // la misma función.
    function crearYRegistrar({ n, l, tratamiento, parametros, advertencia }) {
      const estructura = establecerEstructura({ n, l, tratamiento, parametros, advertencia });
      if (!estructura) return null;

      const detalleTratamiento = tratamiento
        ? `, tratamiento de colisiones por ${etiquetaTratamiento(tratamiento)}`
        : '';
      const detalleParametros = (config.parametros || [])
        // Un parámetro de otro tratamiento no se registra: la bitácora diría
        // que se creó con un dato que la estructura no usa.
        .filter((parametro) => !parametro.soloConTratamiento || parametro.soloConTratamiento === tratamiento)
        .map((parametro) => `, ${parametro.etiqueta.toLowerCase()} ${parametros[parametro.nombre]}`)
        .join('');
      // Sin `l` no hay nada que anunciar ahí (CLAUDE.md 5.7): decir "l =
      // undefined" mentiría sobre un dato que la estructura no tiene.
      const detalleLongitud = config.sinLongitud ? '' : `, l = ${l}`;
      registrarBitacora(config.mensajeCreacion
        ? config.mensajeCreacion(estructura)
        : `Estructura creada: n = ${n}${detalleLongitud}${detalleParametros}${detalleTratamiento}.`);
      // La estructura ya no lleva nombre propio: era el nombre por defecto del
      // archivo .cc2, y guardar quedó para el final del proyecto (CLAUDE.md
      // 10.3). La reciente se identifica por su tema y por los datos con que
      // se creó, que es lo que el estudiante reconoce.
      persistencia.recientes.registrar({
        temaTitulo: config.titulo,
        detalle: config.detalleReciente ? config.detalleReciente(estructura) : `n = ${n} · l = ${l}`
      });
      // En índices no hay ninguna operación que pedir después: los parámetros
      // ya determinan la estructura entera, y lo que queda por enseñar es la
      // cuenta que lleva hasta ella. Crear la estructura arranca su traza.
      if (config.alCrear) {
        reproducirOperacion(config.alCrear({ estructura }), config.mensajeDerivacion || 'Derivación iniciada.');
      }
      return estructura;
    }

    // Reiniciar deja la pantalla como recién entrada al tema: la estructura
    // vacía —con los mismos datos con que se creó— y la bitácora, el aviso y
    // la reproducción en blanco. Antes tocaba salir al menú y volver a entrar
    // (pedido del usuario, 2026-08-29).
    // Vaciar pide un segundo clic (pedido del usuario, 2026-09-11): con quince
    // claves puestas a mano, un clic por error duele. No hay diálogo —el
    // proyecto no usa ninguno— sino que el propio botón pregunta y espera unos
    // segundos; si no se confirma, vuelve solo a lo que decía.
    const MS_CONFIRMACION = 4000;

    function pedirVaciar() {
      if (!requiereEstructura()) return;
      if (estado.confirmandoVaciado) {
        cancelarConfirmacionDeVaciado();
        reiniciarEstructura();
        return;
      }
      estado.confirmandoVaciado = window.setTimeout(cancelarConfirmacionDeVaciado, MS_CONFIRMACION);
      dom.reiniciar.textContent = `¿Vaciar ${nombreEstructura()}?`;
      dom.reiniciar.classList.add('boton--confirmando');
    }

    function cancelarConfirmacionDeVaciado() {
      if (!estado.confirmandoVaciado) return;
      window.clearTimeout(estado.confirmandoVaciado);
      estado.confirmandoVaciado = null;
      dom.reiniciar.textContent = `Vaciar ${nombreEstructura()}`;
      dom.reiniciar.classList.remove('boton--confirmando');
    }

    function reiniciarEstructura() {
      if (!requiereEstructura()) return;
      const anterior = estado.estructura;
      const rehecha = establecerEstructura({
        n: anterior.parametros.n0,
        l: anterior.l,
        tratamiento: anterior.tratamiento,
        parametros: anterior.parametros
      });
      if (!rehecha) return;
      vista.componentes.bitacora.vaciar(dom.bitacora);
      // El mensaje puede depender de la estructura: en cubetas, vaciar además
      // devuelve `n` al valor con que se creó, y eso hay que decirlo.
      registrarBitacora(typeof config.mensajeReinicio === 'function'
        ? config.mensajeReinicio(rehecha)
        : (config.mensajeReinicio || 'Estructura vaciada: sin claves.'));
    }

    // «estructura» en casi todos los temas y «árbol» en los de bits: el botón
    // suelto nombra el objeto completo (CLAUDE.md 9).
    function nombreEstructura(capitalizada = false) {
      const nombre = config.nombreEstructura || 'estructura';
      return capitalizada ? nombre[0].toUpperCase() + nombre.slice(1) : nombre;
    }

    function etiquetaTratamiento(valor) {
      const opcion = (config.tratamientos || []).find((t) => t.valor === valor);
      return opcion ? opcion.etiqueta.toLowerCase() : valor;
    }

    // Insertar, buscar y eliminar viven en un solo panel (pedido del docente,
    // 2026-08-29). Las tres operan sobre lo mismo —una clave— y tres paneles
    // con un campo idéntico cada uno repetían el mismo formulario tres veces y
    // empujaban métricas y bitácora fuera de la pantalla.
    //
    // Los botones nombran solo el verbo y no `Insertar clave`: el campo que
    // tienen encima ya dice sobre qué operan, y tres rótulos con la palabra
    // repetida no caben en una fila del panel (CLAUDE.md 9).
    function crearPanelOperaciones() {
      const contenedor = document.createElement('form');
      contenedor.className = 'panel';
      // En los temas de bits la clave es una letra, y además se puede insertar
      // una palabra entera: es como se arma el ejercicio de clase —«prueba»
      // son p, r, u, e, b y a—. Las seis inserciones viajan en una sola traza,
      // así que se avanzan y se retroceden letra por letra como cualquier otra
      // operación. Ahí el llenado al azar no aporta nada y cede su sitio.
      const campoClave = config.claveEsLetra
        ? '<input type="text" name="clave" maxlength="1" size="4" autocapitalize="off" spellcheck="false" required>'
        : '<input type="text" name="clave" inputmode="numeric" required>';
      // El campo y su botón en un renglón (2026-09-28): uno debajo del otro,
      // en el portátil empujaban las métricas fuera de la pantalla.
      const segundaFila = config.palabra
        ? `<div class="campo">
             <label class="texto-nivel-3" for="campo-palabra">Palabra</label>
             <div class="campo__en-linea">
               <input type="text" id="campo-palabra" name="palabra" autocapitalize="off" spellcheck="false">
               <button type="button" class="boton" data-accion="insertar-palabra">Insertar palabra</button>
             </div>
           </div>`
        : '';
      // El llenado automático es un enlace junto al rótulo de la clave y no un
      // botón en su propia fila (2026-09-27): se usa una vez para preparar el
      // ejemplo, y la fila que ocupaba era la que le faltaba al portátil.
      const enlaceLlenado = config.palabra
        ? ''
        : '<button type="button" class="boton-enlace" data-accion="llenado-automatico">Llenado automático</button>';
      contenedor.innerHTML = `
        <div class="panel__cabecera">
          <h2 class="panel__titulo texto-nivel-2">Operaciones</h2>
          <span class="panel__resumen" data-resumen="estructura" hidden>
            <span class="panel__resumen-texto"></span>
            <button type="button" class="boton-enlace" data-accion="editar-configuracion">Editar</button>
          </span>
        </div>
        ${config.soloPalabra ? '' : `
        <div class="campo">
          <div class="campo__rotulo-fila">
            <label class="texto-nivel-3" for="campo-clave">Clave</label>
            ${enlaceLlenado}
          </div>
          ${campoClave.replace('name="clave"', 'id="campo-clave" name="clave"')}
        </div>
        <div class="pantalla-tema__controles">
          <button type="submit" class="boton boton--primario" data-accion="insertar">Insertar</button>
          <button type="button" class="boton" data-accion="buscar">Buscar</button>
          <button type="button" class="boton" data-accion="eliminar">Eliminar</button>
        </div>`}
        ${segundaFila}
      `;

      // Solo la inserción limpia el campo: es la que se repite clave tras
      // clave al preparar el escenario. Buscar y eliminar dejan el valor, que
      // suele ser el mismo con el que se quiere seguir operando.
      const operar = (operacion, limpiar) => () => {
        if (!requiereEstructura()) return;
        operacion(String(new FormData(contenedor).get('clave')));
        if (limpiar) contenedor.reset();
      };

      // Enter inserta, que es la operación que se repite.
      contenedor.addEventListener('submit', (evento) => {
        evento.preventDefault();
        operar(insertarClave, true)();
      });
      // El árbol de Huffman no tiene operaciones de clave: no se busca ni se
      // elimina en él, se construye desde una palabra y se lee la tabla. Su
      // panel es el campo de palabra y nada más (CLAUDE.md 5.x).
      if (!config.soloPalabra) {
        contenedor.querySelector('[data-accion="buscar"]').addEventListener('click', operar(iniciarBusqueda, false));
        contenedor.querySelector('[data-accion="eliminar"]').addEventListener('click', operar(eliminarClave, false));
      }
      const llenado = contenedor.querySelector('[data-accion="llenado-automatico"]');
      if (llenado) {
        llenado.addEventListener('click', () => {
          if (!requiereEstructura()) return;
          llenarAutomaticamente();
        });
      }
      dom.resumenEstructura = contenedor.querySelector('[data-resumen="estructura"]');
      dom.resumenTexto = contenedor.querySelector('.panel__resumen-texto');
      contenedor.querySelector('[data-accion="editar-configuracion"]').addEventListener('click', () => {
        estado.editandoConfiguracion = true;
        sincronizarConfiguracion();
        const primerCampo = dom.configuracion && dom.configuracion.querySelector('input, select');
        if (primerCampo) primerCampo.focus();
      });
      const porPalabra = contenedor.querySelector('[data-accion="insertar-palabra"]');
      if (porPalabra) {
        porPalabra.addEventListener('click', () => {
          if (!requiereEstructura()) return;
          insertarPalabra(String(new FormData(contenedor).get('palabra')));
        });
      }
      return contenedor;
    }

    // El reproductor es de la operación en curso, sea buscar o insertar: por
    // eso vive en su propio panel y no dentro del formulario de búsqueda.
    function crearPanelReproduccion() {
      const contenido = document.createElement('div');
      contenido.innerHTML = `
        <div data-seccion="reproduccion" hidden>
          <div class="reproductor">
            <button type="button" class="boton" data-accion="anterior" title="Paso anterior" aria-label="Paso anterior">◀</button>
            <button type="button" class="boton" data-accion="reproducir">Reproducir</button>
            <button type="button" class="boton" data-accion="siguiente" title="Paso siguiente" aria-label="Paso siguiente">▶</button>
          </div>
          <label class="pantalla-tema__velocidad texto-nivel-5">
            <span class="pantalla-tema__velocidad-rotulo">Velocidad</span>
            <input type="range" min="${PASO_MS_MINIMO}" max="${PASO_MS_MAXIMO}" step="100"
                   value="${espejarVelocidad(PASO_MS_POR_OMISION)}" data-control="velocidad">
            <output class="pantalla-tema__velocidad-lectura" data-salida="velocidad">${segundosPorPaso(PASO_MS_POR_OMISION)}</output>
          </label>
        </div>
      `;

      // En una fila y no en dos (opción B de la maqueta, 2026-09-27): los
      // pasos a los lados y en medio **un solo botón que alterna** entre
      // «Reproducir» y «Pausar». Reproducir y Detener nunca se usaban a la vez.
      contenido.querySelector('[data-accion="anterior"]').addEventListener('click', () => {
        if (estado.reproductor) estado.reproductor.pasoAnterior();
      });
      contenido.querySelector('[data-accion="siguiente"]').addEventListener('click', () => {
        if (estado.reproductor) estado.reproductor.siguientePaso();
      });
      dom.alternarReproduccion = contenido.querySelector('[data-accion="reproducir"]');
      dom.alternarReproduccion.addEventListener('click', () => {
        if (!estado.reproductor) return;
        if (estado.reproductor.estaReproduciendo()) estado.reproductor.detener();
        else estado.reproductor.reproducirContinuo();
      });

      dom.seccionReproduccion = contenido.querySelector('[data-seccion="reproduccion"]');
      dom.controlVelocidad = contenido.querySelector('[data-control="velocidad"]');
      dom.lecturaVelocidad = contenido.querySelector('[data-salida="velocidad"]');
      dom.controlVelocidad.addEventListener('input', () => {
        const ms = msPorPaso();
        dom.lecturaVelocidad.textContent = segundosPorPaso(ms);
        if (estado.reproductor) estado.reproductor.establecerVelocidad(ms);
      });

      // Sin título (2026-09-30): los pasos, «Reproducir» y la velocidad ya
      // dicen qué son, y ese renglón era parte de lo que le faltaba al
      // portátil para las métricas. El nombre queda para el lector de pantalla.
      const panel = vista.componentes.panel.crearPanel({ contenido });
      panel.setAttribute('aria-label', 'Reproducción');
      return panel;
    }

    function crearPanelMetricas() {
      const contenedorMetricas = document.createElement('div');
      contenedorMetricas.className = 'pantalla-tema__metricas';

      for (const metrica of config.metricas) {
        const el = vista.componentes.panel.crearMetrica({
          etiqueta: metrica.etiqueta,
          formula: metrica.formula,
          ancha: metrica.ancha,
          valor: metrica.valor({ estructura: null, paso: null })
        });
        dom.metricas[metrica.id] = el.querySelector('.metrica__valor');
        contenedorMetricas.appendChild(el);
      }

      return vista.componentes.panel.crearPanel({ titulo: 'Métricas', contenido: contenedorMetricas });
    }

    // El control solo tiene sentido cuando hay algo comprimido que mirar: con
    // `n` chico no hace nada y ocupa la esquina del lienzo. Se decide **después
    // de dibujar y mirando el dibujo** —¿quedó algún tramo?— y no recalculando
    // la elisión, que es la única forma de que valga para las cuatro
    // orientaciones sin repetir su lógica en cada una.
    //
    // La segunda condición es la que hace que se pueda volver: con la casilla
    // marcada no queda ni un tramo, y sin ella el control desaparecería justo
    // cuando hace falta para desmarcarla.
    const TRAMOS = '.tramo-elidido, .tramo-registros, .tramo-bloques, .tramo-indices';

    function actualizarControlElision() {
      if (!dom.controlElision) return;
      const hayTramos = !!dom.estructuraEl.querySelector(TRAMOS);
      dom.controlElision.hidden = !hayTramos && !estado.mostrarCompleta;
    }

    function crearControlElision() {
      const etiqueta = document.createElement('label');
      etiqueta.className = 'lienzo__control texto-nivel-5';
      etiqueta.innerHTML = `<input type="checkbox" data-control="mostrar-completa"> Ver estructura completa`;
      etiqueta.querySelector('input').addEventListener('change', (evento) => {
        estado.mostrarCompleta = evento.target.checked;
        if (!estado.estructura) return;
        calcularSegmentosApilado();
        renderizarEstructura(estado.pasoActual, estado.indicePaso);
      });
      return etiqueta;
    }

    // Sin rótulo ni numeración: el tema se identifica por su nombre.
    function crearEncabezado() {
      const encabezado = document.createElement('header');
      encabezado.className = 'pantalla-tema__encabezado';

      const botonVolver = document.createElement('button');
      botonVolver.type = 'button';
      botonVolver.className = 'pantalla-tema__volver texto-nivel-4';
      botonVolver.textContent = '← Menú';
      botonVolver.addEventListener('click', () => {
        invalidarReproduccion();
        alVolver();
      });

      const tituloEl = document.createElement('h1');
      tituloEl.className = 'texto-nivel-1';
      tituloEl.textContent = config.titulo;

      const subtituloEl = document.createElement('span');
      subtituloEl.className = 'pantalla-tema__subtitulo texto-nivel-5';
      subtituloEl.textContent = config.descripcion;

      // **«Vaciar» y no «reiniciar»** (pedido del usuario, 2026-09-11): lo que
      // hace es dejar la misma estructura sin claves —mismo n, misma l, mismos
      // parámetros—, y «reiniciar» sonaba a empezar de cero, tanto que el
      // usuario llegó a pedir un segundo botón para lo que este ya hacía. El
      // nombre era el problema, no el comportamiento.
      dom.reiniciar = document.createElement('button');
      dom.reiniciar.type = 'button';
      dom.reiniciar.className = 'boton';
      dom.reiniciar.dataset.accion = 'vaciar';
      dom.reiniciar.textContent = `Vaciar ${nombreEstructura()}`;
      // Sin estructura no hay nada que vaciar: el botón aparece cuando la hay,
      // y en los temas que la crean solas eso es de entrada.
      dom.reiniciar.hidden = true;
      dom.reiniciar.addEventListener('click', pedirVaciar);

      // Guardar y abrir viven en el encabezado, junto a reiniciar, por la
      // misma razón: son operaciones sobre la pantalla entera y no sobre las
      // claves, y ahí están siempre a la vista sin alargar el panel lateral,
      // que es el recurso escaso (CLAUDE.md 6.2).
      dom.abrir = document.createElement('button');
      dom.abrir.type = 'button';
      dom.abrir.className = 'boton';
      dom.abrir.dataset.accion = 'cargar';
      dom.abrir.textContent = 'Cargar';
      dom.abrir.addEventListener('click', () => dom.selectorDeArchivo.click());

      // El `input` de verdad no se ve: abrir el explorador del sistema es lo
      // único que sabe hacer, y su aspecto por omisión no se parece a nada de
      // esta pantalla.
      dom.selectorDeArchivo = document.createElement('input');
      dom.selectorDeArchivo.type = 'file';
      dom.selectorDeArchivo.accept = persistencia.archivo.EXTENSION + ',application/json';
      dom.selectorDeArchivo.hidden = true;
      dom.selectorDeArchivo.addEventListener('change', () => {
        const archivo = dom.selectorDeArchivo.files[0];
        // Se limpia en el acto para que volver a elegir el mismo archivo
        // dispare otro `change`: si no, abrir dos veces seguidas lo mismo no
        // haría nada la segunda.
        dom.selectorDeArchivo.value = '';
        if (archivo) abrirArchivo(archivo);
      });

      dom.guardar = document.createElement('button');
      dom.guardar.type = 'button';
      dom.guardar.className = 'boton';
      dom.guardar.dataset.accion = 'guardar';
      dom.guardar.textContent = 'Guardar';
      dom.guardar.hidden = true;
      dom.guardar.addEventListener('click', guardarArchivo);

      // Las tres acciones van juntas y a la derecha (decisión del usuario sobre
      // maqueta, 2026-09-11): sueltas junto al título parecían parte de él y
      // quedaban flotando en un sitio donde no hay nada más. Agrupadas se leen
      // como lo que son —lo que se puede hacer con la estructura entera— y no
      // le quitan ni un píxel al panel lateral ni al lienzo, que son los que
      // van justos.
      const acciones = document.createElement('div');
      acciones.className = 'pantalla-tema__acciones';
      acciones.append(dom.abrir, dom.guardar, dom.reiniciar);

      encabezado.append(botonVolver, tituloEl, subtituloEl, acciones, dom.selectorDeArchivo);
      return encabezado;
    }

    const pantalla = document.createElement('div');
    pantalla.className = 'pantalla pantalla-tema';

    const lienzo = document.createElement('div');
    lienzo.className = 'pantalla-tema__lienzo';
    dom.estructuraEl = document.createElement('div');
    dom.estructuraEl.className = esArbol() ? 'estructura-arbol'
      : esBosque() ? 'estructura-bosque'
      : esBloques() ? 'estructura-bloques'
      : esIndices() ? 'estructura-indices'
      : esVertical() ? 'estructura-vertical' : 'estructura-horizontal';

    // El cálculo se dibuja al lado de la estructura porque lo que se enseña es
    // la correspondencia entre la cuenta y la casilla que resulta de ella.
    const escenario = document.createElement('div');
    escenario.className = `lienzo__escenario${esIndices() ? ' lienzo__escenario--indices' : ''}`;
    dom.escenario = escenario;
    escenario.appendChild(dom.estructuraEl);
    vigilarDesborde(dom.estructuraEl);
    if (config.calculo) {
      dom.calculo = vista.componentes.calculo.crearPanelCalculo({ titulo: config.tituloCalculo });
      escenario.appendChild(dom.calculo.el);
      // El cálculo también puede desbordar a lo ancho, junto al árbol más
      // ancho (ver `.calculo`): mismo borde desvanecido, sin barra.
      vigilarDesborde(dom.calculo.el);
    }
    // Sin operación el panel no está, y al irse se desvanece fuera del flujo,
    // posicionado contra el escenario (ver `aplicarVisibilidadCalculo`).
    if (config.calculoSoloEnOperacion && dom.calculo) {
      escenario.classList.add('lienzo__escenario--posicionado');
      dom.calculo.el.hidden = true;
    }
    // El árbol se encoge si con el cálculo no cabe (ver `encogerArbol`), así
    // que cambiar la ventana lo vuelve a medir.
    if (esArbol()) {
      escenario.classList.add('lienzo__escenario--arbol');
      if (window.ResizeObserver) new ResizeObserver(encogerArbol).observe(escenario);
    }
    // El pico que señala la fila (ver `alinearCalculo`). Hermano del panel y
    // no parte de él: el panel recorta lo que se le sale a los lados.
    if (config.calculoSenalaCasilla && dom.calculo) {
      escenario.classList.add('lienzo__escenario--senala');
      dom.picoCalculo = document.createElement('div');
      dom.picoCalculo.className = 'calculo-pico';
      dom.picoCalculo.setAttribute('aria-hidden', 'true');
      dom.picoCalculo.hidden = true;
      escenario.appendChild(dom.picoCalculo);
      // Desplazar la tabla a mano, cambiar la ventana o destapar la estructura
      // completa mueven la fila: el panel la sigue.
      dom.estructuraEl.addEventListener('scroll', alinearCalculo, { passive: true });
      if (window.ResizeObserver) new ResizeObserver(alinearCalculo).observe(escenario);
    }
    // El árbol no elide: se dibuja entero, porque su tamaño lo acota el
    // alfabeto y no un n que el estudiante elige. Sin elisión, el control
    // sobra y solo ocuparía alto del lienzo.
    if (esArbol()) {
      // El árbol no elide: su tamaño lo acota el alfabeto y no un n elegido.
      lienzo.append(escenario);
    } else {
      dom.controlElision = crearControlElision();
      // Nace escondido: no hay estructura todavía, así que no hay nada que
      // comprimir. `renderizarEstructura` lo destapa en cuanto lo haya.
      dom.controlElision.hidden = true;
      lienzo.append(dom.controlElision, escenario);
    }

    const panelLateral = document.createElement('div');
    panelLateral.className = 'pantalla-tema__panel-lateral';
    dom.alertas = document.createElement('div');
    dom.alertas.className = 'pantalla-tema__alertas';
    // Anunciada sin robar el foco: el aviso llega mientras el usuario sigue
    // operando, no interrumpe (CLAUDE.md 13).
    dom.alertas.setAttribute('role', 'status');
    dom.alertas.setAttribute('aria-live', 'polite');
    dom.bitacora = vista.componentes.bitacora.crearBitacora();

    // Un árbol de bits no tiene nada que configurar —ni tamaño, ni longitud
    // de clave, ni tratamiento— así que su panel se quedaría en un título y un
    // botón «Crear estructura» que no elige nada. El árbol se crea al entrar
    // al tema, y para vaciarlo está el botón de reiniciar (pedido del usuario,
    // 2026-08-29).
    // **El aviso va sobre el lienzo**, arriba a la izquierda, en la fila del
    // control «Ver estructura completa» (opción B de la maqueta, 2026-09-27).
    // Arriba del panel lateral empujaba todo hacia abajo, y en un portátil
    // dejaba las métricas bajo el borde justo al terminar cada operación.
    // Flota —no ocupa alto en el lienzo—, así que al aparecer o irse no
    // mueve la estructura.
    lienzo.appendChild(dom.alertas);
    panelLateral.append(
      ...(config.sinConfiguracion ? [] : [(dom.configuracion = crearFormularioConfiguracion())]),
      // Índices no inserta, ni busca, ni elimina: su panel sería un campo de
      // clave que no opera sobre nada (CLAUDE.md 5.x). Crear la estructura
      // *es* la operación, y la derivación arranca con ella.
      ...(config.sinOperaciones ? [] : [crearPanelOperaciones()]),
      crearPanelReproduccion(),
      crearPanelMetricas(),
      vista.componentes.panel.crearPanel({ titulo: 'Bitácora', contenido: dom.bitacora })
    );

    pantalla.append(crearEncabezado(), lienzo, panelLateral);

    // Los temas sin configuración entran con su estructura ya creada: no hay
    // decisión que tomar antes de empezar a insertar.
    if (config.sinConfiguracion) {
      const tamano = config.tamano();
      crearYRegistrar({ n: tamano.n, l: tamano.l, tratamiento: null, parametros: {} });
    } else {
      // Y los demás entran con el lienzo diciendo qué falta, en vez de con un
      // rectángulo gris y mudo.
      renderizarEstructura(null);
    }
    return pantalla;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.pantallas = window.CC2.vista.pantallas || {};
  window.CC2.vista.pantallas.temaBusqueda = { crearPantallaTema };
})();
