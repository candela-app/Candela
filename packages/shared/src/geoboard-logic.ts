import {
  AlphabetVariant,
  GeoboardBoardId,
  GeoboardProtocol,
  GeoboardTrialMetric,
  GeoboardHalfFieldScore,
  GeoboardSessionResultData,
  GeoboardStimulusType,
  GeoboardMatrixTier,
  GeoboardComplexityTier,
  GeoboardTransform,
} from './types';

export interface GeoboardPattern {
  id: string;
  name: string;
  stimulusType: 'patterns' | 'alphabets' | 'numbers';
  complexityTier: GeoboardComplexityTier;
  segments: Array<[number, number]>;
  /** Letter case, only set on alphabet patterns. */
  variant?: AlphabetVariant;
  /**
   * Beginner board only: `copy` keeps the reference visible; `recall` flashes it
   * then hides it so the patient draws on their own.
   */
  task?: 'copy' | 'recall';
}

// 5x5 Grid representation:
// Row 0: 0,  1,  2,  3,  4
// Row 1: 5,  6,  7,  8,  9
// Row 2: 10, 11, 12, 13, 14
// Row 3: 15, 16, 17, 18, 19
// Row 4: 20, 21, 22, 23, 24
//
// Lowercase letters use a three-zone layout because there are only 5 rows:
// row 0 = ascender, rows 1-3 = x-height (baseline at row 3), row 4 = descender.

