(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const dominioHuffman = window.CC2.dominio.huffman;

  // Árbol de Huffman (CLAUDE.md 5.x): la traza de **la construcción**, que es
  // lo que este tema enseña. En los otros tres árboles por residuo el camino
  // de la letra está decidido antes de empezar y lo único que hay que ver es
  // la bajada; aquí el árbol no existe hasta que se construye, así que la
  // traza no recorre nada: va uniendo.
  //
  // Cada paso lleva **el bosque que hay que dibujar** —la lista de nodos tal
  // como está en ese momento— en vez de un efecto que aplicar. No hace falta
  // más: el bosque de cada paso se deduce entero de la construcción, así que
  // retroceder es volver a dibujar y no deshacer nada. La estructura no se
  // toca en ningún momento (CLAUDE.md 4).

  const fraccion = (numerador, total) => `${numerador}/${total}`;

  // **Cada reducción va en tres tiempos, y cada uno hace una sola cosa**
  // (opción C de la maqueta, elegida por el usuario el 2026-09-30):
  //
  //   1. Se marcan los dos nodos que se van a juntar, **antes** de juntarlos:
  //      así se ve por qué se eligen esos dos —son los dos primeros de la
  //      lista—.
  //   2. Se juntan **donde están**: el nodo nuevo nace encima de ellos, al
  //      principio de la lista, y queda resaltado.
  //   3. El nodo nuevo **vuelve a la lista en su sitio por peso**, en un paso
  //      propio y con su porqué en la bitácora. Es la regla que decide el
  //      empate de CIENCIAS (CLAUDE.md 5.9). Si le toca el primer lugar no
  //      se mueve, y el paso no aparece.
  //
  // Hasta entonces juntarse e ir a su sitio eran un mismo paso: las letras
  // cruzaban el lienzo hasta un círculo que aparecía ya en su sitio, y no se
  // veían por separado las dos cosas que pasaban.
  function nombreDeNodo(nodo, total) {
    return nodo.letra !== undefined ? nodo.letra : `(${fraccion(nodo.peso, total)})`;
  }

  const enumerar = (nombres) => (nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`);

  // Por qué el nodo nuevo va donde va: detrás de los que pesan menos, y
  // **detrás de los que pesan lo mismo**, porque ellos estaban antes.
  function mensajeDeUbicacion(reduccion, total) {
    const { nodo, posicion, lista } = reduccion;
    const empatados = lista.slice(0, posicion).filter((otro) => otro.peso === nodo.peso);
    const base = `El nodo de ${fraccion(nodo.peso, total)} vuelve a la lista en su sitio por peso`;
    if (empatados.length === 0) return `${base}.`;
    const uno = empatados.length === 1;
    return `${base}, detrás de ${enumerar(empatados.map((otro) => nombreDeNodo(otro, total)))}, `
      + `que ${uno ? 'pesa' : 'pesan'} lo mismo y ${uno ? 'estaba' : 'estaban'} antes.`;
  }

  function construirDesdePalabra({ letras }) {
    const arbol = dominioHuffman.construir(letras);
    const total = arbol.total;
    const pasos = [];

    // Las líneas del panel se acumulan, como en los temas hash: cada paso
    // carga las reveladas hasta ese momento, no solo la suya.
    const calculo = [
      { etiqueta: 'Palabra', expresion: letras.join(''), resultado: `${total} letras` }
    ];

    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      total,
      bosque: arbol.inicial,
      calculo: calculo.slice(),
      mensaje: 'Frecuencias en orden de entrada: de menor a mayor, y a igual frecuencia por orden de lectura.'
    }));

    let bosque = arbol.inicial;
    arbol.reducciones.forEach((reduccion, indice) => {
      const { izquierda, derecha, nodo } = reduccion;
      calculo.push({
        etiqueta: `Reducción ${indice + 1}`,
        expresion: `${nombreDeNodo(izquierda, total)} + ${nombreDeNodo(derecha, total)}`,
        resultado: fraccion(nodo.peso, total)
      });
      const comun = () => ({ total, calculo: calculo.slice() });

      pasos.push(crearPaso(TIPOS_PASO.UNION, Object.assign(comun(), {
        bosque,
        uniendo: [izquierda, derecha],
        mensaje: `Se unen ${nombreDeNodo(izquierda, total)} y `
          + `${nombreDeNodo(derecha, total)}: ${fraccion(nodo.peso, total)}.`
      })));

      // Los dos que se unen son siempre los dos primeros de la lista: el
      // nodo nuevo ocupa su lugar.
      pasos.push(crearPaso(TIPOS_PASO.UNION, Object.assign(comun(), {
        bosque: [nodo, ...bosque.slice(2)],
        uniendo: [nodo],
        mensaje: `Nace el nodo de ${fraccion(nodo.peso, total)}: `
          + `${nombreDeNodo(izquierda, total)} a la izquierda (0) y `
          + `${nombreDeNodo(derecha, total)} a la derecha (1).`
      })));

      if (reduccion.posicion > 0) {
        pasos.push(crearPaso(TIPOS_PASO.UNION, Object.assign(comun(), {
          bosque: reduccion.lista,
          uniendo: [nodo],
          mensaje: mensajeDeUbicacion(reduccion, total)
        })));
      }
      bosque = reduccion.lista;
    });

    // Al quedar un solo nodo, su peso es el total —la comprobación que el
    // docente hace en el tablero: la última reducción da 1— y ese nodo es el
    // árbol. Solo entonces aparece la tabla: antes ninguna letra tendría
    // código que poner en ella.
    const tabla = dominioHuffman.tablaDeCodificacion(arbol);
    pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      total,
      bosque: [arbol.raiz],
      tabla,
      arbol,
      calculo: calculo.slice(),
      mensaje: `Árbol construido: ${fraccion(tabla.suma, total)} = `
        + `${(tabla.suma / total).toString().replace('.', ',')} bits por letra.`
    }));

    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.huffman = { construirDesdePalabra };
})();
