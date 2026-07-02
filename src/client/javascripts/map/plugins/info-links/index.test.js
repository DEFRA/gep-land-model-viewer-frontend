import { describe, test, expect } from 'vitest'
import { createInfoLinksPlugin } from './index.js'

describe('#createInfoLinksPlugin', () => {
  test('returns a plugin with expected id', () => {
    const plugin = createInfoLinksPlugin()
    expect(plugin.id).toBe('gepInfoLinks')
  })

  test('load returns a button in right-bottom slot', async () => {
    const plugin = createInfoLinksPlugin()
    const { buttons } = await plugin.load()
    expect(buttons).toHaveLength(1)
    expect(buttons[0].desktop.slot).toBe('right-bottom')
    expect(buttons[0].label).toBe('Page information')
  })

  test('load returns a panel with info links HTML', async () => {
    const plugin = createInfoLinksPlugin()
    const { panels } = await plugin.load()
    expect(panels).toHaveLength(1)
    expect(panels[0].html).toContain('/accessibility-statement')
  })
})
