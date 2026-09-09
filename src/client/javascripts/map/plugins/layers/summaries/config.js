import { FEATURE_VISIBLE_MIN_ZOOM } from './feature/constants.js'
import { GRID_VISIBLE_MIN_ZOOM } from './grid/constants.js'
import { DEFRA_GREEN_DARK, GOVUK_DARK_GREY, withAlpha } from '../../../config/colours.js'

const FEATURE_STROKE_OPACITY = 0.6

export const GRID_SUMMARY = {
  id: 'grid',
  label: 'Grid squares',
  minZoom: GRID_VISIBLE_MIN_ZOOM,
  symbol: {
    type: 'line',
    colour: GOVUK_DARK_GREY,
    width: 1,
    directions: ['right', 'bottom']
  }
}

export const FEATURE_SUMMARY = {
  id: 'features',
  label: 'OS features',
  minZoom: FEATURE_VISIBLE_MIN_ZOOM,
  symbol: {
    type: 'line',
    colour: withAlpha(DEFRA_GREEN_DARK, FEATURE_STROKE_OPACITY),
    width: 1.5,
    directions: ['bottom']
  }
}

export const SUMMARIES = [
  GRID_SUMMARY,
  FEATURE_SUMMARY
]