export const GEOBOARD_PATTERNS: GeoboardPattern[] = [
  // --- STAND AND STEEP (Board 06, first level) ---
  // Reference stays on row 0 (steep / horizontal) or column 0 (standing / vertical).
  { id: 'ss_copy_h', name: 'Steep Line — Practice', stimulusType: 'patterns', complexityTier: 1, task: 'copy', segments: [[0, 4]] },
  { id: 'ss_copy_v', name: 'Standing Line — Practice', stimulusType: 'patterns', complexityTier: 1, task: 'copy', segments: [[0, 20]] },
  { id: 'ss_copy_h_top', name: 'Top Steep Line — Practice', stimulusType: 'patterns', complexityTier: 1, task: 'copy', segments: [[0, 4]] },
  { id: 'ss_copy_v_left', name: 'Left Standing Line — Practice', stimulusType: 'patterns', complexityTier: 1, task: 'copy', segments: [[0, 20]] },
  { id: 'ss_copy_h_short', name: 'Short Steep Line — Practice', stimulusType: 'patterns', complexityTier: 1, task: 'copy', segments: [[0, 2]] },
  { id: 'ss_copy_v_short', name: 'Short Standing Line — Practice', stimulusType: 'patterns', complexityTier: 1, task: 'copy', segments: [[0, 10]] },
  { id: 'ss_own_h', name: 'Steep Line — On Your Own', stimulusType: 'patterns', complexityTier: 1, task: 'recall', segments: [[0, 4]] },
  { id: 'ss_own_v', name: 'Standing Line — On Your Own', stimulusType: 'patterns', complexityTier: 1, task: 'recall', segments: [[0, 20]] },
  { id: 'ss_own_h_bot', name: 'Bottom Steep Line — On Your Own', stimulusType: 'patterns', complexityTier: 1, task: 'recall', segments: [[0, 4]] },
  { id: 'ss_own_v_right', name: 'Right Standing Line — On Your Own', stimulusType: 'patterns', complexityTier: 1, task: 'recall', segments: [[0, 20]] },

  // --- SIMPLE LINES (Board 01) ---
  { id: 'p_horiz_line', name: 'Horizontal Line', stimulusType: 'patterns', complexityTier: 1, segments: [[10, 14]] },
  { id: 'p_vert_line', name: 'Vertical Line', stimulusType: 'patterns', complexityTier: 1, segments: [[2, 22]] },
  { id: 'p_top_line', name: 'Top Edge Line', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 4]] },
  { id: 'p_left_line', name: 'Left Edge Line', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 20]] },
  { id: 'p_short_horiz', name: 'Short Horizontal', stimulusType: 'patterns', complexityTier: 1, segments: [[10, 12]] },
  { id: 'p_short_vert', name: 'Short Vertical', stimulusType: 'patterns', complexityTier: 1, segments: [[2, 12]] },
  { id: 'p_diag_down', name: 'Diagonal Down', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 24]] },
  { id: 'p_diag_up', name: 'Diagonal Up', stimulusType: 'patterns', complexityTier: 1, segments: [[4, 20]] },
  { id: 'p_parallel_lines', name: 'Parallel Verticals', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 20], [4, 24]] },
  { id: 'p_parallel_horiz', name: 'Parallel Horizontals', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 4], [20, 24]] },
  { id: 'p_right_angle', name: 'Right Angle', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 4], [4, 24]] },
  { id: 'p_three_verticals', name: 'Three Verticals', stimulusType: 'patterns', complexityTier: 1, segments: [[0, 20], [2, 22], [4, 24]] },

  // --- GEOMETRIC SHAPES (Board 03) ---
  { id: 'p_square', name: 'Square', stimulusType: 'patterns', complexityTier: 2, segments: [[0, 4], [0, 20], [4, 24], [20, 24]] },
  { id: 'p_rectangle', name: 'Rectangle', stimulusType: 'patterns', complexityTier: 2, segments: [[0, 4], [0, 10], [4, 14], [10, 14]] },
  { id: 'p_triangle', name: 'Triangle', stimulusType: 'patterns', complexityTier: 2, segments: [[2, 20], [2, 24], [20, 24]] },
  { id: 'p_diamond', name: 'Diamond', stimulusType: 'patterns', complexityTier: 2, segments: [[2, 10], [2, 14], [10, 22], [14, 22]] },
  { id: 'p_trapezoid', name: 'Trapezoid', stimulusType: 'patterns', complexityTier: 2, segments: [[1, 3], [1, 20], [3, 24], [20, 24]] },
  { id: 'p_pentagon', name: 'Pentagon', stimulusType: 'patterns', complexityTier: 3, segments: [[2, 10], [2, 14], [10, 20], [14, 24], [20, 24]] },
  { id: 'p_cross', name: 'Cross', stimulusType: 'patterns', complexityTier: 3, segments: [[2, 22], [10, 14]] },
  { id: 'p_x_cross', name: 'X-Cross', stimulusType: 'patterns', complexityTier: 3, segments: [[0, 24], [4, 20]] },
  { id: 'p_hourglass', name: 'Hourglass', stimulusType: 'patterns', complexityTier: 3, segments: [[0, 4], [0, 24], [4, 20], [20, 24]] },
  { id: 'p_chevron', name: 'Chevron', stimulusType: 'patterns', complexityTier: 3, segments: [[10, 2], [2, 14]] },

  // --- COMPOUND FIGURES (Board 05) ---
  { id: 'p_arrow', name: 'Arrow', stimulusType: 'patterns', complexityTier: 3, segments: [[10, 14], [8, 14], [14, 18]] },
  { id: 'p_house', name: 'House', stimulusType: 'patterns', complexityTier: 4, segments: [[20, 0], [0, 4], [4, 24], [24, 20], [0, 2], [2, 4]] },
  { id: 'p_envelope', name: 'Envelope', stimulusType: 'patterns', complexityTier: 4, segments: [[20, 0], [0, 4], [4, 24], [24, 20], [0, 12], [4, 12]] },
  { id: 'p_star', name: 'Five-Point Star', stimulusType: 'patterns', complexityTier: 4, segments: [[20, 2], [2, 24], [24, 10], [10, 14], [14, 20]] },
  { id: 'p_double_square', name: 'Double Square', stimulusType: 'patterns', complexityTier: 4, segments: [[0, 2], [0, 10], [2, 12], [10, 12], [12, 14], [12, 22], [14, 24], [22, 24]] },
  { id: 'p_boxed_x', name: 'Boxed X', stimulusType: 'patterns', complexityTier: 4, segments: [[0, 4], [0, 20], [4, 24], [20, 24], [0, 24], [4, 20]] },
  { id: 'p_asterisk', name: 'Asterisk', stimulusType: 'patterns', complexityTier: 4, segments: [[2, 22], [10, 14], [0, 24], [4, 20]] },
  { id: 'p_kite', name: 'Kite', stimulusType: 'patterns', complexityTier: 4, segments: [[2, 10], [2, 14], [10, 22], [14, 22], [10, 14]] },

  // --- ALPHABETS: UPPERCASE (Board 02) ---
  { id: 'a_A', name: 'Letter A', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[2, 20], [2, 24], [11, 13]] },
  { id: 'a_B', name: 'Letter B', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 20], [0, 2], [2, 12], [10, 12], [12, 22], [20, 22]] },
  { id: 'a_C', name: 'Letter C', stimulusType: 'alphabets', complexityTier: 2, variant: 'uppercase', segments: [[0, 4], [0, 20], [20, 24]] },
  { id: 'a_D', name: 'Letter D', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[0, 20], [0, 2], [2, 14], [14, 22], [20, 22]] },
  { id: 'a_E', name: 'Letter E', stimulusType: 'alphabets', complexityTier: 2, variant: 'uppercase', segments: [[0, 20], [0, 4], [10, 12], [20, 24]] },
  { id: 'a_F', name: 'Letter F', stimulusType: 'alphabets', complexityTier: 2, variant: 'uppercase', segments: [[0, 20], [0, 4], [10, 12]] },
  { id: 'a_G', name: 'Letter G', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 4], [0, 20], [20, 24], [14, 24], [12, 14]] },
  { id: 'a_H', name: 'Letter H', stimulusType: 'alphabets', complexityTier: 2, variant: 'uppercase', segments: [[0, 20], [4, 24], [10, 14]] },
  { id: 'a_I', name: 'Letter I', stimulusType: 'alphabets', complexityTier: 1, variant: 'uppercase', segments: [[2, 22], [0, 4], [20, 24]] },
  { id: 'a_J', name: 'Letter J', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[1, 3], [3, 23], [21, 23], [16, 21]] },
  { id: 'a_K', name: 'Letter K', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 20], [10, 4], [10, 24]] },
  { id: 'a_L', name: 'Letter L', stimulusType: 'alphabets', complexityTier: 1, variant: 'uppercase', segments: [[0, 20], [20, 24]] },
  { id: 'a_M', name: 'Letter M', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 20], [0, 12], [4, 12], [4, 24]] },
  { id: 'a_N', name: 'Letter N', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[0, 20], [0, 24], [4, 24]] },
  { id: 'a_O', name: 'Letter O', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[1, 3], [3, 9], [9, 19], [19, 23], [21, 23], [15, 21], [5, 15], [1, 5]] },
  { id: 'a_P', name: 'Letter P', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[0, 20], [0, 2], [2, 12], [10, 12]] },
  { id: 'a_Q', name: 'Letter Q', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 4], [0, 20], [4, 24], [20, 24], [18, 24]] },
  { id: 'a_R', name: 'Letter R', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 20], [0, 2], [2, 12], [10, 12], [12, 24]] },
  { id: 'a_S', name: 'Letter S', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 4], [0, 10], [10, 14], [14, 24], [20, 24]] },
  { id: 'a_T', name: 'Letter T', stimulusType: 'alphabets', complexityTier: 1, variant: 'uppercase', segments: [[0, 4], [2, 22]] },
  { id: 'a_U', name: 'Letter U', stimulusType: 'alphabets', complexityTier: 2, variant: 'uppercase', segments: [[0, 20], [20, 24], [4, 24]] },
  { id: 'a_V', name: 'Letter V', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[0, 22], [4, 22]] },
  { id: 'a_W', name: 'Letter W', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 20], [20, 12], [4, 24], [12, 24]] },
  { id: 'a_X', name: 'Letter X', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[0, 24], [4, 20]] },
  { id: 'a_Y', name: 'Letter Y', stimulusType: 'alphabets', complexityTier: 4, variant: 'uppercase', segments: [[0, 12], [4, 12], [12, 22]] },
  { id: 'a_Z', name: 'Letter Z', stimulusType: 'alphabets', complexityTier: 3, variant: 'uppercase', segments: [[0, 4], [4, 20], [20, 24]] },

  // --- ALPHABETS: LOWERCASE (Board 02) ---
  // a, e, s and g are omitted: their curves collapse into unreadable shapes on a 5x5 grid.
  { id: 'al_b', name: 'Letter b', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[0, 15], [10, 12], [12, 17], [15, 17]] },
  { id: 'al_c', name: 'Letter c', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 12], [10, 15], [15, 17]] },
  { id: 'al_d', name: 'Letter d', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[2, 17], [10, 12], [10, 15], [15, 17]] },
  { id: 'al_f', name: 'Letter f', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[1, 2], [1, 16], [10, 12]] },
  { id: 'al_h', name: 'Letter h', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[0, 15], [10, 12], [12, 17]] },
  { id: 'al_i', name: 'Letter i', stimulusType: 'alphabets', complexityTier: 1, variant: 'lowercase', segments: [[1, 6], [11, 16]] },
  { id: 'al_j', name: 'Letter j', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[3, 8], [13, 23], [21, 23]] },
  { id: 'al_k', name: 'Letter k', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[0, 15], [7, 10], [10, 17]] },
  { id: 'al_l', name: 'Letter l', stimulusType: 'alphabets', complexityTier: 1, variant: 'lowercase', segments: [[0, 15]] },
  { id: 'al_m', name: 'Letter m', stimulusType: 'alphabets', complexityTier: 4, variant: 'lowercase', segments: [[10, 15], [10, 14], [12, 17], [14, 19]] },
  { id: 'al_n', name: 'Letter n', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 15], [10, 12], [12, 17]] },
  { id: 'al_o', name: 'Letter o', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 12], [10, 15], [12, 17], [15, 17]] },
  { id: 'al_p', name: 'Letter p', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[10, 20], [10, 12], [12, 17], [15, 17]] },
  { id: 'al_q', name: 'Letter q', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[12, 22], [10, 12], [10, 15], [15, 17]] },
  { id: 'al_r', name: 'Letter r', stimulusType: 'alphabets', complexityTier: 1, variant: 'lowercase', segments: [[10, 15], [10, 12]] },
  { id: 'al_t', name: 'Letter t', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[1, 16], [5, 7]] },
  { id: 'al_u', name: 'Letter u', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 15], [15, 17], [12, 17]] },
  { id: 'al_v', name: 'Letter v', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 16], [12, 16]] },
  { id: 'al_w', name: 'Letter w', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[10, 16], [12, 16], [12, 18], [14, 18]] },
  { id: 'al_x', name: 'Letter x', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 17], [12, 15]] },
  { id: 'al_y', name: 'Letter y', stimulusType: 'alphabets', complexityTier: 3, variant: 'lowercase', segments: [[10, 16], [12, 16], [16, 21]] },
  { id: 'al_z', name: 'Letter z', stimulusType: 'alphabets', complexityTier: 2, variant: 'lowercase', segments: [[10, 12], [12, 15], [15, 17]] },

  // --- NUMBERS (Board 04) ---
  { id: 'n_0', name: 'Number 0', stimulusType: 'numbers', complexityTier: 4, segments: [[0, 4], [0, 20], [4, 24], [20, 24]] },
  { id: 'n_1', name: 'Number 1', stimulusType: 'numbers', complexityTier: 1, segments: [[2, 22], [1, 2]] },
  { id: 'n_2', name: 'Number 2', stimulusType: 'numbers', complexityTier: 3, segments: [[0, 4], [4, 14], [10, 14], [10, 20], [20, 24]] },
  { id: 'n_3', name: 'Number 3', stimulusType: 'numbers', complexityTier: 3, segments: [[0, 4], [4, 12], [10, 12], [12, 24], [20, 24]] },
  { id: 'n_4', name: 'Number 4', stimulusType: 'numbers', complexityTier: 2, segments: [[0, 10], [10, 14], [2, 22]] },
  { id: 'n_5', name: 'Number 5', stimulusType: 'numbers', complexityTier: 3, segments: [[0, 4], [0, 10], [10, 14], [14, 24], [20, 24]] },
  { id: 'n_6', name: 'Number 6', stimulusType: 'numbers', complexityTier: 4, segments: [[0, 4], [0, 20], [20, 24], [24, 14], [10, 14], [10, 20]] },
  { id: 'n_7', name: 'Number 7', stimulusType: 'numbers', complexityTier: 1, segments: [[0, 4], [4, 22]] },
  { id: 'n_8', name: 'Number 8', stimulusType: 'numbers', complexityTier: 4, segments: [[0, 4], [0, 20], [4, 24], [20, 24], [10, 14]] },
  { id: 'n_9', name: 'Number 9', stimulusType: 'numbers', complexityTier: 4, segments: [[0, 4], [0, 10], [10, 14], [4, 14], [14, 24]] },
];

