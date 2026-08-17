export const GOVUK_BLUE = '#1d70b8'
export const GOVUK_DARK_GREY = '#505a5f'
export const DEFRA_GREEN = '#008531'
export const DEFRA_GREEN_DARK = '#006a27'

/** rgba() string for a '#rrggbb' palette colour at the given opacity */
export function withAlpha (hexColour, alpha) {
  const r = Number.parseInt(hexColour.slice(1, 3), 16)
  const g = Number.parseInt(hexColour.slice(3, 5), 16)
  const b = Number.parseInt(hexColour.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
