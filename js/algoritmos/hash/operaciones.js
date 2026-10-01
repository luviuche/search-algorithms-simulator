(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const { sondearLineal, sondearCuadratico, sondearDobleHash } = window.CC2.algoritmos.colisiones.reasignacion;
  const { recorrerAnidado } = window.CC2.algoritmos.colisiones.anidados;
  const { recorrerCadena } = window.CC2.algoritmos.colisiones.encadenamiento;

  // Tratamientos de colisión disponibles (CLAUDE.md 5.4). El docente pidió que
  // no fueran temas aparte sino parte de la transformación de claves: se eligen
  // al crear la estructura, porque cambian su forma y no solo su comportamiento.
  const TRATAMIENTOS = Object.freeze({
    NINGUNO: 'ninguno',
    REASIGNACION: 'reasignacion',
    CUADRATICA: 'cuadratica',
    DOBLE_HASH: 'doble-hash',
    ANIDADOS: 'anidados',
    ENCADENAMIENTO: 'encadenamiento'
  });

  const NOMBRE_TRATAMIENTO = Object.freeze({
    ninguno: 'ninguno',
    reasignacion: 'reasignación',
    cuadratica: 'reasignación (prueba cuadrática)',
    'doble-hash': 'reasignación (doble función hash)',
    anidados: 'arreglos anidados',
    encadenamiento: 'encadenamiento secuencial'
  });

  // Las tres reasignaciones comparten todo menos el salto: parar en la primera
  // casilla libre, buscar hasta la clave o un hueco, y el mismo dibujo. Por eso
  // basta con saber qué sondeo usa cada una y cómo se llama en la bitácora.
  const SONDEOS = Object.freeze({
    reasignacion: { sondear: sondearLineal, prueba: 'Prueba lineal' },
    cuadratica: { sondear: sondearCuadratico, prueba: 'Prueba cuadrática' },
    'doble-hash': { sondear: sondearDobleHash, prueba: 'Doble función hash' }
  });

  // «tras 1 sondeo», no «tras 1 sondeos»: con la primera casilla del sondeo
  // libre, la cuenta es uno.
  const sondeos = (cantidad) => `${cantidad} ${cantidad === 1 ? 'sondeo' : 'sondeos'}`;

  // Los renglones de los saltos, para el panel del cálculo: debajo de la
  // dirección que dio la función hash, una sección con el nombre de la prueba y
  // un renglón por casilla recorrida. Como `calculo`, cada paso lleva todo lo
  // revelado hasta él y el panel no recuerda nada. `nota` dice por qué el
  // salto no sirvió; sin nota, es el salto donde el recorrido terminó.
  function crearSaltos(titulo) {
    const lineas = [];
    return {
      anotar(visita, nota = null) {
        lineas.push({ etiqueta: visita.etiqueta, expresion: visita.expresion, resultado: String(visita.casilla), nota });
      },
      foto: () => ({ titulo, lineas: lineas.slice() })
    };
  }

  // Ni insertar ni buscar tocan la estructura: producen la traza completa y la
  // vista la reproduce (CLAUDE.md 4). Es lo que permite retroceder un paso.
  //
  // Todo paso lleva `calculo` con las líneas reveladas hasta ese momento —no
  // solo la última— para que el panel se dibuje sin recordar nada del paso
  // anterior, igual que binaria carga sus `descartadas` en cada paso.
  function pasosDelCalculo(calculo, contadores) {
    const pasos = [];
    for (let i = 0; i < calculo.length; i++) {
      const linea = calculo[i];
      const esUltima = i === calculo.length - 1;
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        calculo: calculo.slice(0, i + 1),
        // La dirección solo existe cuando el cálculo terminó: antes, apuntar a
        // una casilla sería mentir sobre lo que el algoritmo sabe.
        direccion: esUltima ? Number(linea.resultado) : undefined,
        casilla: esUltima ? Number(linea.resultado) : undefined,
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: esUltima
          ? `Dirección obtenida: ${linea.expresion} = ${linea.resultado}.`
          : (linea.expresion
            ? `Cálculo de la dirección: ${linea.expresion} = ${linea.resultado}.`
            : `Cálculo de la dirección para la clave ${linea.resultado}.`)
      }));
    }
    return pasos;
  }

  function insertar({ claves, n, clave, direccionDe, parametros, tratamiento = TRATAMIENTOS.NINGUNO, anidados = [], tamanoAnidado = 0 }) {
    const contadores = { comparaciones: 0, accesos: 0 };
    const { direccion, calculo } = direccionDe(clave, n, parametros);
    const pasos = pasosDelCalculo(calculo, contadores);

    const comun = () => ({
      calculo,
      direccion,
      comparaciones: contadores.comparaciones,
      accesos: contadores.accesos
    });

    contadores.accesos++;
    if (claves[direccion - 1] === undefined) {
      pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun(), {
        casilla: direccion,
        clave,
        efecto: { tipo: 'colocar', casilla: direccion, clave },
        mensaje: `Clave insertada: ${clave} en la casilla ${direccion}.`
      })));
      return pasos;
    }

    pasos.push(crearPaso(TIPOS_PASO.COLISION, Object.assign(comun(), {
      casilla: direccion,
      colision: direccion,
      // Sin tratamiento no hay nada que "aplicar": decirlo así deja la frase
      // «se aplica tratamiento por ninguno», que además de mal escrita miente
      // sobre lo que va a pasar. Se dice qué se encontró y ya.
      mensaje: tratamiento === TRATAMIENTOS.NINGUNO
        ? `Colisión en la dirección ${direccion}: la casilla ya contiene la clave ${claves[direccion - 1]}.`
        : `Colisión en la dirección ${direccion}: se aplica tratamiento por ${NOMBRE_TRATAMIENTO[tratamiento]}.`,
      // La sección de saltos abre aquí, todavía vacía: la dirección está
      // ocupada y lo que sigue es la reasignación.
      saltos: SONDEOS[tratamiento]
        ? crearSaltos(`${SONDEOS[tratamiento].prueba} · la ${direccion} está ocupada`).foto()
        : undefined
    })));

    // Sin tratamiento la colisión es el final: la clave no entra. Es el
    // comportamiento que deja ver la función hash pura, sin nada que la tape.
    if (tratamiento === TRATAMIENTOS.NINGUNO) {
      pasos.push(crearPaso(TIPOS_PASO.RECHAZADA, Object.assign(comun(), {
        casilla: direccion,
        colision: direccion,
        mensaje: `Clave no insertada: la dirección ${direccion} está ocupada y no hay tratamiento de colisiones definido.`
      })));
      return pasos;
    }

    // Arreglos anidados: la clave que chocó no busca otra dirección, se queda
    // en la que le tocó y baja al arreglo secundario de esa dirección. Es lo
    // que separa este tratamiento de la reasignación —la clave nunca se aleja
    // de su dirección— y por eso el límite es la capacidad del arreglo y no la
    // de la tabla.
    if (tratamiento === TRATAMIENTOS.ANIDADOS) {
      const recorrido = recorrerAnidado({
        anidado: anidados[direccion - 1] || [],
        tamano: tamanoAnidado,
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
            mensaje: `Arreglo anidado de ${direccion}: la posición ${visita.posicion} contiene la clave ${visita.clave}; se avanza.`
          })));
          continue;
        }
        pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          colision: direccion,
          recorridas: recorridas.slice(),
          clave,
          efecto: { tipo: 'colocar-anidado', casilla: direccion, posicion: visita.posicion, clave },
          mensaje: `Clave insertada: ${clave} en la posición ${visita.posicion} del arreglo anidado de ${direccion}.`
        })));
      }

      if (recorrido.agotado) {
        pasos.push(crearPaso(TIPOS_PASO.SATURADA, Object.assign(comun(), {
          casilla: direccion,
          colision: direccion,
          recorridas: recorridas.slice(),
          mensaje: `Arreglo anidado de la dirección ${direccion} saturado: `
            + (tamanoAnidado === 1 ? 'su única posición está ocupada' : `sus ${tamanoAnidado} posiciones están ocupadas`)
            + ` y la clave ${clave} no se inserta.`
        })));
      }
      return pasos;
    }

    // Encadenamiento secuencial: como los arreglos anidados, la clave se queda
    // en su dirección y baja a la estructura secundaria. Lo único distinto es
    // que la cadena no tiene tope: se recorre entera y la clave se engancha al
    // final, así que no hay paso de saturación. Esta estructura nunca se llena,
    // y eso es lo que la define.
    if (tratamiento === TRATAMIENTOS.ENCADENAMIENTO) {
      const cadena = anidados[direccion - 1] || [];
      // Todas las posiciones de una cadena están ocupadas —no se llena
      // dejando huecos— así que la condición nunca se cumple y el recorrido
      // termina agotado, en la posición donde se engancha la clave nueva.
      const recorrido = recorrerCadena({
        cadena,
        condicion: (ocupante) => ocupante === undefined
      });

      const recorridas = [];
      for (const visita of recorrido.recorrido) {
        contadores.accesos++;
        recorridas.push(visita.posicion);
        pasos.push(crearPaso(TIPOS_PASO.SONDEO, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          colision: direccion,
          recorridas: recorridas.slice(),
          mensaje: `Cadena de la dirección ${direccion}: la posición ${visita.posicion} contiene la clave ${visita.clave}; se avanza.`
        })));
      }

      contadores.accesos++;
      pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun(), {
        casilla: direccion,
        posicion: recorrido.posicion,
        colision: direccion,
        recorridas: recorridas.slice(),
        clave,
        efecto: { tipo: 'colocar-anidado', casilla: direccion, posicion: recorrido.posicion, clave },
        mensaje: `Clave insertada: ${clave} al final de la cadena de la dirección ${direccion}, en la posición ${recorrido.posicion}.`
      })));
      return pasos;
    }

    const { sondear, prueba } = SONDEOS[tratamiento];
    const saltos = crearSaltos(`${prueba} · la ${direccion} está ocupada`);
    const sondeo = sondear({
      claves,
      n,
      desde: direccion,
      condicion: (ocupante) => ocupante === undefined
    });

    const sondeadas = [];
    for (const visita of sondeo.recorrido) {
      contadores.accesos++;
      if (!visita.detener) {
        sondeadas.push(visita.casilla);
        saltos.anotar(visita, `ocupada por ${visita.clave}`);
        pasos.push(crearPaso(TIPOS_PASO.SONDEO, Object.assign(comun(), {
          casilla: visita.casilla,
          colision: direccion,
          sondeadas: sondeadas.slice(),
          saltos: saltos.foto(),
          mensaje: `${prueba}: la casilla ${visita.casilla} (${visita.detalle}) contiene la clave ${visita.clave}; se avanza.`
        })));
        continue;
      }
      saltos.anotar(visita);
      pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comun(), {
        casilla: visita.casilla,
        colision: direccion,
        sondeadas: sondeadas.slice(),
        saltos: saltos.foto(),
        clave,
        efecto: { tipo: 'colocar', casilla: visita.casilla, clave },
        mensaje: `Clave insertada: ${clave} en la casilla ${visita.casilla} (${visita.detalle}) tras ${sondeos(sondeadas.length + 1)}.`
      })));
    }

    if (sondeo.agotado) {
      // La lineal solo se agota con la tabla llena. La cuadrática y la doble
      // función hash pueden agotarse antes: su recorrido entra en ciclo sin
      // pasar por las casillas libres que quedan, y la clave no entra.
      const libres = Array.from({ length: n }, (_, i) => claves[i]).filter((k) => k === undefined).length;
      pasos.push(libres === 0
        ? crearPaso(TIPOS_PASO.SATURADA, Object.assign(comun(), {
          colision: direccion,
          sondeadas: sondeadas.slice(),
          saltos: saltos.foto(),
          mensaje: `Estructura saturada: capacidad máxima de ${n} casillas alcanzada.`
        }))
        : crearPaso(TIPOS_PASO.RECHAZADA, Object.assign(comun(), {
          colision: direccion,
          sondeadas: sondeadas.slice(),
          saltos: saltos.foto(),
          mensaje: `Clave no insertada: la ${prueba.toLowerCase()} volvió a una casilla ya visitada y entraría en ciclo. `
            + `Quedan ${libres === 1 ? 'una casilla libre' : `${libres} casillas libres`} que su recorrido no alcanza.`
        })));
    }
    return pasos;
  }

  function buscar({ claves, n, objetivo, direccionDe, parametros, tratamiento = TRATAMIENTOS.NINGUNO, anidados = [], tamanoAnidado = 0 }) {
    const contadores = { comparaciones: 0, accesos: 0 };
    const { direccion, calculo } = direccionDe(objetivo, n, parametros);
    const pasos = pasosDelCalculo(calculo, contadores);

    const comun = () => ({
      calculo,
      direccion,
      comparaciones: contadores.comparaciones,
      accesos: contadores.accesos
    });

    // Leer una casilla siempre es un acceso; comparar solo cuenta cuando hay
    // clave con qué comparar: una casilla vacía no se compara con nada.
    function examinar(casilla) {
      contadores.accesos++;
      const ocupante = claves[casilla - 1];
      if (ocupante !== undefined) contadores.comparaciones++;
      return ocupante;
    }

    const ocupante = examinar(direccion);

    if (ocupante === objetivo) {
      pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
        casilla: direccion,
        mensaje: `Clave localizada en la casilla ${direccion} tras ${contadores.comparaciones} comparaciones.`
      })));
      return pasos;
    }

    // La casilla vacía es una respuesta, no un fracaso a medias: si la clave
    // existiera, su dirección la habría puesto justo aquí.
    if (ocupante === undefined) {
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
        casilla: direccion,
        mensaje: `Clave no localizada en la estructura: la dirección ${direccion} está vacía.`
      })));
      return pasos;
    }

    pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
      casilla: direccion,
      mensaje: `Se compara la clave objetivo con la casilla ${direccion}: ${objetivo} no coincide con ${ocupante}.`,
      saltos: SONDEOS[tratamiento]
        ? crearSaltos(`${SONDEOS[tratamiento].prueba} · ${objetivo} no está en la ${direccion}`).foto()
        : undefined
    })));

    if (tratamiento === TRATAMIENTOS.NINGUNO) {
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
        casilla: direccion,
        mensaje: `Clave no localizada en la estructura tras ${contadores.comparaciones} comparaciones.`
      })));
      return pasos;
    }

    // Con arreglos anidados la búsqueda no se va a otra dirección: baja al
    // arreglo de esta. Para en la clave o en la primera posición vacía, que
    // prueba la ausencia porque el anidado se llena en orden.
    if (tratamiento === TRATAMIENTOS.ANIDADOS) {
      const anidado = anidados[direccion - 1] || [];
      const recorrido = recorrerAnidado({
        anidado,
        tamano: tamanoAnidado,
        condicion: (candidato) => candidato === undefined || candidato === objetivo
      });

      for (const visita of recorrido.recorrido) {
        contadores.accesos++;
        if (visita.clave !== undefined) contadores.comparaciones++;
        if (!visita.detener) {
          pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
            casilla: direccion,
            posicion: visita.posicion,
            mensaje: `Arreglo anidado de ${direccion}: ${objetivo} no coincide con ${visita.clave} en la posición ${visita.posicion}; se avanza.`
          })));
          continue;
        }
        if (visita.clave === objetivo) {
          pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
            casilla: direccion,
            posicion: visita.posicion,
            mensaje: `Clave localizada en la posición ${visita.posicion} del arreglo anidado de ${direccion} tras ${contadores.comparaciones} comparaciones.`
          })));
        } else {
          pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
            casilla: direccion,
            posicion: visita.posicion,
            mensaje: `Clave no localizada en la estructura: la posición ${visita.posicion} del arreglo anidado de ${direccion} está vacía.`
          })));
        }
      }

      if (recorrido.agotado) {
        pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
          casilla: direccion,
          mensaje: `Clave no localizada en la estructura tras ${contadores.comparaciones} comparaciones: el arreglo anidado de ${direccion} está lleno y ninguna coincide.`
        })));
      }
      return pasos;
    }

    // Con encadenamiento la búsqueda tampoco se va a otra dirección: recorre
    // la cadena de esta. No hay posición vacía que pruebe la ausencia —una
    // cadena no tiene huecos—, así que lo que la prueba es llegar al final.
    if (tratamiento === TRATAMIENTOS.ENCADENAMIENTO) {
      const cadena = anidados[direccion - 1] || [];
      const recorrido = recorrerCadena({
        cadena,
        condicion: (candidato) => candidato === objetivo
      });

      for (const visita of recorrido.recorrido) {
        contadores.accesos++;
        contadores.comparaciones++;
        if (!visita.detener) {
          pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
            casilla: direccion,
            posicion: visita.posicion,
            mensaje: `Cadena de la dirección ${direccion}: ${objetivo} no coincide con ${visita.clave} en la posición ${visita.posicion}; se avanza.`
          })));
          continue;
        }
        pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
          casilla: direccion,
          posicion: visita.posicion,
          mensaje: `Clave localizada en la posición ${visita.posicion} de la cadena de la dirección ${direccion} tras ${contadores.comparaciones} comparaciones.`
        })));
      }

      if (recorrido.agotado) {
        pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
          casilla: direccion,
          mensaje: `Clave no localizada en la estructura: la cadena de la dirección ${direccion} se recorrió entera tras ${contadores.comparaciones} comparaciones.`
        })));
      }
      return pasos;
    }

    // Con reasignación la búsqueda repite el mismo recorrido que hizo la
    // inserción, y para por la misma razón: halla la clave o halla un hueco.
    const { sondear, prueba } = SONDEOS[tratamiento];
    const saltos = crearSaltos(`${prueba} · ${objetivo} no está en la ${direccion}`);
    const sondeo = sondear({
      claves,
      n,
      desde: direccion,
      condicion: (sondeado) => sondeado === undefined || sondeado === objetivo
    });

    for (const visita of sondeo.recorrido) {
      const hallado = examinar(visita.casilla);
      if (hallado === objetivo) saltos.anotar(visita);
      else saltos.anotar(visita, hallado === undefined ? 'vacía' : `contiene ${hallado}`);
      if (!visita.detener) {
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, Object.assign(comun(), {
          casilla: visita.casilla,
          saltos: saltos.foto(),
          mensaje: `${prueba}: ${objetivo} no coincide con ${hallado} en la casilla ${visita.casilla} (${visita.detalle}); se avanza.`
        })));
        continue;
      }
      if (hallado === objetivo) {
        pasos.push(crearPaso(TIPOS_PASO.ENCONTRADA, Object.assign(comun(), {
          casilla: visita.casilla,
          saltos: saltos.foto(),
          mensaje: `Clave localizada en la casilla ${visita.casilla} tras ${contadores.comparaciones} comparaciones.`
        })));
      } else {
        pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
          casilla: visita.casilla,
          saltos: saltos.foto(),
          mensaje: `Clave no localizada en la estructura: la ${prueba.toLowerCase()} halló vacía la casilla ${visita.casilla} tras ${contadores.comparaciones} comparaciones.`
        })));
      }
    }

    if (sondeo.agotado) {
      pasos.push(crearPaso(TIPOS_PASO.NO_ENCONTRADA, Object.assign(comun(), {
        saltos: saltos.foto(),
        mensaje: sondear === sondearLineal
          ? `Clave no localizada en la estructura tras ${contadores.comparaciones} comparaciones.`
          : `Clave no localizada en la estructura tras ${contadores.comparaciones} comparaciones: la ${prueba.toLowerCase()} volvió a una casilla ya visitada.`
      })));
    }
    return pasos;
  }

  // Eliminación en una tabla dispersa (CLAUDE.md 5.6). Localiza la clave con
  // la misma búsqueda del tema —el borrado no tiene camino propio— y la saca.
  //
  // Sin tratamiento ahí se acaba: la casilla se vacía y no hay cadena que
  // romper, porque ninguna clave llegó a estar fuera de su dirección.
  //
  // Con reasignación hace falta algo más. Borrar en medio de un sondeo deja un
  // hueco que corta la cadena: una clave que se corrió más allá deja de ser
  // alcanzable, porque la búsqueda se detiene en la primera casilla vacía que
  // encuentra. Por eso **las claves que siguen al hueco vuelven a pasar por la
  // función hash** (así lo explica el docente): se levantan una a una y se
  // vuelven a dispersar, con su cálculo y su sondeo a la vista.
  //
  // En la prueba lineal el grupo se recorre hasta la primera casilla vacía y
  // no más allá: si hay una vacía, ninguna clave posterior pudo haberse corrido
  // cruzándola, así que su cadena nunca pasó por aquí y nada de lo que sigue
  // está en riesgo. La cuadrática y la doble función hash no tienen ese atajo
  // (ver abajo).
  function eliminar({ claves, n, clave, direccionDe, parametros, tratamiento = TRATAMIENTOS.NINGUNO, anidados = [], tamanoAnidado = 0, ordenLlegada = [] }) {
    const pasos = buscar({
      claves, n, objetivo: clave, direccionDe, parametros, tratamiento, anidados, tamanoAnidado
    });
    const hallazgo = pasos[pasos.length - 1];
    if (hallazgo.tipo !== TIPOS_PASO.ENCONTRADA) return pasos;

    const contadores = { comparaciones: hallazgo.comparaciones, accesos: hallazgo.accesos };
    const casilla = hallazgo.casilla;

    // Con arreglos anidados la clave sale de donde esté —la casilla de la
    // dirección o una posición de su arreglo— y después el arreglo se cierra:
    // las de atrás se corren, y si la casilla quedó vacía sube a ella la
    // primera del anidado. Sin eso quedaría una dirección vacía con claves
    // colgando, que contradice lo que el dibujo dice.
    //
    // El encadenamiento se vacía igual, y por eso comparte esta rama: sacar de
    // una cadena y sacar de un arreglo anidado son el mismo movimiento sobre
    // la estructura secundaria de una dirección. Lo único que cambia es cómo
    // se llama lo que cierra el hueco.
    if (tratamiento === TRATAMIENTOS.ANIDADOS || tratamiento === TRATAMIENTOS.ENCADENAMIENTO) {
      const secundaria = tratamiento === TRATAMIENTOS.ANIDADOS
        ? { sujeto: `El arreglo anidado de ${casilla}`, complemento: `del arreglo anidado de ${casilla}` }
        : { sujeto: `La cadena de la dirección ${casilla}`, complemento: `de la cadena de la dirección ${casilla}` };
      const posicion = hallazgo.posicion;
      const anidado = anidados[casilla - 1] || [];
      // Solo hay algo que cerrar si queda una clave *detrás* de la que salió.
      // Sacar la última del arreglo no mueve nada, y un paso que no mueve nada
      // sobra en la traza.
      const hayQueCerrar = posicion === undefined
        ? anidado.some((entrada) => entrada !== undefined)
        : anidado.some((entrada, i) => entrada !== undefined && i + 1 > posicion);

      pasos.push(crearPaso(TIPOS_PASO.ELIMINACION, {
        calculo: hallazgo.calculo,
        direccion: hallazgo.direccion,
        casilla,
        posicion,
        clave,
        efecto: posicion === undefined
          ? { tipo: 'retirar', casilla }
          : { tipo: 'retirar-anidado', casilla, posicion },
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: posicion === undefined
          ? `Clave ${clave} eliminada de la casilla ${casilla}.`
          : `Clave ${clave} eliminada de la posición ${posicion} ${secundaria.complemento}.`
      }));

      // Nada que cerrar: el arreglo queda vacío y la casilla ya está en su
      // sitio. Un paso que no mueve nada sobra.
      if (hayQueCerrar) {
        pasos.push(crearPaso(TIPOS_PASO.DESPLAZAMIENTO, {
          calculo: hallazgo.calculo,
          direccion: hallazgo.direccion,
          casilla,
          clave,
          efecto: { tipo: 'compactar-anidado', casilla },
          comparaciones: contadores.comparaciones,
          accesos: contadores.accesos,
          mensaje: posicion === undefined
            ? `La primera clave ${secundaria.complemento} sube a la casilla, y las demás se desplazan.`
            : `${secundaria.sujeto} cierra el hueco: las claves de atrás se desplazan una posición.`
        }));
      }
      return pasos;
    }

    // Una sola tabla simulada para toda la operación: la traza no toca la
    // estructura real, pero sí necesita saber cómo va quedando para que cada
    // sondeo de la redispersión mire el estado que tendrá en ese momento.
    const simulacion = claves.slice();
    delete simulacion[casilla - 1];

    pasos.push(crearPaso(TIPOS_PASO.ELIMINACION, {
      calculo: hallazgo.calculo,
      direccion: hallazgo.direccion,
      casilla,
      clave,
      efecto: { tipo: 'retirar', casilla },
      comparaciones: contadores.comparaciones,
      accesos: contadores.accesos,
      mensaje: `Clave ${clave} eliminada de la casilla ${casilla}.`
    }));

    if (!SONDEOS[tratamiento]) return pasos;
    const { sondear, prueba } = SONDEOS[tratamiento];

    // Levanta una clave de su casilla para volver a dispersarla. Solo la
    // retira: dónde vuelve a caer lo decide `recolocar`.
    function levantar(reubicada, origen, motivo) {
      contadores.accesos++;
      delete simulacion[origen - 1];
      pasos.push(crearPaso(TIPOS_PASO.EXTRACCION, {
        casilla: origen,
        clave: reubicada,
        efecto: { tipo: 'retirar', casilla: origen },
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos,
        mensaje: `Se retira la clave ${reubicada} de la casilla ${origen}: ${motivo}`
      }));
    }

    // Vuelve a pasar la clave por la función hash, con su cálculo a la vista,
    // y la coloca en su dirección o, si sigue ocupada, donde la deje el mismo
    // sondeo con que se insertó la primera vez.
    function recolocar(reubicada, origen) {
      const nueva = direccionDe(reubicada, n, parametros);
      pasos.push(...pasosDelCalculo(nueva.calculo, contadores));

      const comunReubicada = () => ({
        calculo: nueva.calculo,
        direccion: nueva.direccion,
        comparaciones: contadores.comparaciones,
        accesos: contadores.accesos
      });

      contadores.accesos++;
      if (simulacion[nueva.direccion - 1] === undefined) {
        simulacion[nueva.direccion - 1] = reubicada;
        pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comunReubicada(), {
          casilla: nueva.direccion,
          clave: reubicada,
          efecto: { tipo: 'colocar', casilla: nueva.direccion, clave: reubicada },
          mensaje: nueva.direccion === origen
            ? `La clave ${reubicada} vuelve a la casilla ${origen}: su dirección quedó libre.`
            : `La clave ${reubicada} se recoloca en la casilla ${nueva.direccion}, su dirección.`
        })));
        return;
      }

      const saltos = crearSaltos(`${prueba} · la ${nueva.direccion} está ocupada`);
      const sondeo = sondear({
        claves: simulacion,
        n,
        desde: nueva.direccion,
        condicion: (ocupante) => ocupante === undefined
      });

      const sondeadas = [];
      for (const visita of sondeo.recorrido) {
        contadores.accesos++;
        if (!visita.detener) {
          sondeadas.push(visita.casilla);
          saltos.anotar(visita, `ocupada por ${visita.clave}`);
          pasos.push(crearPaso(TIPOS_PASO.SONDEO, Object.assign(comunReubicada(), {
            casilla: visita.casilla,
            colision: nueva.direccion,
            sondeadas: sondeadas.slice(),
            saltos: saltos.foto(),
            mensaje: `${prueba}: la casilla ${visita.casilla} (${visita.detalle}) contiene la clave ${visita.clave}; se avanza.`
          })));
          continue;
        }
        simulacion[visita.casilla - 1] = reubicada;
        saltos.anotar(visita);
        pasos.push(crearPaso(TIPOS_PASO.INSERCION, Object.assign(comunReubicada(), {
          casilla: visita.casilla,
          colision: nueva.direccion,
          sondeadas: sondeadas.slice(),
          saltos: saltos.foto(),
          clave: reubicada,
          efecto: { tipo: 'colocar', casilla: visita.casilla, clave: reubicada },
          mensaje: visita.casilla === origen
            ? `La clave ${reubicada} vuelve a la casilla ${origen} tras ${sondeos(sondeadas.length + 1)}.`
            : `La clave ${reubicada} se recoloca en la casilla ${visita.casilla} tras ${sondeos(sondeadas.length + 1)}.`
        })));
      }

      // Solo la cuadrática y la doble función hash pueden llegar aquí: con
      // otras claves ya recolocadas, su recorrido puede cerrarse sin pasar
      // por ninguna casilla libre. No hay dónde ponerla, y se dice.
      if (sondeo.agotado) {
        pasos.push(crearPaso(TIPOS_PASO.RECHAZADA, Object.assign(comunReubicada(), {
          colision: nueva.direccion,
          sondeadas: sondeadas.slice(),
          saltos: saltos.foto(),
          mensaje: `La clave ${reubicada} no se puede recolocar: la ${prueba.toLowerCase()} entra en ciclo sin hallar casilla libre, y queda fuera de la estructura.`
        })));
      }
    }

    // Prueba lineal: las claves que siguen al hueco, una a una, hasta la
    // primera casilla vacía. Cada una se levanta y se recoloca antes de pasar
    // a la siguiente, porque su grupo está contiguo y nada de lo que queda
    // detrás de ella puede depender de dónde caiga.
    if (sondear === sondearLineal) {
      for (let salto = 1; salto <= n - 1; salto++) {
        const origen = ((casilla - 1 + salto) % n) + 1;
        const reubicada = simulacion[origen - 1];
        if (reubicada === undefined) break;
        levantar(reubicada, origen, 'colisionó en su momento y hay que volver a dispersarla.');
        recolocar(reubicada, origen);
      }
      return pasos;
    }

    // Cuadrática y doble función hash: **todas las claves que llegaron por
    // colisión vuelven a pasar por la función hash** (así lo explica el
    // docente, 2026-09-23). Con saltos, las claves de un recorrido no quedan
    // contiguas, así que no hay un grupo "detrás del hueco" que acotar.
    //
    // Primero se levantan todas y después se recolocan, en su orden de
    // llegada. Hacerlo de a una no sirve aquí: una clave recolocada podría
    // quedar con su recorrido pasando por la casilla de otra que todavía no
    // se ha levantado, y al levantarla le abriría un hueco en el camino.
    const desplazadas = [];
    for (let i = 1; i <= n; i++) {
      const ocupante = simulacion[i - 1];
      if (ocupante === undefined) continue;
      const propia = direccionDe(ocupante, n, parametros).direccion;
      if (propia !== i) desplazadas.push({ clave: ocupante, origen: i, propia });
    }
    const llegada = (clave) => {
      const posicion = ordenLlegada.indexOf(clave);
      return posicion === -1 ? Infinity : posicion;
    };
    desplazadas.sort((x, y) => llegada(x.clave) - llegada(y.clave));

    for (const { clave: reubicada, origen, propia } of desplazadas) {
      levantar(reubicada, origen, `no está en su dirección (${propia}), llegó ahí por colisión y hay que volver a dispersarla.`);
    }
    for (const { clave: reubicada, origen } of desplazadas) {
      recolocar(reubicada, origen);
    }

    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.hash = window.CC2.algoritmos.hash || {};
  window.CC2.algoritmos.hash.operaciones = { TRATAMIENTOS, NOMBRE_TRATAMIENTO, insertar, buscar, eliminar };
})();
