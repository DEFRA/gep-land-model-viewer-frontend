import { vi, describe, test, expect } from 'vitest'
import createPlugin from './index.js'

describe('north indicator plugin', () => {
  test('registers under a fixed id that options cannot override', () => {
    const plugin = createPlugin({ id: 'something-else' })

    expect(plugin.id).toBe('gepNorthIndicator')
  })

  test('loads a manifest with the button and its icon', async () => {
    const manifest = await createPlugin().load()

    expect(manifest.buttons[0]).toMatchObject({ id: 'gepNorthIndicator', iconId: 'gepCompass' })
    expect(manifest.icons[0].id).toBe('gepCompass')
  })

  test('the button animates the view back to north', async () => {
    const { buttons: [button] } = await createPlugin().load()
    const view = { animate: vi.fn() }

    button.onClick(new Event('click'), { mapProvider: { map: { getView: () => view } } })

    expect(view.animate).toHaveBeenCalledWith({ rotation: 0, duration: 300 })
  })
})
