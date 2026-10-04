(function () {
  const dominio = window.CC2.dominio;
  const vista = window.CC2.vista;
  const persistencia = window.CC2.persistencia;
  const { TIPOS_PASO } = window.CC2.algoritmos.traza;

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
      editandoConfiguracion: false,
      // La palabra del árbol, en los temas que solo construyen desde ella
      // (Huffman, `soloPalabra`): es lo que se guarda en el archivo, porque su
      // bosque no toca `estructura.claves` (ver `estructuraAGuardar`).
      palabra: null
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
      habilitarReproduccion(false);
      sincronizarCalculo(null);
      aplicarVisibilidadCalculo();
      alinearCalculo();
    }
    // ── Dibujos de la estructura ──────────────────────────────────────────────
    //
    // Cómo se dibuja cada forma —fila o tabla, apilado de binaria, árbol,
    // bloques de un archivo externo, índices, bosque de Huffman— vive en
    // vista/dibujos/, un archivo por forma (2026-10-03). Aquí solo se crean,
    // pasándoles lo que comparten con la pantalla, y se toma de cada uno lo
    // que la pantalla usa.
    const dibujos = vista.dibujos;
    const comunes = dibujos.comun({ estado, dom, config });
    const { ajustarAnchoDeCasilla, esArbol, esVertical, segmentosDe } = comunes;
    const { renderizarFilaUnica } = dibujos.fila({ estado, dom, config, comunes });
    const { renderizarApilado } = dibujos.apilado({ estado, dom, config, comunes });
    const dibujoArbol = dibujos.arbol({ estado, dom, config, formaArbol, renderizarLienzoVacio, comunes });
    const { ajustarArbol, renderizarArbol } = dibujoArbol;
    const { esBloques, renderizarBloques } = dibujos.bloques({ estado, dom, config, comunes });
    const { apretarDerivacion, esIndices, renderizarIndices } = dibujos.indices({ estado, dom, config, renderizarLienzoVacio, comunes });
    const { esBosque, renderizarBosque } = dibujos.bosque({ dom, config, arbol: dibujoArbol });

    // El apilado es el dispositivo de la búsqueda: una fila por descarte. Los
    // pasos que sacan una clave no descartan nada y además cambian la
    // estructura bajo las filas ya dibujadas —que se leen del mismo arreglo—,
    // así que el tema puede declarar que no le aplican y esos pasos se dibujan
    // sobre la estructura completa, que es donde se ve el desplazamiento.
    // `opciones.duracionMs` alarga el reordenamiento: lo usa el llenado
    // automático, que va más despacio que una inserción suelta.
    function renderizarEstructura(paso, indicePaso, opciones) {
      // Todo lo que cambia la estructura pasa por aquí —crear, vaciar,
      // insertar, abrir un archivo, cada paso—: es el sitio donde los botones
      // de la cabecera se enteran de si ya hay algo.
      sincronizarAccionesDeEstructura();
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
      ajustarArbol();
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

    function renderizarLienzoVacio(mensaje) {
      dom.estructuraEl.className = 'estructura-vacia';
      dom.estructuraEl.removeAttribute('style');
      dom.estructuraEl.innerHTML = '';
      const aviso = document.createElement('p');
      aviso.className = 'texto-nivel-5';
      aviso.textContent = mensaje || config.mensajeLienzoVacio
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
      habilitarReproduccion(true);
      registrarBitacora(mensajeInicial);
      // **Cada paso se apunta una sola vez, la primera que se llega a él**
      // (2026-09-30). La bitácora es lo que pasó, no por dónde anda la
      // reproducción: al retroceder repetía el mensaje del paso al que se
      // volvía, y al avanzar otra vez lo repetía de nuevo.
      let ultimoApuntado = -1;

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
          if (paso && paso.mensaje && !paso.final && indice > ultimoApuntado) registrarBitacora(paso.mensaje);
          ultimoApuntado = Math.max(ultimoApuntado, indice);
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
    // para las tres operaciones, que validan igual. Abrir un archivo pasa por
    // la misma puerta, con la `l` de la estructura que se va a crear: una clave
    // guardada no vale más que una digitada (CLAUDE.md 3.2).
    function validarClaveDigitada(texto, l = estado.estructura && estado.estructura.l) {
      if (config.claveEsLetra) return dominio.clave.validarLetra(texto);
      // Otras búsquedas dinámicas (CLAUDE.md 5.7) no pide l: sus claves no
      // tienen una longitud fija que exigir.
      return config.sinLongitud
        ? dominio.clave.validarClaveNumericaLibre(texto)
        : dominio.clave.validarClaveNumerica(texto, l);
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
      if (config.soloPalabra) estado.palabra = validacion.letras.slice();
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
          <input type="number" name="l" min="1" max="${dominio.limites.L_MAXIMA}" required>
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
    function establecerEstructura({ n, n0 = n, l, tratamiento, parametros, advertencia }) {
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
      estado.palabra = null;
      resultado.estructura.parametros = parametros;
      // El `n` con que se creó, aparte del `n` con que quede la estructura:
      // en casi todos los temas son siempre el mismo valor, pero en otras
      // búsquedas dinámicas (CLAUDE.md 5.x) `n` cambia con las expansiones y
      // reducciones, y reiniciar tiene que volver a este, no al que alcanzó.
      // Al abrir un archivo de cubetas los dos difieren: la tabla se rehace
      // con el `n` que alcanzó, pero el de partida sigue siendo el guardado.
      resultado.estructura.parametros.n0 = n0;
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
    // **Huffman guarda su palabra** (2026-10-01): su bosque viaja en los
    // pasos y no toca `estructura.claves`, así que el archivo salía con
    // `"claves": []` y al abrirlo no había nada que reconstruir. Se guarda la
    // palabra entera, con sus letras repetidas —las frecuencias son el dato—,
    // como el orden de llegada de cualquier otro tema (CLAUDE.md 10.3), y con
    // su largo como `n`, que es lo que el archivo valida contra las claves.
    function estructuraAGuardar() {
      if (!config.soloPalabra || !estado.palabra) return estado.estructura;
      return Object.assign({}, estado.estructura, {
        n: estado.palabra.length,
        ordenLlegada: estado.palabra.slice()
      });
    }

    function guardarArchivo() {
      if (!requiereEstructura()) return;
      const estructura = estructuraAGuardar();
      const datos = persistencia.archivo.serializar({
        tema: config.id,
        estructura,
        titulo: config.titulo,
        sinClaves: !!config.sinClaves
      });
      const nombre = persistencia.archivo.nombreSugerido({
        tema: config.id,
        estructura,
        detalle: config.nombreArchivo ? config.nombreArchivo(estructura) : null
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
          : config.soloPalabra
            ? `Árbol guardado: palabra ${datos.claves.join('')}, en ${resultado.nombre}.`
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
      // Escritos como se digitan, no como se guardan: el umbral de cubetas es
      // 0.82 en la estructura y 82 en su campo. Y solo los que el tema
      // declara, que son los que tienen campo.
      const comoTexto = persistencia.archivo.parametrosComoTexto(datos.parametros, config.parametros);
      for (const [nombre, texto] of comoTexto) {
        if (texto !== '') poner(nombre, texto);
      }
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

      // Un archivo de un tema sin `l` —cubetas— no trae longitud, y aquí hace
      // falta una para saber qué claves valen. Se toma la de la pantalla, como
      // los parámetros de un archivo ajeno; sin ella no se abre, en vez de
      // crear una estructura que acepte claves de cualquier largo.
      if (!config.sinTamano && !config.sinLongitud && tamano.l == null) {
        const lPantalla = dom.configuracion ? Number(new FormData(dom.configuracion).get('l')) : NaN;
        if (!Number.isInteger(lPantalla) || lPantalla < 1) {
          mostrarAlerta('error',
            'El archivo no trae longitud de clave (l): indíquela en la configuración antes de abrirlo.');
          return;
        }
        tamano.l = lPantalla;
      }

      // **Cada clave del archivo pasa por la misma validación que una
      // digitada** (CLAUDE.md 3.2), antes de tocar la estructura: un archivo
      // editado a mano, o abierto en un tema con otra `l`, no puede colar una
      // clave de otra longitud —ni un texto— que después rompa el orden de la
      // binaria. Huffman valida su palabra aparte, y un tema sin claves no
      // tiene ninguna que validar.
      const validas = [];
      const invalidas = [];
      if (!config.sinClaves && !config.soloPalabra) {
        for (const clave of datos.claves) {
          const validacion = validarClaveDigitada(String(clave), tamano.l);
          if (validacion.valido) validas.push(validacion.valor);
          else invalidas.push({ clave, mensaje: validacion.mensaje });
        }
        if (invalidas.length > 0 && validas.length === 0) {
          mostrarAlerta('error',
            `Ninguna clave del archivo vale en este tema. La clave ${invalidas[0].clave}: ${invalidas[0].mensaje}`);
          return;
        }
      }

      let parametros;
      let tratamiento = datos.tratamiento || null;
      if (propio) {
        // **Los parámetros del propio tema se validan igual que al crear**: un
        // archivo editado a mano —`r: 0`, una base fuera de rango, un tipo de
        // índice que no existe— dejaría la estructura en un estado que el
        // formulario nunca permitiría. Se reescriben como se digitan y pasan
        // por los mismos validadores.
        const desdeArchivo = leerParametros(
          persistencia.archivo.parametrosComoTexto(datos.parametros, config.parametros), tamano
        );
        if (!desdeArchivo.valido) {
          mostrarAlerta('error', `El archivo trae parámetros que no valen: ${desdeArchivo.mensaje}`);
          return;
        }
        parametros = desdeArchivo.parametros;
        // El tratamiento, igual: uno de los que ofrece el tema, o ninguno si
        // el tema no los tiene.
        if (!config.tratamientos) {
          tratamiento = null;
        } else if (!config.tratamientos.some((opcion) => opcion.valor === tratamiento)) {
          mostrarAlerta('error',
            `El archivo trae un tratamiento de colisiones que no existe: ${datos.tratamiento}.`);
          return;
        }
      } else {
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
        // En su propio tema, el `n` de partida que se guardó (cubetas lo
        // distingue del que alcanzó); en otro, el archivo no sabe nada del
        // `n0` de aquí.
        n0: propio && !config.sinTamano ? persistencia.archivo.nInicial(datos) : tamano.n,
        l: tamano.l,
        tratamiento,
        parametros
      });
      if (!estructura) return;

      // El panel de configuración refleja lo que se acaba de abrir: si siguiera
      // mostrando los valores anteriores, diría una cosa mientras el lienzo
      // dibuja otra, y bastaría pulsar "Crear estructura" para tirar sin querer
      // lo recién abierto.
      // El `n` que se refleja es el de partida: es el que el formulario crea, y
      // al que vuelve «Vaciar» (en cubetas no es el que alcanzó la tabla).
      reflejarEnConfiguracion({ n: estructura.parametros.n0, l: tamano.l, tratamiento, parametros });

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

      // Huffman se reconstruye desde su palabra, y queda **ya construido**: abrir
      // un archivo es preparar el escenario (CLAUDE.md 6.5). La construcción
      // sigue ahí para recorrerla hacia atrás. Vale también para un archivo de
      // otro árbol de letras: sus claves se leen como la palabra.
      if (config.soloPalabra) {
        const validacion = config.validarPalabra(datos.claves.join(''));
        if (!validacion.valido) {
          mostrarAlerta('error', `El archivo no trae una palabra con la que construir el árbol: ${validacion.mensaje}`);
          return;
        }
        limpiarAlerta();
        estado.palabra = validacion.letras.slice();
        reproducirOperacion(
          config.insertarPalabra({ estructura: estado.estructura, letras: validacion.letras }),
          `Archivo abierto: palabra ${validacion.valor}.`
        );
        estado.reproductor.irAPaso(estado.pasos.length - 1);
        // La bitácora dice lo que pasó: se abrió el archivo, no se recorrió la
        // construcción —el primer paso se había apuntado al arrancarla—.
        vista.componentes.bitacora.vaciar(dom.bitacora);
        registrarBitacora(`Archivo abierto: palabra ${validacion.valor}.`);
        mostrarAlerta('info', `Árbol abierto: palabra ${validacion.valor}, ya construido. Retroceda para ver cómo se formó.`);
        return;
      }

      let colocadas = 0;
      for (const clave of validas) {
        if (colocarSinTraza(clave).exito) colocadas++;
      }
      vista.componentes.bitacora.vaciar(dom.bitacora);
      registrarBitacora(`Archivo abierto: n = ${datos.n}, ${colocadas} clave(s).`);
      renderizarEstructura(null);
      actualizarMetricas(null);
      limpiarAlerta();
      if (colocadas < datos.claves.length) {
        // Dos razones distintas, y se dicen por separado: una clave inválida
        // es un problema del archivo; una que no cupo o estaba repetida, de
        // la estructura en que se abrió.
        const motivos = [];
        if (invalidas.length > 0) {
          motivos.push(`${invalidas.length} no valía(n) en este tema (la clave ${invalidas[0].clave}: ${invalidas[0].mensaje})`);
        }
        const sinSitio = validas.length - colocadas;
        if (sinSitio > 0) motivos.push(`${sinSitio} no cupo(ieron) o estaba(n) repetida(s)`);
        mostrarAlerta('advertencia',
          `Se colocaron ${colocadas} de ${datos.claves.length} claves: ${motivos.join('; ')}.`);
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
    // recientes. **Salvo en la bitácora cuando la crea la pantalla al entrar**
    // (`alEntrar`, los temas sin configuración): la bitácora cuenta lo que el
    // estudiante le hizo a la estructura, y al entrar a un árbol de bits decía
    // «Árbol creado» sin que nadie hubiera creado nada (visto por el usuario,
    // 2026-09-30). Reiniciar no hace ni lo uno ni lo otro —la bitácora se vacía
    // y la reciente ya está anotada—, y por eso son dos entradas distintas a
    // la misma función.
    // **«Guardar» y «Vaciar» aparecen cuando hay algo que guardar o vaciar.**
    // Con configuración, eso es en cuanto la estructura existe: se guardan
    // sus parámetros aunque esté vacía. En los temas que la crean solos al
    // entrar (los árboles), no: la estructura existe desde el principio, pero
    // para el estudiante ahí todavía no hay árbol, y los botones se veían sin
    // que hubiera nada (visto por el usuario, 2026-09-30). Ahí aparecen con
    // la primera clave o la primera operación —en Huffman, la palabra—, y se
    // van al vaciar. Se llama desde `renderizarEstructura`.
    function sincronizarAccionesDeEstructura() {
      let hayAlgo = Boolean(estado.estructura);
      if (hayAlgo && config.sinConfiguracion) {
        hayAlgo = Boolean(estado.pasos) || estado.estructura.claves.some((clave) => clave !== undefined);
      }
      if (dom.reiniciar) dom.reiniciar.hidden = !hayAlgo;
      if (dom.guardar) dom.guardar.hidden = !hayAlgo;
    }

    function crearYRegistrar({ n, l, tratamiento, parametros, advertencia, alEntrar = false }) {
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
      if (!alEntrar) {
        registrarBitacora(config.mensajeCreacion
          ? config.mensajeCreacion(estructura)
          : `Estructura creada: n = ${n}${detalleLongitud}${detalleParametros}${detalleTratamiento}.`);
      }
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

    // **La reproducción es la última fila de Operaciones** (opción C de la
    // maqueta, elegida por el usuario el 2026-09-30): lo que se hace y cómo
    // se lo ve avanzar, juntos. Está siempre, con los pasos y «Reproducir»
    // apagados hasta que hay una operación (`habilitarReproduccion`). Antes
    // era una tarjeta propia que nacía vacía —sus botones estaban ocultos sin
    // operación—, y sin título se veía como un cuadro blanco sin nada dentro.
    // Donde no hay Operaciones (índices) va en una tarjeta propia, igual de
    // siempre presente. La velocidad no se apaga: elegirla antes de operar
    // también vale.
    function crearReproduccion() {
      const contenido = document.createElement('div');
      contenido.className = 'pantalla-tema__reproduccion';
      contenido.setAttribute('role', 'group');
      contenido.setAttribute('aria-label', 'Reproducción');
      contenido.innerHTML = `
        <div data-seccion="reproduccion">
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

      dom.controlVelocidad = contenido.querySelector('[data-control="velocidad"]');
      dom.lecturaVelocidad = contenido.querySelector('[data-salida="velocidad"]');
      dom.controlVelocidad.addEventListener('input', () => {
        const ms = msPorPaso();
        dom.lecturaVelocidad.textContent = segundosPorPaso(ms);
        if (estado.reproductor) estado.reproductor.establecerVelocidad(ms);
      });

      dom.botonesReproduccion = [...contenido.querySelectorAll('.reproductor .boton')];
      habilitarReproduccion(false);
      return contenido;
    }

    function habilitarReproduccion(activa) {
      for (const boton of dom.botonesReproduccion || []) boton.disabled = !activa;
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
      // Sin estructura no hay nada que vaciar: el botón aparece cuando la hay
      // (ver `sincronizarAccionesDeEstructura`).
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
    // Los dibujos fijan en ella el ancho de casilla (`ajustarAnchoDeCasilla`).
    dom.pantalla = pantalla;

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
    // La derivación de índices se angosta si con la estructura no cabe (ver
    // `apretarDerivacion`): cambiar la ventana lo vuelve a medir.
    if (esIndices() && window.ResizeObserver) new ResizeObserver(apretarDerivacion).observe(escenario);
    // El árbol se ajusta al sitio que le deja el cálculo (ver `ajustarArbol`), así
    // que cambiar la ventana lo vuelve a medir.
    if (esArbol()) {
      escenario.classList.add('lienzo__escenario--arbol');
      if (window.ResizeObserver) new ResizeObserver(ajustarArbol).observe(escenario);
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
    const reproduccion = crearReproduccion();
    const operaciones = config.sinOperaciones ? null : crearPanelOperaciones();
    if (operaciones) operaciones.appendChild(reproduccion);
    panelLateral.append(
      ...(config.sinConfiguracion ? [] : [(dom.configuracion = crearFormularioConfiguracion())]),
      // Índices no inserta, ni busca, ni elimina: su panel sería un campo de
      // clave que no opera sobre nada (CLAUDE.md 5.x). Crear la estructura
      // *es* la operación, y la derivación arranca con ella.
      ...(config.sinOperaciones
        ? [vista.componentes.panel.crearPanel({ contenido: reproduccion })]
        : [operaciones]),
      crearPanelMetricas(),
      vista.componentes.panel.crearPanel({ titulo: 'Bitácora', contenido: dom.bitacora })
    );

    pantalla.append(crearEncabezado(), lienzo, panelLateral);

    // Los temas sin configuración entran con su estructura ya creada: no hay
    // decisión que tomar antes de empezar a insertar.
    if (config.sinConfiguracion) {
      const tamano = config.tamano();
      crearYRegistrar({ n: tamano.n, l: tamano.l, tratamiento: null, parametros: {}, alEntrar: true });
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