/**
 * Decomposes a segment connecting idx1 and idx2 into unit collinear pieces.
 * For example, on a 5x5 grid, a line from (0,0) [idx 0] to (2,0) [idx 2]
 * is split into [0,1] and [1,2].
 */
export function decomposeSegment(
  idx1: number,
  idx2: number,
  width: number = 5,
  height: number = 5
): Array<[number, number]> {
  const x1 = idx1 % width;
  const y1 = Math.floor(idx1 / width);
  const x2 = idx2 % width;
  const y2 = Math.floor(idx2 / width);

  const collinearIndices: number[] = [];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  for (let idx3 = 0; idx3 < width * height; idx3++) {
    if (idx3 === idx1 || idx3 === idx2) continue;
    const x3 = idx3 % width;
    const y3 = Math.floor(idx3 / width);

    // Coordinate must be within bounding box
    if (x3 < minX || x3 > maxX || y3 < minY || y3 > maxY) continue;

    // Collinear check: (y3 - y1) * (x2 - x1) === (y2 - y1) * (x3 - x1)
    if ((y3 - y1) * (x2 - x1) === (y2 - y1) * (x3 - x1)) {
      collinearIndices.push(idx3);
    }
  }

  // Sort by Euclidean distance from idx1
  collinearIndices.sort((a, b) => {
    const ax = a % width;
    const ay = Math.floor(a / width);
    const bx = b % width;
    const by = Math.floor(b / width);

    const distA = (ax - x1) ** 2 + (ay - y1) ** 2;
    const distB = (bx - x1) ** 2 + (by - y1) ** 2;
    return distA - distB;
  });

  const allPoints = [idx1, ...collinearIndices, idx2];
  const subSegments: Array<[number, number]> = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const p1 = allPoints[i];
    const p2 = allPoints[i + 1];
    subSegments.push([Math.min(p1, p2), Math.max(p1, p2)]);
  }

  return subSegments;
}

