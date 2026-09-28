// Los archivos de dominio/algoritmos usan el patrón window.CC2.<capa>.<modulo>
// pensado para <script> clásicos en el navegador. Node no tiene `window`;
// este shim lo simula para poder requerirlos tal cual desde las pruebas.
global.window = global;

require('../js/dominio/limites.js');
require('../js/dominio/clave.js');
require('../js/dominio/estructura.js');
require('../js/dominio/arbol.js');
require('../js/dominio/arbol-multiple.js');
require('../js/dominio/cubetas.js');
require('../js/dominio/externa.js');
require('../js/dominio/huffman.js');
require('../js/dominio/indices.js');
require('../js/algoritmos/traza.js');
require('../js/algoritmos/secuencial.js');
require('../js/algoritmos/binaria.js');
require('../js/algoritmos/arbol-digital.js');
require('../js/algoritmos/residuos.js');
require('../js/algoritmos/residuos-multiples.js');
require('../js/algoritmos/eliminacion.js');
require('../js/algoritmos/colisiones/reasignacion.js');
require('../js/algoritmos/colisiones/anidados.js');
require('../js/algoritmos/colisiones/encadenamiento.js');
require('../js/algoritmos/hash/comun.js');
require('../js/algoritmos/hash/modulo.js');
require('../js/algoritmos/hash/cuadrado.js');
require('../js/algoritmos/hash/truncamiento.js');
require('../js/algoritmos/hash/plegamiento.js');
require('../js/algoritmos/hash/bases.js');
require('../js/algoritmos/hash/operaciones.js');
require('../js/algoritmos/cubetas.js');
require('../js/algoritmos/secuencial-externa.js');
require('../js/algoritmos/binaria-externa.js');
require('../js/algoritmos/huffman.js');
require('../js/algoritmos/indices.js');
// Persistencia: serializar y validar son cálculo puro y sí se prueban aquí;
// guardar y leer tocan el navegador y se comprueban en la prueba de humo.
require('../js/persistencia/archivo.js');
// elision.js vive en vista/ pero es cálculo puro: no toca el DOM.
require('../js/vista/elision.js');

module.exports = window.CC2;
