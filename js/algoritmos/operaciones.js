(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const operaciones = window.CC2.dominio.operaciones;
  const { OPERACIONES, par } = operaciones;

  // Operaciones entre grafos (CLAUDE.md 5.15): la traza. Primero un paso con
  // los vértices, V₁ × V₂; después un paso por grupo de aristas, como los
  // arma `dominio.operaciones.operar`, y al final la cuenta con su fórmula
  // (maquetas aprobadas por el usuario el 2026-10-26).
  //
  // Cada paso lleva los dos operandos, el resultado completo y cuántas de
  // sus aristas ya están (`hechas`) y desde cuál son nuevas (`nuevasDesde`):
  // el dibujo pone las hechas, en naranja las nuevas y punteadas las que
  // faltan, y retroceder solo vuelve a dibujar (CLAUDE.md 4).

  const SIMBOLOS = Object.freeze({
    [OPERACIONES.CARTESIANO]: 'G₁ × G₂',
    [OPERACIONES.TENSORIAL]: 'G₁ ⊗ G₂',
    [OPERACIONES.COMPOSICION]: 'G₁[G₂]'
  });
  const TITULOS = Object.freeze({
    [OPERACIONES.CARTESIANO]: 'Producto cartesiano',
    [OPERACIONES.TENSORIAL]: 'Producto tensorial',
    [OPERACIONES.COMPOSICION]: 'Composición'
  });
  const REGLAS = Object.freeze({
    [OPERACIONES.CARTESIANO]: '(u, v) ~ (u′, v′) si u = u′ y v ~ v′ en G₂, o v = v′ y u ~ u′ en G₁',
    [OPERACIONES.TENSORIAL]: '(u, v) ~ (u′, v′) si u ~ u′ en G₁ y v ~ v′ en G₂',
    [OPERACIONES.COMPOSICION]: '(u, v) ~ (u′, v′) si u ~ u′ en G₁, o u = u′ y v ~ v′ en G₂'
  });

  const comoArista = ([p, q]) => `${par(...p)}–${par(...q)}`;
  const cuantas = (n) => `${n} ${n === 1 ? 'arista' : 'aristas'}`;
  // Las aristas del grupo escritas, si son pocas; si no, cuántas.
  const MAXIMAS_ESCRITAS = 4;
  const escritas = (aristas) => (aristas.length <= MAXIMAS_ESCRITAS
    ? `: ${aristas.map(comoArista).join(', ')}`
    : `, ${cuantas(aristas.length)}`);

  function recorrer(g1, g2, operacion) {
    const resultado = operaciones.operar(g1, g2, operacion);
    const aristas = resultado.grupos.flatMap((g) => g.aristas);
    const simbolo = SIMBOLOS[operacion];
    const titulo = `${TITULOS[operacion]} ${simbolo}`;
    const regla = { etiqueta: 'Regla', expresion: REGLAS[operacion], resultado: '', activa: false };
    const n1 = g1.vertices.length;
    const n2 = g2.vertices.length;
    const comun = { operacion, g1, g2, resultado: { vertices: resultado.vertices, aristas }, tituloCalculo: titulo };
    const pasos = [];

    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun,
      hechas: 0,
      nuevasDesde: 0,
      usa: { g1: { vertices: g1.vertices, aristas: [] }, g2: { vertices: g2.vertices, aristas: [] } },
      paresResaltados: resultado.vertices,
      calculo: [regla, { etiqueta: '|V|', expresion: `|V₁| · |V₂| = ${n1} · ${n2}`, resultado: String(n1 * n2), activa: true }],
      mensaje: `Vértices de ${simbolo}: los pares (u, v), con u de G₁ y v de G₂, ${n1} · ${n2} = ${n1 * n2}. Una fila por vértice de G₁ y una columna por vértice de G₂.`
    }));

    let hechas = 0;
    for (const grupo of resultado.grupos) {
      const nuevasDesde = hechas;
      hechas += grupo.aristas.length;
      const { linea, mensaje } = explicar(grupo, g1, g2);
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun,
        hechas,
        nuevasDesde,
        usa: grupo.usa,
        paresResaltados: paresDelGrupo(grupo, g1, g2),
        calculo: [regla, { ...linea, activa: true }],
        mensaje
      }));
    }

    const c = operaciones.cuenta(g1, g2, operacion);
    pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun,
      hechas,
      nuevasDesde: hechas,
      usa: null,
      paresResaltados: [],
      cuenta: c,
      calculo: [
        { etiqueta: '|V|', expresion: `|V₁| · |V₂| = ${n1} · ${n2}`, resultado: String(n1 * n2), activa: false },
        { etiqueta: '|A|', expresion: `${c.formula} = ${c.numeros}`, resultado: String(c.valor), activa: true }
      ],
      mensaje: `${simbolo}: ${n1 * n2} vértices y ${cuantas(c.valor)}. |A| = ${c.formula} = ${c.numeros} = ${c.valor}${porQue(operacion, g1, g2)}.`
    }));
    return pasos;
  }

  // Lo que dice el paso de un grupo: su línea del cálculo y el aviso.
  function explicar(grupo, g1, g2) {
    const n = grupo.aristas.length;
    if (grupo.tipo === 'copia-g2') {
      return {
        linea: { etiqueta: `u = ${grupo.u} fijo`, expresion: 'v ~ v′ en G₂', resultado: cuantas(n) },
        mensaje: n === 0
          ? `Vértice ${grupo.u} de G₁: G₂ no tiene aristas, así que la fila ${grupo.u} queda sin ninguna.`
          : `Vértice ${grupo.u} de G₁: se copia G₂ en la fila ${grupo.u}${escritas(grupo.aristas)}.`
      };
    }
    if (grupo.tipo === 'copia-g1') {
      return {
        linea: { etiqueta: `v = ${grupo.v} fijo`, expresion: 'u ~ u′ en G₁', resultado: cuantas(n) },
        mensaje: n === 0
          ? `Vértice ${grupo.v} de G₂: G₁ no tiene aristas, así que la columna ${grupo.v} queda sin ninguna.`
          : `Vértice ${grupo.v} de G₂: se copia G₁ en la columna ${grupo.v}${escritas(grupo.aristas)}.`
      };
    }
    const [u, u2] = grupo.arista;
    if (grupo.tipo === 'cruce') {
      const m2 = g2.aristas.length;
      return {
        linea: { etiqueta: `${u} ~ ${u2} en G₁`, expresion: `con ${cuantas(m2)} de G₂, dos cada una`, resultado: cuantas(n) },
        mensaje: m2 === 0
          ? `Arista ${u}–${u2} de G₁: G₂ no tiene aristas con que cruzarla, así que no da ninguna.`
          : `Arista ${u}–${u2} de G₁ con cada arista de G₂, en cruz${m2 === 1
            ? `: ${g2.aristas[0].join('–')} da ${comoArista(grupo.aristas[0])} y ${comoArista(grupo.aristas[1])}`
            : escritas(grupo.aristas)}.`
      };
    }
    const n2 = g2.vertices.length;
    return {
      linea: { etiqueta: `${u} ~ ${u2} en G₁`, expresion: `fila ${u} con fila ${u2}, todos con todos`, resultado: cuantas(n) },
      mensaje: `Arista ${u}–${u2} de G₁: todos los de la fila ${u} se unen con todos los de la fila ${u2}, ${n2} · ${n2} = ${cuantas(n)}.`
    };
  }

  // Los vértices del resultado que el grupo toca: la fila o la columna que
  // se copia, o las dos filas que se unen.
  function paresDelGrupo(grupo, g1, g2) {
    if (grupo.tipo === 'copia-g2') return g2.vertices.map((v) => [grupo.u, v]);
    if (grupo.tipo === 'copia-g1') return g1.vertices.map((u) => [u, grupo.v]);
    return grupo.arista.flatMap((u) => g2.vertices.map((v) => [u, v]));
  }

  // De dónde salen las aristas, dicho con los operandos.
  function porQue(operacion, g1, g2) {
    const n1 = g1.vertices.length;
    const n2 = g2.vertices.length;
    if (operacion === OPERACIONES.CARTESIANO) {
      return `: ${n1} ${n1 === 1 ? 'copia' : 'copias'} de G₂, una por vértice de G₁, y ${n2} de G₁, una por vértice de G₂`;
    }
    if (operacion === OPERACIONES.TENSORIAL) {
      return ': cada arista de G₁ con cada arista de G₂ da dos, en cruz';
    }
    return `: ${n1} ${n1 === 1 ? 'copia' : 'copias'} de G₂, y cada arista de G₁ une sus dos filas todos con todos, ${n2}² aristas`;
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.operaciones = { recorrer, SIMBOLOS, TITULOS, REGLAS };
})();