/**
 * Breaks all segments in a pattern into unit segments, deduplicates, and sorts them.
 */
export function normalizePatternSegments(
  segments: Array<[number, number]>,
  width: number = 5,
  height: number = 5
): Array<[number, number]> {
  const uniqueSegmentsMap = new Map<string, [number, number]>();

  for (const [s, e] of segments) {
    const decomposed = decomposeSegment(s, e, width, height);
    for (const [ds, de] of decomposed) {
      const key = `${ds}-${de}`;
      uniqueSegmentsMap.set(key, [ds, de]);
    }
  }

  const result = Array.from(uniqueSegmentsMap.values());
  result.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  return result;
}

/**
 * Transforms a single dot index on a width x height grid.
 */
export function transformDotIndex(
  idx: number,
  transform: GeoboardTransform,
  width: number = 5,
  height: number = 5
): number {
  const col = idx % width;
  const row = Math.floor(idx / width);

  let newCol = col;
  let newRow = row;

  switch (transform) {
    case 'duplicate':
      break;
    case 'flip_h':
      newCol = (width - 1) - col;
      break;
    case 'flip_v':
      newRow = (height - 1) - row;
      break;
    case 'rotate_90_r':
      newCol = (height - 1) - row;
      newRow = col;
      break;
    case 'rotate_90_l':
      newCol = row;
      newRow = (width - 1) - col;
      break;
  }

  return newRow * width + newCol;
}

/**
 * Transforms all segments in a pattern and returns the sorted, normalized result.
 */
export function applyTransformToPattern(
  segments: Array<[number, number]>,
  transform: GeoboardTransform,
  width: number = 5,
  height: number = 5
): Array<[number, number]> {
  const transformed = segments.map(([s, e]) => {
    const ts = transformDotIndex(s, transform, width, height);
    const te = transformDotIndex(e, transform, width, height);
    return [Math.min(ts, te), Math.max(ts, te)] as [number, number];
  });
  return normalizePatternSegments(transformed, width, height);
}

/**
 * Returns an array of visible dots, hiding missing ones (matrix tier logic).
 * Ensures that pattern endpoints/vertices are never hidden.
 */
export function getGeoboardGridDots(
  patternSegments: Array<[number, number]>,
  matrixTier: GeoboardMatrixTier,
  width: number = 5,
  height: number = 5
): boolean[] {
  const activeDots = new Array(width * height).fill(true);

  let numDotsToRemove = 0;
  switch (matrixTier) {
    case 1: numDotsToRemove = 0; break;
    case 2: numDotsToRemove = 8; break;
    case 3: numDotsToRemove = 12; break;
    case 4: numDotsToRemove = 16; break;
    case 5: numDotsToRemove = 20; break;
  }

  if (numDotsToRemove === 0) {
    return activeDots;
  }

  // Find all vertices in the reference pattern (and any collinear dots along them)
  const patternVertices = new Set<number>();
  for (const [s, e] of patternSegments) {
    const decomposed = decomposeSegment(s, e, width, height);
    for (const [ds, de] of decomposed) {
      patternVertices.add(ds);
      patternVertices.add(de);
    }
  }

  // Candidates for removal: dots that are NOT in patternVertices
  const candidates: number[] = [];
  for (let idx = 0; idx < width * height; idx++) {
    if (!patternVertices.has(idx)) {
      candidates.push(idx);
    }
  }

  // Shuffle candidates to pick which to remove
  const toRemoveCount = Math.min(numDotsToRemove, candidates.length);
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let i = 0; i < toRemoveCount; i++) {
    activeDots[shuffled[i]] = false;
  }

  return activeDots;
}

