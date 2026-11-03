/*
 * Layout definitions. All values in feet, model space (see core.js):
 *   r: [x0, y0, x1, y1]  room rectangle on wall centre-lines (y0 = rear side, y1 = road side)
 *   open: doors / windows relative to a room edge (side n = rear, s = front, w = left, e = right)
 *         at = offset from the edge start (west end for n/s, rear end for w/e), 'c' = centred,
 *         ['end', n] = n ft from the far end
 *   furn: furniture relative to the room's clear (inside-wall) rectangle — see core.placeFurniture
 *
 * Both floors share one structural grid: editing a room dimension moves the grid line on
 * every floor, so walls, columns and the staircase stay vertically coordinated.
 */
(function (FP) {
  'use strict';

  const op = (kind) => (side, at, w, hinge, swing) => ({ kind, side, at, w, hinge, swing });
  const D = op('door'), D2 = op('door2'), W = op('win'), V = op('vent'), O = op('open'), S = op('slide'), G = op('gate');
  const F = (k, side, at, w, d, extra) => Object.assign({ k, side, at, w, d }, extra || {});
  const R = (id, name, type, r, extra) => Object.assign({ id, name, type, r, open: [], furn: [] }, extra || {});
  const clone = (room, over) => Object.assign(JSON.parse(JSON.stringify(room)), over || {});

  /* Floor-to-floor 10'-6" = 18 risers x 7"; 10" treads; 2R+T = 24". */
  const STAIR = { risers: 18, riser: 7, tread: 10, floorH: 126, slab: 5, gap: 0.33, start: 'n', width: 'auto' };

  /* ----------------------------------------------------------- shared rooms */

  const bedSet = (side, at, bedW, extra) => F('bedSet', side, at, bedW + 3.2, 6.6, Object.assign({ bedW }, extra));

  /* =========================================================== OPTION A ====
   * Efficient rectangular block. Full-width rear court, 3-room rear band,
   * central lounge, front car porch + front stair hall with its own porch door.
   */
  const A_GF = [
    R('court', 'Rear Open Court', 'court', [0, 0, 32, 4], {
      furn: [F('planter', 'n', 1.5, 8, 1.4), F('planter', 'n', ['end', 1.5], 8, 1.4)],
    }),
    R('mbed', 'Master Bedroom', 'bed', [0, 4, 13, 17], {
      attached: 'mbath',
      open: [D('s', 9.75, 3, 'end'), W('n', 1.5, 5)],
      furn: [bedSet('w', 'c', 6), F('wardrobe', 'n', ['end', 0], 4.5, 2), F('dresser', 's', 1.2, 3.5, 1.5)],
    }),
    R('mbath', 'Master Bath', 'bath', [13, 4, 18.5, 9.5], {
      open: [D('w', 2.5, 2.5, 'end'), V('n', 'c', 2)],
      furn: [F('shower', 'n', ['end', 0], 2.6, 3), F('basin', 'n', 0.3, 1.8, 1.4), F('wc', 'e', ['end', 0.2], 1.6, 2.3)],
    }),
    R('shaft', 'Vent Shaft', 'shaft', [13, 9.5, 18.5, 12]),
    R('bath2', 'Bath 2', 'bath', [13, 12, 18.5, 17], {
      open: [D('s', ['end', 0.25], 2.5, 'end'), V('n', 'c', 2)],
      furn: [F('wc', 'w', ['end', 0.2], 1.6, 2.3), F('basin', 'w', 0.3, 1.8, 1.4), F('shower', 'n', ['end', 0], 2.8, 2)],
    }),
    R('bed2', 'Bedroom 2', 'bed', [18.5, 4, 32, 17], {
      open: [D('s', 0.3, 3, 'start'), W('n', 'c', 5)],
      furn: [bedSet('e', 'c', 6), F('wardrobe', 'w', 0.3, 5, 2), F('dresser', 's', ['end', 0.5], 3.5, 1.5)],
    }),
    R('dining', 'Dining', 'dining', [0, 17, 9.5, 24], {
      open: [O('e', 'c', 5), O('s', 2.9, 4)],
      furn: [F('dining', 'c', [0.42, 0.5], 5.4, 4.4)],
    }),
    R('kitchen', 'Kitchen', 'kitchen', [0, 24, 9.5, 32], {
      open: [D('s', ['end', 0.35], 2.75, 'end', 'in'), W('s', 2.3, 3)],
      furn: [
        F('counter', 'w', 0, 'full', 2, { hob: 0.45 }),
        F('counter', 's', 2.0, 3.6, 2, { sink: 0.5 }),
        F('fridge', 'e', 0.3, 2.4, 2.3),
      ],
    }),
    R('lounge', 'TV Lounge', 'living', [9.5, 17, 22, 32], {
      open: [W('e', 10.3, 2.4), D('s', 2.9, 3, 'start')],
      furn: [
        F('tv', 'w', ['end', 1.5], 5, 1.3),
        F('rug', 'c', [0.55, 0.72], 6, 5),
        F('sofa', 'e', ['end', 0.3], 6.5, 3),
        F('coffee', 'e', ['end', 1.6], 4, 2, { inset: 3.6 }),
      ],
    }),
    R('bed3', 'Bedroom 3', 'bed', [22, 17, 32, 27], {
      open: [D('w', 1.2, 2.75, 'start'), W('s', 'c', 4)],
      furn: [bedSet('e', ['end', 0.2], 5, { d: 6.3 }), F('wardrobe', 'w', ['end', 0.2], 4, 2)],
    }),
    R('lcourt', 'Light Court', 'court', [22, 27, 32, 30], { furn: [F('planter', 'c', [0.5, 0.5], 6, 1.2)] }),
    R('laundry', 'Laundry', 'laundry', [22, 30, 26, 35], {
      open: [S('w', 2.25, 2.5), V('n', 'c', 2)],
      furn: [F('wm', 'n', ['end', 0], 2.2, 2.2), F('utilsink', 'e', ['end', 0.2], 1.8, 1.6)],
    }),
    R('powder', 'Guest Toilet', 'bath', [26, 30, 32, 35], {
      open: [D('s', 0.5, 2.5, 'start'), V('n', 'c', 1.5)],
      furn: [F('wc', 'e', 0.3, 1.6, 2.3), F('basin', 'n', 0.3, 1.8, 1.3)],
    }),
    R('porch', 'Car Porch', 'porch', [0, 32, 12, 50], {
      open: [G('s', 0.75, 10)],
      furn: [F('car', 'c', [0.5, 0.55], 6, 15), F('plant', 'n', ['end', 0.2], 1.6, 1.6)],
    }),
    R('stair', 'Staircase', 'stair', [12, 32, 22, 47], {
      open: [D('w', 0.3, 2.75, 'start'), W('s', 'c', 3)],
    }),
    R('drawing', 'Drawing Room', 'drawing', [22, 35, 32, 47], {
      open: [D2('s', 0.6, 4), W('s', ['end', 0.8], 4)],
      furn: [
        F('sofa', 'e', 'c', 7, 3),
        F('sofa', 'w', 'c', 5, 2.8),
        F('coffee', 'c', [0.5, 0.48], 2, 4),
        F('side', 'n', ['end', 0.2], 1.6, 1.6, { inset: 0.2 }),
      ],
    }),
    R('lawn', 'Front Lawn', 'lawn', [12, 47, 32, 50], {
      open: [G('s', 1, 3.5)],
      furn: [F('planter', 's', ['end', 0.4], 9, 1.2)],
    }),
  ];

  const byId = (list) => Object.fromEntries(list.map((r) => [r.id, r]));
  const a = byId(A_GF);

  const A_FF = [
    R('court', 'Rear Court (open below)', 'court', [0, 0, 32, 4]),
    clone(a.mbed), clone(a.mbath), clone(a.shaft), clone(a.bath2), clone(a.bed2),
    clone(a.dining),
    clone(a.kitchen, { id: 'kitchen', name: 'Kitchenette' }),
    clone(a.lounge, { name: 'Family Lounge' }),
    R('study', 'Study / Prayer', 'study', [22, 17, 32, 27], {
      open: [D('w', 1.2, 2.75, 'start'), W('s', 'c', 4)],
      furn: [
        F('desk', 'e', 'c', 4.5, 2),
        F('shelf', 'n', ['end', 0.3], 4, 1.2),
        F('sofa', 'w', ['end', 0.3], 5, 2.8),
        F('mat', 'c', [0.45, 0.45], 2.2, 4),
      ],
    }),
    R('lcourt', 'Light Court (open below)', 'court', [22, 27, 32, 30]),
    R('passage', 'Passage + Laundry', 'laundry', [22, 30, 26, 35], {
      open: [O('w', 2.25, 2.5), V('n', 'c', 2)],
      furn: [F('wm', 'n', ['end', 0], 2.2, 2.2)],
    }),
    R('bath3', 'Bath 3', 'bath', [26, 30, 32, 35], {
      open: [D('s', 0.4, 2.5, 'end'), V('n', 'c', 1.5)],
      furn: [F('wc', 'e', ['end', 0.3], 1.6, 2.3), F('shower', 'n', ['end', 0], 2.6, 1.9), F('basin', 'n', 0.3, 1.8, 1.3)],
    }),
    R('terrace', 'Open Terrace', 'terrace', [0, 32, 12, 50], {
      furn: [F('outdoor', 'c', [0.5, 0.55], 4.5, 4.5), F('planter', 's', 'c', 8, 1.2), F('plant', 'n', ['end', 0.4], 1.6, 1.6)],
    }),
    clone(a.stair, { open: [D('w', 0.3, 2.75, 'start'), W('s', 'c', 3)] }),
    R('bed3', 'Bedroom 3', 'bed', [22, 35, 32, 47], {
      attached: 'bath3',
      open: [D('n', 0.4, 2.75, 'start'), S('s', 0.3, 2.5), W('s', ['end', 0.8], 4)],
      furn: [bedSet('e', ['end', 0.2], 5), F('wardrobe', 'n', ['end', 0.2], 4.5, 2)],
    }),
    R('balcony', 'Balcony', 'balcony', [12, 47, 32, 50], { furn: [F('planter', 's', ['end', 0.4], 6, 1.0)] }),
  ];

  /* =========================================================== OPTION B ====
   * L-shaped block wrapped around a side courtyard. The lounge opens onto the
   * courtyard with full-height sliding glazing; kitchen, laundry and bedroom 3
   * share a ventilation shaft; stair hall again opens directly off the porch.
   */
  const B_GF = [
    R('court', 'Rear Open Court', 'court', [0, 0, 32, 3], {
      furn: [F('planter', 'n', 1.5, 9, 1.2), F('planter', 'n', ['end', 1.5], 9, 1.2)],
    }),
    R('mbed', 'Master Bedroom', 'bed', [0, 3, 13.5, 16], {
      attached: 'mbath',
      open: [D('s', 10.25, 3, 'end'), W('n', 1.5, 5), W('s', 2.5, 5)],
      furn: [bedSet('w', 'c', 6), F('wardrobe', 'n', ['end', 0], 4.5, 2), F('dresser', 'e', ['end', 3.6], 3.5, 1.5)],
    }),
    R('mbath', 'Master Bath', 'bath', [13.5, 3, 18.5, 9.5], {
      open: [D('w', ['end', 0.25], 2.5, 'end'), V('n', 'c', 2)],
      furn: [F('shower', 'n', ['end', 0], 2.4, 2.6), F('basin', 'n', 0.2, 1.6, 1.3), F('wc', 'e', ['end', 0.2], 1.6, 2.1)],
    }),
    R('bath2', 'Bath 2', 'bath', [13.5, 9.5, 18.5, 16], {
      open: [D('s', ['end', 0.25], 2.5, 'end')],
      furn: [F('wc', 'w', ['end', 0.2], 1.6, 2.0), F('basin', 'w', 0.3, 1.8, 1.4), F('shower', 'n', ['end', 0], 2.6, 2.6)],
    }),
    R('bed2', 'Bedroom 2', 'bed', [18.5, 3, 32, 16], {
      open: [D('s', 0.3, 3, 'start'), W('n', 'c', 5)],
      furn: [bedSet('e', 'c', 6), F('wardrobe', 'w', 0.3, 5, 2), F('desk', 's', 3.4, 3.2, 1.6)],
    }),
    R('courtyard', 'Courtyard', 'court', [0, 16, 10, 29], {
      furn: [F('outdoor', 'c', [0.5, 0.45], 4.5, 4.5), F('planter', 'w', 'c', 7, 1.4), F('plant', 'n', ['end', 0.4], 1.6, 1.6)],
    }),
    R('porch', 'Car Porch', 'porch', [0, 29, 10, 50], {
      open: [G('s', 0.5, 9)],
      furn: [F('car', 'c', [0.5, 0.56], 6, 15)],
    }),
    R('lounge', 'TV Lounge + Dining', 'living', [10, 16, 22, 32], {
      open: [S('w', 1.5, 7), D('s', 4, 3, 'end', 'out')],
      furn: [
        F('dining', 'c', [0.58, 0.3], 5.4, 4.4),
        F('sofa', 'w', ['end', 0.4], 6, 3),
        F('coffee', 'w', ['end', 1.4], 3.4, 2, { inset: 3.6 }),
        F('tv', 'e', 8.4, 3.5, 1.3),
        F('rug', 'w', ['end', 0.6], 5.4, 6, { inset: 0.6 }),
      ],
    }),
    R('kitchen', 'Kitchen', 'kitchen', [22, 16, 32, 25], {
      open: [O('w', 4.5, 4), W('s', 5.5, 3)],
      furn: [
        F('counter', 'e', 0, 'full', 2, { hob: 0.4 }),
        F('counter', 's', ['end', 2.0], 3.75, 2, { sink: 0.55 }),
        F('fridge', 'n', 0.3, 2.4, 2.3),
      ],
    }),
    R('laundry', 'Laundry', 'laundry', [22, 25, 27, 28], {
      open: [S('n', 0.5, 2.5), V('e', 'c', 1.5)],
      furn: [F('wm', 'w', 'c', 2.2, 2.2), F('utilsink', 's', ['end', 0.2], 1.6, 1.4)],
    }),
    R('shaft', 'Vent Shaft', 'shaft', [27, 25, 32, 28]),
    R('bed3', 'Bedroom 3', 'bed', [22, 28, 32, 37.5], {
      open: [D('w', 0.6, 2.75, 'start'), W('n', ['end', 0.9], 3)],
      furn: [bedSet('e', ['end', 0.2], 4.5, { d: 6.3 }), F('wardrobe', 'w', ['end', 0.2], 3.5, 2)],
    }),
    R('stair', 'Staircase', 'stair', [10, 32, 18, 47.5], {
      open: [D('w', 0.3, 2.75, 'start'), W('s', 'c', 3)],
    }),
    R('powder', 'Guest Toilet', 'bath', [18, 32, 22, 37.5], {
      open: [D('s', 0.4, 2.4, 'start')],
      furn: [F('wc', 'n', ['end', 0.2], 1.6, 2.3), F('basin', 'w', 0.4, 1.6, 1.2)],
    }),
    R('drawing', 'Drawing Room', 'drawing', [18, 37.5, 32, 47.5], {
      open: [D2('s', 0.6, 4), W('s', ['end', 0.8], 4)],
      furn: [
        F('sofa', 'n', 2, 7, 3),
        F('sofa', 'e', 'c', 5, 2.8),
        F('armchair', 'w', ['end', 2.6], 2.6, 2.6),
        F('coffee', 'c', [0.48, 0.55], 4, 2),
      ],
    }),
    R('lawn', 'Front Lawn', 'lawn', [10, 47.5, 32, 50], {
      open: [G('s', 0.8, 3.5)],
      furn: [F('planter', 's', ['end', 0.4], 10, 1.2)],
    }),
  ];

  const b = byId(B_GF);

  const B_FF = [
    R('court', 'Rear Court (open below)', 'court', [0, 0, 32, 3]),
    clone(b.mbed), clone(b.mbath), clone(b.bath2), clone(b.bed2),
    R('courtyard', 'Courtyard (open below)', 'court', [0, 16, 10, 29]),
    R('terrace', 'Open Terrace', 'terrace', [0, 29, 10, 50], {
      furn: [F('outdoor', 'c', [0.5, 0.35], 4.5, 4.5), F('planter', 's', 'c', 7, 1.2), F('plant', 'e', 0.4, 1.6, 1.6)],
    }),
    R('lounge', 'Family Lounge', 'living', [10, 16, 22, 32], {
      open: [W('w', 1.5, 7), D('s', 4, 3, 'end', 'out')],
      furn: [
        F('dining', 'c', [0.58, 0.3], 5.4, 4.4),
        F('sofa', 'w', ['end', 0.4], 6, 3),
        F('coffee', 'w', ['end', 1.4], 3.4, 2, { inset: 3.6 }),
        F('tv', 'e', 8.4, 3.5, 1.3),
        F('rug', 'w', ['end', 0.6], 5.4, 6, { inset: 0.6 }),
      ],
    }),
    clone(b.kitchen, { name: 'Kitchenette' }),
    clone(b.laundry), clone(b.shaft), clone(b.bed3),
    clone(b.stair),
    R('passage', 'Passage', 'lobby', [18, 32, 22, 37.5], {
      open: [O('w', 0.4, 3), D('s', 0.4, 2.75, 'start')],
      furn: [F('shelf', 'e', 0.2, 2, 1)],
    }),
    R('study', 'Family Sitting / Study', 'study', [18, 37.5, 32, 47.5], {
      open: [S('s', 0.6, 5), W('s', ['end', 0.8], 4)],
      furn: [F('sofa', 'n', 2, 6.5, 3), F('desk', 'e', ['end', 3.6], 4, 2), F('shelf', 'w', ['end', 0.3], 4, 1.2), F('coffee', 'c', [0.4, 0.55], 3.5, 2)],
    }),
    R('balcony', 'Balcony', 'balcony', [10, 47.5, 32, 50], { furn: [F('planter', 's', ['end', 0.4], 8, 1.0)] }),
  ];

  FP.LAYOUTS = {
    A: {
      id: 'A',
      name: 'Option A — Efficient Rectangular',
      short: 'Rectangular',
      summary: 'Compact rectangular block. Rear court + internal light court ventilate every bedroom; the stair hall opens directly off the car porch so the first floor can run as an independent unit.',
      stair: Object.assign({}, STAIR),
      floors: [
        { level: 0, name: 'Ground Floor', short: 'GF', rooms: A_GF },
        { level: 1, name: 'First Floor', short: 'FF', rooms: A_FF },
      ],
    },
    B: {
      id: 'B',
      name: 'Option B — L-Shaped Courtyard',
      short: 'L-shaped',
      summary: 'Built form wraps an L around a side courtyard next to the car porch. Lounge and master bedroom open to the courtyard; kitchen, laundry and bedroom 3 share a ventilation shaft.',
      stair: Object.assign({}, STAIR),
      floors: [
        { level: 0, name: 'Ground Floor', short: 'GF', rooms: B_GF },
        { level: 1, name: 'First Floor', short: 'FF', rooms: B_FF },
      ],
    },
  };
})(globalThis.FP = globalThis.FP || {});
