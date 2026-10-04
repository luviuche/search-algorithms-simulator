(function () {
  const dominio = window.CC2.dominio;
  const vista = window.CC2.vista;

  // Las búsquedas externas (CLAUDE.md 5.8, 5.11 y 6.1): el archivo en
  // columnas, una por bloque, con su rótulo arriba y los bloques ya
  // descartados comprimidos.
  //
  // Vivía dentro de `crearPantallaTema` (pantallas/tema-busqueda.js) y se
  // sacó tal cual (2026-10-03): la pantalla lo crea al armarse y le pasa lo
  // que comparte con él —el `estado` de la pantalla, sus nodos en `dom`, la
  // `config` del tema—, que son objetos y no copias: lo que la pantalla
  // cambie en ellos, el dibujo lo ve.
  function crearDibujoBloques({ estado, dom, config, comunes }) {
    const { llevarALaVista } = comunes;

    // Búsquedas externas (CLAUDE.md 5.x): cuarta orientación de la pantalla.
    // El archivo es el mismo arreglo ordenado y denso de secuencial, y los
    // bloques son una **agrupación de posiciones consecutivas encima de él**:
    // por eso no hay un modelo aparte que mantener, y por eso insertar en
    // medio empuja el desbordamiento al bloque de al lado sin código propio —
    // las claves se corren en el arreglo y el FLIP las anima cruzando el
    // canal.
    //
    // Cuántos bloques ya comparados conservan su último registro antes de que
    // los anteriores se junten en un tramo. Dos: los suficientes para leer de
    // dónde viene la búsqueda sin gastar el ancho que necesita el bloque que
    // se está mirando (pedido del usuario sobre maqueta, 2026-09-11).
    const BLOQUES_RECIENTES = 2;

    function esBloques() {
      return config.orientacion === 'bloques';
    }

    function formaDelArchivo() {
      return dominio.externa.formaDelArchivo(estado.estructura.n);
    }

    // Lo que miden `k` renglones seguidos: `k` casillas más los huecos entre
    // ellas. Lo usan el tramo elidido y su marca en la escala, que tienen que
    // medir lo mismo para que la numeración no se despegue de las casillas.
    function altoDeRenglones(k) {
      return `calc(${k} * (var(--alto-casilla) + var(--espacio-1)) - var(--espacio-1))`;
    }

    // Numera los renglones una sola vez, a la izquierda de la matriz: todos
    // los bloques tienen los mismos `r`, así que una columna por bloque sería
    // repetir el mismo número B veces (decisión sobre maqueta, 2026-09-11).
    function crearEscalaRegistros(segmentosDelRenglon) {
      // La escala **se construye como un bloque más**: rótulo arriba —oculto,
      // porque no rotula ninguna cubeta— y sus marcas donde van las casillas.
      // Así hereda los mismos huecos y rellenos que un bloque de verdad y el
      // renglón 1 cae a la altura de la primera casilla sin un solo número
      // escrito a mano. Medir el hueco a ojo dejaba la escala dos o cuatro
      // píxeles arriba, poco por renglón y visible al acumularse.
      // No lleva la clase `bloque`: comparte su disposición desde el CSS, pero
      // no *es* un bloque, y quien cuente bloques —las pruebas, sin ir más
      // lejos— no tiene por qué encontrarse una columna de más.
      const columna = document.createElement('div');
      columna.className = 'escala-registros';

      const hueco = document.createElement('span');
      hueco.className = 'bloque__etiqueta bloque__etiqueta--hueco';
      hueco.setAttribute('aria-hidden', 'true');
      hueco.textContent = '\u00A0';
      columna.appendChild(hueco);

      const marcas = document.createElement('div');
      marcas.className = 'bloque__registros';
      for (const segmento of segmentosDelRenglon) {
        const marca = document.createElement('span');
        marca.className = 'renglon__marca';
        marca.textContent = segmento.tipo === 'tramo' ? '⋯' : String(segmento.indice);
        // Una marca alta como el tramo que rotula: si midiera lo de una
        // casilla, la escala se iría despegando de las casillas renglón a
        // renglón y acabaría numerando la que no es.
        if (segmento.tipo === 'tramo') marca.style.height = altoDeRenglones(segmento.cantidad);
        marcas.appendChild(marca);
      }
      columna.appendChild(marcas);
      return columna;
    }

    function crearRotuloDeBloque(bloque, paso) {
      const el = document.createElement('div');
      const descartado = paso && paso.bloquesDescartados && paso.bloquesDescartados.includes(bloque);
      // El bloque en curso se marca en su rótulo y no pintando la columna: el
      // color ya está comprometido con los estados de la casilla y no se
      // reutiliza fuera de ella (CLAUDE.md 8.1).
      const estadoDelBloque = paso && paso.bloque === bloque
        ? ' bloque--en-curso'
        : (descartado ? ' bloque--descartado' : '');
      el.className = 'bloque__etiqueta' + estadoDelBloque;
      el.textContent = `B${bloque}`;
      return el;
    }

    // Una casilla del archivo, dibujada en el bloque que la contiene. `indice`
    // sigue siendo el registro dentro del arreglo —base 1, como en todo el
    // proyecto—: el bloque es solo dónde se dibuja.
    function crearCasillaDeRegistro(paso, registro, bloque) {
      const clave = estado.estructura.claves[registro - 1];
      // `bloque` viaja junto al registro porque el tema lo necesita para saber
      // si la casilla pertenece a un bloque ya descartado, y derivarlo de
      // nuevo desde el índice sería repetir el reparto que la vista ya hizo.
      const descripcion = config.describirCasilla({ paso, indice: registro, bloque, ocupada: clave !== undefined });
      return vista.componentes.casilla.crearCasilla({
        clave,
        indice: registro,
        estado: descripcion.estado,
        modificadores: descripcion.modificadores
      });
    }

    // El bloque comprimido conserva **el único registro que el algoritmo llega
    // a mirar** —el último— y dice cuántos esconde. El tramo crece hasta
    // empujar esa casilla al renglón `r`, que es donde el registro está de
    // verdad: alineada con el último registro de los bloques completos y no
    // flotando a media altura (pedido del usuario sobre maqueta, 2026-09-11).
    function crearBloqueComprimido(paso, bloque, forma) {
      const rango = dominio.externa.rangoDelBloque(forma, bloque);
      const registros = dominio.externa.registrosDelBloque(forma, bloque);

      const contenedor = document.createElement('div');
      contenedor.className = 'bloque__registros';

      // El tramo mide los renglones que oculta, así que el último registro
      // cae solo en el renglón que le toca: en un bloque completo, a la altura
      // del último de los demás; en el último bloque —más corto—, en el suyo.
      if (registros > 1) {
        const tramo = document.createElement('div');
        tramo.className = 'tramo-registros';
        tramo.style.height = altoDeRenglones(registros - 1);
        tramo.textContent = `⋯ ${registros - 1} ⋯`;
        contenedor.appendChild(tramo);
      }
      contenedor.appendChild(crearCasillaDeRegistro(paso, rango.ultimo, bloque));
      return contenedor;
    }

    function crearBloqueCompleto(paso, bloque, forma, segmentosDelRenglon) {
      const rango = dominio.externa.rangoDelBloque(forma, bloque);
      const registros = dominio.externa.registrosDelBloque(forma, bloque);

      const contenedor = document.createElement('div');
      contenedor.className = 'bloque__registros';

      for (const segmento of segmentosDelRenglon) {
        if (segmento.tipo === 'tramo') {
          const tramo = document.createElement('div');
          tramo.className = 'tramo-registros';
          tramo.style.height = altoDeRenglones(segmento.cantidad);
          tramo.textContent = `⋯ ${segmento.cantidad} ⋯`;
          contenedor.appendChild(tramo);
          continue;
        }
        // El último bloque se dibuja **corto**: sus posiciones de más no
        // existen, y una casilla vacía ahí diría «aquí cabe una clave», que es
        // mentira (pedido del usuario, 2026-09-11). La capacidad del archivo
        // es exactamente N.
        if (segmento.indice > registros) break;
        contenedor.appendChild(crearCasillaDeRegistro(paso, rango.primero + segmento.indice - 1, bloque));
      }
      return contenedor;
    }

    function renderizarBloques(paso, opciones) {
      const forma = formaDelArchivo();

      // Los renglones se eliden con la regla de siempre (CLAUDE.md 6.2), una
      // sola vez para toda la matriz: si cada bloque elidiera por su cuenta,
      // sus renglones dejarían de corresponderse y la escala de la izquierda
      // dejaría de rotular lo que rotula.
      //
      // Los renglones relevantes son los de las casillas que el tema declara:
      // la del paso y, en binaria externa, los extremos del rango que está
      // estrechando dentro del bloque.
      const renglonDe = (registro) =>
        registro - dominio.externa.rangoDelBloque(forma, dominio.externa.bloqueDe(forma, registro)).primero + 1;
      const renglonesRelevantes = paso ? config.casillasRelevantes(paso).map(renglonDe) : [];
      const segmentosDelRenglon = vista.elision.calcularSegmentos({
        n: forma.registrosPorBloque,
        relevantes: renglonesRelevantes,
        orientacion: 'vertical',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });
      // Cuando los renglones no caben, los bloques que no se están mirando se
      // comprimen a su último registro: es lo que hace que una búsqueda que se
      // va lejos siga cabiendo en el lienzo.
      const comprimirBloques = segmentosDelRenglon.some((segmento) => segmento.tipo === 'tramo');

      // Bloques que nunca se esconden dentro de un tramo: el primero y el
      // último —la regla de siempre—, el del paso, y los últimos comparados.
      // En secuencial externa los comparados son los descartados, en orden;
      // binaria externa descarta por los dos lados y dice cuáles leyó.
      const comparados = (paso && (paso.bloquesLeidos || paso.bloquesDescartados)) || [];
      const relevantes = comparados.slice(-BLOQUES_RECIENTES);
      if (paso && paso.bloque) relevantes.push(paso.bloque);
      // Y los extremos del rango de binaria externa: sin ellos, un tramo
      // «⋯ 7 bloques ⋯» se tragaba el bloque donde empieza el rango, que es
      // lo que el paso está diciendo.
      if (paso && paso.rangoBloques) relevantes.push(paso.rangoBloques.inicio, paso.rangoBloques.fin);
      const segmentosDeBloques = vista.elision.calcularSegmentos({
        n: forma.bloques,
        relevantes,
        orientacion: 'horizontal',
        mostrarCompleta: estado.mostrarCompleta,
        vecinas: false
      });

      let grupoSeguido = null;
      vista.animacion.animarFlip(dom.estructuraEl, () => {
        dom.estructuraEl.className = 'estructura-bloques';
        dom.estructuraEl.removeAttribute('style');
        dom.estructuraEl.innerHTML = '';
        dom.estructuraEl.appendChild(crearEscalaRegistros(segmentosDelRenglon));

        for (const segmento of segmentosDeBloques) {
          if (segmento.tipo === 'tramo') {
            const tramo = document.createElement('div');
            tramo.className = 'tramo-bloques';
            tramo.textContent = `⋯ ${segmento.cantidad} bloques ⋯`;
            dom.estructuraEl.appendChild(tramo);
            continue;
          }

          const bloque = segmento.indice;
          const grupo = document.createElement('div');
          grupo.className = 'bloque';
          grupo.appendChild(crearRotuloDeBloque(bloque, paso));
          grupo.appendChild(
            comprimirBloques && !(paso && paso.bloque === bloque)
              ? crearBloqueComprimido(paso, bloque, forma)
              : crearBloqueCompleto(paso, bloque, forma, segmentosDelRenglon)
          );
          dom.estructuraEl.appendChild(grupo);
          if (paso && paso.bloque === bloque) grupoSeguido = grupo;
        }

        llevarALaVista(grupoSeguido);
      }, opciones);
    }

    return { esBloques, renderizarBloques };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.dibujos = window.CC2.vista.dibujos || {};
  window.CC2.vista.dibujos.bloques = crearDibujoBloques;
})();
