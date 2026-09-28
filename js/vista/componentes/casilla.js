(function () {
  // Identidad estable por clave, no por índice (CLAUDE.md 7): es lo que permite
  // que el reordenamiento anime un movimiento y no un redibujado completo.
  function crearCasilla({ clave, indice, estado, modificadores }) {
    const el = document.createElement('div');
    el.dataset.clave = clave === null || clave === undefined ? `vacia-${indice}` : String(clave);
    el.dataset.indice = String(indice);
    el.textContent = clave === null || clave === undefined ? '' : String(clave);
    aplicarEstado(el, estado, modificadores);
    return el;
  }

  // El estado pinta la casilla; los modificadores marcan pertenencias que son
  // independientes del color —el rastro de los sondeos, la dirección de la
  // que salió la clave— y que por eso no pueden ser un estado más
  // (CLAUDE.md 8.1).
  function aplicarEstado(el, estado, modificadores) {
    const clases = [`casilla`, `casilla--${estado}`];
    for (const modificador of modificadores || []) clases.push(`casilla--${modificador}`);
    el.className = clases.join(' ');
  }

  // Ancho que necesita una casilla para mostrar una clave de `cifras` cifras
  // sin cambiar de tamaño. Todas las casillas de la estructura usan este
  // ancho, ocupadas o no: es lo que conserva la forma de la cuadrícula.
  //
  // Se **mide** sobre el DOM en lugar de calcularse con `ch` porque el mismo
  // ancho lo usan las pistas del grid de las filas, y allí `ch` resolvería
  // contra la fuente de la fila —proporcional— y no contra la monoespaciada
  // de la casilla: las columnas quedarían de otro tamaño que las casillas que
  // llevan dentro. Medido, el ancho sale con su relleno, su borde y la fuente
  // que de verdad esté cargada.
  //
  // La sonda reserva a la derecha del número el sitio de una marca de estado
  // (◂, ✓, ✕). Las marcas ya no ocupan ese sitio —van en la esquina y fuera
  // del flujo (2026-09-24)—, pero sin él la última cifra quedaría debajo de
  // la marca: el hueco es lo que deja la esquina libre. Y es el mismo ancho de
  // antes, así que ninguna fila cambia de medida.
  const anchosMedidos = new Map();

  function anchoParaCifras(cifras) {
    const digitos = Math.max(1, Number(cifras) || 1);
    if (anchosMedidos.has(digitos)) return anchosMedidos.get(digitos);

    const sonda = document.createElement('div');
    sonda.className = 'casilla casilla--ocupada';
    sonda.textContent = '0'.repeat(digitos);
    const reserva = document.createElement('span');
    reserva.textContent = '✕';
    reserva.style.cssText = 'margin-left:var(--espacio-1);font-size:12px;font-weight:600;';
    sonda.appendChild(reserva);
    // Ancho automático: la sonda mide lo que la casilla *necesita*, no lo
    // que el token dice que mide hoy.
    sonda.style.cssText = 'position:absolute;visibility:hidden;width:auto;';
    document.body.appendChild(sonda);
    const ancho = Math.ceil(sonda.getBoundingClientRect().width);
    sonda.remove();

    anchosMedidos.set(digitos, ancho);
    return ancho;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.casilla = { crearCasilla, aplicarEstado, anchoParaCifras };
})();
