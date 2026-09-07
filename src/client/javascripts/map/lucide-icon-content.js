import { buildLucideSvg } from '@lucide/icons/build'

const CLOSING_TAG = '</svg>'

export function lucideIconContent (icon) {
  const svg = buildLucideSvg(icon)
  return svg.slice(svg.indexOf('>') + 1, -CLOSING_TAG.length)
}
