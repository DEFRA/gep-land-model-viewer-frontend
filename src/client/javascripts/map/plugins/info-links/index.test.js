import { describe, test, expect } from 'vitest'
import createPlugin from './index.js'

describe('info links plugin', () => {
  test('registers under a fixed id that options cannot override', () => {
    const plugin = createPlugin({ id: 'something-else', width: '500px' })

    expect(plugin.id).toBe('gepInfoLinks')
    expect(plugin.width).toBe('500px')
  })

  test('loads a manifest with a button, panel and icon', async () => {
    const manifest = await createPlugin().load()

    expect(manifest.buttons[0]).toMatchObject({ id: 'gepInfoLinks', panelId: 'gepInfoLinks', iconId: 'gepInfo' })
    expect(manifest.panels[0].id).toBe('gepInfoLinks')
    expect(manifest.icons[0].id).toBe('gepInfo')
  })

  test('opens the panel next to its button, using the kebab-cased button slot', async () => {
    const manifest = await createPlugin().load()
    const [panel] = manifest.panels

    expect(panel.tablet.slot).toBe('gep-info-links-button')
    expect(panel.desktop.slot).toBe('gep-info-links-button')
    expect(panel.mobile.slot).toBe('drawer')
  })
})
