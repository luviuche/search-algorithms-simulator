(function () {
  const { lineaDireccionDesdeCero, cifrasDeRango, enmarcar } = window.CC2.algoritmos.hash.comun;

  const BASE_POR_DEFECTO = 11;
  const BASE_MINIMA = 2;
  // Tope de conveniencia, no técnico: con bases mayores el desarrollo crece
  // hasta dejar de ser una cuenta que el estudiante pueda comprobar a mano.
  const BASE_MAXIMA = 36;

  // Conversión de bases (CLAUDE.md 5.3), con la fórmula del docente: **las
  // cifras decimales de la clave se leen como si fueran cifras en base b**, se
  // evalúa el polinomio que forman, y del resultado se toman las últimas
  // cifras, las que caben en el rango.
  //
  //   clave 1836, b = 6:  1×6³ + 8×6² + 3×6¹ + 6×6⁰ = 528
  //   n = 100 → dos cifras → 28 → dirección 29
  //
  // No es una conversión de base en sentido estricto, y por eso las cifras de
  // la clave pueden valer más que la base: el 8 y el 6 del ejemplo no existen
  // en base 6. La operación **mezcla** la clave, no la representa, y eso es lo
  // que se le pide a una función hash.
  //
  // Antes esto convertía de verdad (`clave.toString(base)`) y truncaba la
  // representación, leyendo las cifras en esa base. Da otra dirección —1836 en
  // base 6 es 12300, y truncado daba la casilla 8, no la 29— y no es lo que se
  // enseña en clase (corregido el 2026-08-29).
  function validarBase(entrada) {
    const base = Number(entrada);
    if (!Number.isInteger(base) || base < BASE_MINIMA || base > BASE_MAXIMA) {
      return {
        valido: false,
        mensaje: `Base inválida: se espera un entero entre ${BASE_MINIMA} y ${BASE_MAXIMA}.`
      };
    }
    return {
      valido: true,
      valor: base,
      advertencia: base === 10
        ? 'En base 10 el desarrollo devuelve la clave misma: el tema no transforma nada.'
        : null
    };
  }

  const SUPERINDICES = '⁰¹²³⁴⁵⁶⁷⁸⁹';

  function superindice(exponente) {
    return String(exponente).split('').map((cifra) => SUPERINDICES[Number(cifra)]).join('');
  }

  function direccionBases(clave, n, parametros) {
    const base = (parametros && parametros.base) || BASE_POR_DEFECTO;
    const cifrasClave = String(clave).split('').map(Number);
    const mayorExponente = cifrasClave.length - 1;

    // BigInt y no aritmética normal, como en la función cuadrado: en base 36
    // una clave de 11 cifras ya supera el entero seguro de JavaScript, y desde
    // las 14 el total se escribía como `1.57e+21` —y las «últimas cifras»
    // salían del exponente—. Se acumula por Horner: cada cifra multiplica lo
    // anterior por la base, que es el mismo polinomio del desarrollo.
    let valor = BigInt(0);
    for (const cifra of cifrasClave) {
      valor = valor * BigInt(base) + BigInt(cifra);
    }

    // El desarrollo entero y no solo el total: es el contenido didáctico del
    // tema, igual que el cuadrado completo en la función cuadrado.
    const desarrollo = cifrasClave
      .map((cifra, i) => `${cifra}×${base}${superindice(mayorExponente - i)}`)
      .join(' + ');

    // El truncamiento es sobre el total **en decimal**: son cifras decimales,
    // no cifras de la base. Y son las del rango —dos con n = 100, porque las
    // direcciones se leen de 00 a 99— igual que en las otras funciones.
    //
    // De ahí el `+ 1` del cierre: esas dos cifras son cien valores que cuentan
    // desde cero, y sumar uno es la única forma de llevarlos a 1..n sin caso
    // especial. Sin el `+ 1` el total terminado en `00` no tendría dirección
    // propia y caía en la casilla n por el ajuste del módulo, una excepción que
    // aparece en una clave de cada cien.
    const texto = String(valor);
    const cifras = cifrasDeRango(n);
    const desde = Math.max(0, texto.length - cifras);
    const ultimas = texto.slice(desde);
    const truncado = Number(ultimas);

    return {
      direccion: Number(lineaDireccionDesdeCero(truncado, n).resultado),
      calculo: [
        { etiqueta: 'Clave', expresion: '', resultado: String(clave) },
        {
          etiqueta: `Cifras en base ${base}`,
          expresion: desarrollo,
          resultado: texto
        },
        {
          etiqueta: ultimas.length === 1 ? 'Última cifra' : `Últimas ${ultimas.length} cifras`,
          expresion: enmarcar(texto, desde, ultimas.length),
          resultado: ultimas
        },
        lineaDireccionDesdeCero(truncado, n)
      ]
    };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.algoritmos = window.CC2.algoritmos || {};
  window.CC2.algoritmos.hash = window.CC2.algoritmos.hash || {};
  window.CC2.algoritmos.hash.bases = {
    BASE_POR_DEFECTO,
    BASE_MINIMA,
    BASE_MAXIMA,
    direccionBases,
    validarBase
  };
})();
