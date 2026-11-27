(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const expansion = window.CC2.dominio.expansion;
  const { METODOS, OBJETIVOS, etiqueta } = expansion;

  // Árbol de expansión mínimo o máximo (CLAUDE.md 5.18): la traza de Prim o de
  // Kruskal. Sin hojas del docente, el paso a paso es de esta aplicación:
  //
  //   Kruskal  un paso con la lista ordenada por peso, y uno por arista
  //            revisada: entra porque une dos componentes, o se descarta
  //            porque cerraría un ciclo —y se dice por cuál camino—.
  //   Prim     un paso con el vértice inicial, y uno por arista que entra:
  //            las candidatas que salen del árbol, con su peso, y la más
  //            liviana.
  //
  // Con el árbol, su peso como suma y si hay otro del mismo peso. Después,
  // como el docente antes de los circuitos y cortes fundamentales, las ramas
  // con el rango, y el complemento —las cuerdas— con la nulidad. Y al final,
  // sobre el árbol, la matriz de distancias con su radio, diámetro, centro o
  // bicentro, y mediana (pedido del usuario, 2026-11-24).
  //
  //   Árbol escrito  un paso que lo comprueba (para seguir el ejemplo del
  //                  docente, que elige a, b, e, f entre varios)

  const lista = (cosas) => (cosas.length === 1 ? String(cosas[0])
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`);
  const llaves = (cosas) => `{${cosas.join(', ')}}`;
  const nombres = (aristas) => aristas.map((a) => a.nombre);
  const conPeso = (a) => `${etiqueta(a)} (${a.peso})`;

  // Lo que cambia al decirlo, según se busque el mínimo o el máximo.
  const PALABRAS = {
    [OBJETIVOS.MINIMO]: { nombre: 'mínimo', Nombre: 'Mínimo', orden: 'de menor a mayor peso', elegida: 'más liviana', ninguno: 'menos', fuera: 'más' },
    [OBJETIVOS.MAXIMO]: { nombre: 'máximo', Nombre: 'Máximo', orden: 'de mayor a menor peso', elegida: 'más pesada', ninguno: 'más', fuera: 'menos' }
  };

  // **Qué hallar** (pedido del usuario, 2026-11-26): cada recorrido es un
  // solo ejercicio. Hasta entonces el árbol seguía con el centro en la misma
  // traza, y parecían dos operaciones.
  //
  //   arbol                  Kruskal, Prim o el escrito, paso a paso, con
  //                          ramas, rango, cuerdas y nulidad
  //   centro                 el árbol en un paso, y su centro o bicentro
  //   circuitos · cortes     todos los del grafo, sin árbol
  //   fundamentales          el árbol en un paso, y uno por cuerda
  //   cortes-fundamentales   el árbol en un paso, y uno por rama
  const HALLAR = Object.freeze({
    ARBOL: 'arbol', CENTRO: 'centro', CIRCUITOS: 'circuitos', FUNDAMENTALES: 'fundamentales',
    CORTES: 'cortes', CORTES_FUNDAMENTALES: 'cortes-fundamentales'
  });
  const conArbol = (hallar) => ![HALLAR.CIRCUITOS, HALLAR.CORTES].includes(hallar);

  function recorrer(grafo, { metodo, inicio, arbol = [], objetivo = OBJETIVOS.MINIMO, hallar = HALLAR.ARBOL }) {
    if (hallar === HALLAR.CIRCUITOS) return pasosDeCircuitos(grafo);
    if (hallar === HALLAR.CORTES) return pasosDeCortes(grafo);
    const pasos = metodo === METODOS.DADO ? pasosDelArbolDado(grafo, arbol, objetivo)
      : metodo === METODOS.PRIM ? pasosDePrim(grafo, inicio || grafo.vertices[0], objetivo)
        : pasosDeKruskal(grafo, objetivo);
    if (hallar === HALLAR.ARBOL || !hallar) return pasos.filter((p) => p.fase !== 'centro');
    // Lo demás parte del árbol ya hecho: un paso que lo resume.
    const delArbol = pasos.find((p) => p.fase === 'arbol');
    const T = grafo.aristas.filter((a) => delArbol.T.includes(a.nombre));
    const resumen = pasoDelArbolHecho(grafo, T, delArbol, metodo, hallar);
    if (hallar === HALLAR.CENTRO) return [resumen, ...pasos.filter((p) => p.fase === 'centro')];
    if (hallar === HALLAR.FUNDAMENTALES) return [resumen, ...pasosDeFundamentales(grafo, T)];
    return [resumen, ...pasosDeCortesFundamentales(grafo, T)];
  }

  // ── Árbol escrito ────────────────────────────────────────────────────────
  function pasosDelArbolDado(grafo, nombresDelArbol, objetivo) {
    const arbol = grafo.aristas.filter((a) => nombresDelArbol.includes(a.nombre));
    const n = grafo.vertices.length;
    const comun = { metodo: METODOS.DADO, objetivo, descartadas: [], tabla: [] };
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      ...comun, T: nombres(arbol), fase: 'dado',
      calculo: arbol.map((a) => ({ etiqueta: a.nombre, expresion: `${etiqueta(a)} · peso ${a.peso}`, resultado: '', activa: false })),
      tituloCalculo: 'Árbol escrito',
      mensaje: `Árbol escrito: ${llaves(nombres(arbol))}. Tiene n − 1 = ${n - 1} aristas y ningún ciclo, así que toca a los ${n} vértices: es un árbol de expansión.`
    })];
    return pasos.concat(conclusion(grafo, arbol, { ...comun, antes: '' }));
  }

  // ── Kruskal ──────────────────────────────────────────────────────────────
  function pasosDeKruskal(grafo, objetivo) {
    const n = grafo.vertices.length;
    const { orden, decisiones, arbol } = expansion.kruskal(grafo, objetivo);
    const tabla = (hasta) => orden.map((a, i) => {
      const d = decisiones[i];
      return {
        arista: a.nombre, etiqueta: etiqueta(a), peso: a.peso,
        decision: i < hasta ? (d.entra ? 'entra' : 'ciclo') : (hasta === decisiones.length && !d ? 'sobra' : null)
      };
    });
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      metodo: METODOS.KRUSKAL, objetivo, T: [], descartadas: [], tabla: tabla(0),
      calculo: orden.map((a) => ({ etiqueta: etiqueta(a), expresion: `peso ${a.peso}`, resultado: '', activa: false })),
      tituloCalculo: 'Aristas por peso',
      mensaje: `Se ordenan las ${orden.length} aristas ${PALABRAS[objetivo].orden} (las de igual peso, en el orden escrito). Cada vértice empieza solo, en su propio componente; el árbol necesita n − 1 = ${n - 1} aristas.`
    })];
    const T = [];
    const descartadas = [];
    const sobrantes = decisiones.filter((d) => d.sobrante).map((d) => d.arista);
    decisiones.filter((d) => !d.sobrante).forEach((d, i) => {
      const a = d.arista;
      if (d.entra) T.push(a);
      else descartadas.push(a);
      const [x, y] = d.une || [];
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        metodo: METODOS.KRUSKAL, objetivo, T: nombres(T), descartadas: nombres(descartadas), tabla: tabla(i + 1),
        actual: a.nombre, entra: d.entra, ciclo: d.ciclo ? nombres(d.ciclo) : [],
        componentes: expansion.componentes(grafo, T),
        calculo: [{
          etiqueta: `${etiqueta(a)} · peso ${a.peso}`,
          expresion: d.entra ? `${llaves(x)} y ${llaves(y)}` : `ya unidos por ${d.ciclo.map(etiqueta).join(', ')}`,
          resultado: d.entra ? 'entra' : 'ciclo',
          activa: true
        }],
        tituloCalculo: `Arista ${i + 1} de ${orden.length}`,
        mensaje: d.entra
          ? `${etiqueta(a)}, peso ${a.peso}: une ${llaves(x)} con ${llaves(y)}, que están en componentes distintos. Entra al árbol: ${T.length} de ${n - 1} aristas.`
          : `${etiqueta(a)}, peso ${a.peso}: ${a.origen} y ${a.destino} ya están unidos en el árbol por ${d.ciclo.map(etiqueta).join(', ')}. Cerraría un ciclo: se descarta.`
      }));
    });
    // Las que quedan no se agregan: con n − 1 aristas el árbol ya une todos
    // los vértices, así que cada una cerraría un ciclo.
    return pasos.concat(conclusion(grafo, arbol, {
      metodo: METODOS.KRUSKAL, objetivo, descartadas: nombres(descartadas.concat(sobrantes)), tabla: tabla(decisiones.length),
      antes: sobrantes.length
        ? `Ya hay ${n - 1} aristas: ${sobrantes.length === 1 ? 'la que queda' : `las ${sobrantes.length} que quedan`} (${sobrantes.map(etiqueta).join(', ')}) no se ${sobrantes.length === 1 ? 'agrega' : 'agregan'}, porque sus extremos ya están unidos y ${sobrantes.length === 1 ? 'cerraría' : 'cerrarían'} un ciclo. `
        : ''
    }));
  }

  // ── Prim ─────────────────────────────────────────────────────────────────
  function pasosDePrim(grafo, inicio, objetivo) {
    const n = grafo.vertices.length;
    const { vueltas, arbol } = expansion.prim(grafo, inicio, objetivo);
    const tabla = (hasta) => vueltas.slice(0, hasta).map((v) => ({
      dentro: v.dentro.slice(), arista: v.elegida.nombre, etiqueta: etiqueta(v.elegida), peso: v.elegida.peso, nuevo: v.nuevo
    }));
    // Las que ya no pueden entrar: sus dos extremos están en el árbol.
    const internas = (dentro, T) => grafo.aristas
      .filter((a) => !T.includes(a) && dentro.includes(a.origen) && dentro.includes(a.destino));
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      metodo: METODOS.PRIM, objetivo, T: [], dentro: [inicio], descartadas: [], tabla: [],
      mensaje: `Se empieza por el vértice ${inicio}. En cada paso entra la arista ${PALABRAS[objetivo].elegida} que sale del árbol hacia un vértice que todavía no está en él (entre iguales, la escrita antes). Hacen falta n − 1 = ${n - 1}.`
    })];
    const T = [];
    vueltas.forEach((v, i) => {
      T.push(v.elegida);
      const dentro = v.dentro.concat(v.nuevo);
      const otras = v.candidatas.filter((c) => c !== v.elegida);
      const empate = otras.filter((c) => c.peso === v.elegida.peso);
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        metodo: METODOS.PRIM, objetivo, T: nombres(T), dentro, desde: v.dentro.slice(), nuevo: v.nuevo,
        candidatas: nombres(v.candidatas), actual: v.elegida.nombre,
        descartadas: nombres(internas(dentro, T)), tabla: tabla(i + 1),
        calculo: v.candidatas.map((c) => ({
          etiqueta: etiqueta(c), expresion: `peso ${c.peso}`, resultado: c === v.elegida ? 'entra' : '', activa: c === v.elegida
        })),
        tituloCalculo: `Salen de ${llaves(v.dentro)}`,
        mensaje: `Desde ${llaves(v.dentro)} ${v.candidatas.length === 1 ? 'sale solo' : 'salen'} ${lista(v.candidatas.map(conPeso))}. `
          + (otras.length ? `La ${PALABRAS[objetivo].elegida} es ${etiqueta(v.elegida)}, peso ${v.elegida.peso}${empate.length ? ` (empata con ${lista(empate.map(etiqueta))}; va la escrita antes)` : ''}. ` : '')
          + `Entra, y con ella el vértice ${v.nuevo}: ${T.length} de ${n - 1} aristas.`
      }));
    });
    const dentro = grafo.vertices.slice();
    return pasos.concat(conclusion(grafo, arbol, {
      metodo: METODOS.PRIM, objetivo, dentro, descartadas: nombres(internas(dentro, arbol)), tabla: tabla(vueltas.length), antes: ''
    }));
  }

  // Al terminar: el árbol, su peso como suma, y si es el único.
  function conclusion(grafo, arbol, { antes, ...comun }) {
    const total = expansion.peso(arbol);
    const dado = comun.metodo === METODOS.DADO;
    const { nombre, Nombre, ninguno, fuera } = PALABRAS[comun.objetivo];
    const optimo = expansion.peso(expansion.kruskal(grafo, comun.objetivo).arbol);
    const otro = expansion.otroDelMismoPeso(grafo, arbol);
    const suma = arbol.length > 1 ? `${arbol.map((a) => a.peso).join(' + ')} = ${total}` : String(total);
    const propiedades = [
      {
        nombre: 'Árbol de expansión', valor: true,
        detalle: `toca los ${grafo.vertices.length} vértices con n − 1 = ${arbol.length} aristas, sin ciclos`
      },
      ...(dado ? [{
        nombre: Nombre, valor: total === optimo,
        detalle: total === optimo ? `ningún árbol de expansión pesa ${ninguno} de ${optimo}` : `pesa ${total}, y el ${nombre} pesa ${optimo}`
      }] : []),
      {
        nombre: 'Único', valor: dado && total !== optimo ? null : !otro,
        detalle: dado && total !== optimo ? `no es ${nombre}`
          : otro
            ? `cambiando ${etiqueta(otro.sale)} por ${etiqueta(otro.entra)}, las dos de peso ${otro.entra.peso}, sale otro del mismo peso`
            : `toda arista de fuera pesa ${fuera} que las del camino que reemplazaría`
      }
    ];
    const delArbol = { ...comun, T: nombres(arbol), total, suma, propiedades };
    const paso = crearPaso(TIPOS_PASO.CALCULO, {
      ...delArbol, fase: 'arbol',
      calculo: [
        { etiqueta: 'Aristas', expresion: arbol.map(etiqueta).join(', '), resultado: String(arbol.length), activa: false },
        { etiqueta: 'Peso', expresion: suma, resultado: String(total), activa: true }
      ],
      tituloCalculo: dado ? 'Árbol de expansión' : `Árbol de expansión ${nombre}`,
      mensaje: dado
        ? `Peso del árbol: ${suma}. ${total === optimo ? `Es ${nombre}` : `No es ${nombre}: el ${nombre} pesa ${optimo}`}${total === optimo && otro ? ', y no es el único' : ''}.`
        : `${antes}Árbol de expansión ${nombre}: ${llaves(arbol.map(etiqueta))}, peso ${suma}.`
          + (otro ? ` No es el único: con ${etiqueta(otro.entra)} en lugar de ${etiqueta(otro.sale)} pesa lo mismo.` : '')
    });
    return [paso, ...pasosDeRamasYCuerdas(grafo, arbol, delArbol), ...pasosDeCentro(grafo, arbol, delArbol)];
  }

  // Como en el documento de apoyo: «se identifican las ramas y el rango»;
  // «se encuentra el complemento», G′ = (S′, A′); «se identifican las
  // cuerdas y la nulidad».
  function pasosDeRamasYCuerdas(grafo, arbol, delArbol) {
    const { ramas, cuerdas, rango, nulidad, n, m, k, pesoRamas, pesoCuerdas } = expansion.ramasYCuerdas(grafo, arbol);
    const conRamas = { ...delArbol, ramas: nombres(ramas), rango };
    // Como el taller del usuario (2026-11-26): r = n − k y μ = m − n + k,
    // con k = 1 porque el grafo es conexo, y el peso de cada lado.
    const rangoEscrito = `n − k = ${n} − ${k} = ${rango}`;
    const nulidadEscrita = `m − n + k = ${m} − ${n} + ${k} = ${nulidad}`;
    return [
      crearPaso(TIPOS_PASO.CALCULO, {
        ...conRamas, fase: 'ramas',
        calculo: [
          { etiqueta: 'Ramas', expresion: llaves(nombres(ramas)), resultado: '', activa: false },
          ...(grafo.conPesos ? [{ etiqueta: 'Peso', expresion: '', resultado: String(pesoRamas), activa: false }] : []),
          { etiqueta: 'Rango', expresion: `n − k = ${n} − ${k}`, resultado: String(rango), activa: true }
        ],
        tituloCalculo: 'Ramas y rango',
        mensaje: `Ramas: las aristas del árbol, ${llaves(nombres(ramas))}${grafo.conPesos ? `, de peso ${pesoRamas}` : ''}. Rango = ${rangoEscrito}, el número de ramas (k = ${k}: el grafo es conexo).`
      }),
      crearPaso(TIPOS_PASO.CALCULO, {
        ...conRamas, fase: 'cuerdas', cuerdas: nombres(cuerdas), nulidad, m, n,
        calculo: [
          { etiqueta: 'Ramas', expresion: llaves(nombres(ramas)), resultado: String(rango), activa: false },
          { etiqueta: 'Cuerdas', expresion: llaves(nombres(cuerdas)), resultado: '', activa: false },
          ...(grafo.conPesos ? [{ etiqueta: 'Peso', expresion: '', resultado: String(pesoCuerdas), activa: false }] : []),
          { etiqueta: 'Nulidad', expresion: `m − n + k = ${m} − ${n} + ${k}`, resultado: String(nulidad), activa: true }
        ],
        tituloCalculo: 'Cuerdas y nulidad',
        mensaje: cuerdas.length
          ? `Complemento del árbol: G′ = (S′, A′), con S′ = ${llaves(grafo.vertices)} y A′ = ${llaves(nombres(cuerdas))}. Sus aristas son las cuerdas${grafo.conPesos ? `, de peso ${pesoCuerdas}` : ''}. Nulidad = ${nulidadEscrita}, el número de cuerdas.`
          : `El grafo ya es un árbol: no le quedan aristas fuera, así que no tiene cuerdas. Nulidad = ${nulidadEscrita}.`
      })
    ];
  }

  // La matriz de distancias del árbol y lo que se lee de ella, un concepto
  // por paso, con los mismos nombres y columnas que en Floyd (CLAUDE.md 5.12).
  function pasosDeCentro(grafo, arbol, delArbol) {
    const { matriz, conceptos, union, esBicentro, caminoDiametro } = expansion.distanciasEnArbol(grafo, arbol);
    const { ramas, cuerdas, rango, nulidad } = expansion.ramasYCuerdas(grafo, arbol);
    const { excentricidades, radio, diametro, centro, mediana, distanciaMinima, parDiametro } = conceptos;
    const nombreCentro = esBicentro ? 'Bicentro' : 'Centro';
    const lineas = [];
    const pasos = [];
    const anotar = (tipo, mostrar, linea, mensaje, extra = {}) => {
      lineas.push(linea);
      pasos.push(crearPaso(tipo, {
        ...delArbol, fase: 'centro',
        ramas: nombres(ramas), cuerdas: nombres(cuerdas), rango, nulidad,
        matriz: matriz.map((fila) => fila.slice()),
        tituloMatriz: 'Distancias en el árbol',
        conceptos: { ...conceptos, esBicentro, mostrar: mostrar.slice() },
        calculo: lineas.map((l, i) => ({ ...l, activa: i === lineas.length - 1 })),
        tituloCalculo: 'Sobre el árbol',
        mensaje,
        ...extra
      }));
    };
    const mostrar = ['distancia', 'excentricidad'];
    anotar(TIPOS_PASO.CALCULO, mostrar,
      { etiqueta: 'Excentricidad', expresion: 'mayor valor de su fila', resultado: '' },
      'Distancias sobre el árbol: entre dos vértices hay un solo camino, y la distancia es la suma de sus pesos (Floyd da la misma matriz). '
        + `Excentricidad, el mayor valor de cada fila: ${excentricidades.join(', ')}.`);
    mostrar.push('radio', 'diametro');
    anotar(TIPOS_PASO.CALCULO, mostrar,
      { etiqueta: 'Radio · diámetro', expresion: `mín y máx de ${excentricidades.join(', ')}`, resultado: `${radio} · ${diametro}` },
      `Radio, la excentricidad más pequeña: ${radio}. Diámetro, la más grande: ${diametro}, entre ${parDiametro[0]} y ${parDiametro[1]}.`,
      { resaltar: { tipo: 'diametro', vertices: parDiametro }, caminoDiametro: nombres(caminoDiametro) });
    mostrar.push('centro');
    anotar(TIPOS_PASO.CALCULO, mostrar,
      { etiqueta: nombreCentro, expresion: `excentricidad = ${radio}`, resultado: llaves(centro) },
      esBicentro
        ? `Bicentro: dos vértices tienen la excentricidad mínima, ${lista(centro)}, y la rama ${union.nombre} los une.`
        : centro.length === 1
          ? `Centro: un solo vértice tiene la excentricidad mínima, ${centro[0]}. No hay bicentro.`
          : `Centro: ${lista(centro)} tienen la excentricidad mínima. Son más de dos por las aristas de peso 0, así que no hay bicentro.`,
      { resaltar: { tipo: 'centro', vertices: centro } });
    mostrar.push('mediana');
    anotar(TIPOS_PASO.CONSTRUIDO, mostrar,
      { etiqueta: 'Mediana', expresion: `distancia = ${distanciaMinima}`, resultado: llaves(mediana) },
      `Mediana: ${mediana.length === 1 ? 'el vértice' : 'los vértices'} de distancia mínima, ${lista(mediana)}. `
        + `Sobre el árbol: radio ${radio}, diámetro ${diametro}, ${nombreCentro.toLowerCase()} ${llaves(centro)} y mediana ${llaves(mediana)}.`,
      { resaltar: { tipo: 'mediana', vertices: mediana } });
    return pasos;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  // ── El árbol ya hecho, en un paso ────────────────────────────────────────
  function pasoDelArbolHecho(grafo, T, delArbol, metodo, hallar) {
    const { ramas, cuerdas, rango, nulidad, n, m, k } = expansion.ramasYCuerdas(grafo, T);
    const como = metodo === METODOS.DADO ? 'el árbol escrito' : `${metodo === METODOS.PRIM ? 'Prim' : 'Kruskal'}`;
    const { nombre } = PALABRAS[delArbol.objetivo];
    const porque = {
      [HALLAR.CENTRO]: 'Sobre él se buscan el centro y la mediana.',
      [HALLAR.FUNDAMENTALES]: `Hay un circuito fundamental por cuerda: ${nulidad}, la nulidad.`,
      [HALLAR.CORTES_FUNDAMENTALES]: `Hay un corte fundamental por rama: ${rango}, el rango.`
    }[hallar];
    return crearPaso(TIPOS_PASO.CALCULO, {
      ...delArbol, fase: 'arbol', ramas: nombres(ramas), rango, cuerdas: nombres(cuerdas), nulidad, tabla: [], propiedades: null,
      calculo: [
        { etiqueta: 'Árbol', expresion: llaves(nombres(T)), resultado: String(delArbol.total), activa: false },
        { etiqueta: 'Rango', expresion: `n − k = ${n} − ${k}`, resultado: String(rango), activa: hallar === HALLAR.CORTES_FUNDAMENTALES },
        { etiqueta: 'Nulidad', expresion: `m − n + k = ${m} − ${n} + ${k}`, resultado: String(nulidad), activa: hallar === HALLAR.FUNDAMENTALES }
      ],
      tituloCalculo: 'El árbol',
      mensaje: `Árbol de expansión ${metodo === METODOS.DADO ? '' : `${nombre} `}con ${como}: ${llaves(T.map(etiqueta))}, peso ${delArbol.suma}. `
        + `Ramas ${llaves(nombres(ramas))} y cuerdas ${llaves(nombres(cuerdas))}. ${porque}`
    });
  }

  // ── Circuitos y conjuntos de corte (CLAUDE.md 5.22) ──────────────────────
  // Un paso por circuito o corte: se señala en el grafo y se llena su fila de
  // la matriz, y su renglón de la estructura de adyacencia. Lo que el grafo
  // marca va en `marcas` —estado por vértice y por arista—, aparte del árbol.
  const circuitos = window.CC2.dominio.circuitos;
  const conComas = (aristas) => lista(aristas.map((a) => a.nombre));

  function pasosDeFilas({ grafo, lista: filas, r, intro, tituloCalculo, fase, cada, cierre, comun = {} }) {
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      ...comun, fase, representacion: r, filasLlenas: 0, total: filas.length, marcas: { estados: {}, marcadas: {} },
      calculo: [], tituloCalculo, mensaje: intro
    })];
    filas.forEach((fila, i) => {
      const { marcas, calculo, mensaje } = cada(fila, i);
      const ultimo = i === filas.length - 1;
      pasos.push(crearPaso(ultimo ? TIPOS_PASO.CONSTRUIDO : TIPOS_PASO.CALCULO, {
        ...comun, fase, representacion: r, filasLlenas: i + 1, filaActual: i, total: filas.length, marcas,
        actual: fila.nombre, calculo, tituloCalculo,
        mensaje: ultimo ? `${mensaje} ${cierre}` : mensaje
      }));
    });
    return pasos;
  }

  function pasosDeCircuitos(grafo) {
    const { lista: filas } = circuitos.circuitos(grafo);
    const r = circuitos.matriz(grafo, filas, { titulo: 'Matriz de circuitos' });
    return pasosDeFilas({
      grafo, lista: filas, r, fase: 'circuitos', tituloCalculo: 'Circuitos',
      intro: `Un circuito es un camino cerrado que no repite vértices. Este grafo tiene ${filas.length}, y se recorren de los más cortos a los más largos. Cada uno es una fila de la matriz de circuitos: 1 en las aristas que tiene, 0 en las demás.`,
      cada: (c) => ({
        marcas: {
          estados: Object.fromEntries(c.vertices.map((v) => [v, 'encontrada'])),
          marcadas: Object.fromEntries(c.aristas.map((a) => [a.nombre, 'emparejada']))
        },
        calculo: [
          { etiqueta: c.nombre, expresion: c.recorrido.join(' – '), resultado: '', activa: false },
          { etiqueta: 'Aristas', expresion: llaves(nombres(c.aristas)), resultado: String(c.aristas.length), activa: true }
        ],
        mensaje: `${c.nombre}: ${c.recorrido.join('–')}, con las aristas ${llaves(nombres(c.aristas))}. Su fila lleva 1 en ${conComas(c.aristas)}.`
      }),
      cierre: `Matriz de circuitos: ${filas.length} circuitos por ${grafo.aristas.length} aristas.`
    });
  }

  function pasosDeCortes(grafo) {
    const { lista: filas } = circuitos.cortes(grafo);
    const r = circuitos.matriz(grafo, filas, { titulo: 'Matriz de conjuntos de corte' });
    return pasosDeFilas({
      grafo, lista: filas, r, fase: 'cortes', tituloCalculo: 'Conjuntos de corte',
      intro: `Un conjunto de corte es un conjunto mínimo de aristas que, al quitarlas, deja el grafo en dos partes. Mínimo: si se devuelve cualquiera de ellas, vuelve a ser conexo. Este grafo tiene ${filas.length}, de los más chicos a los más grandes; cada uno es una fila de la matriz.`,
      cada: (c) => ({
        marcas: {
          estados: Object.fromEntries([...c.lado.map((v) => [v, 'encontrada']), ...c.otro.map((v) => [v, 'rango'])]),
          marcadas: Object.fromEntries(c.aristas.map((a) => [a.nombre, 'del-camino']))
        },
        calculo: [
          { etiqueta: c.nombre, expresion: llaves(nombres(c.aristas)), resultado: String(c.aristas.length), activa: true },
          { etiqueta: 'Partes', expresion: `${llaves(c.lado)} y ${llaves(c.otro)}`, resultado: '', activa: false }
        ],
        mensaje: `${c.nombre} = ${llaves(nombres(c.aristas))}: al quitarlas, ${llaves(c.lado)} queda separado de ${llaves(c.otro)}.`
      }),
      cierre: `Matriz de conjuntos de corte: ${filas.length} cortes por ${grafo.aristas.length} aristas.`
    });
  }

  function pasosDeFundamentales(grafo, T) {
    const filas = circuitos.circuitosFundamentales(grafo, T);
    const r = circuitos.matriz(grafo, filas, { titulo: 'Matriz de circuitos fundamentales' });
    // Como en el taller: también por vértices.
    const porVertices = circuitos.matriz(grafo, filas, { titulo: 'Por vértices', porVertices: true });
    return pasosDeFilas({
      grafo, lista: filas, r, fase: 'fundamentales', tituloCalculo: 'Circuitos fundamentales',
      comun: { porVertices },
      intro: '',
      cada: (c) => ({
        marcas: {
          estados: Object.fromEntries(c.vertices.map((v) => [v, 'encontrada'])),
          marcadas: Object.fromEntries([
            ...T.map((a) => [a.nombre, c.camino.includes(a) ? 'emparejada' : undefined]),
            [c.cuerda.nombre, 'evaluacion']
          ].filter(([, e]) => e))
        },
        calculo: [
          { etiqueta: 'Cuerda', expresion: etiqueta(c.cuerda), resultado: c.cuerda.nombre, activa: false },
          { etiqueta: 'En el árbol', expresion: c.recorrido.slice(1).join(' – '), resultado: llaves(nombres(c.camino)), activa: false },
          { etiqueta: c.nombre, expresion: llaves(nombres(c.aristas)), resultado: String(c.aristas.length), activa: true }
        ],
        mensaje: `${c.nombre}, de la cuerda ${c.cuerda.nombre}: el árbol une ${c.cuerda.destino} con ${c.cuerda.origen} por ${c.recorrido.slice(1).join('–')}, y con la cuerda cierra el circuito ${llaves(nombres(c.aristas))}.`
      }),
      cierre: `Matriz de circuitos fundamentales: ${filas.length}, uno por cuerda.`
    }).slice(1);
  }

  function pasosDeCortesFundamentales(grafo, T) {
    const filas = circuitos.cortesFundamentales(grafo, T);
    const r = circuitos.matriz(grafo, filas, { titulo: 'Matriz de cortes fundamentales' });
    return pasosDeFilas({
      grafo, lista: filas, r, fase: 'cortes-fundamentales', tituloCalculo: 'Cortes fundamentales',
      intro: '',
      cada: (c) => {
        const cuerdas = c.aristas.filter((a) => a !== c.rama);
        return {
          marcas: {
            estados: Object.fromEntries([...c.lado.map((v) => [v, 'encontrada']), ...c.otro.map((v) => [v, 'rango'])]),
            marcadas: Object.fromEntries([
              ...T.filter((a) => a !== c.rama).map((a) => [a.nombre, 'emparejada']),
              ...cuerdas.map((a) => [a.nombre, 'del-camino']),
              [c.rama.nombre, 'evaluacion']
            ])
          },
          calculo: [
            { etiqueta: 'Rama', expresion: etiqueta(c.rama), resultado: c.rama.nombre, activa: false },
            { etiqueta: 'Partes', expresion: `${llaves(c.lado)} y ${llaves(c.otro)}`, resultado: '', activa: false },
            { etiqueta: c.nombre, expresion: llaves(nombres(c.aristas)), resultado: String(c.aristas.length), activa: true }
          ],
          mensaje: `${c.nombre}, de la rama ${c.rama.nombre}: sin ella el árbol queda en ${llaves(c.lado)} y ${llaves(c.otro)}; `
            + (cuerdas.length ? `entre las dos partes cruzan ${conComas(cuerdas)}, así que el corte es ${llaves(nombres(c.aristas))}.` : `ninguna cuerda cruza entre ellas: el corte es solo ${c.rama.nombre}.`)
        };
      },
      cierre: `Matriz de cortes fundamentales: ${filas.length}, uno por rama.`
    }).slice(1);
  }

  window.CC2.algoritmos.expansion = { recorrer, HALLAR, conArbol };
})();
