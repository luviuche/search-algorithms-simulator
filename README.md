# CC2 Search Algorithms Simulator

**An interactive, step-by-step simulator of search algorithms and data structures, built for the course _Ciencias de la Computación II_ (Systems Engineering, Universidad Distrital Francisco José de Caldas, Bogotá).**

> 🚧 **Work in progress.** Every search topic in the menu is built and usable; the graphs unit is listed in the menu as "in development" (see [Roadmap](#roadmap)).

In class, a search algorithm is usually explained on a whiteboard, one frame at a time. This simulator makes that explanation reproducible. You create a data structure, insert keys, then search for or delete them, and **watch the algorithm walk through the structure one step at a time**. A counter keeps track of every comparison and every access.

Deleting a key is taught as the same lesson as searching for it: the key is first located with the topic's own algorithm, and only then removed.

The user interface is in **Spanish**, the language of the course.

![Inserting key 1028 into a hash table with quadratic probing: the side panel works out the address and each probe, and the key lands in cell 1](docs/captura.png)

---

## What you can do

- **Create a structure** by choosing its size `n` and key length `l`. Some topics also ask for extra parameters, such as the collision strategy or the digit positions to truncate.
- **Insert, search and delete keys.** Each operation becomes a trace that plays back like a video: play, pause, step forward, step back, and change the speed.
- **See the whole calculation, not just the result.** In the hashing topics, a side panel works out each address line by line (`7412 mod 10 = 2`, `2 + 1 = 3`). The same panel lists every probe that a collision strategy makes (`9 + 2² = 13 − 12 → 1`).
- **Compare costs.** Live counters show comparisons, accesses, load factor or tree height, so two algorithms can be run on the same keys and compared.
- **Read the log.** Every step is written to a timestamped log in plain language.
- **Work with large structures.** A structure with 100 or more cells is drawn with the elided parts collapsed (`1 ⋯ 15 ⋯ 21 ⋯ 100`), the way it is drawn on the board. The drawing stays readable on a projector.
- **Save and reopen your work** as `.cc2` files. A file can also be opened in a different topic, where the same keys are placed again with that topic's rules.
- **Fill a structure automatically** to prepare an example quickly.

## Topics

### Internal searches

| Topic | Status |
|---|---|
| Sequential search | ✅ |
| Binary search, with each narrowing of the range shown as its own row | ✅ |
| Hashing: modulo, mid-square, truncation, folding and base conversion | ✅ |
| Collision handling: linear probing, quadratic probing, double hashing, nested arrays and separate chaining | ✅ |
| Digital search trees, radix search tries and multiple-radix tries | ✅ |
| Huffman trees, with the code table and the average bits per symbol | ✅ |

### External searches

| Topic | Status |
|---|---|
| External sequential search, with the file read block by block | ✅ |
| Primary, secondary and multilevel indexes | ✅ |
| Dynamic hashing (buckets) with total and partial expansion and reduction | ✅ |
| External binary search, halving the range of blocks and then the rows of the one left | ✅ |

### Graphs

| Topic | Status |
|---|---|
| Definitions, traversals, Euler and Hamilton circuits, spanning trees (Prim, Kruskal), cut sets, matrix representation, coloring, matchings | 🚧 Planned |

## Running it

There is nothing to install and nothing to build. The app is plain HTML, CSS and JavaScript, and runs straight from the file system.

```bash
git clone https://github.com/luviuche/simulador-busquedas-cc2.git
cd simulador-busquedas-cc2
# open index.html in any modern browser (Chrome, Edge, Firefox, Brave…)
```

It is meant to work when opened with `file://`, without a server, so it can be copied onto a USB stick and used on any classroom computer.

## Tests

The domain and algorithm logic is covered by unit tests that run on Node's built-in test runner. They need no dependencies.

```bash
npm test
```

A browser smoke test (`pruebas/humo.html`) also drives the real interface through the DOM. It checks the drawing, the layout at several window heights, and the playback controls.

## How it is built

- **Vanilla JavaScript, no frameworks, no build step.** Scripts are loaded as classic `<script>` tags, because browsers block ES modules on `file://`.
- **Algorithms never touch the screen.** Each algorithm only produces a *trace*, a list of steps, each with the changes it makes to the structure. The view replays that trace. This is what makes stepping backwards reliable: the structure is rebuilt from its starting state up to the current step.
- **Layers:** `js/dominio` holds the structures and their rules, `js/algoritmos` produces the traces, `js/vista` draws and animates them, and `js/persistencia` saves and loads `.cc2` files.
- **Animation is the product.** Keys move with FLIP transitions, steps can be interrupted, and `prefers-reduced-motion` is respected.
- **Color carries meaning.** Every algorithm state has its own color, and always a second cue that does not depend on color (a mark, a dashed border, a bracket). This keeps it readable on a projector and for color-blind students.

The design decisions, the professor's rules for each topic, and the reasons behind them are documented in Spanish in [`docs/CLAUDE.md`](docs/CLAUDE.md).

## Roadmap

- The graphs unit.
- Printable/PDF export of a session: the structure, the log and the metrics.

## Author

Developed by [**luviuche**](https://github.com/luviuche) as a course project for _Ciencias de la Computación II_, with the rules of each algorithm taken from the professor's lectures and worked examples.
