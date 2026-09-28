(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const externa = window.CC2.dominio.externa;

  // Búsqueda binaria externa (CLAUDE.md 5.11). El archivo es el mismo de
  // secuencial externa —ordenado, denso y con la forma que da `N`—; lo que
  // cambia es **el orden en que se leen los bloques**: en vez de recorrerlos de
  // izquierda a derecha, se parte el rango de bloques por la mitad.
  //
  // Las reglas, del usuario (2026-09-27):
  //
  //   · Del bloque del medio se compara **solo su último registro**, como en
  //     secuencial externa. Mayor → el bloque y los anteriores se descartan.
  //     Menor → la clave está en ese bloque o antes, así que el bloque **se
  //     queda en el rango** (`fin = medio`). Igual → encontrada.
  //   · El medio se trunca: `⌊(inicio + fin) / 2⌋`, como en binaria interna.
  //   · Cuando queda un solo bloque, se busca dentro de él **también en
  //     binaria**, sobre sus renglones.
  //   · El rango son **solo los bloques con claves**: partir por la mitad
  //     entre bloques vacíos no enseña nada. Secuencial externa hace lo mismo.
  //
  // Los accesos se cuentan por bloque leído, como en secuencial externa
  // (pendiente de confirmar con el docente). El caso nuevo es que **el bloque
  // que queda no siempre es el último que se leyó**: buscando 22 en el
  // ejemplo se leen B3, B2 y B1 y el rango se cierra en B2; buscando 67 se
  // cierra en B5, que nunca se leyó. En memoria solo está el último bloque
  // leído, así que el que queda **cuesta otro acceso salvo que sea ése**
  // (recomendación aceptada por el usuario, 2026-09-27). El panel lo dice —ya
  // leído, se lee, se relee— para que el acceso no se cuente a escondidas.

  const cabecera = (objetivo) => ({ etiqueta: 'Clave buscada', expresion: '', resultado: String(objetivo) });

  const BLOQUES = ['bloque', 'bloques'];
  const RENGLONES = ['renglón', 'renglones'];

  function seDescartan([singular, plural], desde, hasta) {
    return desde === hasta
      ? `se descarta el ${singular} ${desde}`
      : `se descartan los ${plural} ${desde} a ${hasta}`;
  }

  // Los bloques con datos que quedan fuera del rango vigente: los que el
  // dibujo apaga enteros.
  function fueraDelRango(inicio, fin, total) {
    const fuera = [];
    for (let bloque = 1; bloque <= total; bloque++) {
      if (bloque < inicio || bloque > fin) fuera.push(bloque);
    }
    return fuera;
  }

  function buscarBinariaExterna({ claves, n, objetivo }) {
    const forma = externa.formaDelArchivo(n);
    const pasos = [];
    let comparaciones = 0;
    let accesos = 0;

    const ocupados = claves.length;
    if (ocupados === 0) {
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, {
        comparaciones,
        accesos,
        mensaje: 'El archivo está vacío: no hay ningún bloque que leer.'
      }));
      return pasos;
    }

    const total = externa.bloqueDe(forma, ocupados);
    // El último bloque con datos puede estar a medio llenar: su "último
    // registro" es el último **ocupado**, no el último que cabría.
    const ultimoOcupadoDe = (bloque) => Math.min(externa.rangoDelBloque(forma, bloque).ultimo, ocupados);

    // Los bloques leídos, en orden. El último es el que está en memoria, y la
    // vista usa los más recientes para no esconderlos al elidir.
    const leidos = [];
    let inicio = 1;
    let fin = total;

    // Primera fase: por bloques, contra el último registro del medio.
    while (inicio < fin) {
      const medio = Math.floor((inicio + fin) / 2);
      const bloquesDescartados = fueraDelRango(inicio, fin, total);
      accesos++;
      comparaciones++;
      leidos.push(medio);

      const registro = ultimoOcupadoDe(medio);
      const ultimaClave = claves[registro - 1];
      const lineas = [
        cabecera(objetivo),
        { etiqueta: 'Rango', expresion: `B${inicio} … B${fin}`, resultado: '' },
        { etiqueta: 'Medio', expresion: `⌊(${inicio} + ${fin}) / 2⌋ · acceso ${accesos}`, resultado: `B${medio}` }
      ];
      const comun = {
        bloque: medio,
        casilla: registro,
        // El rango vigente al comparar, antes de estrecharlo —como en binaria
        // interna—. La vista no deja que la elisión esconda sus extremos.
        rangoBloques: { inicio, fin },
        bloquesDescartados,
        bloquesLeidos: leidos.slice(),
        comparaciones,
        accesos,
        tituloCalculo: 'Búsqueda por bloques'
      };

      if (objetivo === ultimaClave) {
        lineas.push({ etiqueta: 'Último registro', expresion: `${objetivo} = ${ultimaClave}`, resultado: 'encontrada' });
        pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun, {
          calculo: lineas,
          mensaje: `Clave encontrada en el bloque ${medio}.`
        })));
        return pasos;
      }

      if (objetivo > ultimaClave) {
        lineas.push({ etiqueta: 'Último registro', expresion: `${objetivo} > ${ultimaClave}`, resultado: `inicio = ${medio + 1}` });
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun, {
          calculo: lineas,
          mensaje: `${objetivo} es mayor que ${ultimaClave}, el último registro del bloque ${medio}: `
            + `${seDescartan(BLOQUES, inicio, medio)}.`
        })));
        inicio = medio + 1;
        continue;
      }

      // Con el medio truncado y `inicio < fin`, `medio < fin`: quedarse con el
      // bloque siempre descarta al menos uno por la derecha.
      lineas.push({ etiqueta: 'Último registro', expresion: `${objetivo} < ${ultimaClave}`, resultado: `fin = ${medio}` });
      pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun, {
        calculo: lineas,
        mensaje: `${objetivo} es menor que ${ultimaClave}, el último registro del bloque ${medio}: `
          + `si la clave está, está en el bloque ${medio} o antes; ${seDescartan(BLOQUES, medio + 1, fin)}.`
      })));
      fin = medio;
    }

    // Queda un solo bloque. Si no es el que está en memoria, hay que leerlo.
    const bloque = inicio;
    const bloquesDescartados = fueraDelRango(bloque, bloque, total);
    const enMemoria = leidos[leidos.length - 1];
    let lectura = 'ya leído';
    let entrada = `Queda un solo bloque, el ${bloque}, y es el que se acaba de leer. `;
    if (enMemoria !== bloque) {
      const releido = leidos.includes(bloque);
      accesos++;
      lectura = `${releido ? 'se relee' : 'se lee'} · acceso ${accesos}`;
      entrada = releido
        ? `Queda un solo bloque, el ${bloque}, y hay que volver a leerlo: el último leído fue el ${enMemoria}. `
        : `Queda un solo bloque, el ${bloque}, y hay que leerlo. `;
      leidos.push(bloque);
    }

    // Segunda fase: binaria sobre los renglones del bloque.
    const rango = externa.rangoDelBloque(forma, bloque);
    let bajo = 1;
    let alto = ultimoOcupadoDe(bloque) - rango.primero + 1;
    const lineaDelBloque = { etiqueta: 'Bloque', expresion: lectura, resultado: `B${bloque}` };
    const tituloCalculo = `Dentro del bloque B${bloque}`;

    while (bajo <= alto) {
      const medio = Math.floor((bajo + alto) / 2);
      const registro = rango.primero + medio - 1;
      const clave = claves[registro - 1];
      comparaciones++;

      const lineas = [
        cabecera(objetivo),
        lineaDelBloque,
        { etiqueta: 'Renglones', expresion: `${bajo} … ${alto}`, resultado: '' },
        { etiqueta: 'Medio', expresion: `⌊(${bajo} + ${alto}) / 2⌋`, resultado: String(medio) }
      ];
      const comun = {
        bloque,
        casilla: registro,
        rangoRegistros: { inicio: rango.primero + bajo - 1, fin: rango.primero + alto - 1 },
        bloquesDescartados,
        bloquesLeidos: leidos.slice(),
        comparaciones,
        accesos,
        tituloCalculo
      };

      if (clave === objetivo) {
        lineas.push({ etiqueta: `Renglón ${medio}`, expresion: `${objetivo} = ${clave}`, resultado: 'encontrada' });
        pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun, {
          calculo: lineas,
          mensaje: `Clave encontrada en el bloque ${bloque}.`
        })));
        return pasos;
      }

      if (objetivo < clave) {
        lineas.push({ etiqueta: `Renglón ${medio}`, expresion: `${objetivo} < ${clave}`, resultado: `fin = ${medio - 1}` });
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun, {
          calculo: lineas,
          mensaje: `${entrada}Renglón ${medio}: ${objetivo} es menor que ${clave}; `
            + `${seDescartan(RENGLONES, medio, alto)}.`
        })));
        alto = medio - 1;
      } else {
        lineas.push({ etiqueta: `Renglón ${medio}`, expresion: `${objetivo} > ${clave}`, resultado: `inicio = ${medio + 1}` });
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun, {
          calculo: lineas,
          mensaje: `${entrada}Renglón ${medio}: ${objetivo} es mayor que ${clave}; `
            + `${seDescartan(RENGLONES, bajo, medio)}.`
        })));
        bajo = medio + 1;
      }
      entrada = '';
    }

    // El archivo está ordenado: si no está en el único bloque que podía
    // contenerla, no está en ningún otro.
    pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, {
      bloque,
      bloquesDescartados,
      bloquesLeidos: leidos.slice(),
      comparaciones,
      accesos,
      tituloCalculo,
      calculo: [
        cabecera(objetivo),
        lineaDelBloque,
        { etiqueta: 'No está', expresion: `${accesos} accesos a bloque`, resultado: '—' }
      ],
      mensaje: `La clave no está en el bloque ${bloque}, y por el orden del archivo no puede estar en otro: ${accesos} accesos a bloque.`
    }));
    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.binariaExterna = { buscarBinariaExterna };
})();
