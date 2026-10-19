(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const { recorrerAnidado } = window.CC2.algoritmos.colisiones.anidados;
  const dominioCubetas = window.CC2.dominio.cubetas;
  const estructuras = window.CC2.dominio.estructura;

  // Otras búsquedas dinámicas (CLAUDE.md 5.x): una cubeta con `r` renglones es
  // la misma forma que ya usa el tratamiento de arreglos anidados —el primer
  // renglón vive en `estructura.claves[dirección - 1]` y los `r - 1`
  // restantes en `estructura.anidados[dirección - 1]`—, así que insertar,
  // buscar y colocar reutilizan el dominio existente sin tocarlo. Lo único
  // que este archivo aporta es lo que ningún otro tema necesita: que `n`
  // cambie con el tiempo.

  // Las cubetas se numeran desde 0 en todo lo que ve el estudiante —la
  // matriz, el cálculo, la bitácora, el aviso— (pedido del usuario,
  // 2026-09-06): así las dibuja el docente y así calcula `H(k) = k mod n`.
  // Por dentro siguen siendo base 1, como toda casilla del proyecto
  // (CLAUDE.md 3.1): `mostrar` es el único punto de conversión, igual que la
  // conversión de índice de arreglo a casilla ya vive en un solo sitio.
  const mostrar = (indiceInterno) => indiceInterno - 1;

  // El cálculo de una cubeta es más corto que el de un hash normal: el
  // docente no cierra con un "+ 1" —el residuo *es* la dirección, porque las
  // cubetas cuentan desde 0—, así que no se reutiliza `hash/modulo.js` (que sí
  // cierra en base 1) ni `pasosDelCalculo` (que toma el texto de la última
  // línea como el índice a usar, y aquí el texto que se muestra —base 0— no
  // es el índice que hace falta para indexar `estructura.claves` —base 1—).
  function calculoCubeta(clave, n) {
    const residuo = clave % n;
    return {
      // Índice real, base 1: el que usa el dominio para `claves[direccion - 1]`.
      direccion: residuo + 1,
      calculo: [
        { etiqueta: 'Clave', expresion: '', resultado: String(clave) },
        { etiqueta: 'Dirección', expresion: `${clave} mod ${n}`, resultado: String(residuo) }
      ]
    };
  }

  // Revela el cálculo línea por línea, igual que `pasosDelCalculo` en
  // `hash/operaciones.js`, pero sin derivar el índice del texto: aquí el
  // texto de la última línea es la cubeta en base 0, y `direccionInterna` —ya
  // calculada aparte— es la que de verdad indexa la estructura.
  function pasosDelCalculoCubeta(calculo, direccionInterna, contadores) {
    const pasos = [];
    for (let i = 0; i < calculo.length; i++) {
      const linea = calculo[i];
      const esUltima = i === calculo.length - 1;
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        calculo: calculo.slice(0, i + 1),
        direccion: esUltima ? direccionInterna : undefined,
        casilla: esUltima ? direccionInterna : undefined,
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: esUltima
          ? `Dirección obtenida: cubeta ${linea.resultado}.`
          : `Cálculo de la dirección para la clave ${linea.resultado}.`
      }));
    }
    return pasos;
  }

  // Coloca cada clave de `orden`, en ese orden, en una tabla de `n` cubetas
  // de `r` renglones, sin tocar la estructura real —es una simulación de
  // bolsillo, igual que la redispersión al eliminar en `hash/operaciones.js`—.
  // La que cae en una cubeta llena queda en su Col, como en una inserción
  // cualquiera (pedido del usuario, 2026-10-14): `n` lo decide la densidad, no
  // que todo quepa en los renglones.
  function colocarTodo(orden, n, r) {
    const claves = new Array(n);
    const anidados = new Array(n).fill(null).map(() => []);
    const desbordes = new Array(n).fill(null).map(() => []);
    const sitio = new Map();
    for (const vivo of orden) {
      const direccion = (vivo % n) + 1;
      if (claves[direccion - 1] === undefined) {
        claves[direccion - 1] = vivo;
        sitio.set(vivo, { direccion });
        continue;
      }
      const anidado = anidados[direccion - 1];
      const libre = [...Array(r - 1).keys()].find((posicion) => anidado[posicion] === undefined);
      if (libre !== undefined) {
        anidado[libre] = vivo;
        sitio.set(vivo, { direccion, posicion: libre + 1 });
        continue;
      }
      desbordes[direccion - 1].push(vivo);
      sitio.set(vivo, { direccion, col: desbordes[direccion - 1].length });
    }
    return sitio;
  }

  // Recoloca cada clave de `orden`, en ese mismo orden, sobre una tabla que
  // acaba de vaciarse a un `n` nuevo: un `calculo` revelado más un paso de
  // inserción por clave, igual que se ve una inserción cualquiera. No hace
  // falta sondear renglón por renglón —la simulación ya sabe dónde cae cada
  // una—, así que aquí no hay pasos de tipo `sondeo`.
  //
  // Cada paso lleva `pendientes`: las claves de `orden` que todavía no se
  // recolocaron. La densidad del panel las suma, para que no se lea «0,0 %»
  // mientras el anuncio dice que la estructura se reduce por un 100 %: la
  // tabla está vacía, pero las claves siguen en el archivo.
  function pasosDeReubicacion({ orden, n, contadores, r }) {
    const sitios = colocarTodo(orden, n, r);
    const pasos = [];
    orden.forEach((vivo, indice) => {
      const { direccion, calculo } = calculoCubeta(vivo, n);
      const pendientes = orden.length - indice;
      for (const paso of pasosDelCalculoCubeta(calculo, direccion, contadores)) {
        pasos.push(Object.assign(paso, { pendientes }));
      }
      const { posicion, col } = sitios.get(vivo);
      contadores.accesos++;
      const comun = {
        calculo,
        direccion,
        casilla: direccion,
        clave: vivo,
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        pendientes: pendientes - 1
      };
      if (col !== undefined) {
        pasos.push(crearPaso(TIPOS_PASO.COLISION, Object.assign(comun, {
          col,
          colision: direccion,
          efecto: { tipo: 'colocar-col', casilla: direccion, clave: vivo },
          mensaje: `La clave ${vivo} cae en la cubeta ${mostrar(direccion)}, que está llena: queda en Col.`
        })));
        return;
      }
      const renglon = posicion === undefined ? 1 : posicion + 1;
      pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun, {
        posicion,
        efecto: { tipo: 'colocar-cubeta', casilla: direccion, posicion, clave: vivo },
        mensaje: `La clave ${vivo} se recoloca en el renglón ${renglon} de la cubeta ${mostrar(direccion)}.`
      })));
    });
    return pasos;
  }

  function pasosDeCambioDeTamano({ tipoPaso, n, orden, r, contadores, mensajeAnuncio }) {
    const pasos = [crearPaso(tipoPaso, {
      n,
      efecto: { tipo: 'redimensionar', n },
      pendientes: orden.length,
      comparaciones: contadores.comparaciones,
      accesos: contadores.accesos,
      mensaje: mensajeAnuncio
    })];
    pasos.push(...pasosDeReubicacion({ orden, n, r, contadores }));
    return pasos;
  }

  // `conservarTamano` lo pide quien abre un archivo (tema-busqueda.js,
  // `colocarSinTraza`): el `n` guardado ya es el resultado, y reinsertar
  // tiene que rehacer la misma tabla. Revisando la densidad, una tabla que
  // una reducción dejó sobre el umbral de expandir —con 82 % y 125 %, 79
  // claves en 32 cubetas: 82,3 %— se reabría expandida (fuzz de Col,
  // 2026-10-18). Sin revisarla, reinsertar en orden de llegada da la misma
  // tabla, Col incluida.
  function insertar({ estructura, clave, conservarTamano = false }) {
    const contadores = { comparaciones: 0, accesos: 0 };
    const r = estructura.parametros.r;
    const { direccion, calculo } = calculoCubeta(clave, estructura.n);
    const pasos = pasosDelCalculoCubeta(calculo, direccion, contadores);
    const comun = () => ({
      calculo, direccion, comparaciones: contadores.comparaciones, accesos: contadores.accesos
    });

    contadores.accesos++;

    if (estructura.claves[direccion - 1] === undefined) {
      pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun(), {
        casilla: direccion,
        clave,
        efecto: { tipo: 'colocar-cubeta', casilla: direccion, clave },
        mensaje: `Clave insertada: ${clave} en el primer renglón de la cubeta ${mostrar(direccion)}.`
      })));
    } else {
      const recorrido = recorrerAnidado({
        anidado: estructura.anidados[direccion - 1] || [],
        tamano: r - 1,
        condicion: (ocupante) => ocupante === undefined
      });

      const recorridas = [];
      for (const visita of recorrido.recorrido) {
        contadores.accesos++;
        if (!visita.detener) {
          recorridas.push(visita.posicion);
          pasos.push(crearPaso(TIPOS_PASO.SONDEO, Object.assign(comun(), {
            casilla: direccion,
            posicion: visita.posicion,
            colision: direccion,
            recorridas: recorridas.slice(),
            mensaje: `Cubeta ${mostrar(direccion)}: el renglón ${visita.posicion + 1} contiene la clave ${visita.clave}; se revisa el siguiente.`
          })));
          continue;
        }
        pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          colision: direccion,
          recorridas: recorridas.slice(),
          clave,
          efecto: { tipo: 'colocar-cubeta', casilla: direccion, posicion: visita.posicion, clave },
          mensaje: `Clave insertada: ${clave} en el renglón ${visita.posicion + 1} de la cubeta ${mostrar(direccion)}.`
        })));
      }

      if (recorrido.agotado) {
        // La clave que choca con una cubeta llena **se guarda en su Col** y
        // ahí se queda, con las que choquen después, hasta que la densidad
        // pida expandir (corrección del usuario, 2026-10-14; así lo hace el
        // docente en el taller). Hasta entonces la colisión expandía por sí
        // sola, y Col solo existía el instante entre chocar y recolocarse.
        const col = estructuras.colDe(estructura, direccion).length + 1;
        pasos.push(crearPaso(TIPOS_PASO.COLISION, Object.assign(comun(), {
          casilla: direccion,
          colision: direccion,
          col,
          recorridas: recorridas.slice(),
          clave,
          efecto: { tipo: 'colocar-col', casilla: direccion, clave },
          mensaje: `Cubeta ${mostrar(direccion)} llena: sus ${r} renglones están ocupados y la clave ${clave} queda en Col.`
        })));
      }
    }

    // Se revisa después de insertar (o de chocar), siempre: la clave que se
    // acaba de procesar cuenta haya entrado en la cubeta o haya quedado en
    // Col. **Solo la densidad expande**: una cubeta llena manda la clave a Col,
    // no a expandir.
    const intentos = estructuras.cantidadClaves(estructura) + 1;
    const densidad = intentos / (estructura.n * r);
    if (!conservarTamano && densidad >= estructura.parametros.umbralExpandir) {
      const { n0, modoExpansion } = estructura.parametros;
      // `clave` no está todavía en `ordenLlegada` —el efecto que la coloca (o
      // el choque que la dejó afuera) sigue sin aplicarse—, así que se agrega
      // a mano para que la reubicación no la olvide, haya entrado o no.
      const orden = (estructura.ordenLlegada || []).concat([clave]);
      const nFinal = dominioCubetas.siguienteN(estructura.n, n0, modoExpansion);
      pasos.push(...pasosDeCambioDeTamano({
        tipoPaso: TIPOS_PASO.EXPANSION,
        n: nFinal,
        orden,
        r,
        contadores,
        mensajeAnuncio: `Densidad de ocupación del ${(densidad * 100).toFixed(1).replace('.', ',')} %: la estructura se expande de n = ${estructura.n} a n = ${nFinal}.`
      }));
    }

    return pasos;
  }

  function buscar({ estructura, objetivo }) {
    const contadores = { comparaciones: 0, accesos: 0 };
    const r = estructura.parametros.r;
    const { direccion, calculo } = calculoCubeta(objetivo, estructura.n);
    const pasos = pasosDelCalculoCubeta(calculo, direccion, contadores);
    const comun = () => ({
      calculo, direccion, comparaciones: contadores.comparaciones, accesos: contadores.accesos
    });

    contadores.accesos++;
    const principal = estructura.claves[direccion - 1];
    if (principal !== undefined) contadores.comparaciones++;

    if (principal === objetivo) {
      pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
        casilla: direccion,
        mensaje: `Clave localizada en el primer renglón de la cubeta ${mostrar(direccion)} tras ${contadores.comparaciones} comparaciones.`
      })));
      return pasos;
    }
    if (principal === undefined) {
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
        casilla: direccion,
        mensaje: `Clave no localizada en la estructura: la cubeta ${mostrar(direccion)} está vacía.`
      })));
      return pasos;
    }

    pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
      casilla: direccion,
      mensaje: `Se compara la clave objetivo con el primer renglón de la cubeta ${mostrar(direccion)}: ${objetivo} no coincide con ${principal}.`
    })));

    const recorrido = recorrerAnidado({
      anidado: estructura.anidados[direccion - 1] || [],
      tamano: r - 1,
      condicion: (candidato) => candidato === undefined || candidato === objetivo
    });

    for (const visita of recorrido.recorrido) {
      contadores.accesos++;
      if (visita.clave !== undefined) contadores.comparaciones++;
      if (!visita.detener) {
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          mensaje: `Cubeta ${mostrar(direccion)}: ${objetivo} no coincide con ${visita.clave} en el renglón ${visita.posicion + 1}; se revisa el siguiente.`
        })));
        continue;
      }
      if (visita.clave === objetivo) {
        pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          mensaje: `Clave localizada en el renglón ${visita.posicion + 1} de la cubeta ${mostrar(direccion)} tras ${contadores.comparaciones} comparaciones.`
        })));
      } else {
        pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          mensaje: `Clave no localizada en la estructura: el renglón ${visita.posicion + 1} de la cubeta ${mostrar(direccion)} está vacío.`
        })));
      }
    }

    if (!recorrido.agotado) return pasos;

    // Cubeta llena y ninguna coincide: si guarda claves en Col, se siguen
    // revisando ahí, en el orden en que llegaron (pedido del usuario,
    // 2026-10-14). Col solo tiene claves cuando la cubeta está llena, así que
    // un renglón vacío ya prueba que la clave no está.
    const col = estructuras.colDe(estructura, direccion);
    for (let k = 0; k < col.length; k++) {
      contadores.accesos++;
      contadores.comparaciones++;
      if (col[k] === objetivo) {
        pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
          casilla: direccion,
          col: k + 1,
          mensaje: `Clave localizada en Col de la cubeta ${mostrar(direccion)} tras ${contadores.comparaciones} comparaciones.`
        })));
        return pasos;
      }
      pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
        casilla: direccion,
        col: k + 1,
        mensaje: `Col de la cubeta ${mostrar(direccion)}: ${objetivo} no coincide con ${col[k]}; se revisa ${k + 1 < col.length ? 'la siguiente' : 'si queda alguna'}.`
      })));
    }
    pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
      casilla: direccion,
      mensaje: col.length > 0
        ? `Clave no localizada en la estructura tras ${contadores.comparaciones} comparaciones: ni la cubeta ${mostrar(direccion)} ni su Col la tienen.`
        : `Clave no localizada en la estructura tras ${contadores.comparaciones} comparaciones: la cubeta ${mostrar(direccion)} está llena y ninguna coincide.`
    })));
    return pasos;
  }

  function eliminar({ estructura, clave }) {
    const pasos = buscar({ estructura, objetivo: clave });
    const hallazgo = pasos[pasos.length - 1];
    if (hallazgo.tipo !== TIPOS_PASO.ENCONTRADA) return pasos;

    const contadores = { comparaciones: hallazgo.comparaciones, accesos: hallazgo.accesos };
    const casilla = hallazgo.casilla;
    const posicion = hallazgo.posicion;
    const r = estructura.parametros.r;
    const anidado = estructura.anidados[casilla - 1] || [];
    const col = estructuras.colDe(estructura, casilla);

    if (hallazgo.col !== undefined) {
      pasos.push(crearPaso(TIPOS_PASO.ELIMINACION, {
        calculo: hallazgo.calculo,
        direccion: hallazgo.direccion,
        casilla,
        col: hallazgo.col,
        clave,
        efecto: { tipo: 'retirar-col', casilla, col: hallazgo.col },
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: `Clave ${clave} eliminada de Col de la cubeta ${mostrar(casilla)}.`
      }));
      pasos.push(...pasosDeReduccion({ estructura, clave, contadores, r }));
      return pasos;
    }
    // Solo hay algo que cerrar si queda una clave detrás de la que sale.
    const hayQueCerrar = posicion === undefined
      ? anidado.some((entrada) => entrada !== undefined)
      : anidado.some((entrada, i) => entrada !== undefined && i + 1 > posicion);

    pasos.push(crearPaso(TIPOS_PASO.ELIMINACION, {
      calculo: hallazgo.calculo,
      direccion: hallazgo.direccion,
      casilla,
      posicion,
      clave,
      efecto: { tipo: 'retirar-cubeta', casilla, posicion, clave },
      comparaciones: contadores.comparaciones,
      accesos: contadores.accesos,
      mensaje: posicion === undefined
        ? `Clave ${clave} eliminada del primer renglón de la cubeta ${mostrar(casilla)}.`
        : `Clave ${clave} eliminada del renglón ${posicion + 1} de la cubeta ${mostrar(casilla)}.`
    }));

    if (hayQueCerrar) {
      pasos.push(crearPaso(TIPOS_PASO.DESPLAZAMIENTO, {
        calculo: hallazgo.calculo,
        direccion: hallazgo.direccion,
        casilla,
        clave,
        efecto: { tipo: 'compactar-anidado', casilla },
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: `La cubeta ${mostrar(casilla)} cierra el hueco: los renglones de atrás suben una posición.`
      }));
    }

    // La cubeta estaba llena —por eso tiene claves en Col— y le quedó un
    // renglón libre, el último: la primera de Col sube a él. Sin esto la
    // búsqueda se detendría en el hueco y no llegaría a Col.
    if (col.length > 0) {
      const ultimo = r - 1;
      pasos.push(crearPaso(TIPOS_PASO.DESPLAZAMIENTO, {
        calculo: hallazgo.calculo,
        direccion: hallazgo.direccion,
        casilla,
        posicion: ultimo === 0 ? undefined : ultimo,
        clave: col[0],
        efecto: { tipo: 'subir-de-col', casilla, posicion: ultimo === 0 ? undefined : ultimo },
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: `La clave ${col[0]} sube de Col al renglón ${r} de la cubeta ${mostrar(casilla)}.`
      }));
    }

    pasos.push(...pasosDeReduccion({ estructura, clave, contadores, r }));
    return pasos;
  }

  // Se revisa después de eliminar, con la clave ya fuera: la densidad de
  // reducir compara contra `n`, no contra la capacidad (CLAUDE.md 5.x).
  function pasosDeReduccion({ estructura, clave, contadores, r }) {
    const pasos = [];
    const restantes = estructuras.cantidadClaves(estructura) - 1;
    const densidad = restantes / estructura.n;
    if (densidad < estructura.parametros.umbralReducir) {
      const { n0, modoExpansion } = estructura.parametros;
      const nPropuesto = dominioCubetas.anteriorN(estructura.n, n0, modoExpansion);
      if (nPropuesto !== null) {
        const orden = (estructura.ordenLlegada || []).filter((k) => k !== clave);
        pasos.push(...pasosDeCambioDeTamano({
          tipoPaso: TIPOS_PASO.REDUCCION,
          n: nPropuesto,
          orden,
          r,
          contadores,
          mensajeAnuncio: `Densidad para reducir del ${(densidad * 100).toFixed(1).replace('.', ',')} %: la estructura se reduce de n = ${estructura.n} a n = ${nPropuesto}.`
        }));
      }
    }

    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.cubetas = { insertar, buscar, eliminar };
})();
