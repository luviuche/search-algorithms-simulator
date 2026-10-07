(function () {
  // **La única lista de scripts de la aplicación** (CLAUDE.md 4). Antes vivía
  // copiada en cuatro sitios —index.html, pruebas/humo.html,
  // pruebas/captura.html y pruebas/apoyo.js— y olvidar uno al agregar un
  // archivo era el tropiezo de siempre. Ahora un archivo nuevo se agrega aquí
  // y nada más.
  //
  // Rutas relativas a `js/`, en orden de dependencia: cada archivo cuelga sus
  // símbolos de `window.CC2` y puede leer al cargarse los de los anteriores.
  // `app.js` no está: es el punto de entrada, y cada página lo carga por su
  // cuenta después de este manifiesto —captura.html mete un script suyo justo
  // antes de él—.
  //
  // Dos grupos, porque las pruebas de Node solo pueden cargar el primero:
  //
  //   PUROS     — cálculo sin DOM: dominio, algoritmos, el formato del archivo
  //               y la elisión. pruebas/apoyo.js los requiere tal cual.
  //   PANTALLA  — lo que toca el DOM o el almacenamiento del navegador.
  const PUROS = [
    'dominio/limites.js',
    'dominio/clave.js',
    'dominio/estructura.js',
    'dominio/arbol.js',
    'dominio/arbol-multiple.js',
    'dominio/cubetas.js',
    'dominio/externa.js',
    'dominio/huffman.js',
    'dominio/indices.js',

    'algoritmos/traza.js',
    'algoritmos/secuencial.js',
    'algoritmos/binaria.js',
    'algoritmos/arbol-digital.js',
    'algoritmos/residuos.js',
    'algoritmos/residuos-multiples.js',
    'algoritmos/eliminacion.js',
    'algoritmos/colisiones/reasignacion.js',
    'algoritmos/colisiones/anidados.js',
    'algoritmos/colisiones/encadenamiento.js',
    'algoritmos/hash/comun.js',
    'algoritmos/hash/modulo.js',
    'algoritmos/hash/cuadrado.js',
    'algoritmos/hash/truncamiento.js',
    'algoritmos/hash/plegamiento.js',
    'algoritmos/hash/bases.js',
    'algoritmos/hash/operaciones.js',
    'algoritmos/cubetas.js',
    'algoritmos/secuencial-externa.js',
    'algoritmos/binaria-externa.js',
    'algoritmos/huffman.js',
    'algoritmos/indices.js',

    // Serializar y validar son cálculo puro; guardar y leer usan el navegador
    // solo cuando se llaman, no al cargarse.
    'persistencia/archivo.js',
    // Vive en vista/ pero no toca el DOM.
    'vista/elision.js'
  ];

  const PANTALLA = [
    'persistencia/recientes.js',
    'vista/componentes/casilla.js',
    'vista/componentes/iconos.js',
    'vista/componentes/panel.js',
    'vista/componentes/bitacora.js',
    'vista/componentes/calculo.js',
    'vista/reproductor.js',
    'vista/animacion.js',
    'vista/pantallas/menu.js',
    'vista/dibujos/comun.js',
    'vista/dibujos/fila.js',
    'vista/dibujos/apilado.js',
    'vista/dibujos/arbol.js',
    'vista/dibujos/bloques.js',
    'vista/dibujos/indices.js',
    'vista/dibujos/bosque.js',
    'vista/pantallas/tema-busqueda.js'
  ];

  // Desde Node (pruebas/apoyo.js): solo la lista.
  if (typeof module === 'object' && module.exports) {
    module.exports = { PUROS, PANTALLA };
    return;
  }

  // En el navegador: escribe un <script> por archivo, en el sitio de este. Es
  // `document.write` a propósito: los scripts escritos así mientras se lee la
  // página se cargan y se ejecutan en orden, uno tras otro y antes de lo que
  // sigue —app.js incluido—, exactamente como si estuvieran escritos a mano.
  // Insertarlos con `appendChild` los volvería asíncronos, y los módulos ES
  // no sirven: file:// los bloquea.
  //
  // La carpeta sale de la ruta de este mismo archivo, así que funciona igual
  // desde index.html (`js/`) que desde pruebas/ (`../js/`).
  const base = document.currentScript.src.replace(/manifiesto\.js(?:[?#].*)?$/, '');
  for (const ruta of PUROS.concat(PANTALLA)) {
    document.write(`<script src="${base}${ruta}"><\/script>`);
  }
})();
