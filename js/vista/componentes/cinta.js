(function () {
  // La cinta de herramientas de la pantalla de trabajo (2026-11-25): al docente
  // le gusta que la configuración sea como la de Office, y que cada acción se
  // explique sola, con su símbolo y su palabra (CLAUDE.md 6.11).
  //
  // Aquí viven las piezas —pestañas, grupos, botones, galerías y la explicación
  // al pasar el mouse—; qué lleva cada hoja lo decide la pantalla.
  const { crearIcono, existe: existeIcono } = window.CC2.vista.componentes.iconos;

  // Lo que se explica de un control va en `data-*` y lo muestra `crearPista`.
  function ponerAyuda(el, titulo, ayuda) {
    el.dataset.pistaTitulo = titulo;
    if (ayuda) el.dataset.pista = ayuda;
    return el;
  }

  // Un botón de la cinta: grande —símbolo arriba, palabra abajo— o chico —en
  // un renglón, para apilar tres—. En vez de ícono puede llevar una `cifra`:
  // «k mod n» dice más de la función módulo que cualquier dibujo.
  function crearBoton({ texto, icono, cifra, accion, titulo = texto, ayuda, principal = false, chico = false, tipo = 'button' }) {
    const boton = document.createElement('button');
    boton.type = tipo;
    boton.className = 'cinta-boton' + (chico ? ' cinta-boton--chico' : '') + (principal ? ' cinta-boton--principal' : '');
    if (accion) boton.dataset.accion = accion;
    if (cifra) {
      const cifraEl = document.createElement('span');
      cifraEl.className = 'cinta-boton__cifra';
      cifraEl.setAttribute('aria-hidden', 'true');
      cifraEl.textContent = cifra;
      boton.appendChild(cifraEl);
    } else if (icono && existeIcono(icono)) {
      boton.appendChild(crearIcono(icono));
    }
    const textoEl = document.createElement('span');
    textoEl.className = 'cinta-boton__texto';
    textoEl.textContent = texto;
    boton.appendChild(textoEl);
    return ponerAyuda(boton, titulo, ayuda);
  }

  function escribir(boton, texto) {
    boton.querySelector('.cinta-boton__texto').textContent = texto;
  }

  function cambiarIcono(boton, icono) {
    const viejo = boton.querySelector('.icono');
    if (viejo) viejo.replaceWith(crearIcono(icono));
  }

  // Un grupo: lo suyo arriba y su nombre abajo, como en una hoja de cálculo.
  function crearGrupo(rotulo, ...hijos) {
    const grupo = document.createElement('div');
    grupo.className = 'cinta__grupo';
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', rotulo);
    const cuerpo = document.createElement('div');
    cuerpo.className = 'cinta__grupo-cuerpo';
    cuerpo.append(...hijos);
    const rotuloEl = document.createElement('div');
    rotuloEl.className = 'cinta__grupo-rotulo';
    rotuloEl.setAttribute('aria-hidden', 'true');
    rotuloEl.textContent = rotulo;
    grupo.append(cuerpo, rotuloEl);
    return grupo;
  }

  // Un campo con su nombre: al lado —dos caben apilados en la altura de la
  // cinta— o encima.
  function crearCampo({ etiqueta, control, titulo = etiqueta, ayuda, encima = false }) {
    const el = document.createElement('label');
    el.className = 'cinta-campo' + (encima ? ' cinta-campo--encima' : '');
    const nombre = document.createElement('span');
    nombre.textContent = etiqueta;
    el.append(nombre, control);
    return ponerAyuda(el, titulo, ayuda);
  }

  // Elegir entre pocas opciones, a la vista y no en una lista. El `select`
  // sigue siendo el campo del formulario —es lo que se lee al crear y lo que se
  // escribe al abrir un archivo—; los botones lo manejan y lo siguen.
  function crearGaleria({ select, opciones, chicos = false }) {
    const galeria = document.createElement('div');
    galeria.className = 'cinta-galeria' + (chicos ? ' cinta-galeria--chicos' : '') + (!chicos && opciones.length > 4 ? ' cinta-galeria--muchas' : '');
    galeria.style.setProperty('--filas', String(Math.min(3, opciones.length)));
    select.hidden = true;
    const botones = opciones.map((opcion) => {
      const boton = crearBoton({
        texto: opcion.corta || opcion.etiqueta, titulo: opcion.etiqueta, ayuda: opcion.ayuda,
        icono: opcion.icono, cifra: opcion.cifra, chico: chicos
      });
      boton.addEventListener('click', () => {
        if (select.value === opcion.valor) return;
        select.value = opcion.valor;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      galeria.appendChild(boton);
      return boton;
    });
    const sincronizar = () => botones.forEach((boton, i) => {
      boton.setAttribute('aria-pressed', String(select.value === opciones[i].valor));
    });
    select.addEventListener('change', sincronizar);
    sincronizar();
    galeria.appendChild(select);
    return galeria;
  }

  // La cinta: pestañas, la hoja elegida y, a la derecha, lo que está siempre
  // —la reproducción—, se mire la pestaña que se mire.
  //
  // hojas = [{ id, titulo, el, accion }]
  function crearCinta({ hojas, fija, alElegir }) {
    const el = document.createElement('div');
    el.className = 'cinta';
    const pestanas = document.createElement('div');
    pestanas.className = 'cinta__pestanas';
    pestanas.setAttribute('role', 'tablist');
    const cuerpo = document.createElement('div');
    cuerpo.className = 'cinta__cuerpo';
    let actual = null;

    const botones = new Map();
    for (const hoja of hojas) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'cinta__pestana';
      boton.setAttribute('role', 'tab');
      boton.dataset.hoja = hoja.id;
      if (hoja.accion) boton.dataset.accion = hoja.accion;
      boton.textContent = hoja.titulo;
      boton.addEventListener('click', () => elegir(hoja.id));
      botones.set(hoja.id, boton);
      pestanas.appendChild(boton);
      hoja.el.classList.add('cinta__hoja');
      hoja.el.setAttribute('role', 'tabpanel');
      hoja.el.setAttribute('aria-label', hoja.titulo);
      cuerpo.appendChild(hoja.el);
    }
    // Las flechas recorren las pestañas, como pide su papel.
    pestanas.addEventListener('keydown', (evento) => {
      const sentido = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
      if (!sentido) return;
      const vivas = [...botones.values()].filter((boton) => !boton.disabled);
      const i = vivas.indexOf(document.activeElement);
      if (i === -1) return;
      const otra = vivas[(i + sentido + vivas.length) % vivas.length];
      otra.focus();
      elegir(otra.dataset.hoja);
      evento.preventDefault();
    });

    const plegar = document.createElement('button');
    plegar.type = 'button';
    plegar.className = 'cinta__plegar';
    plegar.dataset.accion = 'plegar-cinta';
    const textoPlegar = document.createElement('span');
    plegar.append(textoPlegar, crearIcono('plegar'));
    plegar.addEventListener('click', () => ponerPlegada(!el.classList.contains('cinta--plegada')));
    pestanas.appendChild(plegar);

    function ponerPlegada(plegada) {
      el.classList.toggle('cinta--plegada', plegada);
      plegar.setAttribute('aria-expanded', String(!plegada));
      textoPlegar.textContent = plegada ? 'Mostrar cinta' : 'Ocultar cinta';
      if (alElegir) alElegir(actual);
    }

    function elegir(id) {
      actual = id;
      for (const hoja of hojas) {
        const es = hoja.id === id;
        hoja.el.hidden = !es;
        const boton = botones.get(hoja.id);
        boton.setAttribute('aria-selected', String(es));
        boton.tabIndex = es ? 0 : -1;
      }
      // Elegir una pestaña con la cinta oculta es pedir verla.
      if (el.classList.contains('cinta--plegada')) ponerPlegada(false);
      else if (alElegir) alElegir(id);
    }

    if (fija) {
      fija.classList.add('cinta__fija');
      cuerpo.appendChild(fija);
    }
    el.append(pestanas, cuerpo);
    ponerPlegada(false);

    return {
      el,
      elegir,
      actual: () => actual,
      plegada: () => el.classList.contains('cinta--plegada'),
      habilitar: (id, activa) => { botones.get(id).disabled = !activa; }
    };
  }

  // **La explicación al pasar el mouse o llegar con el teclado**: el nombre
  // completo y una frase. Una sola por pantalla, posicionada dentro de ella.
  function crearPista(pantalla) {
    const pista = document.createElement('div');
    pista.className = 'pista';
    pista.setAttribute('role', 'tooltip');
    pista.hidden = true;
    const titulo = document.createElement('b');
    const texto = document.createElement('span');
    pista.append(titulo, texto);
    pantalla.appendChild(pista);

    const ocultar = () => { pista.hidden = true; };
    const mostrar = (evento) => {
      const el = evento.target.closest ? evento.target.closest('[data-pista-titulo]') : null;
      if (!el || !el.dataset.pista) return ocultar();
      titulo.textContent = el.dataset.pistaTitulo;
      texto.textContent = el.dataset.pista;
      pista.hidden = false;
      const marco = pantalla.getBoundingClientRect();
      const caja = el.getBoundingClientRect();
      pista.style.left = `${Math.max(8, Math.min(caja.left - marco.left, marco.width - pista.offsetWidth - 8))}px`;
      pista.style.top = `${caja.bottom - marco.top + 6}px`;
    };
    pantalla.addEventListener('mouseover', mostrar);
    pantalla.addEventListener('mouseleave', ocultar);
    pantalla.addEventListener('click', ocultar);
    pantalla.addEventListener('keydown', ocultar);
    pantalla.addEventListener('focusin', (evento) => {
      if (evento.target.matches(':focus-visible') && evento.target.matches('button')) mostrar(evento);
      else ocultar();
    });
    return pista;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.cinta = {
    crearCinta, crearGrupo, crearBoton, crearCampo, crearGaleria, crearPista, ponerAyuda, escribir, cambiarIcono
  };
})();
