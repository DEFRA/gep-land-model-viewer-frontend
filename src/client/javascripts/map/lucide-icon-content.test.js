import InfoIcon from '@lucide/icons/icons/info'
import { describe, expect, test } from 'vitest'
import { lucideIconContent } from './lucide-icon-content.js'

describe('lucideIconContent', () => {
  test('returns the contents of the generated SVG', () => {
    const content = lucideIconContent(InfoIcon)

    expect(content.startsWith('<circle')).toBe(true)
    expect(content).not.toContain('<svg')
    expect(content).not.toContain('</svg>')
  })
})
