(function () {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function formatearFecha(iso) {
    const fecha = new Date(iso);
    return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  // Los temas no construidos se marcan y siguen respondiendo al clic, para
  // avisar en vez de quedarse mudos (decisión del usuario, 2026-09-11). La
  // marca es siempre la misma —"En desarrollo"—: lo disponible no se
  // rotula, porque en un índice lo normal es que el tema exista.
  function crearEstado() {
    const el = document.createElement('span');
    el.className = 'indice__estado';
    el.textContent = 'En desarrollo';
    return el;
  }

  // El catálogo se lee como el índice de un libro: **todo a la vista**, sin
  // navegar por niveles ni tarjetas que abrir (pedido del usuario, 2026-09-11,
  // sobre maqueta). La jerarquía la dicen la sangría y la tipografía, sobre la
  // división que pide el docente —Búsquedas y Grafos—, y ningún nodo lleva
  // número, en ningún nivel (CLAUDE.md 2).
  //
  // Un renglón de tema es: título · guía de puntos · descripción. La guía es
  // la línea que en un libro lleva del título al número de página; aquí lleva
  // a lo que hay que saber del tema, y por eso ningún renglón la deja colgando
  // sin nada al otro lado.
  function crearRenglonTema(nodo, alSeleccionarTema) {
    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'indice__tema' + (nodo.disponible ? '' : ' indice__tema--pendiente');

    const titulo = document.createElement('span');
    titulo.className = 'indice__tema-titulo';
    titulo.textContent = nodo.titulo;

    const guia = document.createElement('span');
    guia.className = 'indice__guia';
    guia.setAttribute('aria-hidden', 'true');

    boton.append(titulo, guia);

    if (nodo.descripcion) {
      const descripcion = document.createElement('span');
      descripcion.className = 'indice__tema-descripcion texto-nivel-5';
      descripcion.textContent = nodo.descripcion;
      boton.appendChild(descripcion);
    }
    if (!nodo.disponible) boton.appendChild(crearEstado());

    boton.addEventListener('click', () => alSeleccionarTema(nodo));
    li.appendChild(boton);
    return li;
  }

  // Una sección del índice, en la profundidad que le toque. Los tres niveles
  // no son tres componentes: es el mismo, rotulado distinto —parte, grupo y
  // subgrupo sangrado—, porque el catálogo es un árbol y nada garantiza que
  // siempre tenga tres niveles.
  const CLASES_POR_PROFUNDIDAD = ['parte', 'grupo', 'subgrupo'];

  function tieneTemaDisponible(nodo) {
    return nodo.hijos ? nodo.hijos.some(tieneTemaDisponible) : Boolean(nodo.disponible);
  }

  function crearSeccion(nodo, profundidad, alSeleccionarTema) {
    const nivel = CLASES_POR_PROFUNDIDAD[Math.min(profundidad, CLASES_POR_PROFUNDIDAD.length - 1)];
    const seccion = document.createElement('section');
    seccion.className = `indice__${nivel}`;

    const titulo = document.createElement(profundidad === 0 ? 'h2' : profundidad === 1 ? 'h3' : 'h4');
    titulo.className = `indice__${nivel}-titulo`;
    titulo.textContent = nodo.titulo;

    // La descripción de la parte va pegada a su título, en la misma línea: es
    // el subtítulo de la sección y no un párrafo aparte.
    if (profundidad === 0 && nodo.descripcion) {
      const descripcion = document.createElement('span');
      descripcion.className = 'indice__parte-descripcion';
      descripcion.textContent = nodo.descripcion;
      titulo.appendChild(descripcion);
    }
    seccion.appendChild(titulo);

    // Dos rasgos de la parte que cambian cómo se dibuja (menú en columnas,
    // 2026-09-27; CLAUDE.md 4):
    //
    //   · **Sus categorías, cada una en su columna.** Búsquedas se divide en
    //     internas y externas, y cada mitad va entera en la suya: partir
    //     internas para equilibrar alturas no convenció al usuario.
    //   · **Una parte sin ningún tema construido va angosta**: sin
    //     descripciones, y el «En desarrollo» una sola vez, en su cabecera, en
    //     vez de en cada renglón. Es lo que hoy le pasa a Grafos, y lo que le
    //     deja a Búsquedas el ancho para que sus descripciones quepan.
    if (profundidad === 0) {
      const categorias = (nodo.hijos || []).filter((hijo) => hijo.hijos);
      if (categorias.length > 1) seccion.classList.add('indice__parte--en-columnas');
      if (!tieneTemaDisponible(nodo)) {
        seccion.classList.add('indice__parte--pendiente');
        titulo.appendChild(crearEstado());
      }
    }

    // Los temas seguidos se juntan en una sola lista y las categorías abren su
    // propia sección, **respetando el orden del catálogo**: en búsquedas
    // internas, secuencial y binaria van antes que transformación de claves.
    let lista = null;
    for (const hijo of nodo.hijos || []) {
      if (hijo.hijos) {
        lista = null;
        seccion.appendChild(crearSeccion(hijo, profundidad + 1, alSeleccionarTema));
        continue;
      }
      if (!lista) {
        lista = document.createElement('ul');
        lista.className = 'indice__lista';
        seccion.appendChild(lista);
      }
      lista.appendChild(crearRenglonTema(hijo, alSeleccionarTema));
    }
    return seccion;
  }

  // **Las recientes van en una tira bajo la barra** y no en un panel a la
  // derecha (2026-09-27). El panel se quedaba con 320 px del ancho del
  // catálogo, y en un portátil las descripciones del índice acababan en
  // columnas de una palabra. En la tira cada una es una pastilla —tema y los
  // datos con que se creó—, y si no caben todas se desvanece el borde, como
  // en el lienzo. La fecha pasa al `title`.
  //
  // No se pueden abrir: guardan el nombre del tema y un resumen, no la
  // estructura. Son un recordatorio; la copia real es el archivo .cc2.
  function crearTiraRecientes(recientes) {
    const tira = document.createElement('section');
    tira.className = 'tira-recientes';
    tira.setAttribute('aria-label', 'Estructuras recientes');

    const titulo = document.createElement('h2');
    titulo.className = 'tira-recientes__titulo';
    titulo.textContent = 'Recientes';

    const lista = document.createElement('ul');
    lista.className = 'tira-recientes__lista';
    for (const item of recientes) {
      const li = document.createElement('li');
      li.className = 'tira-recientes__item';
      li.title = formatearFecha(item.fecha);
      const tema = document.createElement('span');
      tema.className = 'tira-recientes__tema';
      tema.textContent = item.temaTitulo;
      const detalle = document.createElement('span');
      detalle.className = 'tira-recientes__detalle';
      detalle.textContent = item.detalle;
      li.append(tema, detalle);
      lista.appendChild(li);
    }
    tira.append(titulo, lista);
    return tira;
  }

  // **El menú crece con la pantalla** (opción A de la maqueta, 2026-09-27:
  // diseño responsivo). Se dibuja con el ancho de un portátil —1366×640, la
  // referencia más chica— y se escala para llenar la ventana: letra,
  // renglones y espacios crecen juntos, hasta el doble. Así en un portátil
  // cabe justo y en una pantalla grande no deja media pantalla vacía. Con
  // `zoom` y no con `transform`: el zoom sí cambia el espacio que ocupa, y la
  // página no queda con un hueco o un desplazamiento de más.
  const REFERENCIA = { ancho: 1366, alto: 640 };
  const ESCALA_MAXIMA = 2;

  function escalarAlaVentana(pantalla) {
    const escala = Math.max(1, Math.min(
      window.innerWidth / REFERENCIA.ancho,
      window.innerHeight / REFERENCIA.alto,
      ESCALA_MAXIMA
    ));
    pantalla.style.zoom = String(escala);
    // El alto mínimo de pantalla también se escala: `100vh` con zoom 1,4
    // mediría 140 vh y la página se desplazaría sin nada debajo.
    pantalla.style.minHeight = `${100 / escala}vh`;
    return escala;
  }

  function crearPantallaMenu({ catalogo, recientes, alSeleccionarTema }) {
    const pantalla = document.createElement('div');
    pantalla.className = 'pantalla pantalla-menu-app';

    const barra = document.createElement('header');
    barra.className = 'pantalla-menu__barra';

    const marca = document.createElement('div');
    marca.className = 'pantalla-menu__marca';
    const sigla = document.createElement('span');
    sigla.className = 'texto-nivel-2';
    sigla.textContent = 'CC2';
    const descripcionMarca = document.createElement('span');
    descripcionMarca.className = 'texto-nivel-5';
    descripcionMarca.textContent = ' · Ciencias de la Computación II — Simulador de algoritmos de búsqueda';
    marca.append(sigla, descripcionMarca);

    // **Sin botón de alertas** (2026-09-11). Era un botón fijo para preguntar
    // si había alertas, y casi siempre contestaba que no. Los avisos que sí
    // importan —«tema en construcción»— no salían de ahí: salen solos al
    // pulsar un tema pendiente, y se muestran debajo de esta barra, que es
    // donde siguen saliendo.
    barra.appendChild(marca);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'pantalla-menu__cuerpo';

    // Las dos partes van una al lado de la otra (`indice--columnas`): el
    // catálogo entero en una sola columna mide 1439 px y no cabe en la ventana
    // de proyección de 950, así que Grafos quedaba al fondo y había que
    // desplazar para verlo — justo lo que el índice viene a evitar. A dos
    // columnas mide 1045 y las dos mitades del programa quedan a la misma
    // altura (medido sobre la maqueta, 2026-09-11).
    const columnaCatalogo = document.createElement('div');
    columnaCatalogo.className = 'pantalla-menu__catalogo indice indice--columnas';
    for (const parte of catalogo) {
      columnaCatalogo.appendChild(crearSeccion(parte, 0, alSeleccionarTema));
    }

    cuerpo.appendChild(columnaCatalogo);
    pantalla.append(barra);
    if (recientes.length > 0) pantalla.append(crearTiraRecientes(recientes));
    pantalla.append(cuerpo);

    // Se escala al montarse y cada vez que cambia la ventana; el oyente se
    // retira solo cuando el menú ya no está en la página.
    escalarAlaVentana(pantalla);
    const alCambiarVentana = () => {
      if (!pantalla.isConnected) {
        window.removeEventListener('resize', alCambiarVentana);
        return;
      }
      escalarAlaVentana(pantalla);
    };
    window.addEventListener('resize', alCambiarVentana);
    return pantalla;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.pantallas = window.CC2.vista.pantallas || {};
  window.CC2.vista.pantallas.menu = { crearPantallaMenu };
})();