export interface EvaluationResult {
  correct: boolean;
  errorType: 'none' | 'wrong-dot' | 'wrong-shape' | 'incomplete';
}

/**
 * Checks correctness of drawn segments against target pattern segments.
 */
export function evaluateDrawing(
  drawnSegments: Array<[number, number]>,
  targetSegments: Array<[number, number]>,
  width: number = 5,
  height: number = 5
): EvaluationResult {
  const normDrawn = normalizePatternSegments(drawnSegments, width, height);
  const normTarget = normalizePatternSegments(targetSegments, width, height);

  const drawnKeys = new Set(normDrawn.map(([s, e]) => `${s}-${e}`));
  const targetKeys = new Set(normTarget.map(([s, e]) => `${s}-${e}`));

  if (drawnKeys.size === 0) {
    return { correct: false, errorType: 'incomplete' };
  }

  let allDrawnInTarget = true;
  drawnKeys.forEach((key) => {
    if (!targetKeys.has(key)) {
      allDrawnInTarget = false;
    }
  });

  let allTargetInDrawn = true;
  targetKeys.forEach((key) => {
    if (!drawnKeys.has(key)) {
      allTargetInDrawn = false;
    }
  });

  if (allDrawnInTarget && allTargetInDrawn) {
    return { correct: true, errorType: 'none' };
  }

  if (!allDrawnInTarget) {
    // Check if drawn segments connect to dots outside the target pattern vertices
    const targetVertices = new Set<number>();
    normTarget.forEach(([s, e]) => {
      targetVertices.add(s);
      targetVertices.add(e);
    });

    let usesWrongDot = false;
    normDrawn.forEach(([s, e]) => {
      if (!targetKeys.has(`${s}-${e}`)) {
        if (!targetVertices.has(s) || !targetVertices.has(e)) {
          usesWrongDot = true;
        }
      }
    });

    if (usesWrongDot) {
      return { correct: false, errorType: 'wrong-dot' };
    } else {
      return { correct: false, errorType: 'wrong-shape' };
    }
  }

  // Draw is subset of target but incomplete
  return { correct: false, errorType: 'incomplete' };
}

/**
 * Pins a beginner reference to the first row (steep) or first column (standing).
 */
export function snapBeginnerReferenceToFirstAxis(
  segments: Array<[number, number]>,
  width: number = 5,
): Array<[number, number]> {
  return segments.map(([a, b]) => {
    const orient = segmentOrientation(a, b, width);
    if (orient === 'h') {
      const startCol = Math.min(a % width, b % width);
      const endCol = Math.max(a % width, b % width);
      return [startCol, endCol];
    }
    if (orient === 'v') {
      const startRow = Math.min(Math.floor(a / width), Math.floor(b / width));
      const endRow = Math.max(Math.floor(a / width), Math.floor(b / width));
      return [startRow * width, endRow * width];
    }
    return [a, b];
  });
}

function segmentOrientation(a: number, b: number, width: number): 'h' | 'v' | 'other' {
  const rowA = Math.floor(a / width);
  const rowB = Math.floor(b / width);
  const colA = a % width;
  const colB = b % width;
  if (rowA === rowB && colA !== colB) return 'h';
  if (colA === colB && rowA !== rowB) return 'v';
  return 'other';
}

/**
 * Stand and Steep: the guide is one full first-row (steep) or first-column
 * (standing) line. Progress requires every remaining row or column to be
 * drawn in full as well.
 */
export function evaluateBeginnerPractice(
  drawnSegments: Array<[number, number]>,
  referenceSegments: Array<[number, number]>,
  width: number = 5,
  height: number = 5
): EvaluationResult {
  const refUnits = normalizePatternSegments(referenceSegments, width, height);
  if (refUnits.length === 0) return { correct: false, errorType: 'incomplete' };
  const want = segmentOrientation(refUnits[0][0], refUnits[0][1], width);
  if (want === 'other') return evaluateDrawing(drawnSegments, referenceSegments, width, height);

  const drawnUnits = normalizePatternSegments(drawnSegments, width, height);
  const merged = normalizePatternSegments([...referenceSegments, ...drawnSegments], width, height);
  const needed = want === 'h' ? height : width;
  const complete = countCompleteLines(merged, want, width, height);

  if (complete >= needed) return { correct: true, errorType: 'none' };

  const practiceUnits = drawnUnits.filter(([start, end]) => segmentOrientation(start, end, width) === want);
  if (practiceUnits.length === 0) {
    return { correct: false, errorType: drawnUnits.length === 0 ? 'incomplete' : 'wrong-shape' };
  }
  return { correct: false, errorType: 'incomplete' };
}

function countCompleteLines(
  units: Array<[number, number]>,
  want: 'h' | 'v',
  width: number,
  height: number,
): number {
  let complete = 0;
  if (want === 'h') {
    for (let row = 0; row < height; row += 1) {
      const segs = units.filter(
        ([a, b]) => Math.floor(a / width) === row && Math.floor(b / width) === row,
      );
      if (segs.length >= width - 1) complete += 1;
    }
    return complete;
  }
  for (let col = 0; col < width; col += 1) {
    const segs = units.filter(([a, b]) => a % width === col && b % width === col);
    if (segs.length >= height - 1) complete += 1;
  }
  return complete;
}

export interface DifficultyProgressResult {
  nextComplexity: GeoboardComplexityTier;
  nextMatrix: GeoboardMatrixTier;
  transformUnlocked: boolean;
  shouldShowMasteryPrompt: boolean;
}

