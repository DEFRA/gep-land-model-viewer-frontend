import { VIEW_MODES } from './constants.js'

const MODES = [
  { id: VIEW_MODES.MAP, label: 'Map view' },
  { id: VIEW_MODES.GRID, label: 'Grid view' },
  { id: VIEW_MODES.FEATURE, label: 'Feature view', disabled: true }
]

export const MODE_LABELS = Object.fromEntries(MODES.map(m => [m.id, m.label]))

export function renderViewModePanelHtml (activeMode) {
  const items = MODES.map(mode => renderOption(mode, activeMode === mode.id)).join('')
  return `<ul class="app-view-mode" role="group" aria-label="Map view mode">${items}</ul>`
}

function renderOption (mode, pressed) {
  const attrs = [
    'type="button"',
    'class="app-view-mode__option"',
    `data-app-view-mode="${mode.id}"`,
    `aria-pressed="${pressed}"`
  ]
  if (mode.disabled) {
    attrs.push('aria-disabled="true"', 'tabindex="-1"')
  }
  return `<li class="app-view-mode__item"><button ${attrs.join(' ')}>${mode.label}</button></li>`
}
