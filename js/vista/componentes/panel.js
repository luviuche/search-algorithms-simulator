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

  // `tipo` es la gravedad —info, advertencia, error, o `tramite` para un paso
  // que no es noticia— y pinta el borde y el ícono. `icono` es el nombre de un
  // ícono de iconos.js —el tipo de paso, cuando el aviso narra uno—; sin él,
  // el de la gravedad. `rotulo` va encima del mensaje: «Paso 3 de 5».
  function crearAlerta({ tipo = 'info', icono, rotulo, mensaje }) {
    const iconos = window.CC2.vista.componentes.iconos;
    const el = document.createElement('div');
    el.className = `alerta alerta--${tipo}`;
    const iconoEl = document.createElement('span');
    iconoEl.className = 'alerta__icono';
    iconoEl.appendChild(iconos.crearIcono(iconos.existe(icono) ? icono : tipo));
    const cuerpo = document.createElement('span');
    cuerpo.className = 'alerta__cuerpo';
    if (rotulo) {
      const rotuloEl = document.createElement('span');
      rotuloEl.className = 'alerta__rotulo';
      rotuloEl.textContent = rotulo;
      cuerpo.appendChild(rotuloEl);
    }
    const mensajeEl = document.createElement('span');
    mensajeEl.className = 'alerta__mensaje texto-nivel-4';
    mensajeEl.textContent = mensaje;
    cuerpo.appendChild(mensajeEl);
    el.append(iconoEl, cuerpo);
    return el;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.panel = { crearPanel, crearMetrica, crearAlerta };
})();
