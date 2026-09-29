(function () {
  function crearPanel({ titulo, contenido }) {
    const el = document.createElement('section');
    el.className = 'panel';
    if (titulo) {
      const tituloEl = document.createElement('h2');
      tituloEl.className = 'panel__titulo texto-nivel-2';
      tituloEl.textContent = titulo;
      el.appendChild(tituloEl);
    }
    if (contenido) el.appendChild(contenido);
    return el;
  }

  // El rótulo va en versalitas, y por eso **el símbolo va aparte**
  // (`formula`): pasado a mayúsculas, «⌈log₂ n⌉» se leía «⌈LOG₂ N⌉» y
  // «Cubetas (n)» se leía «CUBETAS (N)», y aquí `N` y `n` no son lo mismo —en
  // las búsquedas externas `N` son los registros del archivo— (2026-09-27).
  function crearMetrica({ etiqueta, formula, valor, ancha = false }) {
    const el = document.createElement('div');
    // Con fórmula, el rótulo es largo: ocupa el renglón entero del panel. Sin
    // ella también puede pedirlo una métrica de rótulo largo (`ancha`).
    el.className = 'metrica' + (formula || ancha ? ' metrica--ancha' : '');
    const valorEl = document.createElement('span');
    valorEl.className = 'metrica__valor texto-mono';
    valorEl.textContent = String(valor);
    const etiquetaEl = document.createElement('span');
    etiquetaEl.className = 'texto-nivel-2';
    etiquetaEl.textContent = etiqueta;
    if (formula) {
      const formulaEl = document.createElement('span');
      formulaEl.className = 'metrica__formula';
      formulaEl.textContent = formula;
      etiquetaEl.append(' ', formulaEl);
    }
    el.append(valorEl, etiquetaEl);
    return el;
  }

  function crearAlerta({ tipo = 'info', icono, mensaje }) {
    const el = document.createElement('div');
    el.className = `alerta alerta--${tipo}`;
    const iconoEl = document.createElement('span');
    iconoEl.className = 'alerta__icono';
    iconoEl.setAttribute('aria-hidden', 'true');
    iconoEl.textContent = icono || '!';
    const mensajeEl = document.createElement('span');
    mensajeEl.className = 'texto-nivel-4';
    mensajeEl.textContent = mensaje;
    el.append(iconoEl, mensajeEl);
    return el;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.panel = { crearPanel, crearMetrica, crearAlerta };
})();
