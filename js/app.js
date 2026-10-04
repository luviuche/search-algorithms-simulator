(function () {
  const dominio = window.CC2.dominio;
  const algoritmos = window.CC2.algoritmos;
  const vista = window.CC2.vista;
  const persistencia = window.CC2.persistencia;
  const hashOperaciones = algoritmos.hash.operaciones;
  const { TIPOS_PASO } = algoritmos.traza;

  // Catálogo de temas (CLAUDE.md 2 y 12), organizado por dos grandes temas —
  // Búsquedas y Grafos— y no por unidad del curso (pedido del docente,
  // 2026-09-06): la numeración de unidades mezclaba búsquedas externas con
  // grafos en la misma unidad, que es justo la agrupación que el docente ya
  // no quiere ver en el menú. Cada nodo es o bien una categoría (`hijos`,
  // navegable) o bien un tema final (`tema`, la clave que abre `TEMAS`).
  // `disponible` en un tema final refleja el estado real de esta compilación,
  // no el alcance final de la asignatura. Las categorías ya no llevan estado
  // propio: el catálogo se dibuja como un índice con todo a la vista
  // (CLAUDE.md 2), así que cada tema dice el suyo y una insignia en la
  // categoría solo repetiría —o mentiría, como en búsquedas externas, que
  // tiene dos temas construidos y tres por construir—.
  //
  // Los temas no se numeran: se identifican por su nombre (decisión del
  // docente, 2026-08-18). Ninguna categoría ni tema final lleva número.
  const CATALOGO = [
    {
      id: 'busquedas',
      titulo: 'Búsquedas',
      descripcion: 'Localizar una clave dentro de una estructura, completa en memoria o no',
      hijos: [
        {
          id: 'internas',
          titulo: 'Búsquedas internas',
          descripcion: 'La estructura completa cabe en memoria',
          hijos: [
            { id: 'lineal', titulo: 'Búsqueda secuencial', descripcion: 'Recorrido lineal, clave por clave', tema: 'secuencial', disponible: true },
            { id: 'binaria', titulo: 'Búsqueda binaria', descripcion: 'División sobre arreglo ordenado', tema: 'binaria', disponible: true },
            {
              id: 'transformacion',
              titulo: 'Búsqueda por transformación de claves',
              descripcion: 'La dirección la calcula una función hash',
              hijos: [
                { id: 'hash-modulo', titulo: 'Función módulo', descripcion: 'Dirección por residuo de n', tema: 'hash-modulo', disponible: true },
                { id: 'hash-cuadrado', titulo: 'Función cuadrado', descripcion: 'Cifras centrales del cuadrado', tema: 'hash-cuadrado', disponible: true },
                { id: 'hash-truncamiento', titulo: 'Función truncamiento', descripcion: 'Selección de dígitos de la clave', tema: 'hash-truncamiento', disponible: true },
                { id: 'hash-plegamiento', titulo: 'Función plegamiento', descripcion: 'Suma o producto de las particiones', tema: 'hash-plegamiento', disponible: true },
                { id: 'hash-bases', titulo: 'Conversión de bases', descripcion: 'Las cifras de la clave leídas en otra base', tema: 'hash-bases', disponible: true }
              ]
            },
            {
              id: 'residuo',
              // Nombres y orden del docente (traídos por el usuario,
              // 2026-09-11). "Tries" es el sinónimo del libro y no parte del
              // nombre, así que vive en la descripción, que es donde sirve:
              // es la palabra con la que el tema se encuentra en cualquier
              // otro sitio.
              titulo: 'Árboles de búsqueda por residuo',
              descripcion: 'El camino de la clave se recorre bit a bit, o por bloques de bits',
              hijos: [
                { id: 'arbol-digital', titulo: 'Árbol de búsqueda digital', descripcion: 'Inserción bit a bit', tema: 'arbol-digital', disponible: true },
                { id: 'residuos', titulo: 'Árbol de búsqueda por residuos', descripcion: 'Claves solo en las hojas · trie', tema: 'residuos', disponible: true },
                { id: 'residuos-multiples', titulo: 'Árbol de búsqueda por residuos múltiples', descripcion: 'Ramificación por bloques de bits', tema: 'residuos-multiples', disponible: true },
                { id: 'huffman', titulo: 'Árbol de Huffman', descripcion: 'La forma del árbol la dan las frecuencias', tema: 'huffman', disponible: true }
              ]
            }
          ]
        },
        {
          id: 'externas',
          titulo: 'Búsquedas externas',
          descripcion: 'La estructura no cabe completa en memoria',
          hijos: [
            { id: 'externa-secuencial', titulo: 'Búsqueda secuencial externa', descripcion: 'El archivo se lee bloque por bloque', tema: 'secuencial-externa', disponible: true },
            { id: 'externa-binaria', titulo: 'Búsqueda binaria externa', descripcion: 'Se parte el archivo por la mitad, bloque por bloque', tema: 'binaria-externa', disponible: true },
            { id: 'indices', titulo: 'Índices primarios, secundarios y multinivel', descripcion: 'La estructura sale de los parámetros del archivo', tema: 'indices', disponible: true },
            { id: 'cubetas', titulo: 'Otras búsquedas dinámicas', descripcion: 'Cubetas con expansión y reducción dinámica de n', tema: 'cubetas', disponible: true }
          ]
        }
      ]
    },
    {
      id: 'grafos',
      titulo: 'Grafos',
      descripcion: 'Vértices, aristas, y los recorridos y propiedades que se derivan de ellos',
      hijos: [
        { id: 'grafos-def', titulo: 'Definiciones, recorridos e isomorfismo', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-euler', titulo: 'Circuitos de Euler y Hamilton', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-operaciones', titulo: 'Operaciones entre grafos', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-expansion', titulo: 'Árboles de expansión — Prim y Kruskal', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-corte', titulo: 'Conjuntos de corte y conectividad', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-matricial', titulo: 'Representación matricial', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-coloreado', titulo: 'Coloreado y particionamiento', descripcion: '', tema: null, disponible: false },
        { id: 'grafos-pareamientos', titulo: 'Pareamientos y envolventes', descripcion: '', tema: null, disponible: false }
      ]
    }
  ];

  // Cuántas hojas hay en el bosque de un paso. No cambia durante la
  // construcción —las letras son las que son— pero hay que contarlas bajando,
  // porque a mitad de camino unas ya cuelgan de un nodo y otras siguen sueltas.
  function hojasDelPaso(paso) {
    const contar = (nodo) => (nodo.letra !== undefined ? 1 : contar(nodo.izquierda) + contar(nodo.derecha));
    return (paso.bosque || []).reduce((total, raiz) => total + contar(raiz), 0);
  }

  // Métricas comunes: comparaciones y accesos los reporta todo paso de traza.
  const METRICA_COMPARACIONES = {
    id: 'comparaciones',
    etiqueta: 'Comparaciones',
    valor: ({ paso }) => (paso ? String(paso.comparaciones) : '0')
  };

  const METRICA_ACCESOS = {
    id: 'accesos',
    etiqueta: 'Accesos',
    valor: ({ paso }) => (paso ? String(paso.accesos) : '0')
  };

  // Factor de carga: cuánto de la estructura está ocupado. Es la métrica que
  // explica el comportamiento de una tabla hash —las colisiones se disparan
  // mucho antes de llenarla— y por eso acompaña a los temas de transformación.
  //
  // Se mide contra la **capacidad** y no contra n: con arreglos anidados caben
  // n × (1 + k) claves, y dividir por n daría más de 1 con la tabla a medio
  // llenar. Con encadenamiento no hay capacidad que medir —la cadena no tiene
  // tope—, así que se mide contra n y el factor pasa a decir cuántas claves
  // hay por dirección: ahí sí puede pasar de 1, y eso es lo que significa el
  // factor de carga en una tabla encadenada (CLAUDE.md 5.4).
  const METRICA_FACTOR_CARGA = {
    id: 'factor-carga',
    etiqueta: 'Factor de carga',
    // En su propio renglón (maqueta elegida por el usuario, 2026-09-28): en la
    // columna de «Comparaciones» se partía en dos líneas en todas las
    // pantallas, y el panel crecía un renglón por nada.
    ancha: true,
    valor: ({ estructura }) => (
      estructura
        ? (dominio.estructura.cantidadClaves(estructura) / dominio.estructura.baseDeCarga(estructura)).toFixed(2)
        : '0.00'
    )
  };

  // Todos los temas de transformación de claves se comportan igual: lo único
  // que los distingue es cómo calculan la dirección (CLAUDE.md 5.3 y 12). Por
  // eso comparten una sola configuración y cada función nueva aporta su
  // `direccionDe`, nada más.
  //
  // Tres cosas los separan de las búsquedas por comparación, y las tres entran
  // por `config`:
  //
  //   modo dispersa  — la clave aterriza en su dirección, no al final: la
  //                    estructura tiene huecos y no está ordenada.
  //   insertar       — insertar deja de ser instantáneo y pasa a ser lo que
  //                    se enseña, así que produce traza como una búsqueda.
  //   tratamientos   — las colisiones no son un tema aparte sino parte de
  //                    estos temas (pedido del docente); se eligen al crear.
  function temaHash({ direccionDe, parametros }) {
    const operar = (operacion) => ({ estructura, clave, objetivo }) => operacion({
      claves: estructura.claves,
      n: estructura.n,
      clave,
      objetivo,
      direccionDe,
      parametros: estructura.parametros,
      tratamiento: estructura.tratamiento,
      anidados: estructura.anidados,
      tamanoAnidado: estructura.tamanoAnidado,
      ordenLlegada: estructura.ordenLlegada
    });

    return {
      orientacion: 'vertical',
      modo: dominio.estructura.MODOS.DISPERSA,
      calculo: true,
      // Aquí cada renglón del desarrollo lleva a una casilla, así que el panel
      // se pone a la altura de la que el paso sigue, con un pico que la señala,
      // y sin operación no se dibuja (maqueta elegida por el usuario,
      // 2026-09-28, CLAUDE.md 6.5).
      calculoSoloEnOperacion: true,
      calculoSenalaCasilla: true,
      parametros,
      tratamientos: [
        { valor: hashOperaciones.TRATAMIENTOS.NINGUNO, etiqueta: 'Sin tratamiento' },
        { valor: hashOperaciones.TRATAMIENTOS.REASIGNACION, etiqueta: 'Reasignación (prueba lineal)' },
        { valor: hashOperaciones.TRATAMIENTOS.CUADRATICA, etiqueta: 'Reasignación (prueba cuadrática)' },
        { valor: hashOperaciones.TRATAMIENTOS.DOBLE_HASH, etiqueta: 'Reasignación (doble función hash)' },
        { valor: hashOperaciones.TRATAMIENTOS.ANIDADOS, etiqueta: 'Arreglos anidados' },
        { valor: hashOperaciones.TRATAMIENTOS.ENCADENAMIENTO, etiqueta: 'Encadenamiento secuencial' }
      ],
      // Los dos tratamientos que dejan la clave en su dirección cuelgan de ella
      // una estructura secundaria (CLAUDE.md 5.4), y se distinguen justo en
      // cuánto cabe en ella.
      anidados: {
        // Con arreglos anidados la estructura es una **matriz de n × n**: la
        // primera columna es la tabla y las otras `n − 1` el arreglo de cada
        // dirección, así que en una dirección caben `n` claves contando la
        // suya. El tamaño no se pide: sale de `n`. Con encadenamiento la
        // cadena no tiene tope, y por eso la estructura no se satura nunca.
        tamano: (estructura) => {
          if (estructura.tratamiento === hashOperaciones.TRATAMIENTOS.ANIDADOS) return estructura.n - 1;
          if (estructura.tratamiento === hashOperaciones.TRATAMIENTOS.ENCADENAMIENTO) return Infinity;
          return 0;
        },
        // Cuántas columnas de arreglo dibuja cada dirección. La cadena no
        // dibuja columnas fijas: cada fila crece lo que crezca la suya, así
        // que aquí no cuenta.
        columnas: (estructura) => (
          estructura.tratamiento === hashOperaciones.TRATAMIENTOS.ANIDADOS
            ? estructura.n - 1
            : 0
        ),
        // La cadena se dibuja distinto —casillas enlazadas con flecha, y cada
        // fila elidiendo por su cuenta— porque es lo único que la separa a la
        // vista del arreglo anidado.
        cadena: (estructura) => estructura.tratamiento === hashOperaciones.TRATAMIENTOS.ENCADENAMIENTO
      },
      insertar: operar(hashOperaciones.insertar),
      buscar: operar(hashOperaciones.buscar),
      eliminar: operar(hashOperaciones.eliminar),
      casillasRelevantes: (paso) => [paso.casilla, paso.direccion]
        .concat(paso.sondeadas || [])
        .filter(Boolean),
      // `posicion` distingue la casilla de la tabla —donde es `undefined`— de
      // cada casilla del arreglo anidado de esa dirección. Un paso marca una
      // sola de las dos, así que las dos tienen que coincidir para pintar.
      describirCasilla: ({ paso, indice, posicion, ocupada }) => {
        const base = ocupada ? 'ocupada' : 'vacia';
        if (!paso) return { estado: base };

        const modificadores = [];
        // La dirección que dio el hash se sigue marcando aunque el sondeo ya
        // se haya ido de ella: es lo que deja ver cuánto se alejó la clave.
        if (paso.direccion === indice && paso.casilla !== indice && posicion === undefined) {
          modificadores.push('direccion');
        }

        if (paso.casilla === indice && paso.posicion === posicion) {
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada', modificadores };
          if (paso.tipo === TIPOS_PASO.INSERCION) return { estado: 'insertada', modificadores };
          // La clave que sale y la que se levanta para volver a dispersarse
          // dejan la misma casilla vacía: lo que las distingue es la bitácora.
          if (paso.tipo === TIPOS_PASO.ELIMINACION || paso.tipo === TIPOS_PASO.EXTRACCION) {
            return { estado: 'eliminada', modificadores };
          }
          if (paso.tipo === TIPOS_PASO.COLISION || paso.tipo === TIPOS_PASO.RECHAZADA || paso.tipo === TIPOS_PASO.SATURADA) {
            return { estado: 'colision', modificadores };
          }
          return { estado: 'en-evaluacion', modificadores };
        }
        // Lo que el sondeo ya pasó de largo se apaga, como lo comparado en
        // secuencial (maqueta elegida por el usuario, 2026-09-28): apagado es
        // descartado (CLAUDE.md 8.2). El rojo queda solo para la colisión.
        // Vale para las posiciones del anidado o de la cadena ya recorridas y
        // para las casillas de la tabla que la reasignación saltó.
        if (posicion !== undefined && paso.casilla === indice) {
          if (paso.recorridas && paso.recorridas.includes(posicion)) return { estado: 'descartada', modificadores };
        }
        // Estas dos hablan de casillas de la tabla, no del anidado: sin acotar
        // por `posicion`, una colisión pintaría de rojo la fila entera.
        if (posicion === undefined) {
          if (paso.colision === indice) return { estado: 'colision', modificadores };
          if (paso.sondeadas && paso.sondeadas.includes(indice)) return { estado: 'descartada', modificadores };
        }
        return { estado: base, modificadores };
      },
      metricas: [METRICA_COMPARACIONES, METRICA_ACCESOS, METRICA_FACTOR_CARGA]
    };
  }

  // Búsquedas externas por comparación (CLAUDE.md 5.8 y 5.11). El archivo es
  // el mismo arreglo ordenado y denso de secuencial interna —`modo` ordenada,
  // que es el de por omisión— y los bloques son una agrupación de posiciones
  // encima de él: por eso insertar sigue siendo instantáneo, como en
  // secuencial y binaria, y el desbordamiento al bloque de al lado lo anima
  // el FLIP sin traza propia. Secuencial y binaria externa comparten el
  // archivo, el dibujo, el borrado y las métricas; lo único que cada una
  // aporta es su `recorrido`, el orden en que lee los bloques.
  function temaExterno(recorrido) {
    const leer = (estructura, objetivo) => recorrido({ claves: estructura.claves, n: estructura.n, objetivo });
    return {
      // Cuarta orientación de la pantalla (CLAUDE.md 6.1): ni fila, ni tabla,
      // ni niveles, sino columnas separadas con su rótulo arriba.
      orientacion: 'bloques',
      etiquetaTamano: 'Registros del archivo (N)',
      // El panel del cálculo, junto a la estructura: aquí no desarrolla una
      // dirección sino la comparación en curso —contra qué registro, de qué
      // bloque, y qué se concluye—, que es la cuenta que este algoritmo hace.
      // Binaria externa lo retitula paso a paso (`paso.tituloCalculo`),
      // porque cambia de fase: primero por bloques, después dentro de uno.
      calculo: true,
      tituloCalculo: 'Comparación',
      // Sin operación no se dibuja, como en hash y en los árboles (maqueta de
      // la parada de externas, elegida por el usuario el 2026-09-30).
      calculoSoloEnOperacion: true,
      buscar: ({ estructura, objetivo }) => leer(estructura, objetivo),
      // Borrar lee el archivo como buscar: la eliminación no tiene camino
      // propio, usa el del tema (CLAUDE.md 5.6). Lo único suyo es cómo nombra
      // el sitio: el estudiante ubica el bloque, no el número de registro
      // (pedido del usuario, 2026-09-11).
      eliminar: ({ estructura, clave }) => algoritmos.eliminacion.eliminarPorBusqueda({
        pasos: leer(estructura, clave),
        claves: estructura.claves,
        clave,
        nombrar: (paso) => `el bloque ${paso.bloque}`
      }),
      // Los extremos del rango de renglones también, para que la elisión no
      // esconda justo la frontera que la binaria de dentro está estrechando.
      casillasRelevantes: (paso) => {
        const relevantes = paso.casilla ? [paso.casilla] : [];
        if (paso.rangoRegistros) relevantes.push(paso.rangoRegistros.inicio, paso.rangoRegistros.fin);
        return relevantes;
      },
      describirCasilla: ({ paso, indice, bloque, ocupada }) => {
        const base = ocupada ? 'ocupada' : 'vacia';
        if (!paso) return { estado: base };

        if (paso.casilla === indice) {
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada' };
          if (paso.tipo === TIPOS_PASO.ELIMINACION) return { estado: 'eliminada' };
          return { estado: 'en-evaluacion' };
        }
        // El bloque descartado se apaga entero: es la unidad con la que este
        // algoritmo descarta, igual que binaria apaga el tramo que tiró.
        if (paso.bloquesDescartados && paso.bloquesDescartados.includes(bloque)) {
          return { estado: 'descartada' };
        }
        // Binaria externa, dentro del bloque que queda: lo que ya tiró la
        // binaria de dentro, apagado, como binaria interna pero en la columna
        // del bloque (maqueta elegida por el usuario, 2026-09-27). Lo que
        // sigue en juego se ve normal: el azul se retiró (CLAUDE.md 8.2).
        if (paso.rangoRegistros && paso.bloque === bloque) {
          const { inicio, fin } = paso.rangoRegistros;
          if (indice < inicio || indice > fin) return { estado: 'descartada' };
        }
        // Los registros ya mirados dentro del bloque en curso se apagan:
        // la búsqueda los descartó. Hasta el 2026-09-30 llevaban el borde rojo
        // punteado de la prueba lineal, que en hash ya se había cambiado por
        // apagado: apagado es descartado, y el rojo es de la colisión
        // (CLAUDE.md 8.2).
        if (paso.recorridas && paso.recorridas.includes(indice)) {
          return { estado: 'descartada' };
        }
        return { estado: base };
      },
      detalleReciente: (estructura) => {
        const forma = dominio.externa.formaDelArchivo(estructura.n);
        return `N = ${estructura.n} · ${forma.bloques} bloques de ${forma.registrosPorBloque}`;
      },
      metricas: [
        METRICA_COMPARACIONES,
        {
          // No es el acceso genérico: aquí lo que cuesta es leer un bloque, y
          // ese número —cercano a √N y no a N en secuencial, y a log₂ B en
          // binaria— es la lección del tema.
          id: 'accesos',
          etiqueta: 'Accesos a bloque',
          valor: ({ paso }) => (paso ? String(paso.accesos) : '0')
        },
        {
          id: 'bloques',
          etiqueta: 'Bloques',
          formula: 'B',
          valor: ({ estructura }) => (
            estructura ? String(dominio.externa.formaDelArchivo(estructura.n).bloques) : '0'
          )
        },
        {
          id: 'registros-bloque',
          etiqueta: 'Registros por bloque',
          valor: ({ estructura }) => (
            estructura ? String(dominio.externa.formaDelArchivo(estructura.n).registrosPorBloque) : '0'
          )
        }
      ]
    };
  }

  // Configuración de cada tema sobre la pantalla común de búsqueda. Lo único
  // propio de un algoritmo es cómo se lee su traza: qué casillas son relevantes
  // para la elisión y en qué estado queda cada una en el paso actual.
  const TEMAS = {
    secuencial: {
      buscar: ({ estructura, objetivo }) => algoritmos.secuencial.buscarSecuencial(estructura.claves, objetivo),
      // Borrar en secuencial recorre desde la casilla 1, como buscar: la
      // eliminación no tiene camino propio, usa el del tema (CLAUDE.md 5.6).
      eliminar: ({ estructura, clave }) => algoritmos.eliminacion.eliminarPorBusqueda({
        pasos: algoritmos.secuencial.buscarSecuencial(estructura.claves, clave),
        claves: estructura.claves,
        clave
      }),
      casillasRelevantes: (paso) => (paso.casilla ? [paso.casilla] : []),
      describirCasilla: ({ paso, indice, ocupada }) => {
        if (paso && paso.casilla === indice) {
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada' };
          if (paso.tipo === TIPOS_PASO.ELIMINACION) return { estado: 'eliminada' };
          if (paso.tipo === TIPOS_PASO.COMPARACION) return { estado: 'en-evaluacion' };
        }
        // **El rastro del recorrido** (2026-09-27): las casillas ya comparadas
        // se apagan, como lo que descarta binaria —secuencial descarta una
        // casilla por comparación; binaria, media estructura—. Así se ve de un
        // vistazo cuánto lleva recorrido, que es lo que este tema enseña. Una
        // búsqueda que se agotó las descartó todas. El paso final deja la
        // estructura como queda, sin rastro (CLAUDE.md 7).
        if (paso && !paso.final && ocupada) {
          const recorrido = paso.tipo === TIPOS_PASO.COMPARACION || paso.tipo === TIPOS_PASO.ENCONTRADA;
          if ((recorrido && indice < paso.casilla) || paso.tipo === TIPOS_PASO.NO_ENCONTRADA) {
            return { estado: 'descartada' };
          }
        }
        return { estado: ocupada ? 'ocupada' : 'vacia' };
      },
      metricas: [METRICA_COMPARACIONES, METRICA_ACCESOS]
    },

    binaria: {
      buscar: ({ estructura, objetivo }) => algoritmos.binaria.buscarBinaria(estructura.claves, objetivo),
      // Borrar en binaria divide, como buscar: la clave se localiza con el
      // algoritmo del tema y solo entonces sale (CLAUDE.md 5.6).
      eliminar: ({ estructura, clave }) => algoritmos.eliminacion.eliminarPorBusqueda({
        pasos: algoritmos.binaria.buscarBinaria(estructura.claves, clave),
        claves: estructura.claves,
        clave
      }),
      // Cada paso deja su propia estructura a la vista (pedido del docente),
      // entera y con lo descartado apagado en su sitio (pedido del usuario,
      // 2026-09-27): el apilado completo es el paso a paso del algoritmo, y
      // se ve cómo se van apagando los tramos que ya no se usan.
      apilada: {
        rangoDePaso: (paso) => (
          paso.inicio === undefined ? null : { desde: paso.inicio, hasta: paso.fin }
        ),
        // Sacar la clave no es un descarte: no le corresponde una fila más.
        // Esos pasos se dibujan sobre la estructura completa, que es donde el
        // desplazamiento se ve moverse.
        // Tampoco el paso final: el apilado se va y queda la estructura como
        // queda, con la clave hallada (CLAUDE.md 6.3).
        aplicaA: (paso) => paso.tipo !== TIPOS_PASO.ELIMINACION && paso.tipo !== TIPOS_PASO.DESPLAZAMIENTO && !paso.final
      },
      casillasRelevantes: (paso) => [paso.inicio, paso.medio, paso.fin, paso.casilla].filter(Boolean),
      describirCasilla: ({ paso, indice, ocupada }) => {
        if (!paso) return { estado: ocupada ? 'ocupada' : 'vacia' };

        if (paso.tipo === TIPOS_PASO.ELIMINACION && paso.casilla === indice) {
          return { estado: 'eliminada' };
        }

        if (paso.descartadas && paso.descartadas.includes(indice)) {
          return { estado: 'descartada' };
        }

        // **Sin azul para el rango** (2026-09-27, CLAUDE.md 8.2): lo que
        // sigue en juego se ve normal y lo descartado, apagado. Es la misma
        // regla que secuencial —«apagado es descartado»—, y con lo descartado
        // apagado el azul ya no decía nada que no se viera.
        if (paso.medio === indice) {
          return { estado: paso.tipo === TIPOS_PASO.ENCONTRADA ? 'encontrada' : 'en-evaluacion' };
        }
        return { estado: ocupada ? 'ocupada' : 'vacia' };
      },
      metricas: [
        METRICA_COMPARACIONES,
        METRICA_ACCESOS,
        {
          id: 'maximo-teorico',
          etiqueta: 'Máximo de pasos',
          formula: '⌈log₂ n⌉',
          valor: ({ estructura }) => (
            estructura ? String(dominio.limites.maximoPasosBinaria(estructura.n)) : '0'
          )
        }
      ]
    },

    // Árboles de búsqueda digital (CLAUDE.md 5.5). El primero de los temas que
    // trabajan con letras y bits: la clave es una letra, su código son las
    // cinco cifras que la distinguen, y el árbol se recorre un bit por nivel.
    // Residuos múltiples (CLAUDE.md 5.5). Es residuos mirando un **bloque de
    // bits** por nivel en vez de un bit, así que solo cambian dos cosas: la
    // forma del árbol —que la pantalla toma de `config.arbol`— y el algoritmo.
    // Las claves siguen viviendo solo en las hojas, con todo lo que eso trae.
    'residuos-multiples': (() => {
      const BITS = dominio.clave.BITS_LETRA;
      const arbol = dominio.arbolMultiple;
      const operar = (operacion) => ({ estructura, clave, objetivo, letras }) => operacion({
        claves: estructura.claves,
        n: estructura.n,
        bits: BITS,
        clave,
        objetivo,
        letras
      });

      return {
        descripcion: `Un bloque de ${arbol.BLOQUES.join(', ')} bits por nivel, y las claves solo en las hojas`,
        orientacion: 'arbol',
        modo: dominio.estructura.MODOS.ARBOL,
        // La forma del árbol: cuatro ramas en los dos primeros niveles y dos en
        // el tercero, porque al último bloque solo le queda un bit.
        arbol,
        calculo: true,
        tituloCalculo: 'Código de la clave',
        // Sin operación el panel no se dibuja, como en transformación de
        // claves: el árbol se queda con el lienzo (usuario, 2026-09-28).
        calculoSoloEnOperacion: true,
        claveEsLetra: true,
        palabra: true,
        sinTamano: true,
        sinConfiguracion: true,
        clavesSoloEnHojas: true,
        tamano: () => ({ n: arbol.posiciones(), l: 1 }),
        nombreEstructura: 'árbol',
        mensajeReinicio: 'Árbol vaciado: sin claves.',
        detalleReciente: () => `bloques de ${arbol.BLOQUES.join(', ')} bits`,
        insertar: operar(algoritmos.residuosMultiples.insertar),
        buscar: operar(algoritmos.residuosMultiples.buscar),
        eliminar: operar(algoritmos.residuosMultiples.eliminar),
        insertarPalabra: operar(algoritmos.residuosMultiples.insertarPalabra),
        casillasRelevantes: (paso) => (paso.casilla ? [paso.casilla] : []),
        describirCasilla: ({ paso, indice, ocupada }) => {
          const base = ocupada ? 'ocupada' : 'vacia';
          if (!paso || paso.casilla !== indice) return { estado: base };
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada' };
          if (paso.tipo === TIPOS_PASO.INSERCION) return { estado: 'insertada' };
          if (paso.tipo === TIPOS_PASO.ELIMINACION) return { estado: 'eliminada' };
          if (paso.tipo === TIPOS_PASO.RECHAZADA) return { estado: 'colision' };
          if (paso.tipo === TIPOS_PASO.COLISION) return { estado: 'colision' };
          if (paso.tipo === TIPOS_PASO.NO_ENCONTRADA) return { estado: base, modificadores: ['direccion'] };
          if (paso.tipo === TIPOS_PASO.RAMIFICACION) return { estado: 'en-evaluacion' };
          return { estado: base };
        },
        metricas: [
          METRICA_COMPARACIONES,
          METRICA_ACCESOS,
          {
            id: 'altura',
            etiqueta: 'Altura',
            // La métrica que compara los dos temas: con bloques de dos bits el
            // mismo ejercicio baja de cinco niveles a tres.
            valor: ({ estructura }) => (estructura ? String(arbol.altura(estructura)) : '0')
          }
        ]
      };
    })(),

    // Búsqueda por residuos (CLAUDE.md 5.5). Comparte con el árbol digital
    // casi todo —la letra como clave, el código de bits, el modo `arbol`, el
    // dibujo por niveles, la palabra entera como operación— y se aparta en una
    // sola cosa, de la que cuelga el resto: **las claves solo viven en las
    // hojas**. De ahí salen `clavesSoloEnHojas` para la vista y un nivel más
    // de profundidad para la estructura.
    residuos: (() => {
      const BITS = dominio.clave.BITS_LETRA;
      // Un nivel más que el árbol digital: dos códigos que solo se separan en
      // el último bit dejan sus hojas por debajo del último nivel que se mira.
      const NIVELES = BITS + 1;
      const operar = (operacion) => ({ estructura, clave, objetivo, letras }) => operacion({
        claves: estructura.claves,
        n: estructura.n,
        bits: BITS,
        clave,
        objetivo,
        letras
      });

      return {
        descripcion: 'Un bit por nivel, y las claves solo en las hojas',
        orientacion: 'arbol',
        modo: dominio.estructura.MODOS.ARBOL,
        calculo: true,
        tituloCalculo: 'Código de la clave',
        // Sin operación el panel no se dibuja, como en transformación de
        // claves: el árbol se queda con el lienzo (usuario, 2026-09-28).
        calculoSoloEnOperacion: true,
        claveEsLetra: true,
        palabra: true,
        sinTamano: true,
        sinConfiguracion: true,
        // Los nodos de en medio no guardan clave ni podrán guardarla: se
        // dibujan como punto y no como casilla vacía (CLAUDE.md 6.7).
        clavesSoloEnHojas: true,
        tamano: () => ({ n: dominio.arbol.posiciones(NIVELES), l: 1 }),
        nombreEstructura: 'árbol',
        mensajeReinicio: 'Árbol vaciado: sin claves.',
        detalleReciente: () => `código de ${BITS} bits por letra`,
        insertar: operar(algoritmos.residuos.insertar),
        buscar: operar(algoritmos.residuos.buscar),
        eliminar: operar(algoritmos.residuos.eliminar),
        insertarPalabra: operar(algoritmos.residuos.insertarPalabra),
        casillasRelevantes: (paso) => (paso.casilla ? [paso.casilla] : []),
        describirCasilla: ({ paso, indice, ocupada }) => {
          const base = ocupada ? 'ocupada' : 'vacia';
          if (!paso || paso.casilla !== indice) return { estado: base };
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada' };
          if (paso.tipo === TIPOS_PASO.INSERCION) return { estado: 'insertada' };
          if (paso.tipo === TIPOS_PASO.ELIMINACION) return { estado: 'eliminada' };
          if (paso.tipo === TIPOS_PASO.RECHAZADA) return { estado: 'colision' };
          // El choque de dos claves en la misma hoja no es un error sino el
          // caso normal, pero es el momento que hay que mirar: las dos bajan.
          if (paso.tipo === TIPOS_PASO.COLISION) return { estado: 'colision' };
          // La posición vacía donde se cortó el camino se dibuja como casilla
          // —no como punto— para que se vea que ahí es donde la clave iría.
          if (paso.tipo === TIPOS_PASO.NO_ENCONTRADA) return { estado: base, modificadores: ['direccion'] };
          if (paso.tipo === TIPOS_PASO.RAMIFICACION) return { estado: 'en-evaluacion' };
          return { estado: base };
        },
        metricas: [
          // Comparaciones y accesos juntos son la lección del tema: se baja
          // tanto como diga el código y se compara una sola vez, al final.
          METRICA_COMPARACIONES,
          METRICA_ACCESOS,
          {
            id: 'altura',
            etiqueta: 'Altura',
            valor: ({ estructura }) => (estructura ? String(dominio.arbol.altura(estructura)) : '0')
          }
        ]
      };
    })(),

    'arbol-digital': (() => {
      const BITS = dominio.clave.BITS_LETRA;
      const operar = (operacion) => ({ estructura, clave, objetivo, letras }) => operacion({
        claves: estructura.claves,
        n: estructura.n,
        bits: BITS,
        clave,
        objetivo,
        letras
      });

      return {
        descripcion: 'Un bit por nivel, 0 a la izquierda y 1 a la derecha',
        orientacion: 'arbol',
        modo: dominio.estructura.MODOS.ARBOL,
        calculo: true,
        // Lo que se desarrolla aquí no es una dirección sino el código de la
        // letra y el camino que ese código abre.
        tituloCalculo: 'Código de la clave',
        // Sin operación el panel no se dibuja, como en transformación de
        // claves: el árbol se queda con el lienzo (usuario, 2026-09-28).
        calculoSoloEnOperacion: true,
        // La clave es una letra y además se puede insertar una palabra entera,
        // que es como se arma el ejercicio de clase.
        claveEsLetra: true,
        palabra: true,
        // El árbol no tiene tamaño que elegir: las posiciones salen de la
        // profundidad que dan los bits, y la clave es siempre una letra.
        sinTamano: true,
        // Y como no hay nada más que elegir —ni tratamiento ni parámetros—, el
        // panel de configuración entero sobra: el árbol se crea al entrar.
        sinConfiguracion: true,
        tamano: () => ({ n: dominio.arbol.posiciones(BITS), l: 1 }),
        nombreEstructura: 'árbol',
        mensajeReinicio: 'Árbol vaciado: sin claves.',
        detalleReciente: () => `código de ${BITS} bits por letra`,
        insertar: operar(algoritmos.arbolDigital.insertar),
        buscar: operar(algoritmos.arbolDigital.buscar),
        eliminar: operar(algoritmos.arbolDigital.eliminar),
        insertarPalabra: operar(algoritmos.arbolDigital.insertarPalabra),
        casillasRelevantes: (paso) => (paso.casilla ? [paso.casilla] : []),
        describirCasilla: ({ paso, indice, ocupada }) => {
          const base = ocupada ? 'ocupada' : 'vacia';
          if (!paso || paso.casilla !== indice) return { estado: base };
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada' };
          if (paso.tipo === TIPOS_PASO.INSERCION) return { estado: 'insertada' };
          // La clave que sale y la hoja que sube dejan la misma posición
          // vacía: lo que las distingue es la bitácora.
          if (paso.tipo === TIPOS_PASO.ELIMINACION) return { estado: 'eliminada' };
          if (paso.tipo === TIPOS_PASO.RECHAZADA) return { estado: 'colision' };
          if (paso.tipo === TIPOS_PASO.NO_ENCONTRADA) return { estado: base, modificadores: ['direccion'] };
          if (paso.tipo === TIPOS_PASO.COMPARACION) return { estado: 'en-evaluacion' };
          return { estado: base };
        },
        metricas: [
          METRICA_COMPARACIONES,
          METRICA_ACCESOS,
          {
            id: 'altura',
            etiqueta: 'Altura',
            // Lo que cuesta la peor búsqueda de este árbol, y la razón de que
            // el método se enseñe: el tope es el número de bits del código.
            valor: ({ estructura }) => (estructura ? String(dominio.arbol.altura(estructura)) : '0')
          }
        ]
      };
    })(),

    // Árbol de Huffman (CLAUDE.md 5.x). El cuarto de los árboles por residuo
    // del docente, y el único que no busca nada: se construye desde una
    // palabra y se lee su tabla de codificación. Por eso su panel no tiene
    // clave, ni inserta, ni elimina —`soloPalabra`—, y por eso su lienzo no
    // dibuja un árbol sino **un bosque que se va uniendo** (`orientacion:
    // 'bosque'`), que es donde se ve lo único que este tema enseña: cómo se
    // forma el árbol.
    //
    // Nada de esto toca `estructura.claves`: el bosque de cada paso viaja en
    // el propio paso, porque se deduce entero de la construcción. La
    // estructura existe solo para que la pantalla tenga de qué colgar la
    // operación.
    huffman: {
      orientacion: 'bosque',
      modo: dominio.estructura.MODOS.ARBOL,
      calculo: true,
      // Lo que se desarrolla no es una dirección ni un código de clave, sino
      // la cadena de reducciones que acaba en 1.
      tituloCalculo: 'Reducción',
      palabra: true,
      soloPalabra: true,
      // Sus claves son letras, como en los otros tres árboles: es lo que deja
      // abrir el archivo de uno en el otro (2026-10-01; hasta entonces se
      // declaraba numérico y el cruce se rechazaba).
      claveEsLetra: true,
      sinTamano: true,
      sinConfiguracion: true,
      tamano: () => ({ n: 1, l: 1 }),
      // `huffman-ciencias.cc2`: la palabra es lo que distingue el archivo.
      nombreArchivo: (estructura) => (estructura.ordenLlegada || []).join(''),
      nombreEstructura: 'árbol',
      mensajeReinicio: 'Árbol vaciado: sin palabra.',
      detalleReciente: () => 'árbol de Huffman',
      // La palabra necesita al menos dos letras distintas: con una sola no hay
      // reducción posible y su código sería la cadena vacía.
      validarPalabra: (entrada) => dominio.huffman.validarPalabra(entrada),
      insertarPalabra: ({ letras }) => algoritmos.huffman.construirDesdePalabra({ letras }),
      // El árbol y su tabla se dibujan desde el paso, no desde la estructura:
      // el paso final los hereda para no quedar en blanco. La reducción
      // también, porque es el resultado del tema y no un resaltado.
      conservarAlFinal: ['total', 'bosque', 'tabla', 'arbol', 'calculo'],
      casillasRelevantes: () => [],
      describirCasilla: ({ ocupada }) => ({ estado: ocupada ? 'ocupada' : 'vacia' }),
      metricas: [
        {
          id: 'letras',
          etiqueta: 'Letras distintas',
          // Las dos de rótulo largo, cada una en su renglón: en la columna se
          // partían en dos líneas (como el factor de carga, 2026-09-28).
          ancha: true,
          valor: ({ paso }) => (paso && paso.total ? String(hojasDelPaso(paso)) : '0')
        },
        {
          id: 'reducciones',
          etiqueta: 'Reducciones',
          valor: ({ paso }) => (paso && paso.total ? String(Math.max(hojasDelPaso(paso) - 1, 0)) : '0')
        },
        {
          // La conclusión del tema: cuántos bits cuesta en promedio una letra.
          // Hasta que el árbol no está, ninguna letra tiene código y no hay
          // media que dar.
          id: 'media',
          etiqueta: 'Bits por letra',
          ancha: true,
          valor: ({ paso }) => (paso && paso.tabla
            ? (paso.tabla.suma / paso.tabla.total).toString().replace('.', ',')
            : '—')
        }
      ]
    },

    'hash-modulo': temaHash({
      direccionDe: algoritmos.hash.modulo.direccionModulo
    }),

    'hash-cuadrado': temaHash({
      direccionDe: algoritmos.hash.cuadrado.direccionCuadrado
    }),

    // Las posiciones son del estudiante: "fijas" significa las mismas para
    // toda la estructura, no decididas por el simulador. Es lo que el docente
    // plantea en un ejercicio ("tome la primera y la tercera cifra").
    'hash-truncamiento': temaHash({
      direccionDe: algoritmos.hash.truncamiento.direccionTruncamiento,
      parametros: [
        {
          nombre: 'posiciones',
          etiqueta: 'Posiciones a tomar',
          tipo: 'texto',
          marcador: '1, 3',
          ayuda: 'Cifras de la clave, numeradas desde 1. Si se deja vacío, se toman las primeras que hagan falta para direccionar n.',
          validar: (entrada, { n, l }) => (
            entrada.trim() === ''
              ? { valido: true, valor: algoritmos.hash.truncamiento.posicionesPorDefecto(n) }
              : algoritmos.hash.truncamiento.validarPosiciones(entrada, { n, l })
          )
        }
      ]
    }),

    // La operación entre grupos la elige el estudiante, como las posiciones
    // del truncamiento: el docente plantea el ejercicio sumando los grupos o
    // multiplicándolos, y el resto del cálculo es el mismo.
    'hash-plegamiento': temaHash({
      direccionDe: algoritmos.hash.plegamiento.direccionPlegamiento,
      parametros: [
        {
          nombre: 'operacion',
          etiqueta: 'Operación entre grupos',
          opciones: [
            { valor: algoritmos.hash.plegamiento.OPERACIONES.SUMAR, etiqueta: 'Sumar' },
            { valor: algoritmos.hash.plegamiento.OPERACIONES.MULTIPLICAR, etiqueta: 'Multiplicar' }
          ],
          ayuda: 'Los grupos se combinan con esta operación; del total se toman las últimas cifras.',
          validar: (entrada) => algoritmos.hash.plegamiento.validarOperacion(entrada)
        }
      ]
    }),

    // No convierte la clave: lee sus cifras como cifras en base b y evalúa el
    // polinomio (CLAUDE.md 5.3). Con base 2 eso hace que las cifras pesen como
    // bits, pero no muestra la clave en binario: lo binario del documento
    // quedó otra vez sin resolver.
    'hash-bases': temaHash({
      direccionDe: algoritmos.hash.bases.direccionBases,
      parametros: [
        {
          nombre: 'base',
          etiqueta: 'Base de conversión',
          tipo: 'numero',
          marcador: String(algoritmos.hash.bases.BASE_POR_DEFECTO),
          ayuda: `Entre ${algoritmos.hash.bases.BASE_MINIMA} y ${algoritmos.hash.bases.BASE_MAXIMA}. `
            + `Si se deja vacío se usa ${algoritmos.hash.bases.BASE_POR_DEFECTO}.`,
          validar: (entrada) => (
            entrada.trim() === ''
              ? { valido: true, valor: algoritmos.hash.bases.BASE_POR_DEFECTO }
              : algoritmos.hash.bases.validarBase(entrada)
          )
        }
      ]
    }),

    // Las dos búsquedas externas (CLAUDE.md 5.8 y 5.11) comparten todo menos
    // el recorrido: ver `temaExterno`.
    'secuencial-externa': temaExterno(algoritmos.secuencialExterna.buscarSecuencialExterna),
    'binaria-externa': temaExterno(algoritmos.binariaExterna.buscarBinariaExterna),

    // Índices primarios, secundarios y multinivel (CLAUDE.md 5.x). El tema que
    // más se sale del molde del catálogo: **no se inserta ni se busca ninguna
    // clave**. De cuatro parámetros —cuántos registros tiene el archivo y
    // cuánto miden un registro, un registro índice y un bloque— sale una
    // estructura, y construirla bien *es* el ejercicio (pedido del usuario,
    // 2026-09-17, sobre la hoja manuscrita del docente que dejó en `docs/`).
    //
    // De ahí las tres cosas que ningún otro tema necesita:
    //
    //   · `sinOperaciones` — no hay panel de clave, porque no hay clave.
    //   · `alCrear` — crear la estructura arranca la derivación, que es la
    //     única traza del tema. Los demás temas crean primero y operan después;
    //     aquí no queda nada que pedir.
    //   · El orden de los parámetros importa: `B` va antes que `R` y `Ri`,
    //     porque esos dos se validan contra él —un registro que no cabe en un
    //     bloque no da estructura— y `leerParametros` los lee en orden.
    indices: {
      orientacion: 'indices',
      calculo: true,
      tituloCalculo: 'Derivación',
      // Sin estructura no se dibuja (2026-09-30); creada, la derivación se
      // queda, porque el paso final la conserva (`conservarAlFinal`).
      calculoSoloEnOperacion: true,
      sinTamano: true,
      sinLongitud: true,
      sinOperaciones: true,
      sinClaves: true,
      tamano: () => ({ n: 1, l: 1 }),
      nombreEstructura: 'estructura',
      mensajeReinicio: 'Estructura vaciada: sin parámetros.',
      mensajeLienzoVacio: 'Dé los parámetros del archivo para construir la estructura: '
        + 'elija sus medidas en el panel de la derecha.',
      mensajeDerivacion: 'Derivación iniciada: de los parámetros a la estructura.',
      mensajeCreacion: (estructura) => {
        const p = estructura.parametros;
        return `Estructura creada: r = ${p.r}, B = ${p.B}, R = ${p.R}, Ri = ${p.Ri}, `
          + `índice ${p.tipo}${p.niveles === dominio.indices.NIVELES.MULTINIVEL ? ' multinivel' : ''}.`;
      },
      detalleReciente: (estructura) => {
        const p = estructura.parametros;
        return `r = ${p.r} · índice ${p.tipo}`
          + (p.niveles === dominio.indices.NIVELES.MULTINIVEL ? ' multinivel' : '');
      },
      alCrear: ({ estructura }) => algoritmos.indices.derivar(estructura.parametros),
      // La derivación se dibuja desde el paso, y sus cuentas son el resultado
      // del tema: el paso final las hereda todas menos la columna en curso.
      conservarAlFinal: ['calculo', 'definidas', 'estructura'],
      // El archivo se llamaría `indices-n1-l1.cc2`, que no dice nada: `n` y `l`
      // son de mentira en este tema. Lo que lo distingue en la carpeta de
      // descargas es con qué archivo y qué índice se construyó.
      nombreArchivo: (estructura) => {
        const p = estructura.parametros;
        return `r${p.r}-B${p.B}-${p.tipo}${p.niveles === dominio.indices.NIVELES.MULTINIVEL ? '-multinivel' : ''}`;
      },
      parametros: [
        {
          nombre: 'r',
          etiqueta: 'Registros del archivo (r)',
          tipo: 'numero',
          marcador: '500000',
          ayuda: 'Cuántos registros guarda el archivo de datos.',
          validar: (entrada) => dominio.indices.validarRegistros(entrada)
        },
        {
          nombre: 'B',
          etiqueta: 'Tamaño del bloque (B)',
          tipo: 'numero',
          marcador: '4096',
          ayuda: 'En bytes. Es lo que se lee del disco de una vez, y de ahí salen los dos factores de bloqueo.',
          validar: (entrada) => dominio.indices.validarBloque(entrada)
        },
        {
          nombre: 'R',
          etiqueta: 'Longitud del registro de datos (R)',
          tipo: 'numero',
          marcador: '120',
          ayuda: 'En bytes. Con B da cuántos registros caben en un bloque.',
          validar: (entrada, { parametros }) => dominio.indices.validarLongitud(entrada, {
            etiqueta: 'Longitud del registro de datos (R)', B: parametros.B
          })
        },
        {
          nombre: 'Ri',
          etiqueta: 'Longitud del registro índice (Ri)',
          tipo: 'numero',
          marcador: '15',
          ayuda: 'En bytes. Es menor que R —solo lleva el valor y un puntero—, y por eso el índice cunde más.',
          validar: (entrada, { parametros }) => dominio.indices.validarLongitud(entrada, {
            etiqueta: 'Longitud del registro índice (Ri)', B: parametros.B
          })
        },
        {
          nombre: 'tipo',
          etiqueta: 'Tipo de índice',
          opciones: [
            { valor: 'primario', etiqueta: 'Primario — una entrada por bloque' },
            { valor: 'secundario', etiqueta: 'Secundario — una entrada por registro' }
          ],
          ayuda: 'El primario es disperso porque el archivo está ordenado por ese campo; el secundario, denso.',
          validar: (entrada) => dominio.indices.validarTipo(entrada)
        },
        {
          nombre: 'niveles',
          etiqueta: 'Niveles',
          opciones: [
            { valor: 'un-nivel', etiqueta: 'Un nivel' },
            { valor: 'multinivel', etiqueta: 'Multinivel' }
          ],
          ayuda: 'El multinivel indexa el índice, y otra vez, hasta que un nivel cabe en un solo bloque.',
          validar: (entrada) => dominio.indices.validarNiveles(entrada)
        }
      ],
      // No hay casillas que describir: la estructura de este tema no guarda
      // claves. Se declaran igual porque la pantalla las pide para todos.
      casillasRelevantes: () => [],
      describirCasilla: ({ ocupada }) => ({ estado: ocupada ? 'ocupada' : 'vacia' }),
      // Las cuatro, cada una en su renglón (`ancha`, 2026-09-30): en dos
      // columnas, rótulos como «Bloques del archivo» junto a un valor de
      // cinco cifras se partían en dos y tres renglones.
      metricas: [
        {
          // La conclusión del tema, y la que se compara entre las cuatro
          // combinaciones: 7 con primarios de un nivel, 12 con secundarios,
          // 3 y 4 con sus multiniveles.
          id: 'accesos',
          etiqueta: 'Accesos por búsqueda',
          ancha: true,
          valor: ({ paso }) => (paso && paso.estructura ? String(paso.estructura.accesos) : '—')
        },
        {
          id: 'bloques-indice',
          etiqueta: 'Bloques del índice',
          ancha: true,
          valor: ({ paso }) => (paso && paso.estructura
            ? dominio.indices.mil(paso.estructura.escalones[0].bloques)
            : '—')
        },
        {
          id: 'bloques-datos',
          etiqueta: 'Bloques del archivo',
          ancha: true,
          valor: ({ paso }) => (paso && paso.estructura
            ? dominio.indices.mil(paso.estructura.archivo.bloques)
            : '—')
        },
        {
          id: 'niveles',
          etiqueta: 'Niveles del índice',
          ancha: true,
          valor: ({ paso }) => (paso && paso.estructura ? String(paso.estructura.escalones.length) : '—')
        }
      ]
    },

    // Otras búsquedas dinámicas (CLAUDE.md 5.x): la única estructura del
    // catálogo donde `n` no lo fija el estudiante para toda la vida, sino que
    // crece o decrece solo. Una cubeta con `r` renglones es exactamente la
    // misma forma que ya usa el tratamiento de arreglos anidados —el primer
    // renglón en `claves`, los `r - 1` restantes en `anidados`—, así que se
    // reutiliza esa matriz para dibujar sin CSS nuevo; lo único propio del
    // tema es `algoritmos.cubetas`, que sabe cuándo expandir y reducir.
    cubetas: {
      // Horizontal y no vertical (a diferencia de los temas hash, CLAUDE.md
      // 6.1): el docente dibuja las cubetas en columnas —n cubetas lado a
      // lado— con los renglones bajando dentro de cada una, y no al revés.
      orientacion: 'horizontal',
      modo: dominio.estructura.MODOS.DISPERSA,
      calculo: true,
      // Sin operación no se dibuja, como en hash y en los árboles (maqueta de
      // la parada de externas, elegida por el usuario el 2026-09-30).
      calculoSoloEnOperacion: true,
      // Las cubetas se numeran desde 0 (pedido del usuario, 2026-09-06): así
      // las dibuja el docente y así calcula H(k) = k mod n. Es la única
      // excepción a "toda salida numera desde 1" (CLAUDE.md 3.1) — los
      // renglones de cada cubeta siguen numerando desde 1.
      numerarDesdeCero: true,
      // Las claves del ejercicio mezclan libremente cifras de distinto
      // tamaño (CLAUDE.md 5.7): no se pide longitud de clave.
      sinLongitud: true,
      parametros: [
        {
          nombre: 'r',
          etiqueta: 'Registros por cubeta (r)',
          tipo: 'numero',
          marcador: '3',
          ayuda: 'Cuántos renglones caben en cada cubeta antes de que choque y haya que expandir.',
          validar: (entrada) => dominio.cubetas.validarR(entrada)
        },
        {
          nombre: 'modoExpansion',
          etiqueta: 'Modo de expansión y reducción',
          opciones: [
            { valor: dominio.cubetas.MODOS_EXPANSION.TOTAL, etiqueta: 'Total (n se duplica o se divide entre dos)' },
            { valor: dominio.cubetas.MODOS_EXPANSION.PARCIAL, etiqueta: 'Parcial (series intercaladas)' }
          ],
          ayuda: 'Cómo crece o decrece la cantidad de cubetas al expandir o reducir.',
          validar: (entrada, contexto) => dominio.cubetas.validarModoExpansion(entrada, contexto)
        },
        {
          nombre: 'umbralExpandir',
          etiqueta: 'Densidad para expandir (%)',
          tipo: 'numero',
          marcador: '82',
          ayuda: 'Al llegar o superar este porcentaje de ocupación —o al chocar una cubeta llena—, la estructura se expande.',
          validar: (entrada) => dominio.cubetas.validarUmbral(entrada, 'Densidad para expandir'),
          // Se guarda como fracción y se digita como porcentaje: al abrir un
          // archivo hay que volverlo a escribir como se digita para validarlo.
          comoTexto: dominio.cubetas.umbralComoTexto
        },
        {
          nombre: 'umbralReducir',
          etiqueta: 'Densidad para reducir (%)',
          tipo: 'numero',
          marcador: '125',
          ayuda: 'Al caer por debajo de este porcentaje (claves por cubeta, sin contar los renglones), la estructura se reduce.',
          validar: (entrada) => dominio.cubetas.validarUmbral(entrada, 'Densidad para reducir'),
          comoTexto: dominio.cubetas.umbralComoTexto
        }
      ],
      // La matriz "casilla principal + arreglo anidado" ya existe (CLAUDE.md
      // 5.4): una cubeta es exactamente eso, con tamaño `r - 1` en vez de
      // `n - 1`.
      anidados: {
        tamano: (estructura) => estructura.parametros.r - 1,
        columnas: (estructura) => estructura.parametros.r - 1
      },
      insertar: algoritmos.cubetas.insertar,
      buscar: algoritmos.cubetas.buscar,
      eliminar: algoritmos.cubetas.eliminar,
      detalleReciente: (estructura) => `n = ${estructura.n} · r = ${estructura.parametros.r}`,
      // Vaciar aquí hace algo más que quitar las claves: devuelve `n` al valor
      // con que se creó la estructura, no al que alcanzó expandiéndose
      // (CLAUDE.md 5.7). Es el único tema donde eso pasa, así que se dice.
      mensajeReinicio: (estructura) => `Estructura vaciada: sin claves, y n vuelve a ${estructura.n}.`,
      casillasRelevantes: (paso) => (paso.casilla ? [paso.casilla] : []),
      describirCasilla: ({ paso, indice, posicion, ocupada }) => {
        const base = ocupada ? 'ocupada' : 'vacia';
        if (!paso) return { estado: base };

        const modificadores = [];
        if (paso.casilla === indice && paso.posicion === posicion) {
          if (paso.tipo === TIPOS_PASO.ENCONTRADA) return { estado: 'encontrada', modificadores };
          if (paso.tipo === TIPOS_PASO.INSERCION) return { estado: 'insertada', modificadores };
          if (paso.tipo === TIPOS_PASO.ELIMINACION) return { estado: 'eliminada', modificadores };
          if (paso.tipo === TIPOS_PASO.COLISION) return { estado: 'colision', modificadores };
          return { estado: 'en-evaluacion', modificadores };
        }
        if (posicion === undefined && paso.colision === indice) return { estado: 'colision', modificadores };
        // Los renglones de la cubeta que ya se pasaron de largo, apagados,
        // como lo que el sondeo salta en hash (2026-09-30). El renglón de la
        // colisión conserva su rojo: lo pinta el paso, más arriba.
        if (posicion !== undefined && paso.casilla === indice) {
          if (paso.recorridas && paso.recorridas.includes(posicion)) return { estado: 'descartada', modificadores };
        }
        return { estado: base, modificadores };
      },
      metricas: [
        METRICA_COMPARACIONES,
        METRICA_ACCESOS,
        {
          id: 'cubetas-n',
          etiqueta: 'Cubetas',
          formula: 'n',
          valor: ({ estructura }) => (estructura ? String(estructura.n) : '0')
        },
        {
          id: 'densidad',
          etiqueta: 'Densidad de ocupación',
          // En su renglón y con coma decimal, como el resto de la aplicación
          // («2,5 bits»): en la columna se leía «70.8» con el «%» debajo. El
          // espacio que lo separa del número no se parte.
          ancha: true,
          // Cuenta la clave que está esperando en la fila «Col»: en ese
          // instante el taller escribe 8/9 y no 7/9, porque la densidad mide
          // claves intentadas y esa ya se intentó (CLAUDE.md 5.7).
          valor: ({ estructura, paso }) => (
            estructura
              ? `${(dominio.cubetas.densidadExpandir(estructura, paso && paso.rechazada ? 1 : 0) * 100).toFixed(1).replace('.', ',')}\u00a0%`
              : '0,0\u00a0%'
          )
        }
      ]
    }
  };

  let elementosDomMenu = {};

  function montarPantalla(pantalla) {
    const raiz = document.getElementById('app');
    raiz.innerHTML = '';
    raiz.appendChild(pantalla);
  }

  // **El nombre de un tema vive en un solo sitio: el catálogo.** Antes estaba
  // también en `TEMAS`, duplicado —y en tres temas las dos copias ya decían
  // cosas distintas—. La pantalla recibe el nodo del catálogo fundido con su
  // configuración, así que el menú y la cabecera no pueden volver a
  // desincronizarse.
  //
  // La descripción se hereda del catálogo, y un tema **puede escribir la
  // suya** cuando quiera decir algo más: en el menú la descripción sirve para
  // escoger entre temas, y dentro de la pantalla para situarse en el que ya se
  // escogió, que no siempre pide las mismas palabras. La diferencia deja de
  // ser un descuido y pasa a estar declarada.
  function mostrarTema(tema) {
    const config = TEMAS[tema.tema];
    if (!tema.disponible || !config) {
      mostrarAlertaMenu('info', `Tema en construcción: "${tema.titulo}" aún no está implementado.`);
      return;
    }
    const configDelTema = Object.assign({}, config, {
      // La clave del tema viaja con su configuración: el archivo `.cc2` la
      // guarda y al abrir se comprueba que corresponda (CLAUDE.md 10).
      id: tema.tema,
      titulo: tema.titulo,
      descripcion: config.descripcion || tema.descripcion
    });
    montarPantalla(vista.pantallas.temaBusqueda.crearPantallaTema(configDelTema, mostrarMenu));
  }

  function mostrarAlertaMenu(tipo, mensaje) {
    if (!elementosDomMenu.alertas) return;
    elementosDomMenu.alertas.innerHTML = '';
    const icono = tipo === 'error' ? '✕' : tipo === 'advertencia' ? '!' : 'i';
    elementosDomMenu.alertas.appendChild(vista.componentes.panel.crearAlerta({ tipo, mensaje, icono }));
  }

  function mostrarMenu() {
    elementosDomMenu = { alertas: document.createElement('div') };

    const pantalla = vista.pantallas.menu.crearPantallaMenu({
      catalogo: CATALOGO,
      recientes: persistencia.recientes.obtener(),
      alSeleccionarTema: mostrarTema
    });

    const barra = pantalla.querySelector('.pantalla-menu__barra');
    barra.after(elementosDomMenu.alertas);

    montarPantalla(pantalla);
  }

  document.addEventListener('DOMContentLoaded', mostrarMenu);
})();