/**
 * Clinical auto-progression algorithm.
 * Gated behind rolling accuracy band (~70-80% to level up, <50-60% to level down).
 */
export function geoboardDifficultyProgression(
  trialHistory: GeoboardTrialMetric[],
  currentComplexity: GeoboardComplexityTier,
  currentMatrix: GeoboardMatrixTier,
  rollingWindow: number = 4
): DifficultyProgressResult {
  let nextComplexity = currentComplexity;
  let nextMatrix = currentMatrix;
  let shouldShowMasteryPrompt = false;

  // Filter history for current configuration or look at recent session history
  if (trialHistory.length >= rollingWindow) {
    const recent = trialHistory.slice(-rollingWindow);
    const correctCount = recent.filter((t) => t.correct).length;
    const accuracy = correctCount / rollingWindow;

    if (accuracy >= 0.75) {
      // Advance a lagging axis, keeping them balanced
      if (nextComplexity < 4 && nextComplexity <= nextMatrix) {
        nextComplexity = (nextComplexity + 1) as GeoboardComplexityTier;
      } else if (nextMatrix < 5) {
        nextMatrix = (nextMatrix + 1) as GeoboardMatrixTier;
      }
    } else if (accuracy < 0.5) {
      // Demote a leading axis
      if (nextComplexity > 1 && nextComplexity >= nextMatrix) {
        nextComplexity = (nextComplexity - 1) as GeoboardComplexityTier;
      } else if (nextMatrix > 1) {
        nextMatrix = (nextMatrix - 1) as GeoboardMatrixTier;
      }
    }
  }

  // Early mastery check: 3 consecutive correct trials at the *current* level
  if (trialHistory.length >= 3) {
    const last3 = trialHistory.slice(-3);
    const all3Correct = last3.every(
      (t) => t.correct && t.complexityTier === currentComplexity && t.matrixTier === currentMatrix
    );
    if (all3Correct) {
      shouldShowMasteryPrompt = true;
    }
  }

  // Transforms unlocked when patient reaches at least Complexity Tier 3 and Matrix Tier 3
  const transformUnlocked = currentComplexity >= 3 && currentMatrix >= 3;

  return {
    nextComplexity,
    nextMatrix,
    transformUnlocked,
    shouldShowMasteryPrompt,
  };
}

/**
 * Utility to filter and fetch patterns by stimulus type and complexity.
 */
export function getPatternsByStimulus(
  type: GeoboardStimulusType,
  complexityTier?: GeoboardComplexityTier
): GeoboardPattern[] {
  let filtered = GEOBOARD_PATTERNS;

  if (type !== 'random') {
    filtered = GEOBOARD_PATTERNS.filter((p) => p.stimulusType === type);
  }

  if (complexityTier !== undefined) {
    filtered = filtered.filter((p) => p.complexityTier === complexityTier);
  }

  return filtered;
}

export function getPatternById(id: string): GeoboardPattern | undefined {
  return GEOBOARD_PATTERNS.find((p) => p.id === id);
}

// ============================================================
// BOARD DEFINITIONS
// ============================================================

export interface GeoboardBoardDefinition {
  id: GeoboardBoardId;
  name: string;
  shortLabel: string;
  description: string;
  focus: string;
  stimulusType: GeoboardStimulusType;
  /** Board 02 swaps its playlist based on the clinician's letter-case choice. */
  supportsLetterCase: boolean;
  patternIds: string[];
  patternIdsLowercase?: string[];
  /** Copy-then-recall horizontal/vertical lines; locks transform and matrix. */
  guidedBeginner?: boolean;
}

export const GEOBOARD_BOARDS: Record<GeoboardBoardId, GeoboardBoardDefinition> = {
  6: {
    id: 6,
    name: 'Board 01 — Stand and Steep',
    shortLabel: 'Stand and Steep',
    description: 'Copy a standing (vertical) or steep (horizontal) reference line, then draw it on your own.',
    focus: 'First-level line practice: reference copy, then independent drawing',
    stimulusType: 'patterns',
    supportsLetterCase: false,
    guidedBeginner: true,
    patternIds: [
      'ss_copy_h',
      'ss_copy_v',
      'ss_own_h',
      'ss_own_v',
    ],
  },
  1: {
    id: 1,
    name: 'Board 02 — Simple Lines',
    shortLabel: 'Lines',
    description: 'Single strokes, parallels and right angles.',
    focus: 'Dot targeting & straight-line motor control',
    stimulusType: 'patterns',
    supportsLetterCase: false,
    patternIds: [
      'p_short_horiz',
      'p_horiz_line',
      'p_top_line',
      'p_short_vert',
      'p_vert_line',
      'p_left_line',
      'p_diag_down',
      'p_diag_up',
      'p_right_angle',
      'p_parallel_horiz',
      'p_parallel_lines',
      'p_three_verticals',
    ],
  },
  2: {
    id: 2,
    name: 'Board 03 — Alphabets',
    shortLabel: 'Alphabets',
    description: 'Full letter set, uppercase or lowercase.',
    focus: 'Letter form reproduction & orthographic mapping',
    stimulusType: 'alphabets',
    supportsLetterCase: true,
    patternIds: [
      'a_A', 'a_B', 'a_C', 'a_D', 'a_E', 'a_F', 'a_G', 'a_H', 'a_I',
      'a_J', 'a_K', 'a_L', 'a_M', 'a_N', 'a_O', 'a_P', 'a_Q', 'a_R',
      'a_S', 'a_T', 'a_U', 'a_V', 'a_W', 'a_X', 'a_Y', 'a_Z',
    ],
    patternIdsLowercase: [
      'al_b', 'al_c', 'al_d', 'al_f', 'al_h', 'al_i', 'al_j', 'al_k',
      'al_l', 'al_m', 'al_n', 'al_o', 'al_p', 'al_q', 'al_r', 'al_t',
      'al_u', 'al_v', 'al_w', 'al_x', 'al_y', 'al_z',
    ],
  },
  3: {
    id: 3,
    name: 'Board 04 — Geometric Shapes',
    shortLabel: 'Shapes',
    description: 'Closed figures, diagonals and angled forms.',
    focus: 'Closure, angle & vertex planning',
    stimulusType: 'patterns',
    supportsLetterCase: false,
    patternIds: [
      'p_square',
      'p_rectangle',
      'p_triangle',
      'p_diamond',
      'p_trapezoid',
      'p_pentagon',
      'p_cross',
      'p_x_cross',
      'p_chevron',
      'p_hourglass',
    ],
  },
  4: {
    id: 4,
    name: 'Board 05 — Numbers',
    shortLabel: 'Numbers',
    description: 'Digits 0 through 9 in sequence.',
    focus: 'Numeral form reproduction & sequencing',
    stimulusType: 'numbers',
    supportsLetterCase: false,
    patternIds: ['n_0', 'n_1', 'n_2', 'n_3', 'n_4', 'n_5', 'n_6', 'n_7', 'n_8', 'n_9'],
  },
  5: {
    id: 5,
    name: 'Board 06 — Compound Figures',
    shortLabel: 'Compound',
    description: 'Multi-segment figures with nested detail.',
    focus: 'Sequential planning & sustained spatial attention',
    stimulusType: 'patterns',
    supportsLetterCase: false,
    patternIds: [
      'p_arrow',
      'p_kite',
      'p_house',
      'p_envelope',
      'p_boxed_x',
      'p_asterisk',
      'p_star',
      'p_double_square',
    ],
  },
};

