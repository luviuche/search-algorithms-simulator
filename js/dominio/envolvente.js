(function () {
  // Envolvente convexa de un conjunto de puntos del plano (CLAUDE.md 5.21),
  // con el material del docente (`ENVOLVENTES 03-11-26.pdf`):
  //
  //   envolvente convexa  el menor convexo que contiene los puntos
  //   extremo o vértice   hay una recta por él con todos los demás al mismo
  //                       lado; los otros son internos
  //   cierre convexo      el perímetro que conecta los extremos
  //   diámetro            la mayor distancia entre dos puntos
  //   anchura             la menor distancia entre dos rectas paralelas que
  //                       encierran todos los puntos
  //
  // Divide y vencerás y QuickHull los resuelve él a mano; Graham y Jarvis
  // vienen en pseudocódigo. El incremental no está construido.
  const { ordenNatural } = window.CC2.dominio.operaciones;

  const MODO = 'envolvente';
  const METODOS = Object.freeze({ DIVIDE: 'divide', QUICKHULL: 'quickhull', GRAHAM: 'graham', JARVIS: 'jarvis' });
  const PUNTOS_MAXIMOS = 16;
  const COORDENADA_MAXIMA = 99;
  const NOMBRE = /^([a-zA-Z][0-9]{0,2}|[0-9]{1,2})$/;
  const NUMERO = /^-?\d+(\.\d{1,2})?$/;
  const CASI = 1e-9;

  // Un punto por renglón: «A 3 7», su nombre y sus coordenadas. Sin nombre
  // —«3 7»— lo pone el orden: A, B, C…
  function leerPuntos(texto) {
    const renglones = String(texto || '').split(/\r?\n|;/).map((r) => r.trim()).filter(Boolean);
    const error = (mensaje) => ({ valido: false, mensaje });
    const puntos = [];
    const nombres = new Map();
    const lugares = new Map();
    for (const [indice, renglon] of renglones.entries()) {
      const donde = `Renglón ${indice + 1} («${renglon}»)`;
      const partes = renglon.replace(/−/g, '-').split(/[\s,()]+/).filter(Boolean);
      // «A 3» es un punto con nombre al que le falta una coordenada.
      const incompleto = partes.length === 2 && !NUMERO.test(partes[0]) && NOMBRE.test(partes[0]);
      if (partes.length < 2 || partes.length > 3 || incompleto) return error(`${donde}: un punto lleva su nombre y sus dos coordenadas, por ejemplo «A 3 7».`);
      const nombre = partes.length === 3 ? partes.shift() : null;
      if (nombre !== null && !NOMBRE.test(nombre)) return error(`${donde}: el nombre de un punto es una letra o un número (A, p1, 12).`);
      if (!partes.every((p) => NUMERO.test(p) && Math.abs(Number(p)) <= COORDENADA_MAXIMA)) {
        return error(`${donde}: cada coordenada es un número de −${COORDENADA_MAXIMA} a ${COORDENADA_MAXIMA}, con hasta dos decimales y punto decimal.`);
      }
      const [x, y] = partes.map(Number);
      if (nombre !== null) {
        if (nombres.has(nombre)) return error(`${donde}: ya hay un punto ${nombre}, en el renglón ${nombres.get(nombre) + 1}.`);
        nombres.set(nombre, indice);
      }
      if (lugares.has(`${x}|${y}`)) return error(`${donde}: ya hay un punto en (${x}, ${y}), en el renglón ${lugares.get(`${x}|${y}`) + 1}.`);
      lugares.set(`${x}|${y}`, indice);
      puntos.push({ nombre, escrito: nombre !== null, x, y });
    }
    let siguiente = 0;
    for (const p of puntos) {
      if (p.nombre !== null) continue;
      while (nombres.has(String.fromCharCode(65 + siguiente))) siguiente++;
      p.nombre = String.fromCharCode(65 + siguiente++);
    }
    if (puntos.length < 3) return error('Escriba al menos tres puntos, por ejemplo «A 3 7».');
    if (puntos.length > PUNTOS_MAXIMOS) return error(`Hay ${puntos.length} puntos; caben hasta ${PUNTOS_MAXIMOS}.`);
    if (puntos.every((p) => Math.abs(giro(puntos[0], puntos[1], p)) < CASI)) {
      return error('Los puntos están todos en una misma recta: su envolvente es un segmento, sin área.');
    }
    return { valido: true, puntos };
  }

  const comoTexto = (puntos) => puntos.map((p) => `${p.escrito ? `${p.nombre} ` : ''}${p.x} ${p.y}`).join('\n');

  // El área con signo del triángulo, dos veces: positiva si al ir de a a b se
  // gira a la izquierda hacia c, negativa a la derecha, 0 si están en línea.
  function giro(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }
  const aLaIzquierda = (a, b, c) => giro(a, b, c) > CASI;
  const aLaDerecha = (a, b, c) => giro(a, b, c) < -CASI;
  const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const aLaRecta = (a, b, p) => Math.abs(giro(a, b, p)) / distancia(a, b);
  const porX = (a, b) => a.x - b.x || a.y - b.y;

  // Los extremos de un conjunto, en sentido antihorario desde el más a la
  // izquierda. Es la referencia: las mitades de divide y vencerás, la unión y
  // las pruebas. Con uno o dos puntos, o en línea, los que haya en las puntas.
  function extremos(puntos) {
    const orden = puntos.slice().sort(porX);
    if (orden.length < 3) return orden;
    const cadena = (lista) => {
      const pila = [];
      for (const p of lista) {
        while (pila.length >= 2 && !aLaIzquierda(pila[pila.length - 2], pila[pila.length - 1], p)) pila.pop();
        pila.push(p);
      }
      return pila.slice(0, -1);
    };
    return cadena(orden).concat(cadena(orden.slice().reverse()));
  }

  // ¿Está sobre un lado de la envolvente, sin ser extremo?
  function enElBorde(p, envolvente) {
    return envolvente.some((a, i) => {
      const b = envolvente[(i + 1) % envolvente.length];
      if (p === a || p === b || Math.abs(giro(a, b, p)) > CASI) return false;
      const t = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
      return t > 0 && t < distancia(a, b) ** 2;
    });
  }

  // Lo que el docente define sobre la envolvente terminada.
  function medidas(puntos, envolvente) {
    const n = envolvente.length;
    const lado = (i) => [envolvente[i], envolvente[(i + 1) % n]];
    let perimetro = 0;
    let doble = 0;
    let anchura = { valor: Infinity };
    for (let i = 0; i < n; i++) {
      const [a, b] = lado(i);
      perimetro += distancia(a, b);
      doble += a.x * b.y - a.y * b.x;
      const lejano = envolvente.reduce((m, p) => (aLaRecta(a, b, p) > aLaRecta(a, b, m) + CASI ? p : m));
      const valor = aLaRecta(a, b, lejano);
      if (valor < anchura.valor - CASI) anchura = { valor, lado: [a, b], punto: lejano };
    }
    let diametro = { valor: -1 };
    envolvente.forEach((a, i) => envolvente.slice(i + 1).forEach((b) => {
      if (distancia(a, b) > diametro.valor + CASI) diametro = { valor: distancia(a, b), par: [a, b] };
    }));
    const resto = puntos.filter((p) => !envolvente.includes(p));
    return {
      perimetro, area: doble / 2, diametro, anchura,
      internos: resto.filter((p) => !enElBorde(p, envolvente)),
      borde: resto.filter((p) => enElBorde(p, envolvente))
    };
  }

  // Divide y vencerás: dónde partir. Lo más cerca de la mitad que deje una
  // recta vertical entre los dos grupos, sin puntos sobre ella.
  function partir(puntos) {
    const orden = puntos.slice().sort(porX);
    const mitad = Math.floor(orden.length / 2);
    const cortes = orden.map((_, i) => i).filter((i) => i > 0 && orden[i - 1].x < orden[i].x);
    const corte = cortes.reduce((m, i) => (Math.abs(i - mitad) < Math.abs(m - mitad) ? i : m));
    return { izquierda: orden.slice(0, corte), derecha: orden.slice(corte), x: (orden[corte - 1].x + orden[corte].x) / 2 };
  }

  // QuickHull: los extremos en y, −x, −y y x, en sentido antihorario y sin
  // repetir. Entre dos igual de altos, el del lado que deja un extremo.
  function cardinales(puntos) {
    const mejor = (antes) => puntos.reduce((m, p) => (antes(p, m) < 0 ? p : m));
    return {
      x: mejor((p, m) => m.x - p.x || m.y - p.y),
      y: mejor((p, m) => m.y - p.y || p.x - m.x),
      menosX: mejor((p, m) => p.x - m.x || p.y - m.y),
      menosY: mejor((p, m) => p.y - m.y || m.x - p.x)
    };
  }

  // El más lejano a la recta a–b, por fuera. Entre varios a la misma
  // distancia, el que queda más hacia a, que es el que es extremo.
  function masLejano(a, b, candidatos) {
    const avance = (p) => (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
    return candidatos.reduce((m, p) => {
      const d = aLaRecta(a, b, p) - aLaRecta(a, b, m);
      return d > CASI || (Math.abs(d) <= CASI && avance(p) < avance(m)) ? p : m;
    });
  }

  // Graham: el de menor ordenada (y más a la izquierda), y los demás por el
  // ángulo con él; en la misma dirección, el más cercano antes.
  function masAbajo(puntos) {
    return puntos.reduce((m, p) => (p.y < m.y || (p.y === m.y && p.x < m.x) ? p : m));
  }
  function porAngulo(puntos, base) {
    return puntos.filter((p) => p !== base).sort((p, q) => {
      const g = giro(base, p, q);
      return Math.abs(g) > CASI ? -g : distancia(base, p) - distancia(base, q);
    });
  }

  // Jarvis: el siguiente de `actual`, con todos los demás a su izquierda; en
  // la misma dirección, el más lejano.
  function siguienteDeJarvis(puntos, actual) {
    return puntos.filter((p) => p !== actual).reduce((m, p) => {
      const g = giro(actual, m, p);
      return g < -CASI || (Math.abs(g) <= CASI && distancia(actual, p) > distancia(actual, m)) ? p : m;
    });
  }

  const enOrden = (puntos) => puntos.slice().sort((p, q) => ordenNatural(p.nombre, q.nombre));

  window.CC2.dominio.envolvente = {
    MODO, METODOS, PUNTOS_MAXIMOS, leerPuntos, comoTexto, giro, aLaIzquierda, aLaDerecha, distancia, aLaRecta,
    extremos, medidas, partir, cardinales, masLejano, masAbajo, porAngulo, siguienteDeJarvis, enOrden
  };
})();
