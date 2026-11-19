import { HttpReader } from 'flatgeobuf/lib/mjs/http-reader.js'

/**
 * Matches each theme's field to its FlatGeobuf column case-insensitively.
 *
 * @param {import('../source.js').LayerSource} source FlatGeobuf source
 * @returns {Promise<import('../source.js').LayerSource>}
 */
export async function matchThemeFieldsToFgbColumns (source) {
  const { header } = await HttpReader.open(source.url, false)
  const columns = header.columns?.map((column) => column.name) ?? []
  const themes = source.styleConfig.themes.map((theme) => {
    const field = columns.find((name) => name.toLowerCase() === theme.field?.toLowerCase())
    return field ? { ...theme, field } : theme
  })

  return { ...source, styleConfig: { ...source.styleConfig, themes } }
}