export const STAND_AND_STEEP_BOARD_ID: GeoboardBoardId = 6;

/** Display order: beginner lines first, then the original boards. */
export const GEOBOARD_BOARD_IDS: GeoboardBoardId[] = [6, 1, 2, 3, 4, 5];

export function isBeginnerLineBoard(boardId: GeoboardBoardId): boolean {
  return GEOBOARD_BOARDS[boardId]?.guidedBeginner === true;
}

export function patternStartsWithMemorize(pattern: GeoboardPattern | null | undefined, memoryMode: boolean): boolean {
  if (pattern?.task === 'copy' || pattern?.task === 'recall') return false;
  return memoryMode;
}

export function patternShowsModel(
  pattern: GeoboardPattern | null | undefined,
  memoryMode: boolean,
  gameState: string,
): boolean {
  if (pattern?.task === 'copy' || pattern?.task === 'recall') return true;
  return !memoryMode || gameState === 'memorize';
}

export function lockBeginnerGeoboardProtocol<T extends { transform: string; matrixTier: number; memoryMode: boolean }>(
  protocol: T,
  boardId: GeoboardBoardId,
): T {
  if (!isBeginnerLineBoard(boardId)) return protocol;
  return { ...protocol, transform: 'duplicate', matrixTier: 1, memoryMode: false };
}

/**
 * Resolves a board's ordered playlist. Board 02 honours the letter-case setting;
 * every other board ignores it.
 */
export function getBoardPatterns(
  boardId: GeoboardBoardId,
  variant: AlphabetVariant = 'uppercase'
): GeoboardPattern[] {
  const board = GEOBOARD_BOARDS[boardId];
  if (!board) return [];

  const ids =
    board.supportsLetterCase && variant === 'lowercase' && board.patternIdsLowercase
      ? board.patternIdsLowercase
      : board.patternIds;

  return ids
    .map((id) => getPatternById(id))
    .filter((p): p is GeoboardPattern => Boolean(p))
    .map((pattern) =>
      board.guidedBeginner
        ? { ...pattern, segments: snapBeginnerReferenceToFirstAxis(pattern.segments) }
        : pattern,
    );
}

// ============================================================
// FREEHAND DRAWING — SNAP TO DOT
// ============================================================

export interface GeoboardDotPosition {
  index: number;
  /** Percent of container width. */
  x: number;
  /** Percent of container height. */
  y: number;
}

/**
 * Dot centres as percentages, so renderers stay resolution independent.
 */
export function getGeoboardDotPositions(width: number = 5, height: number = 5): GeoboardDotPosition[] {
  const dots: GeoboardDotPosition[] = [];
  const stepX = 100 / width;
  const stepY = 100 / height;

  for (let idx = 0; idx < width * height; idx++) {
    const col = idx % width;
    const row = Math.floor(idx / width);
    dots.push({
      index: idx,
      x: col * stepX + stepX / 2,
      y: row * stepY + stepY / 2,
    });
  }

  return dots;
}

/**
 * Finds the dot under a pointer position, used while dragging a freehand stroke.
 * Coordinates and snapRadius are percentages of the grid box.
 * Hidden dots (matrix tier removal) are not selectable.
 */
export function findNearestGeoboardDot(
  xPercent: number,
  yPercent: number,
  visibleDots?: boolean[],
  snapRadiusPercent: number = 9,
  width: number = 5,
  height: number = 5
): number | null {
  const dots = getGeoboardDotPositions(width, height);
  let bestIndex: number | null = null;
  let bestDistance = Infinity;

  for (const dot of dots) {
    if (visibleDots && visibleDots[dot.index] === false) continue;

    const dx = dot.x - xPercent;
    const dy = dot.y - yPercent;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= snapRadiusPercent && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = dot.index;
    }
  }

  return bestIndex;
}

