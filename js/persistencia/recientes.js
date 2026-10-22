(function () {
  const CLAVE_ALMACENAMIENTO = 'cc2:recientes';
  const MAXIMO = 5;

  // **Una reciente se abre como la dejó el estudiante** (pedido del usuario,
  // 2026-10-21). Hasta entonces guardaba solo el tema y un resumen —un
  // recordatorio—; ahora lleva también `datos`, lo mismo que se escribiría en
  // el archivo .cc2 (`persistencia.archivo.serializar`), y la pantalla la
  // actualiza tras cada operación. Abrirla es abrir ese archivo en su tema.
  //
  // `tema` es la clave del tema en el catálogo, con la que el menú lo
  // encuentra; `temaTitulo`, lo que se lee en la pastilla. `id` la distingue
  // de otra del mismo tema con los mismos datos de creación, que ya no son la
  // misma estructura si tienen claves distintas.
  //
  // Las guardadas antes no traen `datos` ni `tema`: no hay nada que abrir, y
  // se descartan al leer en vez de mostrar una pastilla que no responde.
  function normalizar(item) {
    if (!item || !item.datos || !item.tema || !item.id) return null;
    return {
      id: item.id,
      fecha: item.fecha,
      tema: item.tema,
      temaTitulo: item.temaTitulo,
      detalle: item.detalle,
      datos: item.datos
    };
  }

  // No es la copia real (CLAUDE.md 10.4): si el navegador borra datos de
  // navegación, esta lista desaparece; el archivo .cc2 es la copia real.
  function obtener() {
    try {
      const crudo = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
      return crudo ? JSON.parse(crudo).map(normalizar).filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function escribir(lista) {
    const recortada = lista.slice(0, MAXIMO);
    try {
      window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(recortada));
    } catch (error) {
      // Almacenamiento no disponible: se degrada a sesión sin recientes.
    }
    return recortada;
  }

  function nuevoId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const mismasClaves = (a, b) => JSON.stringify(a.datos.claves) === JSON.stringify(b.datos.claves);

  // Una estructura recién creada o abierta. Crear dos veces la misma —mismo
  // tema, mismos datos, mismas claves— no llena la lista con la misma línea
  // repetida; con otras claves es otra estructura, y no pisa el trabajo de la
  // anterior. Devuelve el id con que la pantalla la irá actualizando.
  function registrar(entrada) {
    const id = nuevoId();
    const lista = obtener().filter(
      (item) => item.tema !== entrada.tema || item.detalle !== entrada.detalle || !mismasClaves(item, entrada)
    );
    lista.unshift(Object.assign({}, entrada, { id, fecha: new Date().toISOString() }));
    escribir(lista);
    return id;
  }

  // Lo que la estructura tiene ahora. Pasa al frente: es la última que se
  // tocó. Si ya había salido de la lista —se crearon otras cinco en otra
  // pestaña—, vuelve a entrar con el mismo id.
  function actualizar(id, entrada) {
    const lista = obtener().filter((item) => item.id !== id);
    lista.unshift(Object.assign({}, entrada, { id, fecha: new Date().toISOString() }));
    escribir(lista);
  }

  window.CC2 = window.CC2 || {};
  window.CC2.persistencia = window.CC2.persistencia || {};
  window.CC2.persistencia.recientes = { obtener, registrar, actualizar, MAXIMO };
})();
