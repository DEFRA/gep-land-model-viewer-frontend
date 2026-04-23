import { renderInitialInfoPanelHtml, renderCellInfoHtml } from './render.js'

describe('#renderInitialInfoPanelHtml', () => {
  test('returns HTML string with the provided content id', () => {
    const html = renderInitialInfoPanelHtml('test-content-id')

    expect(typeof html).toBe('string')
    expect(html).toContain('id="test-content-id"')
  })
})

describe('#renderCellInfoHtml', () => {
  test('returns HTML string containing cell data', () => {
    const cell = { cellId: 'E418720N385130', easting: 418720, northing: 385130 }
    const html = renderCellInfoHtml(cell)

    expect(typeof html).toBe('string')
    expect(html).toContain('E418720N385130')
  })
})
