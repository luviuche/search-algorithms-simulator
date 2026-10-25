(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const coloreado = window.CC2.dominio.coloreado;
  const { COLORES, MODOS } = coloreado;

  // Coloreado y particionamiento (CLAUDE.md 5.14): la traza de los tres
  // modos. Cada paso lleva lo que el dibujo necesita —los colores puestos
  // hasta ahí, el elemento del paso y sus vecinos, cuántas filas de la tabla
  // se ven—, así que retroceder solo vuelve a dibujar (CLAUDE.md 4).

  const letra = (c) => COLORES[c].letra;
  const nombre = (c) => COLORES[c].nombre.toLowerCase();
  const lista = (cosas) => (cosas.length === 1 ? String(cosas[0])
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`);
  const comoObjeto = (mapa) => Object.fromEntries([...mapa].map(([k, v]) => [k, v]));
  const letras = (colores) => [...new Set(colores)].sort((a, b) => a - b).map(letra);

  function recorrer(grafo, { modo, lambda = 3 }) {
    if (modo === MODOS.POLINOMIO) return pasosDelPolinomio(grafo, lambda);
    return pasosDeColorear(grafo, modo);
  }

  // ── Vértices y aristas: en orden, el primer color libre ──────────────────
  function pasosDeColorear(grafo, modo) {
    const deAristas = modo === MODOS.ARISTAS;
    const ev = coloreado.elementosYVecinos(grafo, modo);
    const { filas, usados } = coloreado.colorearEnOrden(ev);
    const minimo = coloreado.minimoDeColores(ev);
    const cosa = deAristas ? 'Arista' : 'Vértice';
    const delta = coloreado.gradoMaximo(grafo);
    const tabla = filas.map((f) => ({
      clave: f.clave,
      vecinos: f.vecinosColoreados.map((v) => `${v.clave} (${letra(v.color)})`).join(', ') || '—',
      color: f.color
    }));
    const pasos = [];
    const colores = new Map();
    const comun = () => ({ modo, tabla, colores: comoObjeto(colores), usados: new Set(colores.values()).size, delta });

    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun(),
      filasLlenas: 0,
      mensaje: `Coloreado de ${deAristas ? 'aristas' : 'vértices'}, en orden: cada ${deAristas ? 'arista' : 'vértice'} toma el primer color de R, N, A, V que no tenga ${deAristas ? 'ninguna arista que comparta un vértice con ella' : 'ninguno de sus vecinos'}.`
    }));

    filas.forEach((f, indice) => {
      colores.set(f.clave, f.color);
      const vecinosColoreados = f.vecinosColoreados.map((v) => v.clave);
      const ocupados = letras(f.vecinosColoreados.map((v) => v.color));
      const extremos = deAristas ? ` (${aristaPorNombre(grafo, f.clave)})` : '';
      const mensaje = vecinosColoreados.length === 0
        ? `${cosa} ${f.clave}${extremos}: ${deAristas ? 'no comparte vértice con ninguna arista coloreada' : 'no tiene vecinos coloreados'}; toma ${letra(f.color)} (${nombre(f.color)}).`
        : `${cosa} ${f.clave}${extremos}: ${deAristas ? `comparte vértice con ${lista(vecinosColoreados)}, que ${vecinosColoreados.length === 1 ? 'tiene' : 'tienen'}` : `${vecinosColoreados.length === 1 ? 'su vecino' : 'sus vecinos'} ${lista(vecinosColoreados)} ya ${vecinosColoreados.length === 1 ? 'tiene' : 'tienen'}`} ${lista(ocupados)}; el primer color libre es ${letra(f.color)} (${nombre(f.color)}).`;
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun(),
        filasLlenas: indice + 1,
        actual: f.clave,
        vecinos: ev.vecinos.get(f.clave),
        calculo: [
          { etiqueta: deAristas ? 'Vecinas ya coloreadas' : 'Vecinos ya coloreados', expresion: vecinosColoreados.join(', ') || '—', resultado: ocupados.join(', ') || '—', activa: false },
          { etiqueta: 'Primer color libre', expresion: COLORES.slice(0, Math.max(4, f.color + 1)).map((c) => c.letra).join(' '), resultado: letra(f.color), activa: true }
        ],
        tituloCalculo: `${cosa} ${f.clave}`,
        mensaje
      }));
    });

    // Al terminar: cuántos se usaron, y si se podía con menos.
    const simbolo = deAristas ? 'χ′(G)' : 'χ(G)';
    const porque = razonDelMinimo(grafo, modo, minimo.minimo, delta);
    const lineas = [
      { etiqueta: 'Colores usados', expresion: letras([...colores.values()]).join(', '), resultado: String(usados) },
      ...(deAristas ? [{ etiqueta: 'Grado máximo Δ', expresion: 'aristas del vértice con más', resultado: String(delta) }] : []),
      { etiqueta: `Con ${minimo.minimo - 1 || 'menos'} no se puede`, expresion: porque.corto, resultado: '' },
      { etiqueta: simbolo, expresion: 'mínimo de colores', resultado: String(minimo.minimo) }
    ];
    if (usados > minimo.minimo) {
      // El orden se pasó del mínimo: se dice, y se muestra uno con χ colores.
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun(),
        filasLlenas: filas.length,
        calculo: lineas.map((l) => ({ ...l, activa: false })),
        tituloCalculo: deAristas ? 'Índice cromático' : 'Número cromático',
        mensaje: `En este orden se usaron ${usados} colores, pero alcanza con ${minimo.minimo}: el recorrido en orden no siempre llega al mínimo.`
      }));
      const optimo = new Map([...minimo.colores]);
      pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
        modo, tabla, delta,
        colores: comoObjeto(optimo),
        usados: minimo.minimo,
        filasLlenas: filas.length,
        optimo: true,
        minimo: minimo.minimo,
        calculo: lineas.map((l, i) => ({ ...l, activa: i === lineas.length - 1 })),
        tituloCalculo: deAristas ? 'Índice cromático' : 'Número cromático',
        mensaje: `Con ${minimo.minimo} colores, así: ${[...optimo].map(([k, c]) => `${k} ${letra(c)}`).join(', ')}. ${simbolo} = ${minimo.minimo}.`
      }));
      return pasos;
    }
    pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun(),
      filasLlenas: filas.length,
      minimo: minimo.minimo,
      calculo: lineas.map((l, i) => ({ ...l, activa: i === lineas.length - 1 })),
      tituloCalculo: deAristas ? 'Índice cromático' : 'Número cromático',
      mensaje: `Se usaron ${usados} ${usados === 1 ? 'color' : 'colores'}, y no se puede con menos: ${porque.largo}. ${simbolo} = ${minimo.minimo}.`
        + (deAristas ? ` El grado máximo es Δ = ${delta}${minimo.minimo === delta ? ', y χ′(G) = Δ' : ', y χ′(G) = Δ + 1'}.` : '')
    }));
    return pasos;
  }

  function aristaPorNombre(grafo, nombreArista) {
    const a = grafo.aristas.find((x) => x.nombre === nombreArista);
    return `${a.origen}–${a.destino}`;
  }

  // Por qué no alcanza con menos colores. Si hay un grupo de vértices todos
  // vecinos entre sí del tamaño del mínimo, ese es el porqué que se ve en el
  // dibujo; en aristas, las del vértice de grado máximo se tocan todas en él.
  function razonDelMinimo(grafo, modo, minimo, delta) {
    if (minimo <= 1) {
      return modo === MODOS.ARISTAS
        ? { corto: '—', largo: 'con ninguno no se colorea nada' }
        : { corto: '—', largo: 'con ninguno no se colorea nada' };
    }
    if (modo === MODOS.ARISTAS) {
      if (minimo === delta) {
        const v = grafo.vertices.find((x) => grafo.aristas.filter((a) => a.origen === x || a.destino === x).length === delta);
        const suyas = grafo.aristas.filter((a) => a.origen === v || a.destino === v).map((a) => a.nombre);
        return { corto: `${suyas.join(', ')} se tocan en ${v}`, largo: `${lista(suyas)} se tocan todas en el vértice ${v}` };
      }
      return { corto: `con ${minimo - 1} siempre se repite`, largo: `con ${minimo - 1} siempre quedan dos aristas vecinas del mismo color` };
    }
    const clique = mayorGrupoDeVecinos(grafo);
    if (clique.length === minimo) {
      return { corto: `${clique.join(', ')} son vecinos entre sí`, largo: `${lista(clique)} son vecinos entre sí` };
    }
    return { corto: `con ${minimo - 1} siempre se repite`, largo: `con ${minimo - 1} siempre quedan dos vecinos del mismo color` };
  }

  function mayorGrupoDeVecinos(grafo) {
    const v = grafo.vertices;
    const vecinos = (a, b) => grafo.aristas.some((x) => (x.origen === a && x.destino === b) || (x.origen === b && x.destino === a));
    let mejor = [];
    for (let mascara = 1; mascara < (1 << v.length); mascara++) {
      const grupo = v.filter((_, i) => mascara & (1 << i));
      if (grupo.length <= mejor.length) continue;
      if (grupo.every((a, i) => grupo.slice(i + 1).every((b) => vecinos(a, b)))) mejor = grupo;
    }
    return mejor;
  }

  // ── El polinomio cromático, con la fórmula general ───────────────────────
  // P(λ) = Σ cᵢ · C(λ, i). Cada cᵢ es un particionamiento: las formas de
  // repartir los vértices en i grupos sin vecinos dentro (mᵢ), por las i!
  // formas de darle un color a cada grupo.
  function pasosDelPolinomio(grafo, lambda) {
    const resultado = coloreado.polinomioCromatico(grafo);
    const { m, c, coeficientes } = resultado;
    const n = grafo.vertices.length;
    const tabla = c.map((ci, k) => ({ i: k + 1, ci, mi: m[k] }));
    const pasos = [];
    const lineas = [];
    const comun = (filasLlenas, extra = {}) => ({ modo: MODOS.POLINOMIO, tabla, filasLlenas, lambda, polinomio: null, ...extra });

    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun(0),
      colores: {},
      mensaje: `Polinomio cromático: P(λ) = Σ cᵢ · C(λ, i), donde cᵢ son las formas de colorear el grafo usando exactamente i colores. Se evalúa en λ = ${lambda}.`
    }));

    c.forEach((ci, k) => {
      const i = k + 1;
      const ejemplo = ci > 0 ? coloreado.coloreadoConExactamente(grafo, i) : null;
      const explicacion = ci === 0
        ? (i === 1 && grafo.aristas.length
          ? 'con un solo color, los dos extremos de cada arista quedarían iguales'
          : `no hay forma de repartir los vértices en ${i} grupos sin dos vecinos en el mismo grupo`)
        : `hay ${m[k]} ${m[k] === 1 ? 'forma' : 'formas'} de repartir los vértices en ${i} ${i === 1 ? 'grupo' : 'grupos'} sin vecinos dentro, y ${i}! = ${coloreado.factorial(i)} de darle un color a cada grupo`;
      lineas.push({ etiqueta: `c${'₀₁₂₃₄₅₆₇₈₉'[i]}`, expresion: ci === 0 ? 'no hay forma' : `${m[k]} × ${i}!`, resultado: String(ci) });
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        ...comun(i),
        colores: ejemplo ? comoObjeto(ejemplo) : {},
        calculo: lineas.map((l, j) => ({ ...l, activa: j === lineas.length - 1 })),
        tituloCalculo: 'Polinomio cromático',
        mensaje: `c${'₀₁₂₃₄₅₆₇₈₉'[i]} = ${ci}: ${explicacion}.${ejemplo ? ` Una de ellas, en el grafo.` : ''}`
      }));
    });

    const expandido = coloreado.polinomioComoTexto(coeficientes);
    const factorizado = coloreado.factoresComoTexto(resultado.factores);
    const sumandos = c.map((ci, k) => ({ ci, i: k + 1 })).filter((x) => x.ci > 0);
    const polinomio = {
      suma: `P(λ) = ${sumandos.map(({ ci, i }) => `${ci === coloreado.factorial(i) ? '' : `${ci / coloreado.factorial(i)} · `}${caidaComoTexto(i)}`).join(' + ')}`,
      factorizado: `P(λ) = ${factorizado}`,
      expandido: `P(λ) = ${expandido}`,
      evaluado: null
    };
    pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
      ...comun(n, { polinomio }),
      colores: {},
      calculo: lineas.map((l) => ({ ...l, activa: false })).concat([{ etiqueta: 'P(λ)', expresion: 'Σ cᵢ · C(λ, i)', resultado: factorizado, activa: true }]),
      tituloCalculo: 'Polinomio cromático',
      mensaje: `Sumando cᵢ · C(λ, i): P(λ) = ${factorizado}, que es ${expandido}.`
    }));

    const valor = coloreado.evaluar(coeficientes, lambda);
    const minimo = coloreado.minimoDeColores(coloreado.elementosYVecinos(grafo, MODOS.VERTICES)).minimo;
    pasos.push(crearPaso(TIPOS_PASO.CONSTRUIDO, {
      ...comun(n, { polinomio: { ...polinomio, evaluado: `P(${lambda}) = ${valor}` }, valor, minimo }),
      colores: {},
      calculo: lineas.map((l) => ({ ...l, activa: false })).concat([
        { etiqueta: 'P(λ)', expresion: 'Σ cᵢ · C(λ, i)', resultado: factorizado, activa: false },
        { etiqueta: `P(${lambda})`, expresion: `con λ = ${lambda}`, resultado: String(valor), activa: true }
      ]),
      tituloCalculo: 'Polinomio cromático',
      mensaje: valor === 0
        ? `P(${lambda}) = 0: con ${lambda} ${lambda === 1 ? 'color' : 'colores'} no se puede colorear el grafo, hacen falta ${minimo} (χ(G) = ${minimo}).`
        : `P(${lambda}) = ${valor}: hay ${valor} ${valor === 1 ? 'forma' : 'formas'} de colorear el grafo con ${lambda} ${lambda === 1 ? 'color' : 'colores'}. χ(G) = ${minimo}.`
    }));
    return pasos;
  }

  // λ(λ−1)(λ−2): lo que queda de C(λ, i) multiplicado por i!.
  function caidaComoTexto(i) {
    return Array.from({ length: i }, (_, k) => (k === 0 ? 'λ' : `(λ−${k})`)).join('');
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.coloreado = { recorrer };
})();
