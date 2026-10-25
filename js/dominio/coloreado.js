(function () {
  // Coloreado y particionamiento (CLAUDE.md 5.14), con el método de los
  // apuntes del docente (docs/Coloreado de Grafos/, 2021-I; lo que se vio en
  // clase en 2026: vértices, aristas y polinomio cromático):
  //
  //   · **En orden, el primer color libre.** Cada vértice —o cada arista—, en
  //     el orden en que se escribió, toma el primer color de R, N, A, V que no
  //     tenga ninguno de sus vecinos ya coloreados. Es lo que hace la hoja 1:
  //     V1 R, V2 N, V3 A, V4 R.
  //   · El número cromático χ(G) —y el índice χ′(G)— se calculan aparte,
  //     exactos: el recorrido en orden no siempre llega al mínimo, y entonces
  //     se dice.
  //   · **El polinomio cromático con la fórmula general** de los apuntes,
  //     P(λ) = Σ cᵢ · C(λ, i), con cᵢ las formas de colorear usando
  //     exactamente i colores (elegida por el usuario, 2026-10-24, sobre las
  //     fórmulas de casos especiales, que para los cíclicos están mal: el
  //     cíclico de 5 vértices con 3 colores da 24 en la hoja y son 30).
  //
  // Dos vértices son vecinos si los une una arista, sin importar su sentido:
  // el coloreado no depende de la dirección. Dos aristas son vecinas si
  // comparten un vértice.

  // Los colores de los apuntes y, si hacen falta más —un completo de 5
  // vértices pide 5—, cuatro que no usa el docente.
  const COLORES = Object.freeze([
    { letra: 'R', nombre: 'Rojo' },
    { letra: 'N', nombre: 'Negro' },
    { letra: 'A', nombre: 'Azul' },
    { letra: 'V', nombre: 'Verde' },
    { letra: 'M', nombre: 'Morado' },
    { letra: 'C', nombre: 'Café' },
    { letra: 'G', nombre: 'Gris' },
    { letra: 'O', nombre: 'Ocre' }
  ]);

  const MODOS = Object.freeze({ VERTICES: 'vertices', ARISTAS: 'aristas', POLINOMIO: 'polinomio' });

  // Los elementos que se colorean y quiénes son vecinos de quién, como
  // listas de claves: números para los vértices, nombres para las aristas.
  function elementosYVecinos(grafo, modo) {
    if (modo === MODOS.ARISTAS) {
      const claves = grafo.aristas.map((a) => a.nombre);
      const vecinos = new Map(grafo.aristas.map((a) => [a.nombre, grafo.aristas
        .filter((b) => b !== a && [b.origen, b.destino].some((v) => v === a.origen || v === a.destino))
        .map((b) => b.nombre)]));
      return { claves, vecinos };
    }
    const claves = grafo.vertices.slice();
    const vecinos = new Map(claves.map((v) => [v, grafo.vertices.filter((u) => u !== v
      && grafo.aristas.some((a) => (a.origen === u && a.destino === v) || (a.origen === v && a.destino === u)))]));
    return { claves, vecinos };
  }

  // En orden, el primer color libre. Devuelve, por elemento, sus vecinos ya
  // coloreados con su color y el color que toma: la tabla del docente.
  function colorearEnOrden({ claves, vecinos }) {
    const color = new Map();
    const filas = [];
    for (const clave of claves) {
      const coloreados = vecinos.get(clave).filter((v) => color.has(v)).map((v) => ({ clave: v, color: color.get(v) }));
      const ocupados = new Set(coloreados.map((c) => c.color));
      const libre = COLORES.findIndex((_, i) => !ocupados.has(i));
      color.set(clave, libre);
      filas.push({ clave, vecinosColoreados: coloreados, color: libre });
    }
    return { filas, colores: color, usados: new Set(color.values()).size };
  }

  // El mínimo de colores, buscando con vuelta atrás desde 1. Con hasta 8
  // vértices —o 28 aristas— es inmediato. Devuelve también un coloreado con
  // ese mínimo, para mostrarlo si el recorrido en orden usó más.
  function minimoDeColores({ claves, vecinos }) {
    if (claves.length === 0) return { minimo: 0, colores: new Map() };
    for (let k = 1; k <= claves.length; k++) {
      const color = new Map();
      const probar = (i) => {
        if (i === claves.length) return true;
        const clave = claves[i];
        for (let c = 0; c < k; c++) {
          if (vecinos.get(clave).some((v) => color.get(v) === c)) continue;
          color.set(clave, c);
          if (probar(i + 1)) return true;
          color.delete(clave);
        }
        return false;
      };
      if (probar(0)) return { minimo: k, colores: color };
    }
    return { minimo: claves.length, colores: new Map(claves.map((c, i) => [c, i])) };
  }

  function gradoMaximo(grafo) {
    const grados = grafo.vertices.map((v) => grafo.aristas.filter((a) => a.origen === v || a.destino === v).length);
    return grados.length ? Math.max(...grados) : 0;
  }

  // **Particionamiento**: las formas de repartir los vértices en i grupos sin
  // vecinos dentro de ninguno (mᵢ). Colorear con exactamente i colores es
  // eso mismo más darle un color a cada grupo, así que cᵢ = mᵢ · i!. Se
  // cuentan por subconjuntos: el grupo del primer vértice que queda, y lo
  // demás repartido igual.
  function particiones(grafo) {
    const { claves, vecinos } = elementosYVecinos(grafo, MODOS.VERTICES);
    const n = claves.length;
    const indice = new Map(claves.map((c, i) => [c, i]));
    const vecinosMascara = claves.map((c) => vecinos.get(c).reduce((m, v) => m | (1 << indice.get(v)), 0));
    const independiente = (mascara) => {
      for (let i = 0; i < n; i++) if (mascara & (1 << i) && mascara & vecinosMascara[i]) return false;
      return true;
    };
    const memo = new Map();
    // Cuántas formas hay de repartir `mascara` en exactamente `grupos`.
    const contar = (mascara, grupos) => {
      if (mascara === 0) return grupos === 0 ? 1 : 0;
      if (grupos === 0) return 0;
      const clave = mascara * 16 + grupos;
      if (memo.has(clave)) return memo.get(clave);
      const primero = mascara & -mascara;
      const resto = mascara ^ primero;
      let total = 0;
      // El grupo del primer vértice: él más cualquier parte del resto.
      for (let sub = resto; ; sub = (sub - 1) & resto) {
        const grupo = sub | primero;
        if (independiente(grupo)) total += contar(mascara ^ grupo, grupos - 1);
        if (sub === 0) break;
      }
      memo.set(clave, total);
      return total;
    };
    const todos = (1 << n) - 1;
    const m = [];
    for (let i = 1; i <= n; i++) m.push(contar(todos, i));
    return m;
  }

  const factorial = (k) => (k <= 1 ? 1 : k * factorial(k - 1));

  // Un coloreado que usa exactamente i colores, para dibujarlo junto a cᵢ.
  function coloreadoConExactamente(grafo, i) {
    const { claves, vecinos } = elementosYVecinos(grafo, MODOS.VERTICES);
    const color = new Map();
    const probar = (k) => {
      if (k === claves.length) return new Set(color.values()).size === i;
      for (let c = 0; c < i; c++) {
        if (vecinos.get(claves[k]).some((v) => color.get(v) === c)) continue;
        // Sin saltarse colores: así el primero es R, el siguiente N…
        if (c > 0 && ![...color.values()].includes(c - 1)) continue;
        color.set(claves[k], c);
        if (probar(k + 1)) return true;
        color.delete(claves[k]);
      }
      return false;
    };
    return probar(0) ? color : null;
  }

  // ── Polinomios con coeficientes enteros, del grado 0 hacia arriba ────────
  const sumar = (p, q) => Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] || 0) + (q[i] || 0));
  const multiplicar = (p, q) => {
    const r = new Array(p.length + q.length - 1).fill(0);
    p.forEach((a, i) => q.forEach((b, j) => { r[i + j] += a * b; }));
    return r;
  };
  const escalar = (p, k) => p.map((a) => a * k);
  const evaluar = (p, x) => p.reduce((total, a, i) => total + a * x ** i, 0);

  // λ(λ−1)…(λ−i+1): el numerador de C(λ, i).
  function caidaFactorial(i) {
    let p = [1];
    for (let k = 0; k < i; k++) p = multiplicar(p, [-k, 1]);
    return p;
  }

  // P(λ) = Σ cᵢ · C(λ, i) = Σ mᵢ · λ(λ−1)…(λ−i+1).
  function polinomioCromatico(grafo) {
    const m = particiones(grafo);
    const c = m.map((mi, k) => mi * factorial(k + 1));
    let p = [0];
    m.forEach((mi, k) => { p = sumar(p, escalar(caidaFactorial(k + 1), mi)); });
    while (p.length > 1 && p[p.length - 1] === 0) p.pop();
    return { m, c, coeficientes: p, factores: factorizar(p, grafo.vertices.length) };
  }

  // Las raíces enteras de 0 a n, cada una con su multiplicidad, y lo que
  // quede sin factorizar: λ(λ−1)(λ−2)² en vez de λ⁴ − 5λ³ + 8λ² − 4λ.
  function factorizar(p, n) {
    let resto = p.slice();
    const factores = [];
    for (let r = 0; r <= n && resto.length > 1; r++) {
      let veces = 0;
      while (resto.length > 1 && evaluar(resto, r) === 0) {
        resto = dividirPorRaiz(resto, r);
        veces++;
      }
      if (veces) factores.push({ raiz: r, veces });
    }
    return { factores, resto };
  }

  // Divide entre (λ − r) por Ruffini.
  function dividirPorRaiz(p, r) {
    const grado = p.length - 1;
    const q = new Array(grado).fill(0);
    let arrastre = 0;
    for (let i = grado; i >= 1; i--) {
      arrastre = p[i] + arrastre * r;
      q[i - 1] = arrastre;
    }
    return q;
  }

  const SUPERINDICES = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const potencia = (k) => (k === 1 ? '' : String(k).replace(/\d/g, (d) => SUPERINDICES[d]));

  // λ⁴ − 5λ³ + 8λ² − 4λ
  function polinomioComoTexto(p) {
    const terminos = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const a = p[i];
      if (a === 0) continue;
      const absoluto = Math.abs(a);
      const variable = i === 0 ? '' : `λ${potencia(i)}`;
      const numero = absoluto === 1 && i > 0 ? '' : String(absoluto);
      const signo = a < 0 ? '−' : '+';
      terminos.push(terminos.length === 0 ? `${a < 0 ? '−' : ''}${numero}${variable}` : `${signo} ${numero}${variable}`);
    }
    return terminos.length ? terminos.join(' ') : '0';
  }

  // λ(λ−1)(λ−2)²
  function factoresComoTexto({ factores, resto }) {
    const partes = factores.map(({ raiz, veces }) => {
      const base = raiz === 0 ? 'λ' : `(λ−${raiz})`;
      return `${base}${potencia(veces)}`;
    });
    const constante = resto.length === 1 ? resto[0] : null;
    if (constante !== null && constante !== 1) partes.unshift(String(constante));
    if (constante === null) partes.push(`(${polinomioComoTexto(resto)})`);
    return partes.join('') || '1';
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.coloreado = {
    COLORES, MODOS, elementosYVecinos, colorearEnOrden, minimoDeColores, gradoMaximo,
    particiones, coloreadoConExactamente, polinomioCromatico, evaluar, caidaFactorial,
    polinomioComoTexto, factoresComoTexto, factorial
  };
})();
