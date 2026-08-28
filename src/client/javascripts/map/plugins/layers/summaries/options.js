import { FEATURE_VISIBLE_MIN_ZOOM } from './feature/constants.js'
import { GRID_VISIBLE_MIN_ZOOM } from './grid/constants.js'

export const SUMMARY_TOGGLES = [
  { id: 'grid', label: 'Grid squares', minZoom: GRID_VISIBLE_MIN_ZOOM },
  { id: 'features', label: 'OS features', minZoom: FEATURE_VISIBLE_MIN_ZOOM }
]
