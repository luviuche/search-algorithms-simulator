(function () {
  // Operaciones entre grafos (CLAUDE.md 5.15): producto cartesiano G₁ ⊕ G₂
  // —el + en círculo es el símbolo del docente—, producto tensorial G₁ ⊗ G₂ y
  // composición G₁[G₂] (notación confirmada por el usuario, 2026-10-26). No
  // hay material del docente: el paso a paso lo propuso esta aplicación sobre
  // maquetas, y el usuario lo aprobó.
  //
  // Los vértices del resultado son los pares (u, v), u de G₁ y v de G₂, y
  // las aristas salen de la regla de cada operación (~ es «adyacente a»):
  //
  //   G₁ ⊕ G₂   (u, v) ~ (u′, v′) si u = u′ y v ~ v′, o v = v′ y u ~ u′
  //   G₁ ⊗ G₂   (u, v) ~ (u′, v′) si u ~ u′ y v ~ v′
  //   G₁[G₂]    (u, v) ~ (u′, v′) si u ~ u′, o u = u′ y v ~ v′
  //
  // Los grafos son simples y no dirigidos.

  const OPERACIONES = Object.freeze({ CARTESIANO: 'cartesiano', TENSORIAL: 'tensorial', COMPOSICION: 'composicion' });

  // El resultado ya tiene |V₁| · |V₂| vértices: con 4 y 4 son 16.
  const VERTICES_MAXIMOS = 4;

  // Un grafo de la operación: una arista por renglón, «u v», y un vértice
  // solo en su renglón si está aislado. **Los vértices pueden ser números o
  // letras**, en cualquiera de los dos grafos (pedido del usuario,
  // 2026-10-26): por eso aquí no hay nombre de arista delante, como en los
  // otros temas.
  function leerOperando(texto, nombre) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    if (renglones.length === 0) {
      return { valido: false, mensaje: `${nombre}: escriba al menos una arista o un vértice, por ejemplo «1 2».` };
    }
    const vertices = new Set();
    const aristas = [];
    const vistas = new Map();
    for (const [indice, renglon] of renglones.entries()) {
      const partes = renglon.split(/[\s,\-–>]+/).filter(Boolean);
      const donde = `${nombre}, renglón ${indice + 1} («${renglon}»)`;
      if (partes.length > 2) return { valido: false, mensaje: `${donde}: una arista son sus dos vértices, sin peso ni nombre.` };
      if (!partes.every((p) => /^[0-9]{1,2}$|^[a-zA-Z][0-9]?$/.test(p))) {
        return { valido: false, mensaje: `${donde}: un vértice es un número de hasta dos cifras o una letra (1, 12, a, x1).` };
      }
      if (partes.length === 1) {
        vertices.add(partes[0]);
        continue;
      }
      const [u, v] = partes;
      if (u === v) return { valido: false, mensaje: `${donde}: un lazo no forma parte de un grafo simple; quítelo.` };
      const clave = [u, v].sort().join('|');
      if (vistas.has(clave)) return { valido: false, mensaje: `${donde}: esa arista ya está en el renglón ${vistas.get(clave) + 1}.` };
      vistas.set(clave, indice);
      vertices.add(u);
      vertices.add(v);
      aristas.push([u, v]);
    }
    if (vertices.size > VERTICES_MAXIMOS) {
      return { valido: false, mensaje: `${nombre} tiene ${vertices.size} vértices; caben hasta ${VERTICES_MAXIMOS}, porque el resultado tiene el producto de los dos.` };
    }
    return { valido: true, grafo: { vertices: [...vertices].sort(ordenNatural), aristas } };
  }

  // El operando escrito como se guarda: sus aristas, y después sus vértices
  // aislados, uno por renglón.
  function comoTexto(grafo) {
    const conArista = new Set(grafo.aristas.flat());
    return grafo.aristas.map((a) => a.join(' '))
      .concat(grafo.vertices.filter((v) => !conArista.has(v)))
      .join('\n');
  }

  // Los números por su valor y antes que las letras.
  function ordenNatural(a, b) {
    const na = /^\d+$/.test(a);
    const nb = /^\d+$/.test(b);
    if (na && nb) return Number(a) - Number(b);
    if (na !== nb) return na ? -1 : 1;
    return a.localeCompare(b);
  }

  const adyacentes = (grafo, x, y) => grafo.aristas.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  const par = (u, v) => `(${u}, ${v})`;

  // El resultado, con las aristas **agrupadas como se agregan paso a paso**:
  //
  //   cartesiano   una copia de G₂ por cada vértice de G₁ (su fila), y una de
  //                G₁ por cada vértice de G₂ (su columna)
  //   tensorial    una arista de G₁ por grupo, cruzada con todas las de G₂;
  //                cada par de aristas da dos, en cruz
  //   composición  una copia de G₂ por cada vértice de G₁, y una arista de G₁
  //                por grupo, que une todos los de una fila con todos los de
  //                la otra
  //
  // Cada grupo dice qué usa de cada operando, para resaltarlo.
  function operar(g1, g2, operacion) {
    const vertices = g1.vertices.flatMap((u) => g2.vertices.map((v) => [u, v]));
    const grupos = [];
    const copiasDeG2 = () => g1.vertices.forEach((u) => grupos.push({
      tipo: 'copia-g2', u,
      usa: { g1: { vertices: [u], aristas: [] }, g2: { vertices: [], aristas: g2.aristas } },
      aristas: g2.aristas.map(([v, w]) => [[u, v], [u, w]])
    }));
    if (operacion === OPERACIONES.CARTESIANO) {
      copiasDeG2();
      g2.vertices.forEach((v) => grupos.push({
        tipo: 'copia-g1', v,
        usa: { g1: { vertices: [], aristas: g1.aristas }, g2: { vertices: [v], aristas: [] } },
        aristas: g1.aristas.map(([u, w]) => [[u, v], [w, v]])
      }));
    } else if (operacion === OPERACIONES.TENSORIAL) {
      g1.aristas.forEach(([u, u2]) => grupos.push({
        tipo: 'cruce', arista: [u, u2],
        usa: { g1: { vertices: [], aristas: [[u, u2]] }, g2: { vertices: [], aristas: g2.aristas } },
        aristas: g2.aristas.flatMap(([v, v2]) => [[[u, v], [u2, v2]], [[u, v2], [u2, v]]])
      }));
    } else {
      copiasDeG2();
      g1.aristas.forEach(([u, u2]) => grupos.push({
        tipo: 'todos', arista: [u, u2],
        usa: { g1: { vertices: [], aristas: [[u, u2]] }, g2: { vertices: [], aristas: [] } },
        aristas: g2.vertices.flatMap((v) => g2.vertices.map((w) => [[u, v], [u2, w]]))
      }));
    }
    const total = grupos.reduce((suma, g) => suma + g.aristas.length, 0);
    return { vertices, grupos, total };
  }

  // La cuenta de aristas de cada operación, con su fórmula y sus números.
  function cuenta(g1, g2, operacion) {
    const n1 = g1.vertices.length;
    const n2 = g2.vertices.length;
    const m1 = g1.aristas.length;
    const m2 = g2.aristas.length;
    if (operacion === OPERACIONES.CARTESIANO) {
      return { formula: '|V₁|·|A₂| + |V₂|·|A₁|', numeros: `${n1} · ${m2} + ${n2} · ${m1}`, valor: n1 * m2 + n2 * m1 };
    }
    if (operacion === OPERACIONES.TENSORIAL) {
      return { formula: '2·|A₁|·|A₂|', numeros: `2 · ${m1} · ${m2}`, valor: 2 * m1 * m2 };
    }
    return { formula: '|V₁|·|A₂| + |V₂|²·|A₁|', numeros: `${n1} · ${m2} + ${n2}² · ${m1}`, valor: n1 * m2 + n2 * n2 * m1 };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.operaciones = { OPERACIONES, VERTICES_MAXIMOS, leerOperando, comoTexto, operar, cuenta, adyacentes, par };
})();
