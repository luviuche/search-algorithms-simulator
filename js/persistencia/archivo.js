(function () {
  // Guardar y abrir estructuras en archivos `.cc2` (CLAUDE.md 10).
  //
  // **Lo que se guarda son las claves en su orden de llegada, no la tabla.**
  // En los temas de transformación de claves ese orden es lo que decide dónde
  // cae cada una —dos órdenes del mismo conjunto dan tablas distintas en
  // cuanto hay colisiones—, así que la tabla se rehace al abrir, reinsertando
  // en ese orden. Guardar la colocación sería guardar dos veces lo mismo, y
  // mal: solo significa algo dentro de las reglas del tema que la produjo.
  //
  // Lo que el archivo devuelve es la estructura con sus claves, lista para
  // operar —`n`, `l` y las claves, esté completa o no—, y nada de sesión: ni
  // bitácora, ni paso en curso.

  const VERSION = 1;
  const EXTENSION = '.cc2';

  // `sinClaves` marca los temas cuya estructura **no sale de claves sino de
  // parámetros** —índices (CLAUDE.md 5.10)—. El archivo se guarda y se abre
  // igual, pero lo que lleva dentro y vale es `parametros`, y por eso no se
  // puede cruzar con los demás temas: ver `compatibilidad`.
  function serializar({ tema, estructura, titulo, sinClaves = false }) {
    return {
      version: VERSION,
      tema,
      titulo,
      sinClaves,
      tipoClave: estructura.tipoClave,
      // El modo dice cómo se colocaron las claves —ordenada, dispersa,
      // árbol—, y es lo que permite saber, al abrir el archivo en otro tema,
      // si la tabla va a salir igual o recolocada (CLAUDE.md 10.5).
      modo: estructura.modo,
      n: estructura.n,
      l: estructura.l,
      tratamiento: estructura.tratamiento || null,
      parametros: estructura.parametros || {},
      // El orden de llegada y no el contenido de la tabla: ver arriba.
      claves: (estructura.ordenLlegada || []).slice(),
      creadaEn: new Date().toISOString()
    };
  }

  // Un nombre que diga de qué es el archivo sin abrirlo, porque en la carpeta
  // de descargas va a estar junto a otros quince: tema y los datos con que se
  // creó, que es lo mismo con lo que se reconoce una estructura reciente
  // (CLAUDE.md 10.3).
  function nombreSugerido({ tema, estructura, detalle }) {
    // Un tema sin claves nombra su archivo por lo que de verdad lo distingue.
    // `n1-l1` —lo que índices guarda como tamaño— no dice nada de nada.
    if (detalle) return `${tema}-${detalle}${EXTENSION}`;
    const partes = [tema, `n${estructura.n}`];
    if (estructura.l !== undefined) partes.push(`l${estructura.l}`);
    return partes.join('-') + EXTENSION;
  }

  // Qué tiene que traer un archivo para que se pueda abrir **en este tema**.
  // Se valida antes de tocar nada: si algo no cuadra, la estructura que está
  // en pantalla se queda como está (CLAUDE.md 10.5).
  function validar(datos) {
    if (!datos || typeof datos !== 'object') {
      return { valido: false, mensaje: 'Archivo ilegible: no contiene una estructura.' };
    }
    if (datos.version !== VERSION) {
      return {
        valido: false,
        mensaje: `Versión no reconocida: el archivo dice ${datos.version} y esta versión lee ${VERSION}.`
      };
    }
    if (!Number.isInteger(datos.n) || datos.n < 1) {
      return { valido: false, mensaje: 'Archivo incompleto: no trae un tamaño válido.' };
    }
    if (!Array.isArray(datos.claves)) {
      return { valido: false, mensaje: 'Archivo incompleto: no trae la lista de claves.' };
    }
    // **No se compara la cantidad de claves contra `n`.** `n` es cuántas
    // casillas tiene la tabla, no cuántas claves caben: con cubetas caben
    // `n × r`, con arreglos anidados `n × n` y con encadenamiento no hay tope.
    // Exigir `claves ≤ n` dejaba sin poder abrir —ni en su propio tema— una
    // tabla de cubetas expandida o una tabla encadenada. Si caben o no lo
    // decide el tema que abre el archivo, al colocarlas, y lo avisa.
    //
    // Lo que sí se exige es que cada clave sea un valor y no una estructura:
    // números, o letras en los temas de árboles. Que además valga en el tema
    // —longitud, rango— se comprueba al abrir, con el mismo validador que una
    // clave digitada.
    const malformada = datos.claves.findIndex((clave) => typeof clave !== 'number' && typeof clave !== 'string');
    if (malformada !== -1) {
      return {
        valido: false,
        mensaje: `Archivo inconsistente: la clave ${malformada + 1} de la lista no es un número ni una letra.`
      };
    }
    // `l` puede faltar —cubetas no la pide—, pero si viene tiene que ser una
    // longitud: con otra cosa ninguna clave pasaría la validación.
    if (datos.l !== undefined && datos.l !== null && (!Number.isInteger(datos.l) || datos.l < 1)) {
      return { valido: false, mensaje: 'Archivo inconsistente: la longitud de clave (l) no es válida.' };
    }
    return { valido: true, datos };
  }

  // El `n` con que se creó la estructura guardada. En casi todos los temas es
  // el mismo `n` del archivo, pero en cubetas (CLAUDE.md 5.7) `n` crece al
  // expandir y el archivo guarda el que alcanzó: el de partida va en
  // `parametros.n0`, y es el que manda al reducir y al vaciar. Tomar el `n`
  // expandido como `n0` dejaría la tabla reabierta sin poder volver a reducir.
  function nInicial(datos) {
    const n0 = datos.parametros && datos.parametros.n0;
    return Number.isInteger(n0) && n0 >= 1 && n0 <= datos.n ? n0 : datos.n;
  }

  // Los parámetros guardados, escritos como los habría digitado el estudiante.
  // Al abrir un archivo en su propio tema, sus parámetros pasan por los mismos
  // validadores del formulario —un archivo editado a mano con `r: 0` no puede
  // crear una tabla de cubetas sin renglones—, y esos validadores leen texto
  // y devuelven el valor ya convertido. Por eso cada parámetro puede declarar
  // `comoTexto`, la conversión inversa: los umbrales de cubetas se guardan
  // como fracción (0.82) y se digitan como porcentaje (82). Sin ella vale
  // `String`, que ya sirve para números, opciones y listas de posiciones
  // (`[1, 3]` → `"1,3"`). Lo que falta queda vacío, como un campo sin llenar:
  // el validador decide si tiene valor por omisión o si es un error.
  //
  // Devuelve un `Map`, que responde a `get` igual que el `FormData` del
  // formulario, para que la pantalla valide las dos cosas con la misma pieza.
  function parametrosComoTexto(guardados, declarados) {
    const origen = guardados && typeof guardados === 'object' ? guardados : {};
    return new Map((declarados || []).map((parametro) => {
      const valor = origen[parametro.nombre];
      if (valor === undefined || valor === null) return [parametro.nombre, ''];
      return [parametro.nombre, parametro.comoTexto ? parametro.comoTexto(valor) : String(valor)];
    }));
  }

  // **Un archivo se puede abrir en otro tema** (pedido del usuario,
  // 2026-09-11): la gracia de tener las claves guardadas es poder ver las
  // mismas en secuencial y en binaria, o en dos funciones hash distintas. Lo
  // que decide si se puede no es el nombre del tema sino **qué clase de claves
  // guarda**: numéricas a un tema de letras no van, y al revés tampoco.
  //
  // Y hay que distinguir dos casos, porque no significan lo mismo:
  //
  //   · **Sale igual** — el archivo viene de una estructura ordenada y el
  //     destino también lo es. Secuencial, binaria y secuencial externa
  //     colocan las claves exactamente igual: la tabla que aparece es la
  //     misma que se guardó.
  //   · **Se recoloca** — cualquier otro cruce. Las claves son las mismas,
  //     pero la regla del destino las pone en otro sitio: es lo interesante
  //     del asunto —las mismas doce claves por módulo y por plegamiento— pero
  //     hay que avisarlo, o parecerá que el archivo se abrió mal.
  function compatibilidad(datos, destino) {
    if (datos.tema === destino.tema) {
      return { abre: true, recoloca: false };
    }
    // **Un archivo sin claves no cruza de tema, en ninguna de las dos
    // direcciones.** Lo que lo define son los parámetros de su tema —`r`, `B`,
    // `R`, `Ri`— y fuera de él no significan nada; y al revés, un archivo de
    // claves abierto en un tema que no las tiene no traería nada que colocar.
    // El cruce existe para ver las mismas claves con otras reglas, y aquí no
    // hay claves que ver.
    if (datos.sinClaves || destino.sinClaves) {
      const cual = datos.sinClaves ? 'El archivo' : 'Este tema';
      return {
        abre: false,
        mensaje: `${cual} guarda una estructura que sale de parámetros y no de claves,`
          + ' así que solo se abre en el tema que la creó.'
      };
    }
    if (datos.tipoClave !== destino.tipoClave) {
      const clases = { numerica: 'números', alfabetica: 'letras' };
      return {
        abre: false,
        mensaje: `El archivo guarda claves de ${clases[datos.tipoClave] || datos.tipoClave}`
          + ` y este tema trabaja con ${clases[destino.tipoClave] || destino.tipoClave}.`
      };
    }
    // Un archivo guardado antes de que existiera este cruce no trae `modo`:
    // sin él no se puede saber si la tabla saldrá igual, y se avisa de que
    // puede cambiar, que es lo honesto. Se arregla solo en cuanto se vuelve a
    // guardar.
    const ordenadas = datos.modo === 'ordenada' && destino.modo === 'ordenada';
    return { abre: true, recoloca: !ordenadas };
  }

  function comoTexto(datos) {
    return JSON.stringify(datos, null, 2);
  }

  // Guardar tiene dos niveles y se elige en tiempo de ejecución, no de
  // antemano (CLAUDE.md 10.2):
  //
  //   2. `showSaveFilePicker` — diálogo real de "Guardar como", con elección
  //      de carpeta y regrabado sobre el mismo archivo. **No existe cuando la
  //      aplicación se abre con `file://`**, que es como se abre casi siempre:
  //      Chromium no expone esos selectores a una página abierta como archivo.
  //   1. Descarga — siempre disponible. Deja el archivo en la carpeta de
  //      descargas con el nombre sugerido; para elegir carpeta y nombre, el
  //      ajuste "preguntar dónde guardar cada archivo" del navegador abre el
  //      explorador en cada descarga.
  function hayDialogoDeGuardado() {
    return typeof window.showSaveFilePicker === 'function';
  }

  async function guardar({ datos, nombre }) {
    const texto = comoTexto(datos);

    if (hayDialogoDeGuardado()) {
      try {
        const manejador = await window.showSaveFilePicker({
          suggestedName: nombre,
          types: [{
            description: 'Estructura del simulador',
            accept: { 'application/json': [EXTENSION] }
          }]
        });
        const escritura = await manejador.createWritable();
        await escritura.write(texto);
        await escritura.close();
        return { exito: true, via: 'dialogo', nombre: manejador.name };
      } catch (error) {
        // Cancelar el diálogo no es un fallo: es decir que no.
        if (error && error.name === 'AbortError') return { exito: false, cancelado: true };
        // Cualquier otro tropiezo cae a la descarga, que siempre funciona.
      }
    }

    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Se libera después, no en el acto: revocar antes de que el navegador
    // haya empezado la descarga la cancela.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { exito: true, via: 'descarga', nombre };
  }

  // Abrir sí es nativo desde `file://`: `<input type="file">` abre el
  // explorador del sistema y `FileReader` lee el archivo.
  function leer(archivo) {
    return new Promise((resolver) => {
      const lector = new FileReader();
      lector.onerror = () => resolver({ exito: false, mensaje: 'No se pudo leer el archivo.' });
      lector.onload = () => {
        try {
          resolver({ exito: true, datos: JSON.parse(String(lector.result)) });
        } catch (error) {
          resolver({ exito: false, mensaje: 'Archivo ilegible: no es un JSON válido.' });
        }
      };
      lector.readAsText(archivo);
    });
  }

  window.CC2 = window.CC2 || {};
  window.CC2.persistencia = window.CC2.persistencia || {};
  window.CC2.persistencia.archivo = {
    VERSION,
    EXTENSION,
    serializar,
    nombreSugerido,
    validar,
    nInicial,
    parametrosComoTexto,
    compatibilidad,
    comoTexto,
    hayDialogoDeGuardado,
    guardar,
    leer
  };
})();
