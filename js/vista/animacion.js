(function () {
  function prefiereMovimientoReducido() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Las animaciones se reemplazan, nunca se encolan (CLAUDE.md 7): cancelar
  // cualquier animación en curso sobre el mismo elemento antes de iniciar otra.
  function reemplazarAnimacion(el, keyframes, opciones) {
    if (el.__animacionActual) {
      el.__animacionActual.cancel();
    }
    const animacion = el.animate(keyframes, opciones);
    el.__animacionActual = animacion;
    animacion.onfinish = () => {
      if (el.__animacionActual === animacion) el.__animacionActual = null;
    };
    return animacion;
  }

  // Cuánto amplía la pantalla al elemento: el producto del `zoom` de él y de
  // sus ancestros. `currentCSSZoom` lo da hecho donde existe (Chrome 128,
  // Firefox 126); si no, se recorre la cadena.
  //
  // **Y la escala que les pongan sus ancestros con `transform`** (2026-10-08):
  // el árbol que cambia de tamaño al aparecer el cálculo se anima escalando su
  // caja (`recentrarArbol`, tema-busqueda.js), y mientras dura, un píxel del
  // nodo mide en la pantalla el zoom por esa escala. Sin contarla, el FLIP de
  // los nodos y las aristas que los siguen se corrían en la misma proporción.
  function zoomEfectivo(el) {
    let zoom = 1;
    if (typeof el.currentCSSZoom === 'number') {
      zoom = el.currentCSSZoom || 1;
    } else {
      for (let nodo = el; nodo && nodo.nodeType === 1; nodo = nodo.parentElement) {
        zoom *= parseFloat(getComputedStyle(nodo).zoom) || 1;
      }
    }
    for (let nodo = el.parentElement; nodo && nodo.nodeType === 1; nodo = nodo.parentElement) {
      const transform = getComputedStyle(nodo).transform;
      if (transform && transform !== 'none') zoom *= new DOMMatrixReadOnly(transform).a || 1;
    }
    return zoom;
  }

  // Técnica FLIP: mide posición antes, deja que aplicarCambio() modifique el
  // DOM, mide después y anima solo el delta con transform (CLAUDE.md 7).
  //
  // **El delta se mide en la pantalla y se aplica dentro del elemento**: con
  // el árbol ajustado al lienzo (`zoom`, vista/dibujos/arbol.js) un píxel del
  // elemento no mide un píxel de pantalla, así que el delta se divide por su
  // zoom. Sin eso el nodo salía de otro sitio, y como cada FLIP arranca de
  // donde el anterior lo dejó en vuelo, avanzar pasos seguidos acumulaba el
  // error hasta mandar las casillas a decenas de miles de píxeles (visto por
  // la prueba de humo, 2026-10-04).
  function animarFlip(contenedor, aplicarCambio, { duracionMs = 400, easing = 'ease-in-out' } = {}) {
    const posicionesPrevias = new Map();
    for (const el of contenedor.querySelectorAll('[data-clave]')) {
      posicionesPrevias.set(el.dataset.clave, el.getBoundingClientRect());
    }

    aplicarCambio();

    if (prefiereMovimientoReducido()) return;

    for (const el of contenedor.querySelectorAll('[data-clave]')) {
      const previa = posicionesPrevias.get(el.dataset.clave);
      if (!previa) continue;
      const actual = el.getBoundingClientRect();
      const zoom = zoomEfectivo(el);
      const deltaX = (previa.left - actual.left) / zoom;
      const deltaY = (previa.top - actual.top) / zoom;
      if (deltaX === 0 && deltaY === 0) continue;
      reemplazarAnimacion(el, [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: duracionMs, easing });
    }
  }

  function animarCambioEstado(el, { duracionMs = 400, easing = 'ease-in-out' } = {}) {
    if (prefiereMovimientoReducido()) return;
    reemplazarAnimacion(el, [{ opacity: .4 }, { opacity: 1 }], { duration: duracionMs, easing });
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.animacion = { prefiereMovimientoReducido, reemplazarAnimacion, animarFlip, animarCambioEstado, zoomEfectivo };
})();
