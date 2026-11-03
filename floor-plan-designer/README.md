# Floor Plan Designer — 32′ × 50′ Double-Storey House (Faisalabad)

An interactive, dependency-free architectural planning tool for a 32 ft × 50 ft (1,600 sq ft)
rectangular plot with road access from the front. Open `index.html` directly in a browser —
it works from `file://` and offline (no build step, no CDN).

> Conceptual layouts only. Not construction-ready or structurally certified — verify with a
> licensed architect, a structural engineer and the applicable FDA/LDA building by-laws.

## Features

- **Two concepts** — Option A (efficient rectangular block) and Option B (L-shaped around a side courtyard).
- **Ground / First / Both / 3D** views. 3D is a lightweight canvas massing model built from the same geometry.
- **Dimensioned SVG drawings**: plot dimensions, grid chain dimensions, clear room sizes in feet-inches,
  9″ external / 4½″ internal walls, doors with swing arcs, windows, ventilators, sliding doors, gates,
  furniture, kitchen counters, bathroom fixtures, conceptual column positions, north arrow, road, title block, scale bar.
- **U-shaped staircase**: 18 risers × 7″ (10′-6″ floor-to-floor), 10″ treads, 2R+T = 24″, half landing,
  UP/DN arrows, cut line, identical well on both floors, entered directly from the car porch so the
  first floor can work as an independent unit.
- **Room selection** shows width, length, clear area, centre-line size and attached-bath info.
- **Dimension editing** moves the shared grid line on both floors, so neighbours, walls and the stair stay coordinated.
- **Layer toggles**: furniture, dimensions, walls/openings, columns, labels. Road orientation (N/E/S/W) rotates the north arrow.
- **Export**: ground-floor SVG, first-floor SVG, complete PNG (both floors), 2-page A3 PDF, print.
- **Validation**: plot size, rooms/walls/furniture inside plot, overlaps, minimum sizes, door/window placement
  (corners, party walls, swing collisions), furniture vs walls and door swings, daylight/ventilation,
  reachability from the road gate, free floor area, staircase geometry and floor-to-floor alignment.

## Coordinate system

All model geometry is in feet: origin at the rear-left plot corner, `x` across the 32′ frontage,
`y` toward the road. Drawings use **12 SVG units per foot (1 unit = 1 inch)**, so the plot is exactly
384 × 600 units. Rooms are rectangles on wall centre-lines; walls are generated from room adjacency
(boundary walls are laid fully inside the plot line).

## Structure

| File | Purpose |
| --- | --- |
| `js/core.js` | Geometry model: walls, openings, clear rectangles, furniture placement, stair geometry, columns, grid editing |
| `js/layouts.js` | Option A and B room/door/window/furniture definitions for both floors |
| `js/validate.js` | Architectural validation checks |
| `js/furniture.js` | Furniture & fixture symbols |
| `js/render.js` | Self-contained SVG renderer (screen, export, print) |
| `js/view3d.js` | Canvas 3D massing view |
| `js/export.js` | SVG / PNG / PDF / print export (built-in minimal PDF writer) |
| `js/app.js` | UI controller |

## Tests

```bash
node tests/validate-layouts.js          # headless model validation (exit 1 on any error)
NODE_PATH=$(npm root -g) node tests/e2e.js   # Playwright browser test incl. exports (writes tests/out/)
```
