(function () {
  const { TIPOS_PASO, crearPaso } = window.CC2.algoritmos.traza;
  const plano = window.CC2.dominio.envolvente;
  const { METODOS, giro, aLaIzquierda, aLaDerecha, aLaRecta, enOrden } = plano;

  // Envolventes convexas (CLAUDE.md 5.21): la traza de los cuatro métodos.
  // Cada paso lleva los puntos y lo que el dibujo pone:
  //
  //   estados    por nombre de punto, su color
  //   segmentos  [{ a, b, clase }], con los puntos de sus extremos
  //   vertical   la x de la recta que divide, en divide y vencerás
  //   conjuntos  los conjuntos escritos, como en las operaciones de grafos
  //
  // Naranja lo que se está mirando, verde lo que ya es de la envolvente, gris
  // lo descartado.

  const TITULOS = Object.freeze({
    [METODOS.DIVIDE]: 'Divide y vencerás',
    [METODOS.QUICKHULL]: 'QuickHull',
    [METODOS.GRAHAM]: 'Graham',
    [METODOS.JARVIS]: 'Jarvis'
  });

  const redondo = (n) => String(Math.round(n * 100) / 100);
  const nombres = (lista) => lista.map((p) => p.nombre);
  const conjunto = (lista) => (lista.length ? `{${nombres(lista).join(', ')}}` : '∅');
  const coordenadas = (p) => `(${p.x}, ${p.y})`;
  const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const enLista = (lista) => (lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`);

  // Los lados de un polígono; con dos puntos, el único que tiene.
  function lados(poligono, clase) {
    if (poligono.length < 2) return [];
    if (poligono.length === 2) return [{ a: poligono[0], b: poligono[1], clase }];
    return poligono.map((a, i) => ({ a, b: poligono[(i + 1) % poligono.length], clase }));
  }
  // Los tramos de una cadena abierta.
  const tramos = (cadena, clase) => cadena.slice(1).map((b, i) => ({ a: cadena[i], b, clase }));
  const pintar = (...pares) => Object.fromEntries(pares.flatMap(([lista, estado]) => lista.map((p) => [p.nombre, estado])));
  const fila = (etiqueta, lista, actuales = []) => ({ etiqueta, elementos: nombres(lista), actuales: nombres(actuales) });

  function recorrer(puntos, metodo) {
    const pasos = [];
    const base = { envolvente: true, metodo, puntos, tituloCalculo: TITULOS[metodo] };
    const anotar = (datos) => pasos.push(crearPaso(datos.tipo || TIPOS_PASO.CALCULO, {
      ...base, vertical: null, segmentos: [], estados: {}, ...datos, tipo: datos.tipo || TIPOS_PASO.CALCULO
    }));
    const metodos = { [METODOS.DIVIDE]: divide, [METODOS.QUICKHULL]: quickhull, [METODOS.GRAHAM]: graham, [METODOS.JARVIS]: jarvis };
    const hallada = metodos[metodo](puntos, anotar);

    // El cierre, igual en los cuatro: extremos, internos y las medidas. En
    // sentido antihorario desde el más a la izquierda, como él los lista.
    const m = plano.medidas(puntos, hallada);
    anotar({
      tipo: TIPOS_PASO.CONSTRUIDO,
      estados: pintar([puntos, 'descartada'], [m.borde, 'rango'], [hallada, 'encontrada']),
      segmentos: lados(hallada, 'encontrada'),
      extremos: hallada.length,
      descartados: puntos.length - hallada.length,
      conjuntos: [fila('Extremos', hallada), fila('Internos', enOrden(m.internos))]
        .concat(m.borde.length ? [fila('En el borde', enOrden(m.borde))] : []),
      medidas: [
        ['Cierre convexo (perímetro)', redondo(m.perimetro)],
        ['Área', redondo(m.area)],
        ['Diámetro', `d(${m.diametro.par[0].nombre}, ${m.diametro.par[1].nombre}) = ${redondo(m.diametro.valor)}`],
        ['Anchura', `${redondo(m.anchura.valor)}, del lado ${m.anchura.lado[0].nombre}–${m.anchura.lado[1].nombre} a ${m.anchura.punto.nombre}`]
      ],
      perimetro: redondo(m.perimetro),
      calculo: [{ etiqueta: 'Extremos', expresion: conjunto(hallada), resultado: String(hallada.length), activa: true }],
      mensaje: `Envolvente convexa: ${cuantos(hallada.length, 'extremo', 'extremos')}, ${conjunto(hallada)}${
        m.internos.length ? `; ${cuantos(m.internos.length, 'interno', 'internos')}, ${conjunto(enOrden(m.internos))}` : '; ningún interno'}.${
        m.borde.length ? ` ${enLista(nombres(m.borde))} ${m.borde.length === 1 ? 'está' : 'están'} en un lado, pero no ${m.borde.length === 1 ? 'es extremo' : 'son extremos'}.` : ''}`
    });
    return pasos;
  }

  // ── Divide y vencerás (pág. 6): dividir, los extremos de cada mitad, unir ──

  function divide(puntos, anotar) {
    const { izquierda, derecha, x } = plano.partir(puntos);
    const h1 = plano.extremos(izquierda);
    const h2 = plano.extremos(derecha);
    const todos = plano.extremos(puntos);
    const s = (extra = []) => [fila('S₁', enOrden(izquierda)), fila('S₂', enOrden(derecha)), ...extra];
    const contar = (lista) => ({ extremos: lista.length, descartados: 0 });

    anotar({
      vertical: x,
      estados: pintar([izquierda, 'rango'], [derecha, 'evaluacion']),
      conjuntos: s(),
      ...contar([]),
      calculo: [
        { etiqueta: 'S₁', expresion: 'a la izquierda', resultado: cuantos(izquierda.length, 'punto', 'puntos'), activa: false },
        { etiqueta: 'S₂', expresion: 'a la derecha', resultado: cuantos(derecha.length, 'punto', 'puntos'), activa: false }
      ],
      mensaje: `Se divide el conjunto con la recta x = ${redondo(x)}: S₁ = ${conjunto(enOrden(izquierda))} y S₂ = ${conjunto(enOrden(derecha))}.`
    });
    const fuera = (lista, h) => lista.filter((p) => !h.includes(p));
    const mitad = (nombre, lista, h, extra) => anotar({
      vertical: x,
      estados: pintar([fuera(lista, h), 'descartada'], [h, 'evaluacion'], ...extra.estados),
      segmentos: extra.segmentos.concat(lados(h, 'evaluacion')),
      conjuntos: s(extra.conjuntos.concat(fila(`Ext ${nombre}`, h, h))),
      extremos: extra.cuantos + h.length,
      descartados: extra.fuera + fuera(lista, h).length,
      calculo: [{ etiqueta: `Ext ${nombre}`, expresion: conjunto(h), resultado: String(h.length), activa: true }],
      mensaje: h.length === lista.length
        ? `Extremos de ${nombre}: ${conjunto(h)}, todos sus puntos.`
        : `Extremos de ${nombre}: ${conjunto(h)}; ${enLista(nombres(enOrden(fuera(lista, h))))} ${fuera(lista, h).length === 1 ? 'queda dentro' : 'quedan dentro'}.`
    });
    mitad('S₁', izquierda, h1, { estados: [], segmentos: [], conjuntos: [], cuantos: 0, fuera: 0 });
    mitad('S₂', derecha, h2, {
      estados: [[fuera(izquierda, h1), 'descartada'], [h1, 'rango']], segmentos: lados(h1, 'rango'),
      conjuntos: [fila('Ext S₁', h1)], cuantos: h1.length, fuera: fuera(izquierda, h1).length
    });

    // Las dos tangentes: los únicos lados de la envolvente con un extremo en
    // cada mitad. En sentido antihorario, la de abajo va de S₁ a S₂.
    const cruza = lados(todos, 'evaluacion').filter(({ a, b }) => izquierda.includes(a) !== izquierda.includes(b));
    const abajo = cruza.find(({ a }) => izquierda.includes(a));
    const arriba = cruza.find(({ a }) => derecha.includes(a));
    const uneComun = {
      vertical: x,
      conjuntos: s([fila('Ext S₁', h1), fila('Ext S₂', h2)]),
      extremos: h1.length + h2.length,
      descartados: puntos.length - h1.length - h2.length
    };
    const fondo = [[puntos, 'descartada'], [h1, 'rango'], [h2, 'rango']];
    const contornos = lados(h1, 'rango').concat(lados(h2, 'rango'));
    const unir = (donde, recta, previas) => anotar({
      ...uneComun,
      estados: pintar(...fondo, [[recta.a, recta.b], 'evaluacion']),
      segmentos: contornos.concat(previas.map((p) => ({ ...p, clase: 'encontrada' })), recta),
      calculo: [{ etiqueta: donde, expresion: `${recta.a.nombre}–${recta.b.nombre}`, resultado: 'todos al mismo lado', activa: true }],
      mensaje: `Se unen por ${donde} con ${recta.a.nombre}–${recta.b.nombre}: todos los puntos quedan al mismo lado de esa recta.`
    });
    unir('arriba', arriba, []);
    unir('abajo', abajo, [arriba]);
    const sueltos = h1.concat(h2).filter((p) => !todos.includes(p));
    anotar({
      vertical: x,
      estados: pintar([puntos, 'descartada'], [todos, 'encontrada'], [sueltos, 'evaluacion']),
      segmentos: lados(todos, 'encontrada'),
      conjuntos: s([fila('Ext S₁', h1, sueltos), fila('Ext S₂', h2, sueltos), fila('Extremos', todos)]),
      extremos: todos.length,
      descartados: puntos.length - todos.length,
      calculo: [{ etiqueta: 'Salen', expresion: conjunto(sueltos), resultado: String(sueltos.length), activa: true }],
      mensaje: sueltos.length
        ? `Al unir, ${enLista(nombres(sueltos))} ${sueltos.length === 1 ? 'deja de ser extremo: queda' : 'dejan de ser extremos: quedan'} dentro.`
        : 'Al unir, todos los extremos de las mitades siguen siéndolo.'
    });
    return todos;
  }

  // ── QuickHull (pág. 7): el cuadrilátero y, por fuera, el más lejano ─────────

  function quickhull(puntos, anotar) {
    const c = plano.cardinales(puntos);
    let poligono = [c.x, c.y, c.menosX, c.menosY].filter((p, i, lista) => lista.indexOf(p) === i);
    const iniciales = poligono.slice();
    const FORMAS = { 2: 'un segmento', 3: 'un triángulo', 4: 'un cuadrilátero' };
    anotar({
      estados: pintar([iniciales, 'evaluacion']),
      conjuntos: [fila('Extremos', iniciales, iniciales)],
      extremos: iniciales.length,
      descartados: 0,
      calculo: [['y', c.y], ['x', c.x], ['−y', c.menosY], ['−x', c.menosX]]
        .map(([eje, p]) => ({ etiqueta: `En ${eje}`, expresion: coordenadas(p), resultado: p.nombre, activa: false })),
      mensaje: `Puntos extremos: en y, ${c.y.nombre}; en x, ${c.x.nombre}; en −y, ${c.menosY.nombre}; en −x, ${c.menosX.nombre}.`
    });

    // Lo que queda por fuera de cada lado del polígono (antihorario: a la
    // derecha). Lo que no queda por fuera de ninguno se descarta.
    const deLado = (a, b, lista) => lista.filter((p) => aLaDerecha(a, b, p));
    const ladosDe = (p) => (p.length === 2 ? [[p[0], p[1]], [p[1], p[0]]] : p.map((a, i) => [a, p[(i + 1) % p.length]]));
    let libres = puntos.filter((p) => !poligono.includes(p));
    let regiones = ladosDe(poligono).map(([a, b]) => ({ a, b, puntos: deLado(a, b, libres) }));
    const descartados = libres.filter((p) => !regiones.some((r) => r.puntos.includes(p)));
    libres = libres.filter((p) => !descartados.includes(p));
    const comun = (actuales = []) => ({
      conjuntos: [fila('Extremos', poligono, actuales), fila('Descartados', enOrden(descartados), actuales), fila('Por fuera', enOrden(libres), actuales)],
      extremos: poligono.length,
      descartados: descartados.length
    });
    anotar({
      ...comun(descartados),
      estados: pintar([descartados, 'descartada'], [poligono, 'encontrada'], [libres, 'rango']),
      segmentos: lados(poligono, 'encontrada'),
      calculo: regiones.map((r) => ({ etiqueta: `${r.a.nombre}–${r.b.nombre}`, expresion: 'por fuera', resultado: conjunto(enOrden(r.puntos)), activa: r.puntos.length > 0 })),
      mensaje: `${conjunto(poligono)} forman ${FORMAS[poligono.length]}. ${descartados.length
        ? `${enLista(nombres(enOrden(descartados)))} ${descartados.length === 1 ? 'no queda' : 'no quedan'} por fuera y se ${descartados.length === 1 ? 'descarta' : 'descartan'}.`
        : 'Ningún punto queda dentro.'}${libres.length ? '' : ' Por fuera no queda ninguno.'}`
    });

    // Por rondas: primero las regiones del cuadrilátero, después las que salen
    // de ellas.
    const pendientes = regiones.filter((r) => r.puntos.length);
    while (pendientes.length) {
      const { a, b, puntos: region } = pendientes.shift();
      const lejano = plano.masLejano(a, b, region);
      poligono = poligono.slice();
      poligono.splice(poligono.indexOf(a) + 1, 0, lejano);
      const resto = region.filter((p) => p !== lejano);
      const uno = deLado(a, lejano, resto);
      const otro = deLado(lejano, b, resto);
      const dentro = resto.filter((p) => !uno.includes(p) && !otro.includes(p));
      descartados.push(...dentro);
      libres = libres.filter((p) => p !== lejano && !dentro.includes(p));
      if (uno.length) pendientes.push({ a, b: lejano, puntos: uno });
      if (otro.length) pendientes.push({ a: lejano, b, puntos: otro });
      anotar({
        tipo: TIPOS_PASO.COMPARACION,
        ...comun([lejano, ...dentro]),
        estados: pintar([descartados, 'descartada'], [libres, 'rango'], [poligono, 'encontrada'], [[lejano], 'evaluacion']),
        segmentos: lados(poligono, 'encontrada').map((l) => (l.a === lejano || l.b === lejano ? { ...l, clase: 'evaluacion' } : l))
          .concat({ a, b, clase: 'descartada' }),
        calculo: region.map((p) => ({ etiqueta: p.nombre, expresion: `distancia a ${a.nombre}–${b.nombre}`, resultado: redondo(aLaRecta(a, b, p)), activa: p === lejano })),
        mensaje: `${region.length === 1 ? `Por fuera de ${a.nombre}–${b.nombre} solo está ${lejano.nombre}`
          : `Por fuera de ${a.nombre}–${b.nombre}, el más lejano es ${lejano.nombre}, a ${redondo(aLaRecta(a, b, lejano))}`}: es extremo.${
          dentro.length ? ` ${enLista(nombres(enOrden(dentro)))} ${dentro.length === 1 ? 'queda dentro y se descarta' : 'quedan dentro y se descartan'}.` : ''}`
      });
    }
    return desdeLaIzquierda(poligono);
  }

  // ── Graham (pág. 10 y 11): orden angular y una pila ───────────────────────

  function graham(puntos, anotar) {
    const inicio = plano.masAbajo(puntos);
    const orden = plano.porAngulo(puntos, inicio);
    anotar({
      estados: pintar([[inicio], 'evaluacion']),
      conjuntos: [fila('Pila', [])],
      extremos: 0,
      descartados: 0,
      calculo: [{ etiqueta: 'min', expresion: coordenadas(inicio), resultado: inicio.nombre, activa: true }],
      mensaje: `El punto de menor ordenada es ${inicio.nombre} ${coordenadas(inicio)}: es extremo, y alrededor de él se ordenan los demás.`
    });
    const filas = (pila, fuera, actuales = []) => [
      fila('Orden', [inicio, ...orden]), fila('Pila', pila, actuales), fila('Descartados', enOrden(fuera))
    ];
    const pila = [inicio];
    const fuera = [];
    anotar({
      estados: pintar([orden, 'rango'], [[inicio], 'evaluacion']),
      segmentos: orden.map((p) => ({ a: inicio, b: p, clase: 'descartada' })),
      conjuntos: filas(pila, fuera),
      extremos: 1,
      descartados: 0,
      calculo: [{ etiqueta: 'Orden', expresion: nombres([inicio, ...orden]).join(', '), resultado: '', activa: true }],
      mensaje: `Orden angular alrededor de ${inicio.nombre}, en sentido antihorario: ${nombres(orden).join(', ')}.`
    });
    for (const p of orden) {
      for (;;) {
        const tope = pila[pila.length - 1];
        const anterior = pila[pila.length - 2];
        const gira = anterior ? giro(anterior, tope, p) : null;
        const entra = !anterior || aLaIzquierda(anterior, tope, p);
        if (entra) pila.push(p);
        else {
          pila.pop();
          fuera.push(tope);
        }
        anotar({
          tipo: anterior ? TIPOS_PASO.COMPARACION : TIPOS_PASO.CALCULO,
          estados: pintar([fuera, 'descartada'], [pila, 'encontrada'], [[p], 'evaluacion']),
          segmentos: tramos(entra ? pila.slice(0, -1) : pila, 'encontrada')
            .concat(entra ? [{ a: tope, b: p, clase: 'evaluacion' }]
              : [{ a: anterior, b: tope, clase: 'descartada' }, { a: tope, b: p, clase: 'descartada' }]),
          conjuntos: filas(pila, fuera, entra ? [p] : []),
          extremos: pila.length,
          descartados: fuera.length,
          calculo: anterior
            ? [{ etiqueta: `${anterior.nombre}, ${tope.nombre}, ${p.nombre}`, expresion: `área con signo ${redondo(gira / 2)}`, resultado: entra ? 'izquierda' : Math.abs(gira) < 1e-9 ? 'en línea' : 'derecha', activa: true }]
            : [{ etiqueta: p.nombre, expresion: 'el primero', resultado: 'a la pila', activa: true }],
          mensaje: !anterior ? `${p.nombre}, el primero del orden, entra a la pila.`
            : entra ? `${anterior.nombre} → ${tope.nombre} → ${p.nombre} gira a la izquierda: ${p.nombre} entra a la pila.`
              : `${anterior.nombre} → ${tope.nombre} → ${p.nombre} ${Math.abs(gira) < 1e-9 ? 'va en línea' : 'gira a la derecha'}: ${tope.nombre} no es extremo y sale de la pila.`
        });
        if (entra) break;
      }
    }
    return desdeLaIzquierda(pila);
  }

  // ── Jarvis (pág. 13): rodear la nube ───────────────────────────────────

  function jarvis(puntos, anotar) {
    const inicio = plano.masAbajo(puntos);
    const hallados = [inicio];
    anotar({
      estados: pintar([[inicio], 'evaluacion']),
      conjuntos: [fila('Extremos', hallados, hallados)],
      extremos: 1,
      descartados: 0,
      calculo: [{ etiqueta: 'p₀', expresion: coordenadas(inicio), resultado: inicio.nombre, activa: true }],
      mensaje: `Se empieza en el punto más abajo, ${inicio.nombre} ${coordenadas(inicio)}: es extremo.`
    });
    for (;;) {
      const actual = hallados[hallados.length - 1];
      const siguiente = plano.siguienteDeJarvis(puntos, actual);
      const cierra = siguiente === inicio;
      anotar({
        tipo: TIPOS_PASO.COMPARACION,
        estados: pintar([hallados, 'encontrada'], [[siguiente], 'evaluacion']),
        segmentos: puntos.filter((p) => p !== actual && p !== siguiente && !hallados.includes(p)).map((p) => ({ a: actual, b: p, clase: 'descartada' }))
          .concat(tramos(hallados, 'encontrada'), { a: actual, b: siguiente, clase: 'evaluacion' }),
        conjuntos: [fila('Extremos', cierra ? hallados : hallados.concat(siguiente), [siguiente])],
        extremos: hallados.length + (cierra ? 0 : 1),
        descartados: 0,
        calculo: [{ etiqueta: `${actual.nombre}–${siguiente.nombre}`, expresion: 'los demás, a la izquierda', resultado: cierra ? 'cierra' : siguiente.nombre, activa: true }],
        mensaje: cierra
          ? `Desde ${actual.nombre}, el siguiente es ${inicio.nombre}, donde se empezó: la envolvente se cierra.`
          : `Desde ${actual.nombre}, con todos los demás a la izquierda de la recta, el siguiente es ${siguiente.nombre}.`
      });
      if (cierra) break;
      hallados.push(siguiente);
    }
    return desdeLaIzquierda(hallados);
  }

  // El mismo polígono antihorario, empezando por el más a la izquierda.
  function desdeLaIzquierda(poligono) {
    const primero = poligono.reduce((m, p) => (p.x < m.x || (p.x === m.x && p.y < m.y) ? p : m));
    const i = poligono.indexOf(primero);
    return poligono.slice(i).concat(poligono.slice(0, i));
  }

  window.CC2.algoritmos.envolvente = { recorrer, TITULOS };
})();
