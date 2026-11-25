(function () {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function formatearFecha(iso) {
    const fecha = new Date(iso);
    return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  const { crearIcono } = window.CC2.vista.componentes.iconos;
  const miniaturas = window.CC2.vista.componentes.miniaturas;

  // Lo no construido sigue en el catálogo y no se dibuja (decisión del
  // usuario, 2026-11-25): la entrega no muestra lo que no está.
  function seMuestra(nodo) {
    return nodo.hijos ? nodo.hijos.some(seMuestra) : Boolean(nodo.disponible);
  }
  const hijosDe = (nodo) => nodo.hijos.filter(seMuestra);

  // **Un bloque por módulo, submódulo o tema** (2026-11-25, sobre maquetas):
  // el dibujo de lo que se estudia, el nombre y, si lleva algo dentro, qué. Sin
  // descripciones: el dibujo ya explica (pedido del usuario). Ningún nodo
  // lleva número ni la palabra «módulo» (CLAUDE.md 2).
  function crearBloque(nodo, { modulo, grande, alPulsar }) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'bloque-menu' + (grande ? ' bloque-menu--grande' : '');
    boton.dataset.modulo = modulo;
    boton.dataset.nodo = nodo.id;
    if (nodo.hijos) boton.dataset.categoria = 'si';

    const dibujo = document.createElement('span');
    dibujo.className = 'bloque-menu__dibujo';
    const miniatura = miniaturas.crear(nodo.id);
    dibujo.appendChild(miniatura);

    const texto = document.createElement('span');
    texto.className = 'bloque-menu__texto';
    const titulo = document.createElement('span');
    titulo.className = 'bloque-menu__titulo';
    const nombre = document.createElement('span');
    nombre.className = 'bloque-menu__nombre';
    nombre.textContent = nodo.titulo;
    titulo.append(nombre, crearIcono('entrar'));
    texto.appendChild(titulo);
    if (nodo.hijos) {
      const fichas = document.createElement('span');
      fichas.className = 'bloque-menu__fichas';
      for (const hijo of hijosDe(nodo)) {
        const ficha = document.createElement('span');
        ficha.className = 'ficha';
        ficha.textContent = hijo.corto || hijo.titulo;
        fichas.appendChild(ficha);
      }
      texto.appendChild(fichas);
    }
    boton.append(dibujo, texto);
    const recorrer = () => miniaturas.recorrer(miniatura);
    boton.addEventListener('mouseenter', recorrer);
    boton.addEventListener('focus', () => { if (boton.matches(':focus-visible')) recorrer(); });
    boton.addEventListener('click', () => alPulsar(nodo));
    return boton;
  }

  // **Las recientes van en una tira bajo la barra** y no en un panel a la
  // derecha (2026-09-27). El panel se quedaba con 320 px del ancho del
  // catálogo, y en un portátil las descripciones del índice acababan en
  // columnas de una palabra. En la tira cada una es una pastilla —tema y los
  // datos con que se creó—, y si no caben todas se desvanece el borde, como
  // en el lienzo.
  //
  // **Y se abren** (pedido del usuario, 2026-10-21): cada pastilla es un botón
  // que entra al tema con la estructura como la dejó el estudiante, y dice
  // cuántas claves tiene, que es lo que distingue dos con los mismos datos de
  // creación. El `title` lleva la fecha y que vive en el navegador: la copia
  // real es el archivo .cc2 (CLAUDE.md 10.4).
  function cantidadDeClaves(datos) {
    if (datos.sinClaves) return '';
    const cantidad = datos.claves.length;
    if (cantidad === 0) return 'vacía';
    return cantidad === 1 ? '1 clave' : `${cantidad} claves`;
  }

  function crearTiraRecientes(recientes, alAbrirReciente) {
    const tira = document.createElement('section');
    tira.className = 'tira-recientes';
    tira.setAttribute('aria-label', 'Estructuras recientes');

    const titulo = document.createElement('h2');
    titulo.className = 'tira-recientes__titulo';
    titulo.append(crearIcono('reloj'), 'Seguir con');

    const lista = document.createElement('ul');
    lista.className = 'tira-recientes__lista';
    for (const item of recientes) {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'tira-recientes__item';
      boton.title = `${formatearFecha(item.fecha)}. Guardada en este navegador; la copia real es el archivo .cc2.`;
      const tema = document.createElement('span');
      tema.className = 'tira-recientes__tema';
      tema.textContent = item.temaTitulo;
      const detalle = document.createElement('span');
      detalle.className = 'tira-recientes__detalle';
      detalle.textContent = item.detalle;
      boton.append(tema, detalle);
      const claves = cantidadDeClaves(item.datos);
      if (claves) {
        const cantidad = document.createElement('span');
        cantidad.className = 'tira-recientes__claves';
        cantidad.textContent = claves;
        boton.append(cantidad);
      }
      boton.addEventListener('click', () => alAbrirReciente(item));
      li.appendChild(boton);
      lista.appendChild(li);
    }
    tira.append(titulo, lista);
    hacerDesplazable(lista);
    return tira;
  }

  // **La tira se desplaza en horizontal** (pedido del usuario, 2026-10-28).
  // Shift + rueda ya lo hace el navegador en un contenedor que se desplaza;
  // la rueda sola, encima de la tira, también la mueve de lado, porque el
  // menú cabe en la ventana y no hay nada que desplazar hacia abajo. Solo se
  // toma la rueda cuando la tira de verdad se mueve: en un extremo, o si
  // cabe entera, sigue siendo de la página. El desvanecido se pone del lado
  // donde queda algo por ver.
  function hacerDesplazable(lista) {
    const marcarCortes = () => {
      const resto = lista.scrollWidth - lista.clientWidth - lista.scrollLeft;
      lista.classList.toggle('tira-recientes__lista--corte-izquierda', lista.scrollLeft > 1);
      lista.classList.toggle('tira-recientes__lista--corte-derecha', resto > 1);
    };
    lista.addEventListener('wheel', (evento) => {
      if (evento.shiftKey || Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return;
      const antes = lista.scrollLeft;
      lista.scrollLeft += evento.deltaY;
      if (lista.scrollLeft !== antes) evento.preventDefault();
    }, { passive: false });
    lista.addEventListener('scroll', marcarCortes, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(marcarCortes).observe(lista);
    requestAnimationFrame(marcarCortes);
  }

  // **El menú crece con la pantalla** (opción A de la maqueta, 2026-09-27:
  // diseño responsivo). Se dibuja con el ancho de un portátil —1366×640, la
  // referencia más chica— y se escala para llenar la ventana: letra,
  // renglones y espacios crecen juntos, hasta el doble. Así en un portátil
  // cabe justo y en una pantalla grande no deja media pantalla vacía. Con
  // `zoom` y no con `transform`: el zoom sí cambia el espacio que ocupa, y la
  // página no queda con un hueco o un desplazamiento de más.
  //
  // **Y también se achica, hasta 0,75** (2026-10-06). Con el piso en 1, por
  // debajo de 1366 px el diseño no cabía y se apretaba: a 1024 las
  // descripciones quedaban una palabra por renglón, y a 1280 —la pantalla de
  // referencia con el zoom del navegador a 150 %, el que se usa en el aula—
  // las de búsquedas externas ocupaban hasta cinco. 0,75 es lo que pide un
  // proyector XGA (1024 / 1366); más abajo la letra ya no se leería.
  const REFERENCIA = { ancho: 1366, alto: 640 };
  const ESCALA_MAXIMA = 2;
  const ESCALA_MINIMA = 0.75;

  function escalarAlaVentana(pantalla) {
    const escala = Math.max(ESCALA_MINIMA, Math.min(
      window.innerWidth / REFERENCIA.ancho,
      window.innerHeight / REFERENCIA.alto,
      ESCALA_MAXIMA
    ));
    pantalla.style.zoom = String(escala);
    // El alto de la pantalla también se escala: `100vh` con zoom 1,4
    // mediría 140 vh y la página se desplazaría sin nada debajo.
    pantalla.style.height = `${100 / escala}vh`;
    return escala;
  }

  function crearBotonDeRuta(clase, icono, texto, alPulsar) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = clase;
    if (icono) boton.appendChild(crearIcono(icono));
    boton.append(texto);
    boton.addEventListener('click', alPulsar);
    return boton;
  }

  // Las migas: dónde se está, y un clic a cualquier nivel de arriba.
  function crearMigas(categorias, alNavegar) {
    const nav = document.createElement('nav');
    nav.className = 'migas';
    nav.setAttribute('aria-label', 'Dónde estoy');
    nav.appendChild(crearBotonDeRuta('migas__nivel', 'inicio', 'Inicio', () => alNavegar([])));
    categorias.forEach((nodo, i) => {
      nav.appendChild(crearIcono('miga'));
      if (i === categorias.length - 1) {
        const actual = document.createElement('span');
        actual.className = 'migas__actual';
        actual.setAttribute('aria-current', 'page');
        actual.textContent = nodo.titulo;
        nav.appendChild(actual);
      } else {
        nav.appendChild(crearBotonDeRuta('migas__nivel', null, nodo.titulo, () => alNavegar(categorias.slice(0, i + 1).map((categoria) => categoria.id))));
      }
    });
    return nav;
  }

  // La marca: unas casillas de las que sale un grafo.
  function crearMarca() {
    const molde = document.createElement('template');
    molde.innerHTML = `<svg class="menu__marca" viewBox="0 0 34 34" aria-hidden="true" focusable="false"><rect x="2" y="13" width="9" height="9" rx="1.5"/><rect x="11" y="13" width="9" height="9" rx="1.5" fill="currentColor"/><path d="M20 17.5 27 8M20 17.5 27 27"/><circle cx="28.5" cy="6.5" r="3.6"/><circle cx="28.5" cy="28" r="3.6"/></svg>`;
    return molde.content.firstElementChild;
  }

  // **El menú se recorre por niveles** (2026-11-25): el inicio con los dos
  // módulos, sus submódulos y sus temas. `ruta` son los ids de las categorías
  // abiertas; una que no exista se corta ahí.
  function crearPantallaMenu({ catalogo, ruta, recientes, alSeleccionarTema, alNavegar, alAbrirReciente }) {
    const categorias = [];
    let nivel = catalogo;
    for (const id of ruta) {
      const nodo = nivel.find((hijo) => hijo.id === id && hijo.hijos);
      if (!nodo) break;
      categorias.push(nodo);
      nivel = nodo.hijos;
    }
    const ids = (nodos) => nodos.map((nodo) => nodo.id);
    const actual = categorias[categorias.length - 1] || null;
    const modulo = categorias.length ? categorias[0].id : 'inicio';

    const pantalla = document.createElement('div');
    pantalla.className = 'pantalla pantalla-menu-app';
    pantalla.dataset.modulo = modulo;

    const cabecera = document.createElement('header');
    cabecera.className = 'menu__cabecera';
    const nombre = document.createElement('div');
    const titulo = document.createElement('h1');
    titulo.textContent = 'Simulador de búsquedas y grafos';
    const materia = document.createElement('p');
    materia.textContent = 'Ciencias de la Computación II';
    nombre.append(titulo, materia);
    cabecera.append(crearMarca(), nombre);
    if (actual) cabecera.appendChild(crearMigas(categorias, alNavegar));

    const cuerpo = document.createElement('main');
    cuerpo.className = 'menu__cuerpo';
    if (actual) {
      const padre = categorias[categorias.length - 2];
      const encabezado = document.createElement('div');
      encabezado.className = 'menu__encabezado';
      const tituloActual = document.createElement('h2');
      tituloActual.textContent = actual.titulo;
      encabezado.append(
        crearBotonDeRuta('menu__volver', 'volver', padre ? padre.titulo : 'Inicio', () => alNavegar(ids(categorias.slice(0, -1)))),
        tituloActual
      );
      cuerpo.appendChild(encabezado);
    }

    // Dos o tres bloques van en fila; cuatro, de a dos con el dibujo a la
    // izquierda: en una fila quedaban altos, angostos y con el dibujo chico.
    const visibles = actual ? hijosDe(actual) : catalogo;
    const bloques = document.createElement('div');
    bloques.className = `menu__bloques menu__bloques--${visibles.length}`;
    for (const nodo of visibles) {
      bloques.appendChild(crearBloque(nodo, {
        modulo: actual ? modulo : nodo.id,
        grande: visibles.length === 2,
        alPulsar: (pulsado) => (pulsado.hijos ? alNavegar(ids(categorias.concat(pulsado))) : alSeleccionarTema(pulsado))
      }));
    }
    cuerpo.appendChild(bloques);
    if (!actual && recientes.length > 0) cuerpo.appendChild(crearTiraRecientes(recientes, alAbrirReciente));
    pantalla.append(cabecera, cuerpo);

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
