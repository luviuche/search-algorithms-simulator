(function () {
  const clave = window.CC2.dominio.clave;

  // Árbol de Huffman (CLAUDE.md 5.x). Es el cuarto de los árboles de búsqueda
  // por residuo del docente, y comparte con los otros tres la bajada —un bit
  // por nivel, 0 a la izquierda y 1 a la derecha, claves solo en las hojas—,
  // pero se aparta en lo esencial: **la forma del árbol no la dicta la clave
  // sino la frecuencia**. En los otros tres el camino de la letra `a` está
  // fijado de antemano por su código de cinco bits; aquí se descubre
  // construyendo, y por eso lo que el tema enseña es la construcción.
  //
  // La regla, confirmada con el usuario contra el ejemplo del docente
  // (CIENCIAS, 2026-09-11):
  //
  //   1. Las letras se ordenan por **frecuencia ascendente**, y a igual
  //      frecuencia por **orden de lectura** —la que aparece antes en la
  //      palabra entra antes—.
  //   2. Se reducen de dos en dos, tomando siempre los dos primeros.
  //   3. El nodo nuevo vuelve a la lista **en su sitio por peso**, y a igual
  //      peso detrás de los que ya estaban. De ahí sale el paso que revela la
  //      regla: con cuatro nodos de 2/8 —C, I, E+N, A+S— se unen C e I, porque
  //      las letras llevaban más tiempo en la lista que los nodos recién
  //      creados.
  //   4. Al quedar un solo nodo, su peso es 1 y ese es el árbol.
  //
  // El primero de cada pareja va a la izquierda, que es el bit 0.

  // Un nodo es `{ peso, entrada, letra }` si es hoja, o `{ peso, entrada,
  // izquierda, derecha }` si es una reducción. `entrada` es lo que ordena los
  // empates: para una letra, dónde aparece por primera vez en la palabra; para
  // una reducción, el momento en que se creó, siempre posterior al de
  // cualquier letra.
  function compararNodos(a, b) {
    if (a.peso !== b.peso) return a.peso - b.peso;
    return a.entrada - b.entrada;
  }

  // Frecuencias en orden de lectura: cada letra con cuántas veces aparece y
  // dónde apareció por primera vez. El recuento va sobre las letras ya
  // normalizadas (CLAUDE.md 3.4), así que `Á` y `A` son la misma.
  function frecuenciasDe(letras) {
    const porLetra = new Map();
    letras.forEach((letra, indice) => {
      const normal = clave.normalizarLetra(letra).toLowerCase();
      if (porLetra.has(normal)) porLetra.get(normal).veces++;
      else porLetra.set(normal, { letra: normal, veces: 1, entrada: indice });
    });
    return [...porLetra.values()];
  }

  // Las hojas, ya ordenadas: es la lista con la que empieza el método, y la
  // que el docente escribe en el tablero antes de reducir nada.
  function ordenInicial(letras) {
    return frecuenciasDe(letras)
      .map((f) => ({ peso: f.veces, entrada: f.entrada, letra: f.letra }))
      .sort(compararNodos);
  }

  // Inserta respetando el orden (peso, entrada). No vale empujar al final: el
  // nodo nuevo puede pesar menos que alguno de los que quedan, y entonces le
  // toca antes. Lo que sí se cumple siempre es que, a igual peso, va detrás,
  // porque su `entrada` es la mayor emitida hasta ahora.
  function insertarEnOrden(lista, nodo) {
    let posicion = lista.length;
    for (let i = 0; i < lista.length; i++) {
      if (compararNodos(nodo, lista[i]) < 0) {
        posicion = i;
        break;
      }
    }
    lista.splice(posicion, 0, nodo);
    return posicion;
  }

  // Construye el árbol y deja el rastro de cómo se construyó: cada reducción
  // con la lista que había antes, la pareja que se unió y el peso que resultó.
  // La vista lo reproduce paso a paso; el dominio no dibuja nada.
  function construir(letras) {
    const total = letras.length;
    const lista = ordenInicial(letras);
    const inicial = lista.slice();
    // La primera `entrada` libre después de las letras: así cualquier
    // reducción queda siempre detrás de cualquier letra de su mismo peso.
    let siguienteEntrada = total;
    const reducciones = [];

    while (lista.length > 1) {
      const izquierda = lista.shift();
      const derecha = lista.shift();
      const nodo = {
        peso: izquierda.peso + derecha.peso,
        entrada: siguienteEntrada++,
        izquierda,
        derecha
      };
      const posicion = insertarEnOrden(lista, nodo);
      reducciones.push({ izquierda, derecha, nodo, posicion, lista: lista.slice() });
    }

    return { total, inicial, reducciones, raiz: lista[0] || null };
  }

  // El código de cada letra es su camino: 0 al bajar a la izquierda, 1 a la
  // derecha. Es la misma lectura que en los otros tres árboles por residuo
  // —de ahí que el docente los agrupe—, solo que aquí el camino lo decidió la
  // frecuencia y no los bits de la letra.
  function codigosDe(raiz) {
    const codigos = new Map();
    if (!raiz) return codigos;
    (function bajar(nodo, camino) {
      if (nodo.letra !== undefined) {
        codigos.set(nodo.letra, camino);
        return;
      }
      bajar(nodo.izquierda, camino + '0');
      bajar(nodo.derecha, camino + '1');
    })(raiz, '');
    return codigos;
  }

  // La tabla de codificación, que es lo que se evalúa al final (pedido del
  // usuario, 2026-09-11): por letra, su código, la longitud `Li`, la
  // frecuencia `Pi` como fracción, y el producto. La suma de `Pi × Li` es la
  // longitud media del código: cuánto costó de verdad cada letra, y por tanto
  // cuánto se comprimió frente a un código de longitud fija.
  //
  // Las fracciones se guardan como numerador sobre el total y no como decimal:
  // así la tabla se lee igual que en el tablero —`3/8`— y la comprobación de
  // que todo suma 1 sigue siendo exacta, sin arrastrar el error del punto
  // flotante.
  function tablaDeCodificacion({ inicial, raiz, total }) {
    const codigos = codigosDe(raiz);
    // **En el orden inverso al de entrada** (pedido del usuario, 2026-09-11):
    // la tabla se lee como el docente escribe la lista de frecuencias en el
    // tablero —de mayor a menor, y a igual frecuencia la última leída primero—,
    // que es el reflejo exacto del orden con que las letras entran a reducirse.
    const filas = inicial.slice().reverse().map((hoja) => {
      const codigo = codigos.get(hoja.letra);
      return {
        letra: hoja.letra,
        codigo,
        longitud: codigo.length,
        veces: hoja.peso,
        total,
        // Numerador de Pi × Li sobre el mismo total: (veces/total) × longitud.
        producto: hoja.peso * codigo.length
      };
    });
    return {
      filas,
      total,
      // Numerador de la suma, sobre `total`. Con CIENCIAS da 20/8 = 2,5.
      suma: filas.reduce((acumulado, fila) => acumulado + fila.producto, 0)
    };
  }

  // **El espacio es un carácter más** (pedido del docente, 2026-10-06, con el
  // taller de JULIO CESAR): cuenta su frecuencia y lleva su código como
  // cualquier letra. Se escribe `_`, como lo escribe el docente —JULIO_CESAR—,
  // porque un espacio en blanco no se ve en una hoja ni en la tabla. Se
  // aceptan las dos formas al teclear: «julio cesar» y «julio_cesar» son la
  // misma palabra. Solo en este tema: en los otros árboles cada letra se
  // convierte en sus bits del alfabeto (§3.4), y el espacio no tiene.
  //
  // Los espacios de los extremos se descartan, como en cualquier campo; los
  // de en medio cuentan todos, y repetidos se ven repetidos (`julio__cesar`).
  const ESPACIO = '_';

  function letrasDePalabra(entrada) {
    const texto = String(entrada).trim();
    if (texto.length === 0) {
      return { valido: false, mensaje: 'Palabra vacía: se esperan letras (A–Z), con espacios entre ellas si hace falta.' };
    }
    const letras = [];
    for (const caracter of texto) {
      if (caracter === ' ' || caracter === ESPACIO) {
        letras.push(ESPACIO);
        continue;
      }
      const validacion = clave.validarLetra(caracter);
      if (!validacion.valido) {
        return { valido: false, mensaje: 'Carácter no admitido: se esperan letras (A–Z) y espacios.' };
      }
      letras.push(validacion.valor);
    }
    return { valido: true, valor: letras.join(''), letras };
  }

  // Hace falta más de una letra distinta: con una sola no hay nada que
  // reducir y su código sería la cadena vacía, que no es un código. No se
  // inventa una convención —"vale 0"— porque el docente no la ha dado.
  function validarPalabra(entrada) {
    const validacion = letrasDePalabra(entrada);
    if (!validacion.valido) return validacion;
    const distintas = new Set(validacion.letras.map((l) => clave.normalizarLetra(l)));
    if (distintas.size < 2) {
      return {
        valido: false,
        mensaje: 'La palabra necesita al menos dos letras distintas: con una sola no hay reducción que hacer.'
      };
    }
    return validacion;
  }

  // La media de bits por letra, `suma / total`, como se escribe: con coma y a
  // lo sumo dos decimales. Con JULIO_CESAR da 39/11, periódica, y salía
  // «3,5454545454545454» en la métrica, la tabla y la bitácora (2026-10-06).
  // `signo` dice si la cifra es exacta (`=`, 20/8 = 2,5) o redondeada (`≈`,
  // 39/11 ≈ 3,55), para no escribir una igualdad que no es cierta.
  function mediaComoTexto(suma, total) {
    const redondeada = Math.round((suma / total) * 100) / 100;
    const exacta = Math.abs(redondeada * total - suma) < 1e-9;
    return { signo: exacta ? '=' : '≈', valor: String(redondeada).replace('.', ',') };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.huffman = {
    mediaComoTexto,
    ESPACIO,
    compararNodos,
    frecuenciasDe,
    ordenInicial,
    construir,
    codigosDe,
    tablaDeCodificacion,
    validarPalabra
  };
})();
