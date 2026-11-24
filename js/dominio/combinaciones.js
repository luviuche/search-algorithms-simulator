(function () {
  // Operaciones entre dos grafos que comparten vértices (CLAUDE.md 5.15):
  // unión, intersección, diferencia, suma anillo y suma (lista aprobada por el
  // usuario el 2026-11-24). No hay material del docente: las definiciones son
  // las usuales, y las dudas están en CLAUDE.md 5.15.
  //
  //   G₁ ∪ G₂   V₁ ∪ V₂   las aristas de cualquiera de los dos
  //   G₁ ∩ G₂   V₁ ∩ V₂   las aristas que están en los dos
  //   G₁ − G₂   V₁        las aristas de G₁ que no están en G₂
  //   G₁ ⊕ G₂   V₁ ∪ V₂   las aristas que están en uno solo
  //   G₁ + G₂   V₁ ∪ V₂   las de los dos, más todas las que unen V₁ con V₂;
  //                       pide que no compartan vértices
  //
  // Aquí dos vértices con el mismo nombre son el mismo. En los productos
  // (`operaciones.js`) no importa, porque el resultado son pares.
  const { ordenNatural, leerOperando } = window.CC2.dominio.operaciones;

  const COMBINACIONES = Object.freeze({
    UNION: 'union', INTERSECCION: 'interseccion', DIFERENCIA: 'diferencia', SUMA_ANILLO: 'suma-anillo', SUMA: 'suma'
  });

  // El resultado tiene a lo sumo V₁ ∪ V₂: con 6 y 6 son 12.
  const VERTICES_MAXIMOS = 6;

  const es = (operacion) => Object.values(COMBINACIONES).includes(operacion);

  const leer = (texto, nombre) => leerOperando(texto, nombre, VERTICES_MAXIMOS);

  // Una arista no tiene sentido: 2–1 y 1–2 son la misma, y en los conjuntos
  // tienen que verse iguales.
  const ordenada = ([u, v]) => (ordenNatural(u, v) <= 0 ? [u, v] : [v, u]);
  const clave = (arista) => ordenada(arista).join('|');
  const aristasDe = (grafo) => grafo.aristas.map(ordenada);

  const comunes = (g1, g2) => g1.vertices.filter((v) => g2.vertices.includes(v));
  const reunir = (g1, g2) => [...new Set(g1.vertices.concat(g2.vertices))].sort(ordenNatural);

  // Por qué dos operandos no se pueden operar, o null.
  function impedimento(g1, g2, operacion) {
    if (operacion !== COMBINACIONES.SUMA) return null;
    const repetidos = comunes(g1, g2);
    if (repetidos.length === 0) return null;
    return `La suma G₁ + G₂ pide grafos sin vértices en común, y ${repetidos.length === 1
      ? `${repetidos[0]} está` : `${repetidos.join(', ')} están`} en los dos.`;
  }

  // Los vértices del resultado y las aristas **en el orden en que se revisan**
  // paso a paso. Cada revisión dice de dónde sale la arista, si está en el
  // otro grafo y si entra; `repetida` es la que está en los dos y ya se
  // revisó desde G₁.
  function combinar(g1, g2, operacion) {
    const a1 = aristasDe(g1);
    const a2 = aristasDe(g2);
    const claves1 = new Set(a1.map(clave));
    const claves2 = new Set(a2.map(clave));
    const { UNION, INTERSECCION, DIFERENCIA, SUMA_ANILLO, SUMA } = COMBINACIONES;
    const vertices = operacion === INTERSECCION ? comunes(g1, g2)
      : operacion === DIFERENCIA ? g1.vertices.slice()
        : reunir(g1, g2);
    const revisiones = [];
    for (const arista of a1) {
      const enLosDos = claves2.has(clave(arista));
      const entra = operacion === UNION || operacion === SUMA
        || (operacion === INTERSECCION ? enLosDos : !enLosDos);
      revisiones.push({ arista, de: 'g1', enLosDos, repetida: false, entra, origen: enLosDos ? 'ambos' : 'g1' });
    }
    if ([UNION, SUMA_ANILLO, SUMA].includes(operacion)) {
      for (const arista of a2) {
        const enLosDos = claves1.has(clave(arista));
        revisiones.push({ arista, de: 'g2', enLosDos, repetida: enLosDos, entra: !enLosDos, origen: 'g2' });
      }
    }
    if (operacion === SUMA) {
      for (const u of g1.vertices) {
        for (const v of g2.vertices) {
          revisiones.push({ arista: [u, v], de: 'nueva', vertice: u, enLosDos: false, repetida: false, entra: true, origen: 'nueva' });
        }
      }
    }
    const aristas = revisiones.filter((r) => r.entra).map((r) => ({ arista: r.arista, origen: r.origen }));
    return { vertices, revisiones, aristas };
  }

  // |V| y |A| con su fórmula y sus números.
  function cuenta(g1, g2, operacion) {
    const n1 = g1.vertices.length;
    const n2 = g2.vertices.length;
    const m1 = g1.aristas.length;
    const m2 = g2.aristas.length;
    const nc = comunes(g1, g2).length;
    const mc = combinar(g1, g2, COMBINACIONES.INTERSECCION).aristas.length;
    const union = { formula: '|V₁| + |V₂| − |V₁ ∩ V₂|', numeros: `${n1} + ${n2} − ${nc}`, valor: n1 + n2 - nc };
    switch (operacion) {
      case COMBINACIONES.UNION:
        return { vertices: union, aristas: { formula: '|A₁| + |A₂| − |A₁ ∩ A₂|', numeros: `${m1} + ${m2} − ${mc}`, valor: m1 + m2 - mc } };
      case COMBINACIONES.INTERSECCION:
        return { vertices: { formula: '|V₁ ∩ V₂|', numeros: '', valor: nc }, aristas: { formula: '|A₁ ∩ A₂|', numeros: '', valor: mc } };
      case COMBINACIONES.DIFERENCIA:
        return { vertices: { formula: '|V₁|', numeros: '', valor: n1 }, aristas: { formula: '|A₁| − |A₁ ∩ A₂|', numeros: `${m1} − ${mc}`, valor: m1 - mc } };
      case COMBINACIONES.SUMA_ANILLO:
        return { vertices: union, aristas: { formula: '|A₁| + |A₂| − 2·|A₁ ∩ A₂|', numeros: `${m1} + ${m2} − 2 · ${mc}`, valor: m1 + m2 - 2 * mc } };
      default:
        return {
          vertices: { formula: '|V₁| + |V₂|', numeros: `${n1} + ${n2}`, valor: n1 + n2 },
          aristas: { formula: '|A₁| + |A₂| + |V₁|·|V₂|', numeros: `${m1} + ${m2} + ${n1} · ${n2}`, valor: m1 + m2 + n1 * n2 }
        };
    }
  }

  window.CC2.dominio.combinaciones = {
    COMBINACIONES, VERTICES_MAXIMOS, es, leer, impedimento, combinar, cuenta, comunes, reunir, aristasDe, clave
  };
})();
