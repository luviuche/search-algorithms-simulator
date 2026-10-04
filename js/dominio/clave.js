(function () {
  const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const TILDES = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U' };

  function validarClaveNumerica(entrada, l) {
    const texto = String(entrada).trim();
    if (!/^[0-9]+$/.test(texto)) {
      return { valido: false, mensaje: 'Carácter no admitido: solo se aceptan dígitos.' };
    }
    if (texto.length !== l) {
      return { valido: false, mensaje: `Longitud de clave inválida: se esperan ${l} dígitos.` };
    }
    // Sin ceros a la izquierda (CLAUDE.md 3.3): rechazarlo aquí evita distinguir
    // "0521" de "521" más adelante, donde ya son el mismo número.
    if (texto[0] === '0') {
      return { valido: false, mensaje: 'Carácter no admitido: no se aceptan ceros a la izquierda.' };
    }
    // Con `l` acotada a 15 (`limites.L_MAXIMA`) no debería pasar, pero si una
    // clave no cabe en un entero seguro, convertirla la falsearía en silencio:
    // mejor rechazarla, como `validarClaveNumericaLibre`.
    const valor = Number(texto);
    if (!Number.isSafeInteger(valor)) {
      return { valido: false, mensaje: 'Clave demasiado grande.' };
    }
    return { valido: true, valor };
  }

  // Claves numéricas sin longitud fija (otras búsquedas dinámicas, CLAUDE.md
  // 5.7): ese tema no pide `l` —las claves del ejercicio mezclan libremente
  // dos y tres cifras—, así que valida solo lo que no depende de una longitud
  // exacta: dígitos y sin ceros a la izquierda (CLAUDE.md 3.3, salvo el "0"
  // solo, que no es un cero *a la izquierda* de nada).
  function validarClaveNumericaLibre(entrada) {
    const texto = String(entrada).trim();
    if (!/^[0-9]+$/.test(texto)) {
      return { valido: false, mensaje: 'Carácter no admitido: solo se aceptan dígitos.' };
    }
    if (texto.length > 1 && texto[0] === '0') {
      return { valido: false, mensaje: 'Carácter no admitido: no se aceptan ceros a la izquierda.' };
    }
    const valor = Number(texto);
    if (!Number.isSafeInteger(valor)) {
      return { valido: false, mensaje: 'Clave demasiado grande.' };
    }
    return { valido: true, valor };
  }

  function normalizarLetra(letra) {
    const mayus = letra.toUpperCase();
    return TILDES[mayus] || mayus;
  }

  function mapearLetraADigitos(letra) {
    const posicion = ALFABETO.indexOf(letra) + 1;
    return String(posicion).padStart(2, '0');
  }

  // Implementación diferida (CLAUDE.md 3.4): el tipo se mantiene en el modelo,
  // deshabilitado en la interfaz, hasta que se habiliten las claves alfabéticas.
  function validarClaveAlfabetica(entrada, l) {
    const texto = String(entrada).trim();
    if (texto.length !== l) {
      return { valido: false, mensaje: `Longitud de clave inválida: se esperan ${l} letras.` };
    }
    const letras = [];
    for (const caracter of texto) {
      const normal = normalizarLetra(caracter);
      if (!ALFABETO.includes(normal)) {
        return { valido: false, mensaje: 'Carácter no admitido en el alfabeto definido (A–Z).' };
      }
      letras.push(normal);
    }
    const palabra = letras.join('');
    const claveTransformada = Number(letras.map(mapearLetraADigitos).join(''));
    return { valido: true, palabra, claveTransformada };
  }

  // ── Letras como clave (CLAUDE.md 5.5) ───────────────────────────────────
  //
  // Los temas de búsqueda por bits —árboles digitales, residuos, residuos
  // múltiples— no trabajan con números sino con letras, y la letra viaja como
  // su byte. Pero lo que distingue una letra de otra son **las cinco últimas
  // cifras de ese byte**, que además son su posición en el alfabeto:
  //
  //   a = 97 = 011 00001 → 00001 = 1        p = 112 = 011 10000 → 10000 = 16
  //
  // Con el byte entero las tres primeras cifras (011) son iguales en todas las
  // letras y el árbol no se bifurca hasta el cuarto bit: las seis letras de
  // «prueba» quedan en una sola rama. Con cinco, el árbol se abre a lado y
  // lado, que es como lo dibuja el docente (decisión del usuario, 2026-08-29).
  //
  // Mayúscula y minúscula dan las mismas cinco cifras, así que da igual cómo
  // se digite; se guarda en minúscula, que es como está escrita la palabra del
  // ejercicio.
  const BITS_LETRA = 5;

  function posicionEnAlfabeto(letra) {
    return ALFABETO.indexOf(normalizarLetra(letra)) + 1;
  }

  function codigoDeLetra(letra, bits = BITS_LETRA) {
    return posicionEnAlfabeto(letra).toString(2).padStart(bits, '0');
  }

  function validarLetra(entrada) {
    const texto = String(entrada).trim();
    if (texto.length === 0) {
      return { valido: false, mensaje: 'Clave vacía: se espera una letra del alfabeto (A–Z).' };
    }
    if (texto.length !== 1) {
      return { valido: false, mensaje: 'Longitud de clave inválida: se espera una sola letra.' };
    }
    if (!ALFABETO.includes(normalizarLetra(texto))) {
      return { valido: false, mensaje: 'Carácter no admitido en el alfabeto definido (A–Z).' };
    }
    return { valido: true, valor: normalizarLetra(texto).toLowerCase() };
  }

  // Una palabra es la lista de letras que la componen, en su orden: es lo que
  // se inserta en estos temas —«prueba» son p, r, u, e, b y a— y por eso se
  // valida entera antes de tocar la estructura.
  function validarPalabra(entrada) {
    const texto = String(entrada).trim();
    if (texto.length === 0) {
      return { valido: false, mensaje: 'Palabra vacía: se esperan letras del alfabeto (A–Z).' };
    }
    const letras = [];
    for (const caracter of texto) {
      const validacion = validarLetra(caracter);
      if (!validacion.valido) return validacion;
      letras.push(validacion.valor);
    }
    return { valido: true, valor: letras.join(''), letras };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.dominio = window.CC2.dominio || {};
  window.CC2.dominio.clave = {
    ALFABETO,
    BITS_LETRA,
    validarClaveNumerica,
    validarClaveNumericaLibre,
    validarClaveAlfabetica,
    validarLetra,
    validarPalabra,
    normalizarLetra,
    mapearLetraADigitos,
    posicionEnAlfabeto,
    codigoDeLetra
  };
})();
