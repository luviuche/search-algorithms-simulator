(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const combinaciones = window.CC2.dominio.combinaciones;
  const { COMBINACIONES, aristasDe } = combinaciones;

  // Unión, intersección, diferencia, suma anillo y suma de dos grafos
  // (CLAUDE.md 5.15): la traza. Primero un paso con los vértices; después uno
  // por arista revisada, diciendo en qué grafo está y si entra, y al final la
  // cuenta. En la suma todas entran: un paso copia A₁, otro A₂, y después uno
  // por vértice de V₁, que se une con todo V₂.
  //
  // Cada paso lleva los dos grafos, el resultado completo, cuántas de sus
  // aristas ya están (`hechas`) y desde cuál son nuevas (`nuevasDesde`), y los
  // conjuntos escritos como en el cuaderno.

  const SIMBOLOS = Object.freeze({
    [COMBINACIONES.UNION]: 'G₁ ∪ G₂',
    [COMBINACIONES.INTERSECCION]: 'G₁ ∩ G₂',
    [COMBINACIONES.DIFERENCIA]: 'G₁ − G₂',
    [COMBINACIONES.SUMA_ANILLO]: 'G₁ ⊕ G₂',
    [COMBINACIONES.SUMA]: 'G₁ + G₂'
  });
  const TITULOS = Object.freeze({
    [COMBINACIONES.UNION]: 'Unión',
    [COMBINACIONES.INTERSECCION]: 'Intersección',
    [COMBINACIONES.DIFERENCIA]: 'Diferencia',
    [COMBINACIONES.SUMA_ANILLO]: 'Suma anillo',
    [COMBINACIONES.SUMA]: 'Suma'
  });
  const REGLAS = Object.freeze({
    [COMBINACIONES.UNION]: { v: 'V₁ ∪ V₂', a: 'A₁ ∪ A₂', dicho: 'las de cualquiera de los dos' },
    [COMBINACIONES.INTERSECCION]: { v: 'V₁ ∩ V₂', a: 'A₁ ∩ A₂', dicho: 'las que están en los dos' },
    [COMBINACIONES.DIFERENCIA]: { v: 'V₁', a: 'A₁ − A₂', dicho: 'las de G₁ que no están en G₂' },
    [COMBINACIONES.SUMA_ANILLO]: { v: 'V₁ ∪ V₂', a: '(A₁ ∪ A₂) − (A₁ ∩ A₂)', dicho: 'las que están en uno solo' },
    [COMBINACIONES.SUMA]: { v: 'V₁ ∪ V₂', a: 'A₁ ∪ A₂ ∪ {u–v : u ∈ V₁, v ∈ V₂}', dicho: 'las de los dos y todas las que unen V₁ con V₂' }
  });

  const escrita = (arista) => arista.join('–');
  const cuantas = (n) => `${n} ${n === 1 ? 'arista' : 'aristas'}`;
  const cuantos = (n) => `${n} ${n === 1 ? 'vértice' : 'vértices'}`;
  const conjunto = (lista) => (lista.length ? `{${lista.join(', ')}}` : '∅');

  function recorrer(g1, g2, operacion) {
    const { vertices, revisiones, aristas } = combinaciones.combinar(g1, g2, operacion);
    const simbolo = SIMBOLOS[operacion];
    const titulo = `${TITULOS[operacion]} ${simbolo}`;
    const regla = REGLAS[operacion];
    const esSuma = operacion === COMBINACIONES.SUMA;
    const a1 = aristasDe(g1);
    const a2 = aristasDe(g2);
    const lineaRegla = { etiqueta: 'Regla', expresion: `A = ${regla.a}`, resultado: '', activa: false };
    const comun = { combinacion: true, operacion, g1, g2, resultado: { vertices, aristas }, tituloCalculo: titulo };

    // Los conjuntos como se escriben en el cuaderno. `actual` es lo que el
    // paso mira, y va resaltado en los que lo contienen.
    const conjuntos = (hechas, actual = []) => {
      const fila = (etiqueta, elementos) => ({ etiqueta, elementos, actuales: elementos.filter((e) => actual.includes(e)) });
      const filas = [
        fila('V₁', g1.vertices), fila('V₂', g2.vertices), fila('V', vertices),
        fila('A₁', a1.map(escrita)), fila('A₂', a2.map(escrita))
      ];
      // En la suma, A llega a 66 aristas: escribirlas no cabe.
      if (!esSuma) filas.push(fila('A', aristas.slice(0, hechas).map((x) => escrita(x.arista))));
      return filas;
    };
    const pasos = [];
    const comunes = combinaciones.comunes(g1, g2);
    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun,
      hechas: 0,
      nuevasDesde: 0,
      usa: { g1: { vertices: g1.vertices.filter((v) => vertices.includes(v)), aristas: [] }, g2: { vertices: g2.vertices.filter((v) => vertices.includes(v)), aristas: [] } },
      verticesNuevos: vertices,
      conjuntos: conjuntos(0, vertices),
      calculo: [lineaRegla, { etiqueta: 'V', expresion: regla.v, resultado: conjunto(vertices), activa: true }],
      mensaje: `Vértices de ${simbolo}: V = ${regla.v}${regla.v === 'V₁' ? ', los de G₁' : ''}${
        vertices.length ? ` = ${conjunto(vertices)}` : ' = ∅: G₁ y G₂ no comparten vértices'}.${
        operacion === COMBINACIONES.UNION && comunes.length ? ` ${comunes.length === 1 ? `${comunes[0]} está en los dos y va` : `${comunes.slice(0, -1).join(', ')} y ${comunes[comunes.length - 1]} están en los dos y van`} una sola vez.` : ''}`
    }));

    let hechas = 0;
    const agregar = (grupo, linea, mensaje) => {
      const nuevasDesde = hechas;
      hechas += grupo.filter((r) => r.entra).length;
      const usadas = grupo.map((r) => r.arista);
      const unir = grupo[0] && grupo[0].de === 'nueva';
      const sale = grupo.length === 1 && !grupo[0].entra && !grupo[0].repetida ? grupo[0].arista : null;
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun,
        hechas,
        nuevasDesde,
        usa: unir
          ? { g1: { vertices: [grupo[0].vertice], aristas: [] }, g2: { vertices: g2.vertices, aristas: [] } }
          : { g1: { vertices: [], aristas: usadas }, g2: { vertices: [], aristas: usadas } },
        verticesNuevos: [],
        noEntra: sale,
        conjuntos: conjuntos(hechas, unir ? [grupo[0].vertice].concat(g2.vertices) : usadas.map(escrita)),
        calculo: [lineaRegla, { ...linea, activa: true }],
        mensaje
      }));
    };

    if (esSuma) {
      for (const [de, nombre, lista] of [['g1', 'G₁', a1], ['g2', 'G₂', a2]]) {
        const grupo = revisiones.filter((r) => r.de === de);
        if (grupo.length === 0) continue;
        agregar(grupo, { etiqueta: nombre, expresion: 'todas sus aristas', resultado: cuantas(lista.length) },
          `Aristas de ${nombre}: entran todas, ${cuantas(lista.length)}.`);
      }
      for (const u of g1.vertices) {
        const grupo = revisiones.filter((r) => r.de === 'nueva' && r.vertice === u);
        agregar(grupo, { etiqueta: `u = ${u}`, expresion: 'con todo V₂', resultado: cuantas(grupo.length) },
          `Vértice ${u} de G₁: se une con todos los de V₂, ${cuantas(grupo.length)}.`);
      }
    } else {
      for (const revision of revisiones) {
        const { linea, mensaje } = explicar(revision, operacion);
        agregar([revision], linea, mensaje);
      }
    }

    const c = combinaciones.cuenta(g1, g2, operacion);
    const conNumeros = (x) => `${x.formula}${x.numeros ? ` = ${x.numeros}` : ''}`;
    pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun,
      hechas,
      nuevasDesde: hechas,
      usa: null,
      verticesNuevos: [],
      conjuntos: conjuntos(hechas),
      cuenta: c,
      calculo: [
        { etiqueta: '|V|', expresion: conNumeros(c.vertices), resultado: String(c.vertices.valor), activa: false },
        { etiqueta: '|A|', expresion: conNumeros(c.aristas), resultado: String(c.aristas.valor), activa: true }
      ],
      mensaje: `${simbolo}: ${cuantos(c.vertices.valor)} y ${cuantas(c.aristas.valor)}, ${regla.dicho}. |A| = ${conNumeros(c.aristas)} = ${c.aristas.valor}.`
    }));
    return pasos;
  }

  // Lo que dice el paso de una arista revisada.
  function explicar({ arista, de, enLosDos, repetida, entra }, operacion) {
    const a = escrita(arista);
    const aqui = de === 'g1' ? 'A₁' : 'A₂';
    const alla = de === 'g1' ? 'A₂' : 'A₁';
    const linea = { etiqueta: a, expresion: enLosDos ? 'en A₁ y en A₂' : `en ${aqui}, no en ${alla}`, resultado: repetida && operacion === COMBINACIONES.UNION ? 'ya está' : entra ? 'entra' : 'no entra' };
    let mensaje;
    if (operacion === COMBINACIONES.UNION) {
      mensaje = repetida ? `Arista ${a} de G₂: ya entró desde G₁, y no se repite.` : `Arista ${a} de ${de === 'g1' ? 'G₁' : 'G₂'}: entra.`;
    } else if (operacion === COMBINACIONES.INTERSECCION) {
      mensaje = entra ? `Arista ${a}: está en G₁ y en G₂, entra.` : `Arista ${a}: está en G₁ pero no en G₂, no entra.`;
    } else if (operacion === COMBINACIONES.DIFERENCIA) {
      mensaje = entra ? `Arista ${a}: está en G₁ y no en G₂, entra.` : `Arista ${a}: está también en G₂, se quita.`;
    } else {
      const nombre = de === 'g1' ? 'G₁' : 'G₂';
      mensaje = entra ? `Arista ${a}: está solo en ${nombre}, entra.`
        : `Arista ${a}: está en los dos, no entra${repetida ? ' (ya se revisó desde G₁)' : ''}.`;
    }
    return { linea, mensaje };
  }

  window.CC2.algoritmos.combinaciones = { recorrer, SIMBOLOS, TITULOS, REGLAS };
})();
