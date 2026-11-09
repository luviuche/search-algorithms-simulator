(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const expansion = window.CC2.dominio.expansion;
  const { METODOS, etiqueta } = expansion;

  // Árbol de expansión mínimo (CLAUDE.md 5.18): la traza de Prim o de
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
  // con el rango, y el complemento —las cuerdas— con la nulidad.
  //
  //   Árbol escrito  un paso que lo comprueba (para seguir el ejemplo del
  //                  docente, que elige a, b, e, f entre varios)

  const lista = (cosas) => (cosas.length === 1 ? String(cosas[0])
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`);
  const llaves = (cosas) => `{${cosas.join(', ')}}`;
  const nombres = (aristas) => aristas.map((a) => a.nombre);
  const conPeso = (a) => `${etiqueta(a)} (${a.peso})`;

  function recorrer(grafo, { metodo, inicio, arbol = [] }) {
    if (metodo === METODOS.DADO) return pasosDelArbolDado(grafo, arbol);
    return metodo === METODOS.PRIM ? pasosDePrim(grafo, inicio || grafo.vertices[0]) : pasosDeKruskal(grafo);
  }

  // ── Árbol escrito ────────────────────────────────────────────────────────
  function pasosDelArbolDado(grafo, nombresDelArbol) {
    const arbol = grafo.aristas.filter((a) => nombresDelArbol.includes(a.nombre));
    const n = grafo.vertices.length;
    const comun = { metodo: METODOS.DADO, descartadas: [], tabla: [] };
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      ...comun, T: nombres(arbol), fase: 'dado',
      calculo: arbol.map((a) => ({ etiqueta: a.nombre, expresion: `${etiqueta(a)} · peso ${a.peso}`, resultado: '', activa: false })),
      tituloCalculo: 'Árbol escrito',
      mensaje: `Árbol escrito: ${llaves(nombres(arbol))}. Tiene n − 1 = ${n - 1} aristas y ningún ciclo, así que toca a los ${n} vértices: es un árbol de expansión.`
    })];
    return pasos.concat(conclusion(grafo, arbol, { ...comun, antes: '' }));
  }

  // ── Kruskal ──────────────────────────────────────────────────────────────
  function pasosDeKruskal(grafo) {
    const n = grafo.vertices.length;
    const { orden, decisiones, arbol } = expansion.kruskal(grafo);
    const tabla = (hasta) => orden.map((a, i) => {
      const d = decisiones[i];
      return {
        arista: a.nombre, etiqueta: etiqueta(a), peso: a.peso,
        decision: i < hasta ? (d.entra ? 'entra' : 'ciclo') : (hasta === decisiones.length && !d ? 'sobra' : null)
      };
    });
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      metodo: METODOS.KRUSKAL, T: [], descartadas: [], tabla: tabla(0),
      calculo: orden.map((a) => ({ etiqueta: etiqueta(a), expresion: `peso ${a.peso}`, resultado: '', activa: false })),
      tituloCalculo: 'Aristas por peso',
      mensaje: `Se ordenan las ${orden.length} aristas de menor a mayor peso (las de igual peso, en el orden escrito). Cada vértice empieza solo, en su propio componente; el árbol necesita n − 1 = ${n - 1} aristas.`
    })];
    const T = [];
    const descartadas = [];
    decisiones.forEach((d, i) => {
      const a = d.arista;
      if (d.entra) T.push(a);
      else descartadas.push(a);
      const [x, y] = d.une || [];
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        metodo: METODOS.KRUSKAL, T: nombres(T), descartadas: nombres(descartadas), tabla: tabla(i + 1),
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
    const sobran = orden.slice(decisiones.length);
    return pasos.concat(conclusion(grafo, arbol, {
      metodo: METODOS.KRUSKAL, descartadas: nombres(descartadas), tabla: tabla(decisiones.length),
      antes: sobran.length
        ? `Ya hay ${n - 1} aristas: ${sobran.length === 1 ? 'la que queda' : `las ${sobran.length} que quedan`} (${sobran.map(etiqueta).join(', ')}) no hace falta revisarlas. `
        : ''
    }));
  }

  // ── Prim ─────────────────────────────────────────────────────────────────
  function pasosDePrim(grafo, inicio) {
    const n = grafo.vertices.length;
    const { vueltas, arbol } = expansion.prim(grafo, inicio);
    const tabla = (hasta) => vueltas.slice(0, hasta).map((v) => ({
      dentro: v.dentro.slice(), arista: v.elegida.nombre, etiqueta: etiqueta(v.elegida), peso: v.elegida.peso, nuevo: v.nuevo
    }));
    // Las que ya no pueden entrar: sus dos extremos están en el árbol.
    const internas = (dentro, T) => grafo.aristas
      .filter((a) => !T.includes(a) && dentro.includes(a.origen) && dentro.includes(a.destino));
    const pasos = [crearPaso(TIPOS_PASO.CALCULO, {
      metodo: METODOS.PRIM, T: [], dentro: [inicio], descartadas: [], tabla: [],
      mensaje: `Se empieza por el vértice ${inicio}. En cada paso entra la arista más liviana que sale del árbol hacia un vértice que todavía no está en él (entre iguales, la escrita antes). Hacen falta n − 1 = ${n - 1}.`
    })];
    const T = [];
    vueltas.forEach((v, i) => {
      T.push(v.elegida);
      const dentro = v.dentro.concat(v.nuevo);
      const otras = v.candidatas.filter((c) => c !== v.elegida);
      const empate = otras.filter((c) => c.peso === v.elegida.peso);
      pasos.push(crearPaso(TIPOS_PASO.CALCULO, {
        metodo: METODOS.PRIM, T: nombres(T), dentro, desde: v.dentro.slice(), nuevo: v.nuevo,
        candidatas: nombres(v.candidatas), actual: v.elegida.nombre,
        descartadas: nombres(internas(dentro, T)), tabla: tabla(i + 1),
        calculo: v.candidatas.map((c) => ({
          etiqueta: etiqueta(c), expresion: `peso ${c.peso}`, resultado: c === v.elegida ? 'entra' : '', activa: c === v.elegida
        })),
        tituloCalculo: `Salen de ${llaves(v.dentro)}`,
        mensaje: `Desde ${llaves(v.dentro)} ${v.candidatas.length === 1 ? 'sale solo' : 'salen'} ${lista(v.candidatas.map(conPeso))}. `
          + (otras.length ? `La más liviana es ${etiqueta(v.elegida)}, peso ${v.elegida.peso}${empate.length ? ` (empata con ${lista(empate.map(etiqueta))}; va la escrita antes)` : ''}. ` : '')
          + `Entra, y con ella el vértice ${v.nuevo}: ${T.length} de ${n - 1} aristas.`
      }));
    });
    const dentro = grafo.vertices.slice();
    return pasos.concat(conclusion(grafo, arbol, {
      metodo: METODOS.PRIM, dentro, descartadas: nombres(internas(dentro, arbol)), tabla: tabla(vueltas.length), antes: ''
    }));
  }

  // Al terminar: el árbol, su peso como suma, y si es el único.
  function conclusion(grafo, arbol, { antes, ...comun }) {
    const total = expansion.peso(arbol);
    const dado = comun.metodo === METODOS.DADO;
    const minimo = expansion.peso(expansion.kruskal(grafo).arbol);
    const otro = expansion.otroDelMismoPeso(grafo, arbol);
    const suma = arbol.length > 1 ? `${arbol.map((a) => a.peso).join(' + ')} = ${total}` : String(total);
    const propiedades = [
      {
        nombre: 'Árbol de expansión', valor: true,
        detalle: `toca los ${grafo.vertices.length} vértices con n − 1 = ${arbol.length} aristas, sin ciclos`
      },
      ...(dado ? [{
        nombre: 'Mínimo', valor: total === minimo,
        detalle: total === minimo ? `ningún árbol de expansión pesa menos de ${minimo}` : `pesa ${total}, y el mínimo pesa ${minimo}`
      }] : []),
      {
        nombre: 'Único', valor: dado && total !== minimo ? null : !otro,
        detalle: dado && total !== minimo ? 'no es mínimo'
          : otro
            ? `cambiando ${etiqueta(otro.sale)} por ${etiqueta(otro.entra)}, las dos de peso ${otro.entra.peso}, sale otro del mismo peso`
            : 'toda arista de fuera pesa más que las del camino que reemplazaría'
      }
    ];
    const delArbol = { ...comun, T: nombres(arbol), total, suma, propiedades };
    const paso = crearPaso(TIPOS_PASO.CALCULO, {
      ...delArbol, fase: 'arbol',
      calculo: [
        { etiqueta: 'Aristas', expresion: arbol.map(etiqueta).join(', '), resultado: String(arbol.length), activa: false },
        { etiqueta: 'Peso', expresion: suma, resultado: String(total), activa: true }
      ],
      tituloCalculo: dado ? 'Árbol de expansión' : 'Árbol de expansión mínimo',
      mensaje: dado
        ? `Peso del árbol: ${suma}. ${total === minimo ? 'Es mínimo' : `No es mínimo: el mínimo pesa ${minimo}`}${total === minimo && otro ? ', y no es el único' : ''}.`
        : `${antes}Árbol de expansión mínimo: ${llaves(arbol.map(etiqueta))}, peso ${suma}.`
          + (otro ? ` No es el único: con ${etiqueta(otro.entra)} en lugar de ${etiqueta(otro.sale)} pesa lo mismo.` : '')
    });
    return [paso, ...pasosDeRamasYCuerdas(grafo, arbol, delArbol)];
  }

  // Como en el documento de apoyo: «se identifican las ramas y el rango»;
  // «se encuentra el complemento», G′ = (S′, A′); «se identifican las
  // cuerdas y la nulidad».
  function pasosDeRamasYCuerdas(grafo, arbol, delArbol) {
    const { ramas, cuerdas, rango, nulidad, n, m } = expansion.ramasYCuerdas(grafo, arbol);
    const conRamas = { ...delArbol, ramas: nombres(ramas), rango };
    return [
      crearPaso(TIPOS_PASO.CALCULO, {
        ...conRamas, fase: 'ramas',
        calculo: [
          { etiqueta: 'Ramas', expresion: llaves(nombres(ramas)), resultado: '', activa: false },
          { etiqueta: 'Rango', expresion: `n − 1 = ${n} − 1`, resultado: String(rango), activa: true }
        ],
        tituloCalculo: 'Ramas y rango',
        mensaje: `Ramas: las aristas del árbol, ${llaves(nombres(ramas))}. Rango = n − 1 = ${n} − 1 = ${rango}, el número de ramas.`
      }),
      crearPaso(TIPOS_PASO.CONSTRUIDO, {
        ...conRamas, fase: 'cuerdas', cuerdas: nombres(cuerdas), nulidad, m, n,
        calculo: [
          { etiqueta: 'Ramas', expresion: llaves(nombres(ramas)), resultado: String(rango), activa: false },
          { etiqueta: 'Cuerdas', expresion: llaves(nombres(cuerdas)), resultado: '', activa: false },
          { etiqueta: 'Nulidad', expresion: `m − n + 1 = ${m} − ${n} + 1`, resultado: String(nulidad), activa: true }
        ],
        tituloCalculo: 'Cuerdas y nulidad',
        mensaje: cuerdas.length
          ? `Complemento del árbol: G′ = (S′, A′), con S′ = ${llaves(grafo.vertices)} y A′ = ${llaves(nombres(cuerdas))}. Sus aristas son las cuerdas. Nulidad = m − n + 1 = ${m} − ${n} + 1 = ${nulidad}, el número de cuerdas.`
          : `El grafo ya es un árbol: no le quedan aristas fuera, así que no tiene cuerdas. Nulidad = m − n + 1 = ${m} − ${n} + 1 = 0.`
      })
    ];
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.expansion = { recorrer };
})();
