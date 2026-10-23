(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const grafos = window.CC2.dominio.grafo;

  // Floyd (CLAUDE.md 5.12), **como lo recorre el docente** en su hoja: tres
  // variables, `j` el vértice intermedio —el lazo de afuera—, `i` la fila y
  // `k` la columna, y la condición
  //
  //     D_ij + D_jk < D_ik
  //
  // que, si se cumple, cambia D_ik por la suma: de i a k es más corto pasando
  // por j. La matriz se cambia en su lugar, así que lo que cambió con un j ya
  // lo ve el siguiente.
  //
  // **Un paso por pareja (j, i), con sus n comparaciones** (opción B de las
  // maquetas, elegida por el usuario el 2026-10-22): así escribe la hoja, un
  // bloque de cuatro comparaciones con su «sí» o «no» y la matriz al lado. Con
  // 4 vértices son 16 pasos en vez de 64.
  //
  // Cada paso lleva su copia de la matriz: retroceder vuelve a dibujar desde
  // el paso, sin efectos que deshacer (CLAUDE.md 4), como la derivación de
  // índices. Y si el grafo es conexo, detrás vienen los conceptos, que se
  // leen de la matriz final.

  const DIGITOS_SUBINDICE = '₀₁₂₃₄₅₆₇₈₉';
  const subindice = (texto) => String(texto).replace(/\d/g, (d) => DIGITOS_SUBINDICE[d]);
  const valor = (numero) => (Number.isFinite(numero) ? String(numero) : '∞');
  const copia = (matriz) => matriz.map((fila) => fila.slice());
  const lista = (vertices) => (vertices.length === 1
    ? String(vertices[0])
    : `${vertices.slice(0, -1).join(', ')} y ${vertices[vertices.length - 1]}`);
  const conjunto = (vertices) => `{${vertices.join(', ')}}`;

  // D con dos subíndices. Con vértices de dos cifras los separa una coma, o
  // D₁₂₃ no diría si es (1, 23) o (12, 3).
  function nombreCelda(fila, columna) {
    const separador = fila >= 10 || columna >= 10 ? ',' : '';
    return `D${subindice(fila)}${separador}${subindice(columna)}`;
  }

  function recorrer(grafo) {
    const { vertices } = grafo;
    const n = vertices.length;
    const matriz = grafos.matrizInicial(grafo);
    const pasos = [];
    let comparaciones = 0;
    let cambios = 0;

    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      fase: 'floyd',
      matriz: copia(matriz),
      comparaciones,
      cambios,
      mensaje: grafo.conPesos
        ? 'Matriz inicial: 0 en la diagonal, el peso de cada arista y ∞ donde no hay arista.'
        : 'Matriz inicial: 0 en la diagonal, 1 en cada arista (sin peso vale 1) y ∞ donde no hay arista.'
    }));

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const lineas = [];
        const cambiadas = [];
        for (let k = 0; k < n; k++) {
          const dij = matriz[i][j];
          const djk = matriz[j][k];
          const dik = matriz[i][k];
          const cumple = dij + djk < dik;
          comparaciones++;
          if (cumple) {
            matriz[i][k] = dij + djk;
            cambios++;
            cambiadas.push({ fila: i, columna: k, antes: dik });
          }
          // La condición con nombres va una vez, en el título del panel; cada
          // línea dice la celda que decide y sus valores. Entera en cada
          // línea, el panel no cabía junto a la matriz en una ventana chica.
          lineas.push({
            etiqueta: `k = ${vertices[k]}`,
            expresion: `${nombreCelda(vertices[i], vertices[k])}   ${valor(dij)} + ${valor(djk)} < ${valor(dik)}`,
            resultado: cumple ? `sí → ${valor(dij + djk)}` : 'no',
            activa: cumple
          });
        }
        const vj = vertices[j];
        const vi = vertices[i];
        const mensaje = cambiadas.length === 0
          ? `j = ${vj}, i = ${vi}: ninguna cumple la condición; la fila ${vi} no cambia.`
          : `j = ${vj}, i = ${vi}: pasando por ${vj}, ` + cambiadas
            .map((c) => `de ${vi} a ${vertices[c.columna]} hay ${valor(matriz[i][c.columna])} (antes ${valor(c.antes)})`)
            .join('; ') + '.';
        pasos.push(crearPaso(TIPOS_PASO.COMPARACION, {
          fase: 'floyd',
          j,
          i,
          matriz: copia(matriz),
          cambiadas,
          calculo: lineas,
          tituloCalculo: `j = ${vj} · i = ${vi} · ${nombreCelda(vi, vj)} + D${subindice(vj)}ₖ < D${subindice(vi)}ₖ`,
          comparaciones,
          cambios,
          mensaje
        }));
      }
    }

    pasos.push(...pasosDeConceptos({ grafo, matriz, comparaciones, cambios }));
    return pasos;
  }

  // Los conceptos, uno por paso, sobre la matriz que dejó Floyd. Las líneas
  // del panel se acumulan —cada concepto se apoya en los anteriores— y la
  // tabla por vértice se llena con ellas.
  function pasosDeConceptos({ grafo, matriz, comparaciones, cambios }) {
    const { vertices } = grafo;
    const resultado = grafos.conceptos(matriz, vertices);
    const comun = { fase: 'conceptos', matriz: copia(matriz), comparaciones, cambios };
    const resumenFloyd = `Floyd terminado: ${comparaciones} comparaciones, ${cambios} ${cambios === 1 ? 'cambio' : 'cambios'} en la matriz.`;

    if (!resultado.conexo) {
      const dirigido = grafo.tipo === grafos.TIPOS.DIRIGIDO;
      return [crearPaso(TIPOS_PASO.CONSTRUIDO, {
        ...comun,
        fase: 'floyd',
        conceptos: null,
        mensaje: `${resumenFloyd} Quedan pares en ∞ —sin camino—, así que no hay conceptos: piden un grafo ${dirigido ? 'en el que desde cada vértice se llegue a todos' : 'conexo'}.`
      })];
    }

    const { distancias, excentricidades, radio, diametro, centro, mediana, distanciaMinima, parDiametro } = resultado;
    const pasos = [];
    const lineas = [];
    const datos = { ...resultado };
    const anotar = (tipo, mostrar, mensaje, extra = {}) => {
      pasos.push(crearPaso(tipo, {
        ...comun,
        conceptos: { ...datos, mostrar: mostrar.slice() },
        calculo: lineas.map((l, indice) => ({ ...l, activa: indice === lineas.length - 1 })),
        tituloCalculo: 'Conceptos',
        mensaje,
        ...extra
      }));
    };
    const mostrados = [];

    // Los valores por vértice van en columnas al final de la matriz; aquí, de
    // dónde salen.
    lineas.push({ etiqueta: 'Distancia de un vértice', expresion: '', resultado: 'suma de su fila' });
    mostrados.push('distancia');
    anotar(TIPOS_PASO.CALCULO, mostrados, `${resumenFloyd} Distancia de cada vértice (la suma de su fila): ${distancias.join(', ')}.`);

    lineas.push({ etiqueta: 'Excentricidad', expresion: '', resultado: 'mayor valor de su fila' });
    mostrados.push('excentricidad');
    anotar(TIPOS_PASO.CALCULO, mostrados, `Excentricidad de cada vértice (el mayor valor de su fila): ${excentricidades.join(', ')}.`);

    lineas.push({ etiqueta: 'Radio', expresion: `mín(${excentricidades.join(', ')})`, resultado: String(radio) });
    mostrados.push('radio');
    anotar(TIPOS_PASO.CALCULO, mostrados, `Radio: la excentricidad más pequeña, ${radio}.`, { resaltar: { tipo: 'radio', vertices: centro } });

    lineas.push({ etiqueta: 'Diámetro', expresion: `máx(${excentricidades.join(', ')})`, resultado: String(diametro) });
    mostrados.push('diametro');
    anotar(TIPOS_PASO.CALCULO, mostrados,
      `Diámetro: la excentricidad más grande, ${diametro}, entre ${parDiametro[0]} y ${parDiametro[1]}.`,
      { resaltar: { tipo: 'diametro', vertices: parDiametro } });

    lineas.push({ etiqueta: 'Centro', expresion: `excentricidad = ${radio}`, resultado: conjunto(centro) });
    mostrados.push('centro');
    // El centro es el subgrafo inducido (hoja del docente): los vértices y las
    // aristas que los unen, que el dibujo resalta.
    const inducidas = grafos.aristasInducidas(grafo, centro).length;
    const conAristas = inducidas === 0 ? '' : `, con ${inducidas === 1 ? 'la arista que los une' : 'las aristas entre ellos'}`;
    anotar(TIPOS_PASO.CALCULO, mostrados,
      centro.length === 1
        ? `Centro: el vértice de excentricidad mínima, ${centro[0]}.`
        : `Centro: los vértices de excentricidad mínima, ${lista(centro)}${conAristas}.`,
      { resaltar: { tipo: 'centro', vertices: centro } });

    lineas.push({ etiqueta: 'Mediana', expresion: `distancia = ${distanciaMinima}`, resultado: conjunto(mediana) });
    mostrados.push('mediana');
    // El último deja el resumen: es el aviso que se queda al terminar.
    anotar(TIPOS_PASO.CONSTRUIDO, mostrados,
      `Mediana: ${mediana.length === 1 ? 'el vértice' : 'los vértices'} de distancia mínima, ${lista(mediana)}. `
        + `Radio ${radio}, diámetro ${diametro}, centro ${conjunto(centro)} y mediana ${conjunto(mediana)}.`,
      { resaltar: { tipo: 'mediana', vertices: mediana } });

    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.floyd = { recorrer, nombreCelda };
})();
