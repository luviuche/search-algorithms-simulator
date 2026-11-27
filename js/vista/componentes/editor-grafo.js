(function () {
  // **El editor de un grafo** (pedido del docente, 2026-11-26): se da el
  // número de vértices, cada arista se arma eligiendo de qué vértice a qué
  // vértice va —en una tabla, o con dos clics en el dibujo— y, si el grafo es
  // ponderado, su peso (CLAUDE.md 6.13).
  //
  // **El editor escribe el mismo texto de siempre** en el `textarea`, que sigue
  // siendo el campo del formulario, como el `select` de una galería: lo lee
  // cada tema con su lector, lo valida al crear y lo guarda en el archivo. El
  // editor no valida nada que el lector ya diga; solo marca la arista que va
  // de un vértice a sí mismo y la repetida, que se ven en la tabla.
  //
  // Escribir como texto sigue a mano, para pegar un ejercicio largo. Al volver
  // a la tabla el texto se lee; si no cabe en ella —vértices salteados,
  // números y letras mezclados— se dice por qué y se sigue en texto.
  const { crearIcono } = window.CC2.vista.componentes.iconos;

  // Lo que no toca la pantalla —leer el texto, escribirlo, nombrar— vive en
  // `dominio/tabla-de-aristas.js`, donde lo prueban las pruebas de Node.
  const { nombresDe, rotuloDeEsquema, vale, rotulosDeAristas, leerTexto, comoTexto, claveDe } = window.CC2.dominio.tablaDeAristas;

  // config = { esquemas(datos), pesos(datos), ponderadoPorDefecto, maximo(datos),
  //            dirigido(datos), rotulos }
  function crearEditorGrafo({ area, formulario, config, etiqueta, ayudaDeTexto, conTitulo = true }) {
    const fn = (valor) => (typeof valor === 'function' ? valor : () => valor);
    const esquemasDe = fn(config.esquemas || ['n:1']);
    const pesosDe = fn(config.pesos || false);
    const maximoDe = fn(config.maximo || 8);
    const dirigidoDe = config.dirigido
      ? fn(config.dirigido)
      : (datos) => String(datos.get('tipo') || '') === 'dirigido';
    const datos = () => new FormData(formulario);
    const ctx = () => {
      const d = datos();
      const esquemas = esquemasDe(d);
      return { esquemas, pesos: pesosDe(d), maximo: maximoDe(d), dirigido: dirigidoDe(d) };
    };

    const estado = {
      n: null,
      esquema: esquemasDe(datos()).find((e) => e !== 'n:*'),
      filas: [],
      ponderado: Boolean(config.ponderadoPorDefecto),
      enTexto: false,
      elegido: null,
      aviso: ''
    };

    const el = document.createElement('div');
    el.className = 'editor-grafo';
    // Arriba, el nombre del grafo —si hay dos— y cómo se escribe: en la
    // tabla o en texto, a la vista y no al pie, donde quedaba tapado.
    const arriba = document.createElement('div');
    arriba.className = 'editor-grafo__arriba';
    const titulo = document.createElement('div');
    titulo.className = 'editor-grafo__titulo';
    titulo.textContent = conTitulo ? etiqueta : '';
    const modos = document.createElement('div');
    modos.className = 'editor-grafo__modos';
    modos.setAttribute('role', 'group');
    modos.setAttribute('aria-label', `Cómo escribir ${etiqueta.toLowerCase()}`);
    const enTabla = document.createElement('button');
    enTabla.type = 'button';
    enTabla.dataset.editor = 'tabla';
    enTabla.textContent = 'Tabla';
    enTabla.title = 'Elegir cada arista de cuál vértice a cuál';
    const aTexto = document.createElement('button');
    aTexto.type = 'button';
    aTexto.dataset.editor = 'texto';
    aTexto.textContent = 'Texto';
    aTexto.title = 'Escribir las aristas, una por renglón: sirve para pegar un ejercicio';
    modos.append(enTabla, aTexto);
    arriba.append(titulo, modos);

    // ── Vértices y nombres ──
    const cabecera = document.createElement('div');
    cabecera.className = 'editor-grafo__vertices';
    const rotuloN = document.createElement('label');
    rotuloN.className = 'editor-grafo__dato';
    const textoN = document.createElement('span');
    textoN.textContent = 'Vértices';
    const contador = document.createElement('div');
    contador.className = 'editor-grafo__contador';
    const menos = botonChico('−', 'Un vértice menos');
    const campoN = document.createElement('input');
    campoN.type = 'number';
    campoN.min = '1';
    campoN.inputMode = 'numeric';
    campoN.placeholder = 'ej. 5';
    campoN.dataset.editor = 'vertices';
    const mas = botonChico('+', 'Un vértice más');
    contador.append(menos, campoN, mas);
    rotuloN.append(textoN, contador);

    const rotuloNombres = document.createElement('label');
    rotuloNombres.className = 'editor-grafo__dato';
    const textoNombres = document.createElement('span');
    textoNombres.textContent = 'Nombres';
    const listaNombres = document.createElement('select');
    listaNombres.dataset.editor = 'nombres';
    rotuloNombres.append(textoNombres, listaNombres);
    const rotuloDesde = document.createElement('label');
    rotuloDesde.className = 'editor-grafo__dato';
    const textoDesde = document.createElement('span');
    textoDesde.textContent = 'Desde';
    const campoDesde = document.createElement('input');
    campoDesde.type = 'number';
    campoDesde.min = '0';
    campoDesde.inputMode = 'numeric';
    campoDesde.dataset.editor = 'desde';
    rotuloDesde.append(textoDesde, campoDesde);
    cabecera.append(rotuloN, rotuloNombres, rotuloDesde);

    const rotuloPonderado = document.createElement('label');
    rotuloPonderado.className = 'editor-grafo__ponderado';
    const casillaPonderado = document.createElement('input');
    casillaPonderado.type = 'checkbox';
    casillaPonderado.dataset.editor = 'ponderado';
    const textoPonderado = document.createElement('span');
    textoPonderado.textContent = 'Ponderado: cada arista con su peso';
    rotuloPonderado.append(casillaPonderado, textoPonderado);

    // ── Las aristas ──
    const tabla = document.createElement('div');
    tabla.className = 'editor-grafo__tabla';
    tabla.setAttribute('role', 'table');
    tabla.setAttribute('aria-label', etiqueta);
    const agregar = document.createElement('button');
    agregar.type = 'button';
    agregar.className = 'boton editor-grafo__agregar';
    agregar.dataset.editor = 'agregar';
    agregar.append(crearIcono('insertar-arista'), 'Agregar arista');
    const guia = document.createElement('p');
    guia.className = 'editor-grafo__guia';

    // ── En texto ──
    const enTexto = document.createElement('div');
    enTexto.className = 'editor-grafo__texto';
    const aviso = document.createElement('p');
    aviso.className = 'editor-grafo__aviso';
    aviso.setAttribute('role', 'status');
    const ayuda = document.createElement('span');
    ayuda.className = 'campo__ayuda';
    ayuda.textContent = ayudaDeTexto || '';
    enTexto.append(aviso, area, ayuda);

    el.append(arriba, cabecera, rotuloPonderado, tabla, agregar, guia, enTexto);

    function botonChico(texto, nombre) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'editor-grafo__paso';
      boton.textContent = texto;
      boton.setAttribute('aria-label', nombre);
      return boton;
    }

    // Lo que se toca dentro del editor no es un campo del formulario: el
    // cambio que importa es el del texto, que se avisa al escribirlo.
    for (const tipo of ['input', 'change']) {
      for (const control of [campoN, listaNombres, campoDesde, casillaPonderado]) {
        control.addEventListener(tipo, (evento) => evento.stopPropagation());
      }
      tabla.addEventListener(tipo, (evento) => evento.stopPropagation());
    }

    let escribiendo = false;
    function escribir() {
      const texto = comoTexto(estado, ctx().pesos);
      if (area.value === texto) return;
      area.value = texto;
      escribiendo = true;
      area.dispatchEvent(new Event('input', { bubbles: true }));
      escribiendo = false;
    }

    // Lo que viene de fuera —abrir un archivo, una reciente, escribir en
    // texto— se lee. En texto no se cambia de modo mientras se escribe.
    function leerDelArea({ cambiarDeModo }) {
      const lectura = leerTexto(area.value, ctx());
      if (lectura.valido && lectura.vacio) {
        estado.filas = [];
        estado.aviso = '';
        return true;
      }
      if (!lectura.valido) {
        estado.aviso = lectura.motivo;
        if (cambiarDeModo) estado.enTexto = true;
        return false;
      }
      Object.assign(estado, { n: lectura.n, esquema: lectura.esquema, filas: lectura.filas, aviso: '' });
      // Con aristas escritas, es ponderado si alguna trae su peso.
      if (lectura.filas.length) estado.ponderado = lectura.ponderado;
      estado.elegido = null;
      return true;
    }
    // En texto se lee callado mientras se escribe; con la tabla a la vista, lo
    // que llega de fuera se ve en ella.
    area.addEventListener('input', () => {
      if (escribiendo) return;
      if (estado.enTexto) leerDelArea({ cambiarDeModo: false });
      else {
        leerDelArea({ cambiarDeModo: true });
        pintar();
      }
    });
    area.addEventListener('change', () => {
      if (escribiendo) return;
      leerDelArea({ cambiarDeModo: !estado.enTexto });
      pintar();
    });

    // El nombre de cada arista, como lo pone el lector. Donde el tema nombra
    // por los extremos cuando los vértices son letras (`porExtremos`: árbol
    // de expansión, 2026-11-26), «ab».
    function rotulosDe() {
      if (config.porExtremos && (estado.esquema === 'A' || estado.esquema === 'a') && estado.n) {
        const nombres = nombresDe(estado.esquema, estado.n);
        return estado.filas.map((f) => f.nombre || `${nombres[f.desde]}${nombres[f.hasta]}`);
      }
      return rotulosDeAristas(estado.filas);
    }

    // ── Dibujar el editor ──
    function pintarNombres(esquemas) {
      const libre = esquemas.includes('n:*');
      let lista = esquemas.filter((e) => e !== 'n:*');
      if (libre) lista = lista.concat('n:otro');
      const fuera = !lista.includes(estado.esquema);
      if (fuera && !libre) lista = lista.concat(estado.esquema);
      listaNombres.innerHTML = '';
      for (const esquema of lista) {
        const opcion = document.createElement('option');
        opcion.value = esquema;
        opcion.textContent = rotuloDeEsquema(esquema);
        listaNombres.appendChild(opcion);
      }
      listaNombres.value = fuera && libre ? 'n:otro' : estado.esquema;
      rotuloNombres.hidden = lista.length < 2;
      rotuloDesde.hidden = !(fuera && libre);
      if (!rotuloDesde.hidden) campoDesde.value = estado.esquema.slice(2);
    }

    function pintar() {
      const c = ctx();
      el.classList.toggle('editor-grafo--en-texto', estado.enTexto);
      cabecera.hidden = estado.enTexto;
      tabla.hidden = estado.enTexto;
      agregar.hidden = estado.enTexto;
      guia.hidden = estado.enTexto;
      enTexto.hidden = !estado.enTexto;
      rotuloPonderado.hidden = estado.enTexto || !c.pesos;
      enTabla.setAttribute('aria-pressed', String(!estado.enTexto));
      aTexto.setAttribute('aria-pressed', String(estado.enTexto));
      aviso.textContent = estado.aviso;
      aviso.hidden = !estado.aviso;
      if (estado.enTexto) return;

      // Sin vértices todavía, la forma de nombrar del tema: Dijkstra, desde 0.
      if (!vale(estado.esquema, c.esquemas) || !estado.n) {
        estado.esquema = c.esquemas.find((e) => e !== 'n:*');
        escribir();
      }
      pintarNombres(c.esquemas);
      campoN.max = String(c.maximo);
      campoN.value = estado.n ? String(estado.n) : '';
      menos.disabled = !estado.n || estado.n <= 1;
      mas.disabled = Boolean(estado.n) && estado.n >= c.maximo;
      casillaPonderado.checked = estado.ponderado;
      agregar.disabled = !estado.n || estado.n < 2;
      pintarTabla(c);
      guia.textContent = !estado.n
        ? 'Diga cuántos vértices tiene el grafo: se dibujan al lado.'
        : config.alDibujo && config.alDibujo()
          ? 'Haga clic en un vértice del dibujo y luego en otro para unirlos.'
          : estado.filas.length === 0 ? 'Agregue sus aristas.' : '';
      guia.hidden = !guia.textContent;
    }

    function pintarTabla(c) {
      tabla.innerHTML = '';
      const conPeso = c.pesos && estado.ponderado;
      tabla.classList.toggle('editor-grafo__tabla--con-peso', conPeso);
      tabla.classList.toggle('editor-grafo__tabla--con-rotulo', Boolean(config.rotulos));
      if (!estado.n || estado.filas.length === 0) return;
      const nombres = nombresDe(estado.esquema, estado.n);
      const encabezado = document.createElement('div');
      encabezado.className = 'editor-grafo__fila editor-grafo__fila--encabezado';
      encabezado.setAttribute('role', 'row');
      const columnas = [config.rotulos ? '' : null, c.dirigido ? 'Desde' : 'Entre', '', c.dirigido ? 'Hasta' : 'y', conPeso ? 'Peso' : null, ''];
      for (const texto of columnas) {
        if (texto === null) continue;
        const celda = document.createElement('span');
        celda.setAttribute('role', 'columnheader');
        celda.textContent = texto;
        encabezado.appendChild(celda);
      }
      tabla.appendChild(encabezado);

      const rotulos = rotulosDe();
      const vistas = new Map();
      estado.filas.forEach((fila, i) => {
        const el = document.createElement('div');
        el.className = 'editor-grafo__fila';
        el.setAttribute('role', 'row');
        el.dataset.fila = String(i);
        const clave = claveDe(fila, c.dirigido);
        const problema = fila.desde === fila.hasta ? 'Va de un vértice a sí mismo.'
          : vistas.has(clave) ? `Repite la arista ${rotulos[vistas.get(clave)]}.` : '';
        if (!vistas.has(clave)) vistas.set(clave, i);
        if (problema) {
          el.classList.add('editor-grafo__fila--mal');
          el.title = problema;
        }
        if (config.rotulos) {
          const rotulo = document.createElement('span');
          rotulo.className = 'editor-grafo__rotulo';
          rotulo.textContent = rotulos[i];
          el.appendChild(rotulo);
        }
        const lista = (valor, parte) => {
          const select = document.createElement('select');
          select.setAttribute('aria-label', `${parte} de la arista ${rotulos[i]}`);
          nombres.forEach((nombre, j) => {
            const opcion = document.createElement('option');
            opcion.value = String(j);
            opcion.textContent = nombre;
            select.appendChild(opcion);
          });
          select.value = String(valor);
          return select;
        };
        const desde = lista(fila.desde, c.dirigido ? 'Origen' : 'Un extremo');
        const hasta = lista(fila.hasta, c.dirigido ? 'Destino' : 'El otro extremo');
        desde.dataset.parte = 'desde';
        hasta.dataset.parte = 'hasta';
        const flecha = document.createElement('span');
        flecha.className = 'editor-grafo__flecha';
        flecha.setAttribute('aria-hidden', 'true');
        flecha.textContent = c.dirigido ? '→' : '—';
        el.append(desde, flecha, hasta);
        if (conPeso) {
          const peso = document.createElement('input');
          peso.type = 'text';
          peso.inputMode = 'numeric';
          peso.className = 'editor-grafo__peso';
          peso.placeholder = '1';
          peso.value = fila.peso;
          peso.dataset.parte = 'peso';
          peso.setAttribute('aria-label', `Peso de la arista ${rotulos[i]}`);
          el.appendChild(peso);
        }
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'boton-icono editor-grafo__quitar';
        quitar.dataset.parte = 'quitar';
        quitar.setAttribute('aria-label', `Quitar la arista ${rotulos[i]}`);
        quitar.title = 'Quitar esta arista';
        quitar.appendChild(crearIcono('eliminar'));
        el.appendChild(quitar);
        tabla.appendChild(el);
      });
    }

    // ── Lo que hace cada control ──
    function ponerN(n) {
      const c = ctx();
      if (!Number.isInteger(n) || n < 1) return;
      const nuevo = Math.min(n, c.maximo);
      // Las aristas de un vértice que se va, se van con él.
      estado.filas = estado.filas.filter((f) => f.desde < nuevo && f.hasta < nuevo);
      estado.n = nuevo;
      if (estado.elegido !== null && estado.elegido >= nuevo) estado.elegido = null;
      escribir();
      pintar();
    }
    menos.addEventListener('click', () => ponerN((estado.n || 2) - 1));
    mas.addEventListener('click', () => ponerN((estado.n || 0) + 1));
    campoN.addEventListener('change', () => {
      if (campoN.value.trim() === '') { pintar(); return; }
      ponerN(Math.round(Number(campoN.value)));
    });
    campoN.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') { evento.preventDefault(); campoN.dispatchEvent(new Event('change')); }
    });
    listaNombres.addEventListener('change', () => {
      estado.esquema = listaNombres.value === 'n:otro' ? 'n:2' : listaNombres.value;
      escribir();
      pintar();
      if (listaNombres.value === 'n:otro') campoDesde.focus();
    });
    campoDesde.addEventListener('change', () => {
      const desde = Math.round(Number(campoDesde.value));
      // Hasta dos cifras, como en los lectores.
      if (!Number.isInteger(desde) || desde < 0 || desde + (estado.n || 1) - 1 > 99) { pintar(); return; }
      estado.esquema = `n:${desde}`;
      escribir();
      pintar();
    });
    casillaPonderado.addEventListener('change', () => {
      estado.ponderado = casillaPonderado.checked;
      escribir();
      pintar();
    });

    // La primera arista que todavía no está, para que agregar no repita.
    function siguientePar() {
      const { dirigido } = ctx();
      const vistas = new Set(estado.filas.map((f) => claveDe(f, dirigido)));
      for (let i = 0; i < estado.n; i++) {
        for (let j = 0; j < estado.n; j++) {
          if (i === j || (!dirigido && j < i)) continue;
          if (!vistas.has(claveDe({ desde: i, hasta: j }, dirigido))) return [i, j];
        }
      }
      return [0, Math.min(1, estado.n - 1)];
    }

    function agregarFila(desde, hasta) {
      estado.filas.push({ desde, hasta, peso: '', nombre: null });
      escribir();
      pintar();
      return tabla.querySelector(`[data-fila="${estado.filas.length - 1}"]`);
    }
    agregar.addEventListener('click', () => {
      const fila = agregarFila(...siguientePar());
      if (fila) fila.querySelector('select').focus();
    });

    tabla.addEventListener('change', (evento) => {
      const filaEl = evento.target.closest('[data-fila]');
      if (!filaEl) return;
      const fila = estado.filas[Number(filaEl.dataset.fila)];
      const parte = evento.target.dataset.parte;
      if (parte === 'desde' || parte === 'hasta') {
        fila[parte] = Number(evento.target.value);
        escribir();
        // Se repinta para marcar la repetida, sin perder el foco.
        const foco = `[data-fila="${filaEl.dataset.fila}"] [data-parte="${parte}"]`;
        pintar();
        const vuelta = tabla.querySelector(foco);
        if (vuelta) vuelta.focus();
      }
    });
    tabla.addEventListener('input', (evento) => {
      if (evento.target.dataset.parte !== 'peso') return;
      const filaEl = evento.target.closest('[data-fila]');
      estado.filas[Number(filaEl.dataset.fila)].peso = evento.target.value.trim();
      escribir();
    });
    tabla.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-parte="quitar"]');
      if (!boton) return;
      const i = Number(boton.closest('[data-fila]').dataset.fila);
      estado.filas.splice(i, 1);
      escribir();
      pintar();
      const siguiente = tabla.querySelector(`[data-fila="${Math.min(i, estado.filas.length - 1)}"] [data-parte="quitar"]`);
      (siguiente || agregar).focus();
    });

    aTexto.addEventListener('click', () => {
      if (estado.enTexto) return;
      estado.enTexto = true;
      estado.aviso = '';
      pintar();
      area.focus();
      // Sin la tabla, el dibujo ya no se une con clics.
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Al volver, el texto se lee; si no cabe en la tabla, se dice por qué.
    enTabla.addEventListener('click', () => {
      if (!estado.enTexto) return;
      if (leerDelArea({ cambiarDeModo: false })) estado.enTexto = false;
      pintar();
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Lo que cambia afuera —dirigido o no, el algoritmo, la operación— cambia
    // las flechas, los nombres que valen y si hay pesos.
    formulario.addEventListener('change', (evento) => {
      if (el.contains(evento.target)) return;
      if (!estado.enTexto) {
        const c = ctx();
        if (!vale(estado.esquema, c.esquemas)) {
          estado.esquema = c.esquemas.find((e) => e !== 'n:*');
          escribir();
        }
        pintar();
      }
    });

    // **Dos clics en el dibujo**: el primero elige, el segundo une. Volver a
    // tocar el elegido lo suelta; unir dos ya unidos no repite la arista.
    function tocarVertice(nombre) {
      if (estado.enTexto || !estado.n) return false;
      const i = nombresDe(estado.esquema, estado.n).indexOf(String(nombre));
      if (i === -1) return false;
      if (estado.elegido === null) estado.elegido = i;
      else if (estado.elegido === i) estado.elegido = null;
      else {
        const { dirigido } = ctx();
        const fila = { desde: estado.elegido, hasta: i };
        estado.elegido = null;
        const ya = estado.filas.findIndex((f) => claveDe(f, dirigido) === claveDe(fila, dirigido));
        if (ya === -1) {
          const nueva = agregarFila(fila.desde, fila.hasta);
          const peso = nueva && nueva.querySelector('[data-parte="peso"]');
          if (peso) peso.focus({ preventScroll: true });
        } else {
          const existente = tabla.querySelector(`[data-fila="${ya}"]`);
          if (existente) {
            existente.classList.remove('editor-grafo__fila--avisada');
            void existente.offsetWidth;
            existente.classList.add('editor-grafo__fila--avisada');
          }
        }
      }
      return true;
    }

    // Lo que se dibuja si el lector todavía no da un grafo —sin aristas, con
    // una a medias—: los vértices y las aristas que ya están bien.
    function grafoProvisional() {
      if (estado.enTexto || !estado.n) return null;
      const c = ctx();
      const nombres = nombresDe(estado.esquema, estado.n);
      const vistas = new Set();
      const rotulos = rotulosDe();
      const aristas = [];
      estado.filas.forEach((fila, i) => {
        const clave = claveDe(fila, c.dirigido);
        if (fila.desde === fila.hasta || vistas.has(clave)) return;
        vistas.add(clave);
        const peso = Number(fila.peso);
        aristas.push({
          origen: nombres[fila.desde], destino: nombres[fila.hasta],
          peso: fila.peso !== '' && Number.isFinite(peso) ? peso : 1, nombre: rotulos[i]
        });
      });
      return { tipo: c.dirigido ? 'dirigido' : 'no-dirigido', vertices: nombres, aristas, conPesos: c.pesos && estado.ponderado };
    }

    leerDelArea({ cambiarDeModo: true });
    pintar();

    return {
      el,
      tocarVertice,
      grafoProvisional,
      elegido: () => (estado.elegido === null || !estado.n ? null : nombresDe(estado.esquema, estado.n)[estado.elegido]),
      enTabla: () => !estado.enTexto,
      repintar: pintar
    };
  }

  window.CC2 = window.CC2 || {};
  window.CC2.vista = window.CC2.vista || {};
  window.CC2.vista.componentes = window.CC2.vista.componentes || {};
  window.CC2.vista.componentes.editorGrafo = { crearEditorGrafo };
})();
