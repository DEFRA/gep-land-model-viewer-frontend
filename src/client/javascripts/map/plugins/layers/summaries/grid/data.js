import { toTaxonomyClass, toSource } from '../model.js'
import { toLandModelRecord } from '../land-model-properties.js'
import { readCellValues } from './cell-values.js'
import { readCellProperties } from './cell-properties.js'

// 10m cells are read from the COG and coarser cells from the FGB for their size.
const COG_CELL_SIZE = 10

/**
 * @typedef {object} SectionDescription
 * @property {{ name?: string, date?: string }} [source] date is dd/MM/yyyy or yyyy
 * @property {Record<string, FieldDescription>} fields The section's fields by model property
 * @typedef {object} FieldDescription
 * @property {number} band One-based COG band
 * @property {ClassDescription[]} [classes] Absent where the band holds the value itself
 * @typedef {{ bandValue: number, code?: string, label: string }} ClassDescription
 */

/** @typedef {Record<string, SectionDescription>} Bands The grid COG's bands, keyed by summary section */

/**
 * @param {SectionDescription} description
 * @returns {{ source?: import('../model.js').Source }}
 */
function sourceOf (description) {
  const source = toSource(description.source?.name, description.source?.date)
  return source ? { source } : {}
}

/**
 * @param {FieldDescription | undefined} field
 * @param {ArrayLike<number>} values
 * @returns {ClassDescription | undefined}
 */
function classOf (field, values) {
  return field?.classes?.find(candidate => candidate.bandValue === values[field.band - 1])
}

/**
 * @param {SectionDescription} description
 * @param {ClassDescription} definition The dominant class
 * @returns {import('../model.js').TaxonomyTheme}
 */
function toTheme (description, definition) {
  return { dominant: toTaxonomyClass(definition.label, definition.code), ...sourceOf(description) }
}

/**
 * @param {SectionDescription | undefined} description
 * @param {ArrayLike<number>} values
 * @returns {import('../model.js').TaxonomyTheme | null}
 */
function toDominantTheme (description, values) {
  const definition = classOf(description?.fields.dominant, values)
  if (!definition) {
    return null
  }

  return toTheme(description, definition)
}

/**
 * @param {SectionDescription | undefined} description
 * @param {ArrayLike<number>} values
 * @returns {import('../model.js').Ownership | null}
 */
function toOwnership (description, values) {
  if (!description) {
    return null
  }

  const inspireId = values[description.fields.inspireId.band - 1]
  const titleDescriptor = classOf(description.fields.titleDescriptor, values)?.label
  return {
    titles: inspireId ? [{ inspireId: String(inspireId), ...(titleDescriptor ? { titleDescriptor } : {}) }] : [],
    ...sourceOf(description)
  }
}

/**
 * @param {SectionDescription | undefined} description
 * @param {ArrayLike<number>} values
 * @returns {import('../model.js').LandManagement | null}
 */
function toLandManagement (description, values) {
  if (!description) {
    return null
  }

  const pseudoSbi = values[description.fields.pseudoSbi.band - 1]
  return { records: pseudoSbi ? [{ pseudoSbi: String(pseudoSbi) }] : [], ...sourceOf(description) }
}

/**
 * @param {SectionDescription | undefined} description
 * @param {ArrayLike<number>} values
 * @returns {import('../model.js').ProtectedAreas | null}
 */
function toProtectedAreas (description, values) {
  if (!description) {
    return null
  }

  return { count: values[description.fields.count.band - 1], ...sourceOf(description) }
}

/**
 * @param {import('../model.js').GridUnit} unit
 * @param {ArrayLike<number>} values The cell's COG band values, first band first
 * @param {Bands} bands
 * @returns {import('../model.js').LandModelRecord}
 */
export function toGridRecord (unit, values, bands) {
  return {
    unit,
    landCover: toDominantTheme(bands.landCover, values),
    landUse: toDominantTheme(bands.landUse, values),
    ownership: toOwnership(bands.ownership, values),
    landManagement: toLandManagement(bands.landManagement, values),
    protectedAreas: toProtectedAreas(bands.protectedAreas, values),
    soils: toDominantTheme(bands.soils, values)
  }
}

/**
 * @param {import('../model.js').GridUnit} unit
 * @param {import('ol/extent.js').Extent} extent The cell's bounds
 * @param {import('./api.js').GridSource} source The grid layer's source
 * @returns {Promise<import('../model.js').LandModelRecord | null>}
 */
export async function getGridDetails (unit, extent, { url, bands, fgbs }) {
  if (unit.cellSize === COG_CELL_SIZE) {
    const values = await readCellValues(url, extent)
    return values ? toGridRecord(unit, values, bands) : null
  }

  const properties = await readCellProperties(fgbs[unit.cellSize], unit.bngRef, extent)
  return properties ? toLandModelRecord(unit, properties) : null
}
