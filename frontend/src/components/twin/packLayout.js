/**
 * packLayout.js: ILLUSTRATIVE pack geometry.
 *
 * The CellTriage API reports pack-level values per session (SOC, voltage, spreads)
 * and does not expose individual cells, nor the real module/cell layout of a vehicle.
 * These 12 equal blocks are therefore a symbolic battery pack, not the vehicle's real
 * construction, and no value is assigned to any single module or cell.
 */
export const MODULE_COLS = 4
export const MODULE_ROWS = 3
export const MODULE_COUNT = MODULE_COLS * MODULE_ROWS

export const MODULE_W = 3.5
export const MODULE_D = 1.85
export const MODULE_H = 1.05
export const TRAY_H = 0.14
const GAP = 0.5

export const PACK_W = MODULE_COLS * MODULE_W + (MODULE_COLS - 1) * GAP
export const PACK_D = MODULE_ROWS * MODULE_D + (MODULE_ROWS - 1) * GAP

export function buildModules() {
  const out = []
  for (let r = 0; r < MODULE_ROWS; r += 1) {
    for (let c = 0; c < MODULE_COLS; c += 1) {
      out.push({
        index: r * MODULE_COLS + c + 1,
        position: [(c - (MODULE_COLS - 1) / 2) * (MODULE_W + GAP), 0, (r - (MODULE_ROWS - 1) / 2) * (MODULE_D + GAP)],
      })
    }
  }
  return out
}

export const PALETTE = {
  light: { fill: '#C0452B', shell: '#D8BDB5', tray: '#C9C6BD', edge: '#8F5B4F' },
  dark: { fill: '#E2674B', shell: '#5A423D', tray: '#3B3F37', edge: '#B98578' },
}
