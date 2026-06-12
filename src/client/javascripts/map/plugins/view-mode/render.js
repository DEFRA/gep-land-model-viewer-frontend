import { VIEW_MODES } from './constants.js'

const MODES = [
  { id: VIEW_MODES.MAP, label: 'Map view' },
  { id: VIEW_MODES.GRID, label: 'Grid view' },
  { id: VIEW_MODES.FEATURE, label: 'Feature view' }
]

export const MODE_LABELS = Object.fromEntries(MODES.map(m => [m.id, m.label]))

export function renderViewModePanelHtml (activeMode) {
  const items = MODES.map(mode => renderOption(mode, activeMode === mode.id)).join('')
  return `<ul class="app-map__view-mode" role="group" aria-label="Map view mode">${items}</ul>`
}

function renderOption (mode, pressed) {
  const attrs = [
    'type="button"',
    'class="app-map__view-mode-option"',
    `data-app-view-mode="${mode.id}"`,
    `aria-pressed="${pressed}"`
  ]
  return `<li class="app-map__view-mode-item"><button ${attrs.join(' ')}>${mode.label}</button></li>`
}
