(function () {
  // Tres modos de estructura, porque los temas colocan las claves de forma
  // distinta (CLAUDE.md 3.2):
  //
  //   'ordenada' — secuencial y binaria. Arreglo denso, siempre ascendente.
  //                La casilla i contiene claves[i-1] y no hay huecos.
  //   'dispersa' — transformación de claves. La clave aterriza en la dirección
  //                que le da la función hash, así que quedan huecos en el medio
  //                y el orden ascendente deja de aplicar.
  //
  //   'arbol'    — árboles de búsqueda por bits (CLAUDE.md 5.5). También usa
  //                `claves`, pero indexado como árbol binario implícito: la
  //                raíz es la posición 1, y los hijos de i son 2i y 2i + 1.
  //                Sin arreglo de nodos ni punteros: la posición dice el
  //                camino de bits que llevó hasta ella, que es lo que el tema
  //                enseña, y dibujar o contar sigue leyendo `claves`.
  //
  // En los tres modos `claves` es el arreglo que la vista lee por posición,
  // para que dibujar la estructura no dependa del modo.
  const MODOS = Object.freeze({ ORDENADA: 'ordenada', DISPERSA: 'dispersa', ARBOL: 'arbol' });

  function crearEstructura({ n, l, tipoClave, modo = MODOS.ORDENADA, tratamiento = null }) {
    // El árbol no tiene tamaño que validar: `n` no es una capacidad elegida
    // sino cuántas posiciones caben en la profundidad que dan los bits, y `l`
    // es siempre una letra.
    const validacion = modo === MODOS.ARBOL
      ? { valido: true, advertencia: null }
      : window.CC2.dominio.limites.validarTamano(n, l);
    if (!validacion.valido) {
      return { exito: false, mensaje: validacion.mensaje };
    }
    return {
      exito: true,
      advertencia: validacion.advertencia,
      estructura: {
        n,
        l,
        tipoClave,
        modo,
        tratamiento,
        // La dispersa nace con las n casillas vacías: su longitud no crece con
        // las inserciones, cambia solo qué posiciones están definidas.
        claves: (modo === MODOS.DISPERSA || modo === MODOS.ARBOL) ? new Array(n) : [],
        // Estructuras secundarias por dirección (CLAUDE.md 5.4): una por
        // casilla, y las llenan los dos tratamientos que dejan la clave en su
        // dirección —arreglos anidados y encadenamiento secuencial—. Se
        // declaran siempre para que dibujar y contar no dependan de qué
        // tratamiento se eligió, igual que `claves`.
        anidados: modo === MODOS.DISPERSA ? new Array(n) : [],
        // La fila «Col» de cada cubeta en otras búsquedas dinámicas (CLAUDE.md
        // 5.7): las claves que chocaron con una cubeta llena esperan aquí,
        // guardadas, hasta que la densidad pida expandir. Una lista por
        // dirección, sin tope. Los demás temas no la usan y queda vacía.
        desbordes: modo === MODOS.DISPERSA ? new Array(n) : [],
        // En qué orden llegaron las claves, para poder rehacer la estructura.
        ordenLlegada: [],
        // Cuánto cabe en la estructura secundaria de cada dirección. Cero es
        // "no hay", que es el caso de los otros tratamientos, e `Infinity` es
        // la cadena, que no tiene tope.
        tamanoAnidado: 0
      }
    };
  }

  // **El orden en que llegaron las claves es un dato de la estructura**, no un
  // adorno: es lo que permite rehacerla colocándolas otra vez como cayeron.
  // Hacía falta ya para expandir una tabla de cubetas (CLAUDE.md 5.7) y hace
  // falta para abrir un archivo (CLAUDE.md 10), porque la estructura no lo
  // sabe por sí sola: en un arreglo ordenado las claves están ordenadas y no
  // en el orden en que entraron, y en uno disperso la posición la decide la
  // función hash. Sin este registro, guardar y volver a abrir una tabla con
  // colisiones daría otra tabla.
  function anotarLlegada(estructura, valor) {
    if (!estructura.ordenLlegada) estructura.ordenLlegada = [];
    estructura.ordenLlegada.push(valor);
  }

  function olvidarLlegada(estructura, valor) {
    if (!estructura.ordenLlegada) return;
    const indice = estructura.ordenLlegada.indexOf(valor);
    if (indice !== -1) estructura.ordenLlegada.splice(indice, 1);
  }

  // El arreglo anidado de una dirección, siempre como arreglo: quien dibuja o
  // recorre no tiene que distinguir "todavía no existe" de "está vacío".
  function anidadoDe(estructura, indice) {
    return (estructura.anidados && estructura.anidados[indice - 1]) || [];
  }

  // Mantiene la invariante "siempre ordenada ascendente" (CLAUDE.md 3.2)
  // devolviendo el índice donde insertar sin romper el orden.
  function buscarPosicionInsercion(claves, valor) {
    let inicio = 0;
    let fin = claves.length;
    while (inicio < fin) {
      const medio = (inicio + fin) >> 1;
      if (claves[medio] < valor) inicio = medio + 1;
      else fin = medio;
    }
    return inicio;
  }

  // Único contador válido para los tres modos: en la dispersa y en el árbol
  // `claves.length` es siempre n, ocupada o no, así que hay que contar las
  // definidas. Las de los arreglos anidados cuentan igual: están en la
  // estructura.
  function cantidadClaves(estructura) {
    if (estructura.modo === MODOS.ORDENADA) return estructura.claves.length;
    let total = 0;
    for (let i = 0; i < estructura.claves.length; i++) {
      if (estructura.claves[i] !== undefined) total++;
    }
    for (const anidado of estructura.anidados || []) {
      if (!anidado) continue;
      for (const clave of anidado) if (clave !== undefined) total++;
    }
    for (const col of estructura.desbordes || []) if (col) total += col.length;
    return total;
  }

  // Cuántas claves caben. Con arreglos anidados no son `n` sino `n × (1 + k)`:
  // medir contra `n` daría la estructura por llena teniendo sitio de sobra, y
  // el factor de carga mentiría por el mismo motivo.
  // Con encadenamiento la cadena no tiene tope (`tamanoAnidado` vale
  // `Infinity`) y la capacidad deja de ser un número: la estructura no se
  // satura nunca, que es lo que define al tratamiento.
  //
  // En el árbol `n` no es una capacidad elegida sino cuántas posiciones caben
  // en la profundidad que dan los bits; su límite real es el alfabeto, y por
  // eso el tema no lleva factor de carga entre sus métricas.
  function capacidad(estructura) {
    if (estructura.modo !== MODOS.DISPERSA) return estructura.n;
    return estructura.n * (1 + (estructura.tamanoAnidado || 0));
  }

  // Contra qué se mide el factor de carga. Normalmente es la capacidad, pero
  // cuando no hay capacidad que medir se mide contra `n`, y entonces el factor
  // significa lo que significa en una tabla encadenada: claves por dirección
  // en promedio, que **puede pasar de 1**. Dividir por una capacidad infinita
  // daría siempre 0 y la métrica no diría nada.
  function baseDeCarga(estructura) {
    const cabe = capacidad(estructura);
    return Number.isFinite(cabe) ? cabe : estructura.n;
  }

  function estaLlena(estructura) {
    return cantidadClaves(estructura) >= capacidad(estructura);
  }

  function estaVacia(estructura) {
    return cantidadClaves(estructura) === 0;
  }

  // Índice base 1 de la casilla que contiene la clave, o 0 si no está
  // (CLAUDE.md 3.1). Sirve para la invariante de unicidad en los dos modos.
  //
  // Una clave que vive en un arreglo anidado devuelve la **dirección** que lo
  // sostiene: es la casilla a la que pertenece, y es lo que hay que decir para
  // rechazar un duplicado.
  function casillaDe(estructura, valor) {
    const posicion = estructura.claves.indexOf(valor);
    if (posicion !== -1) return posicion + 1;
    const anidados = estructura.anidados || [];
    for (let i = 0; i < anidados.length; i++) {
      if (anidados[i] && anidados[i].indexOf(valor) !== -1) return i + 1;
    }
    const desbordes = estructura.desbordes || [];
    for (let i = 0; i < desbordes.length; i++) {
      if (desbordes[i] && desbordes[i].indexOf(valor) !== -1) return i + 1;
    }
    return 0;
  }

  // El índice devuelto es siempre base 1 (CLAUDE.md 3.1): este es el único
  // punto donde se hace la conversión de índice de arreglo a casilla visible.
  function insertar(estructura, valor) {
    if (estaLlena(estructura)) {
      return { exito: false, mensaje: `Estructura saturada: capacidad máxima de ${estructura.n} casillas alcanzada.` };
    }
    const posicionExistente = estructura.claves.indexOf(valor);
    if (posicionExistente !== -1) {
      return { exito: false, mensaje: `Clave duplicada: la clave ya reside en la posición ${posicionExistente + 1}.` };
    }
    const posicion = buscarPosicionInsercion(estructura.claves, valor);
    estructura.claves.splice(posicion, 0, valor);
    anotarLlegada(estructura, valor);
    return { exito: true, indice: posicion + 1 };
  }

  function eliminar(estructura, valor) {
    const posicion = estructura.claves.indexOf(valor);
    if (posicion === -1) {
      return { exito: false, mensaje: 'Clave no localizada en la estructura.' };
    }
    if (estructura.modo === MODOS.DISPERSA) {
      delete estructura.claves[posicion];
    } else {
      estructura.claves.splice(posicion, 1);
    }
    olvidarLlegada(estructura, valor);
    return { exito: true, indice: posicion + 1 };
  }

  // Colocación directa en una casilla concreta, que es como inserta la
  // transformación de claves: la dirección ya viene calculada por el algoritmo,
  // el dominio solo la aplica. No decide nada sobre colisiones —eso es del
  // tratamiento— pero sí se niega a pisar una casilla ocupada.
  function colocarEn(estructura, indice, valor) {
    if (estructura.modo !== MODOS.DISPERSA) {
      return { exito: false, mensaje: 'Colocación directa no aplicable a una estructura ordenada.' };
    }
    if (indice < 1 || indice > estructura.n) {
      return { exito: false, mensaje: `Dirección fuera de rango: ${indice} no pertenece a 1..${estructura.n}.` };
    }
    if (estructura.claves[indice - 1] !== undefined) {
      return { exito: false, mensaje: `Casilla ocupada: la casilla ${indice} ya contiene una clave.` };
    }
    estructura.claves[indice - 1] = valor;
    anotarLlegada(estructura, valor);
    return { exito: true, indice };
  }

  function retirarDe(estructura, indice) {
    if (estructura.modo !== MODOS.DISPERSA) {
      return { exito: false, mensaje: 'Retiro directo no aplicable a una estructura ordenada.' };
    }
    const valor = estructura.claves[indice - 1];
    if (valor === undefined) {
      return { exito: false, mensaje: `Casilla vacía: la casilla ${indice} no contiene ninguna clave.` };
    }
    delete estructura.claves[indice - 1];
    olvidarLlegada(estructura, valor);
    return { exito: true, indice, valor };
  }

  // Colocación y retiro en el arreglo anidado de una dirección. Son las
  // hermanas de `colocarEn` y `retirarDe`: el algoritmo ya decidió dirección y
  // posición, el dominio solo las aplica.
  function colocarEnAnidado(estructura, indice, posicion, valor) {
    if (estructura.modo !== MODOS.DISPERSA) {
      return { exito: false, mensaje: 'Arreglo anidado no aplicable a una estructura ordenada.' };
    }
    if (indice < 1 || indice > estructura.n) {
      return { exito: false, mensaje: `Dirección fuera de rango: ${indice} no pertenece a 1..${estructura.n}.` };
    }
    if (!estructura.anidados[indice - 1]) estructura.anidados[indice - 1] = [];
    const anidado = estructura.anidados[indice - 1];
    if (anidado[posicion - 1] !== undefined) {
      return { exito: false, mensaje: `Casilla ocupada: la posición ${posicion} del arreglo anidado de ${indice} ya contiene una clave.` };
    }
    anidado[posicion - 1] = valor;
    anotarLlegada(estructura, valor);
    return { exito: true, indice, posicion };
  }

  function retirarDeAnidado(estructura, indice, posicion) {
    const anidado = estructura.anidados && estructura.anidados[indice - 1];
    const valor = anidado && anidado[posicion - 1];
    if (valor === undefined) {
      return { exito: false, mensaje: `Casilla vacía: la posición ${posicion} del arreglo anidado de ${indice} no contiene ninguna clave.` };
    }
    delete anidado[posicion - 1];
    olvidarLlegada(estructura, valor);
    // Sin recortar la cola, sacar la última clave dejaría un hueco al final y
    // el mismo estado tendría dos representaciones: `[a]` y `[a, <hueco>]`.
    // No mueve ninguna clave —las de delante conservan su posición—, solo deja
    // de contar un vacío que nadie ocupa.
    while (anidado.length > 0 && anidado[anidado.length - 1] === undefined) anidado.length--;
    return { exito: true, indice, posicion, valor };
  }

  // La fila «Col» de una cubeta (CLAUDE.md 5.7): la clave que chocó con una
  // cubeta llena se guarda al final de su lista, y al salir la lista se cierra
  // sola —no tiene renglones fijos que conservar—.
  function colDe(estructura, indice) {
    return (estructura.desbordes && estructura.desbordes[indice - 1]) || [];
  }

  function colocarEnCol(estructura, indice, valor) {
    if (!estructura.desbordes) estructura.desbordes = new Array(estructura.n);
    if (!estructura.desbordes[indice - 1]) estructura.desbordes[indice - 1] = [];
    estructura.desbordes[indice - 1].push(valor);
    anotarLlegada(estructura, valor);
    return { exito: true, indice, col: estructura.desbordes[indice - 1].length };
  }

  function retirarDeCol(estructura, indice, col) {
    const lista = colDe(estructura, indice);
    const valor = lista[col - 1];
    if (valor === undefined) {
      return { exito: false, mensaje: `Casilla vacía: el lugar ${col} de Col de ${indice} no contiene ninguna clave.` };
    }
    lista.splice(col - 1, 1);
    olvidarLlegada(estructura, valor);
    return { exito: true, indice, col, valor };
  }

  // Cuando una cubeta con claves en Col pierde una de las suyas, la primera
  // de Col sube al renglón libre: si no, la búsqueda se detendría en el hueco
  // y no llegaría a Col. No cambia el orden de llegada: la clave es la misma.
  function subirDeCol(estructura, indice, posicion) {
    const lista = colDe(estructura, indice);
    if (lista.length === 0) return { exito: true, indice };
    const valor = lista.shift();
    if (posicion === undefined) {
      estructura.claves[indice - 1] = valor;
    } else {
      if (!estructura.anidados[indice - 1]) estructura.anidados[indice - 1] = [];
      estructura.anidados[indice - 1][posicion - 1] = valor;
    }
    return { exito: true, indice, posicion, valor };
  }

  // Cierra los huecos del arreglo anidado y, si la casilla de la dirección
  // quedó vacía, sube a ella la primera clave del anidado.
  //
  // Lo segundo no es cosmético: una dirección vacía con claves colgando de su
  // arreglo contradice lo que el dibujo dice —que la casilla es donde aterrizó
  // la clave y el anidado es para las que chocaron con ella—, y dejaría la
  // primera comparación de la búsqueda contra una casilla que nadie ocupa.
  function compactarAnidado(estructura, indice) {
    const anidado = estructura.anidados && estructura.anidados[indice - 1];
    if (!anidado) return { exito: true, indice };
    const restantes = anidado.filter((clave) => clave !== undefined);
    if (estructura.claves[indice - 1] === undefined && restantes.length > 0) {
      estructura.claves[indice - 1] = restantes.shift();
    }
    estructura.anidados[indice - 1] = restantes;
    return { exito: true, indice };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.estructura = {
    MODOS,
    anotarLlegada,
    olvidarLlegada,
    crearEstructura,
    insertar,
    eliminar,
    colocarEn,
    retirarDe,
    colocarEnAnidado,
    retirarDeAnidado,
    compactarAnidado,
    colDe,
    colocarEnCol,
    retirarDeCol,
    subirDeCol,
    anidadoDe,
    cantidadClaves,
    capacidad,
    baseDeCarga,
    casillaDe,
    estaLlena,
    estaVacia
  };
})();