export interface SegmentToggleResult {
  segments: Array<[number, number]>;
  action: 'added' | 'removed' | 'invalid';
}

/**
 * Adds a connection between two dots, or removes it when it already exists.
 */
export function toggleGeoboardSegment(
  segments: Array<[number, number]>,
  dotA: number,
  dotB: number
): SegmentToggleResult {
  if (dotA === dotB) {
    return { segments, action: 'invalid' };
  }

  const seg: [number, number] = [Math.min(dotA, dotB), Math.max(dotA, dotB)];
  const existingIdx = segments.findIndex(([s, e]) => s === seg[0] && e === seg[1]);

  if (existingIdx >= 0) {
    return {
      segments: segments.filter((_, idx) => idx !== existingIdx),
      action: 'removed',
    };
  }

  return { segments: [...segments, seg], action: 'added' };
}

// ============================================================
// METRICS
// ============================================================

/**
 * Splits the target pattern by screen half and reports how much of each half the
 * patient reproduced. A persistent gap on one side can indicate hemifield neglect.
 * Segments centred on the midline are excluded from both halves.
 */
export function evaluateHalfFieldAccuracy(
  drawnSegments: Array<[number, number]>,
  targetSegments: Array<[number, number]>,
  width: number = 5,
  height: number = 5
): GeoboardHalfFieldScore {
  const normDrawn = normalizePatternSegments(drawnSegments, width, height);
  const normTarget = normalizePatternSegments(targetSegments, width, height);
  const drawnKeys = new Set(normDrawn.map(([s, e]) => `${s}-${e}`));

  const midline = (width - 1) / 2;
  const score: GeoboardHalfFieldScore = {
    leftMatched: 0,
    leftTotal: 0,
    rightMatched: 0,
    rightTotal: 0,
  };

  for (const [s, e] of normTarget) {
    const midCol = ((s % width) + (e % width)) / 2;
    const matched = drawnKeys.has(`${s}-${e}`);

    if (midCol < midline) {
      score.leftTotal += 1;
      if (matched) score.leftMatched += 1;
    } else if (midCol > midline) {
      score.rightTotal += 1;
      if (matched) score.rightMatched += 1;
    }
  }

  return score;
}

/**
 * 1-5 stars for the child-facing results card.
 */
export function getGeoboardStarRating(accuracyPercent: number): number {
  if (accuracyPercent >= 90) return 5;
  if (accuracyPercent >= 75) return 4;
  if (accuracyPercent >= 60) return 3;
  if (accuracyPercent >= 40) return 2;
  return 1;
}

/**
 * Blends the stimulus colour toward the background to model Weber contrast.
 * Applying opacity to the whole grid instead would also fade the background and
 * dots, which is not what a contrast sensitivity setting should measure.
 */
export function getContrastAdjustedColor(
  shapeColor: string,
  bgColor: string,
  contrast: number
): string {
  const parse = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '');
    const full =
      clean.length === 3
        ? clean.split('').map((c) => c + c).join('')
        : clean.padEnd(6, '0');
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };

  const clamped = Math.max(0, Math.min(1, contrast));
  const [sr, sg, sb] = parse(shapeColor);
  const [br, bg, bb] = parse(bgColor);

  const mix = (s: number, b: number) => Math.round(b + (s - b) * clamped);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');

  return `#${toHex(mix(sr, br))}${toHex(mix(sg, bg))}${toHex(mix(sb, bb))}`;
}

/** Current on-board peg diameter is the maximum. Scale down from here to shrink. */
export const GEOBOARD_PEG_SIZE_MAX_FRACTION = 0.07;
export const GEOBOARD_PEG_SIZE_MIN_PX = 6;

export const GEOBOARD_PEG_SIZE_PRESETS: ReadonlyArray<{ id: string; label: string; scale: number }> = [
  { id: 'small', label: 'Small', scale: 0.4 },
  { id: 'medium', label: 'Medium', scale: 0.58 },
  { id: 'large', label: 'Large', scale: 0.78 },
  { id: 'max', label: 'Max', scale: 1 },
];

export function clampGeoboardPegSizeScale(scale?: number): number {
  if (typeof scale !== 'number' || Number.isNaN(scale)) return 1;
  return Math.min(1, Math.max(0.4, scale));
}

/** Pixel diameter for a peg. `scale` 1 keeps today's size; smaller values shrink. */
export function geoboardPegPixelSize(boardMinEdge: number, scale = 1): number {
  const maxSize = Math.max(12, Math.round(boardMinEdge * GEOBOARD_PEG_SIZE_MAX_FRACTION));
  return Math.max(
    GEOBOARD_PEG_SIZE_MIN_PX,
    Math.round(maxSize * clampGeoboardPegSizeScale(scale)),
  );
}

/**
 * Named pen colours offered as one-tap presets. Each is separated from the
 * default navy board on both luminance and hue, and the set spans long-,
 * medium- and short-wavelength options so a pen can be picked that stays
 * visible for a given colour vision deficiency. Any other colour remains
 * selectable through the free picker.
 */
export const GEOBOARD_PEN_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Amber', hex: '#FBBF24' },
  { name: 'Coral', hex: '#FB7185' },
  { name: 'Lime', hex: '#A3E635' },
  { name: 'Cyan', hex: '#22D3EE' },
  { name: 'Violet', hex: '#C084FC' },
  { name: 'White', hex: '#F8FAFC' },
];

/** Resolves a hex to its preset name, or 'Custom' for a free-picked colour. */
export function getPenColorName(hex: string): string {
  const match = GEOBOARD_PEN_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.trim().toLowerCase()
  );
  return match ? match.name : 'Custom';
}
