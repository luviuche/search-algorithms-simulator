(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const externa = window.CC2.dominio.externa;

  // Búsqueda secuencial externa (CLAUDE.md 5.x). El archivo es el mismo
  // arreglo ordenado y denso de secuencial interna; lo que cambia es que no se
  // lee registro por registro sino **bloque por bloque**: se compara la clave
  // contra el último registro de cada bloque —lo único que hay que leer para
  // descartarlo entero— y solo se recorre por dentro el bloque que sí puede
  // contenerla.
  //
  // Dos decisiones de conteo, las dos visibles en las métricas:
  //
  //   accesos       — uno por bloque leído. Comparar contra su último registro
  //                   *es* la lectura del bloque, así que recorrerlo por
  //                   dentro no suma otro (supuesto del usuario, 2026-09-11,
  //                   pendiente de confirmar con el docente). Es el número que
  //                   este tema existe para enseñar: leer un bloque cuesta, y
  //                   por eso conviene que haya √N y no N.
  //   comparaciones — todas: la del último registro de cada bloque y las de
  //                   los registros que se miran dentro.
  //
  // Dentro del bloque se recorre entero, sin cortar al pasarse, igual que la
  // secuencial interna (`secuencial.js`), que tampoco aprovecha el orden.

  // Las líneas del panel del cálculo (CLAUDE.md 6.5). En los temas hash ese
  // panel desarrolla la dirección; aquí desarrolla **la comparación en curso**,
  // que es la cuenta que este algoritmo hace: contra qué registro se compara,
  // de qué bloque, y qué se concluye. Las dos primeras líneas son el
  // encabezado y no cambian dentro de un bloque; la tercera es el paso.
  function lineasDeComparacion({ objetivo, bloque, accesos, cierre }) {
    return [
      { etiqueta: 'Clave buscada', expresion: '', resultado: String(objetivo) },
      { etiqueta: 'Bloque', expresion: `acceso ${accesos}`, resultado: `B${bloque}` },
      cierre
    ];
  }

  function buscarSecuencialExterna({ claves, n, objetivo }) {
    const forma = externa.formaDelArchivo(n);
    const pasos = [];
    let comparaciones = 0;
    let accesos = 0;

    // El archivo es denso: las claves ocupan el prefijo, así que la cantidad
    // dice hasta qué registro —y hasta qué bloque— hay algo que leer.
    const ocupados = claves.length;
    if (ocupados === 0) {
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, {
        comparaciones,
        accesos,
        mensaje: 'El archivo está vacío: no hay ningún bloque que leer.'
      }));
      return pasos;
    }

    const ultimoBloqueConDatos = externa.bloqueDe(forma, ocupados);
    const descartados = [];

    for (let bloque = 1; bloque <= ultimoBloqueConDatos; bloque++) {
      const rango = externa.rangoDelBloque(forma, bloque);
      // El último bloque con datos puede estar a medio llenar: su "último
      // registro" es el último **ocupado**, no el último que cabría.
      const ultimoRegistro = Math.min(rango.ultimo, ocupados);
      const ultimaClave = claves[ultimoRegistro - 1];

      accesos++;
      comparaciones++;

      if (objetivo > ultimaClave) {
        descartados.push(bloque);
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, {
          bloque,
          casilla: ultimoRegistro,
          bloquesDescartados: descartados.slice(),
          comparaciones,
          accesos,
          calculo: lineasDeComparacion({
            objetivo,
            bloque,
            accesos,
            cierre: {
              etiqueta: 'Último registro',
              expresion: `${objetivo} > ${ultimaClave}`,
              resultado: 'se descarta'
            }
          }),
          mensaje: `${objetivo} es mayor que ${ultimaClave}, el último registro del bloque ${bloque}: el bloque se descarta entero.`
        }));
        continue;
      }

      pasos.push(crearPaso(TIPOS_PASO.COMPARACION, {
        bloque,
        casilla: ultimoRegistro,
        bloquesDescartados: descartados.slice(),
        comparaciones,
        accesos,
        calculo: lineasDeComparacion({
          objetivo,
          bloque,
          accesos,
          cierre: {
            etiqueta: 'Último registro',
            expresion: `${objetivo} ≤ ${ultimaClave}`,
            resultado: 'puede estar'
          }
        }),
        mensaje: `${objetivo} no supera a ${ultimaClave}, el último registro del bloque ${bloque}: si la clave está, está en este bloque.`
      }));

      const recorridas = [];
      for (let registro = rango.primero; registro <= ultimoRegistro; registro++) {
        comparaciones++;
        const renglon = registro - rango.primero + 1;

        if (claves[registro - 1] === objetivo) {
          pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, {
            bloque,
            casilla: registro,
            recorridas: recorridas.slice(),
            bloquesDescartados: descartados.slice(),
            comparaciones,
            accesos,
            calculo: lineasDeComparacion({
              objetivo,
              bloque,
              accesos,
              cierre: { etiqueta: 'Encontrada', expresion: 'en el bloque', resultado: `B${bloque}` }
            }),
            mensaje: `Clave localizada en el bloque ${bloque}.`
          }));
          return pasos;
        }

        recorridas.push(registro);
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, {
          bloque,
          casilla: registro,
          recorridas: recorridas.slice(),
          bloquesDescartados: descartados.slice(),
          comparaciones,
          accesos,
          calculo: lineasDeComparacion({
            objetivo,
            bloque,
            accesos,
            cierre: {
              etiqueta: `Renglón ${renglon}`,
              expresion: `${objetivo} ≠ ${claves[registro - 1]}`,
              resultado: 'sigue'
            }
          }),
          mensaje: `Se compara con el renglón ${renglon} del bloque ${bloque}.`
        }));
      }

      // El archivo está ordenado: si no está en el bloque que le correspondía,
      // no puede estar en ningún otro. Leer los bloques siguientes sería
      // gastar accesos para nada, y decirlo es parte de lo que el tema enseña.
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, {
        bloque,
        bloquesDescartados: descartados.slice(),
        comparaciones,
        accesos,
        calculo: lineasDeComparacion({
          objetivo,
          bloque,
          accesos,
          cierre: { etiqueta: 'No está', expresion: `${accesos} accesos a bloque`, resultado: '—' }
        }),
        mensaje: `Clave no localizada en el bloque ${bloque}, y por el orden del archivo no puede estar en otro, tras ${accesos} accesos a bloque.`
      }));
      return pasos;
    }

    pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, {
      bloquesDescartados: descartados.slice(),
      comparaciones,
      accesos,
      mensaje: `Clave no localizada: ${objetivo} supera al último registro del archivo, tras ${accesos} accesos a bloque.`
    }));
    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.secuencialExterna = { buscarSecuencialExterna };
})();
