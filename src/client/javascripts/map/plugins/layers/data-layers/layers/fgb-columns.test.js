import { afterEach, describe, test, expect, vi } from 'vitest'
import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js'
import { matchThemeFieldsToFgbColumns } from './fgb-columns.js'

const FGB_URL = '/api/datasets/dataset/layer/assets/data.fgb?v=fgb-version'

function stubColumns (names) {
  return vi.spyOn(HttpReader, 'open').mockResolvedValueOnce(/** @type {any} */ ({
    header: { columns: names.map((name) => ({ name })) }
  }))
}

describe('#matchThemeFieldsToFgbColumns', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('names a theme field as the column it matches ignoring case', async () => {
    const open = stubColumns(['themid', 'themname'])
    const source = {
      type: 'fgb',
      url: FGB_URL,
      styleConfig: {
        opacity: 0.7,
        themes: [
          { band: 1, field: 'THEMNAME', classes: [] },
          { band: 2, field: 'themid', classes: [] },
          { band: 3, classes: [] }
        ]
      }
    }

    const matched = await matchThemeFieldsToFgbColumns(source)

    expect(open).toHaveBeenCalledWith(FGB_URL, false)
    expect(matched.styleConfig).toEqual({
      opacity: 0.7,
      themes: [
        { band: 1, field: 'themname', classes: [] },
        { band: 2, field: 'themid', classes: [] },
        { band: 3, classes: [] }
      ]
    })
  })
})
