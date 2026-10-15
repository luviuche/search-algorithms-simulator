(function () {
  // **La hora abre cada operación** (2026-10-14): la lleva la primera línea
  // que la operación deja (`entrada.abre`), y los pasos que le siguen van sin
  // ella. Hasta entonces se escribía cada vez que cambiaba el segundo, y al
  // reproducir paso a paso caía a mitad de una operación sin marcar nada. El
  // hueco se conserva —la columna no se encoge— para que los mensajes sigan
  // alineados. Y no se repite: si la última hora escrita es la misma —doce
  // inserciones seguidas en el mismo segundo—, la operación va sin ella.
  function crearFilaBitacora(entrada, ultimaHora) {
    const el = document.createElement('div');
    el.className = 'bitacora__fila';
    const hora = document.createElement('span');
    hora.className = 'bitacora__hora';
    const abre = entrada.abre !== false && entrada.hora !== ultimaHora;
    hora.textContent = abre ? entrada.hora : '';
    // El lector de pantalla sí la oye siempre: la repetición estorba a la
    // vista, que abarca varios renglones de un golpe, no al oído.
    if (!abre) hora.setAttribute('aria-label', entrada.hora);
    const mensaje = document.createElement('span');
    mensaje.textContent = entrada.mensaje;
    el.append(hora, mensaje);
    return el;
  }

  function crearBitacora() {
    const el = document.createElement('div');
    el.className = 'bitacora';
    return el;
  }

  function agregarEntrada(bitacoraEl, entrada) {
    const fila = crearFilaBitacora(entrada, bitacoraEl.dataset.ultimaHora);
    fila.dataset.hora = entrada.hora;
    if (fila.firstElementChild.textContent) bitacoraEl.dataset.ultimaHora = entrada.hora;
    bitacoraEl.appendChild(fila);
    bitacoraEl.scrollTop = bitacoraEl.scrollHeight;
  }

  // Reiniciar la estructura vacía también su historia: lo que la bitácora
  // cuenta es lo que se le hizo a la estructura que hay en pantalla.
  function vaciar(bitacoraEl) {
    bitacoraEl.innerHTML = '';
    delete bitacoraEl.dataset.ultimaHora;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.bitacora = { crearBitacora, crearFilaBitacora, agregarEntrada, vaciar };
})();
