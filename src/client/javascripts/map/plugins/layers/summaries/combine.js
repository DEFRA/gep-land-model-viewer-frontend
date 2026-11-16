/** @typedef {import('./model.js').LandModelRecord} LandModelRecord */
/** @typedef {import('./model.js').LandModelThemes} LandModelThemes */
/** @typedef {import('./model.js').Source} Source */

/**
 * Percentage of the total area, rounded to 1 decimal place.
 *
 * @param {number} area
 * @param {number} totalArea
 */
function percentageOf (area, totalArea) {
  return Math.round(area / totalArea * 1000) / 10
}

/**
 * Adds up area by label and shares it against the total area.
 *
 * @param {Array<{ label: string, area?: number }>} labelledAreas
 * @param {number} totalArea
 * @returns {import('./model.js').ClassIntersection[]}
 */
function intersectionsOf (labelledAreas, totalArea) {
  const areas = new Map()
  for (const { label, area } of labelledAreas) {
    areas.set(label, (areas.get(label) ?? 0) + area)
  }

  return [...areas].map(([label, area]) => ({ label, area, percentage: percentageOf(area, totalArea) }))
}

/**
 * Each unit's themes come from the same release, so they share its source.
 *
 * @param {Array<{ source?: Source }>} themes
 * @returns {{ source?: Source }}
 */
function sourceOf (themes) {
  const source = themes.find(theme => theme.source)?.source
  return source ? { source } : {}
}

/**
 * @param {import('./model.js').TaxonomyTheme} theme
 * @param {number} area The unit's area
 * @returns {Array<{ label: string, area?: number }>}
 */
function classAreasOf (theme, area) {
  // 10m squares only have a dominant class, which stands for the whole area.
  return theme.intersections ?? [{ label: theme.dominant.label, area }]
}

/**
 * @param {Array<{ theme: import('./model.js').TaxonomyTheme, area: number }>} themes Each unit's theme with the unit's area
 * @param {number} totalArea
 * @returns {import('./model.js').TaxonomyTheme | null}
 */
function combineTheme (themes, totalArea) {
  if (!themes.length) {
    return null
  }

  const intersections = intersectionsOf(themes.flatMap(({ theme, area }) => classAreasOf(theme, area)), totalArea)
  const dominant = intersections.reduce((largest, intersection) => intersection.area > largest.area ? intersection : largest, intersections[0])

  return { dominant: { label: dominant.label }, intersections, ...sourceOf(themes.map(({ theme }) => theme)) }
}

/**
 * Titles without an area come from 10m squares, which only have their dominant title, so it stands for the whole square.
 *
 * @param {import('./model.js').Ownership} ownership
 * @param {number} area The unit's area
 * @returns {Array<{ label: string, area?: number }>}
 */
function tenureAreasOf (ownership, area) {
  return ownership.titles
    .filter(({ titleDescriptor }) => titleDescriptor)
    .map(title => ({ label: title.titleDescriptor, area: title.area ?? area }))
}

/**
 * @param {Array<{ theme: import('./model.js').Ownership, area: number }>} ownerships Each unit's ownership with the unit's area
 * @param {number} totalArea
 * @returns {import('./model.js').Ownership | null}
 */
function combineOwnership (ownerships, totalArea) {
  if (!ownerships.length) {
    return null
  }

  const titles = new Map()
  for (const { theme } of ownerships) {
    for (const { inspireId, titleDescriptor } of theme.titles) {
      if (!titles.has(inspireId)) {
        titles.set(inspireId, { inspireId, ...(titleDescriptor ? { titleDescriptor } : {}) })
      }
    }
  }

  return {
    titles: [...titles.values()],
    tenureIntersections: intersectionsOf(ownerships.flatMap(({ theme, area }) => tenureAreasOf(theme, area)), totalArea),
    ...sourceOf(ownerships.map(({ theme }) => theme))
  }
}

/**
 * @param {Array<import('./model.js').LandManagement | null>} landManagements
 * @returns {import('./model.js').LandManagement | null}
 */
function combineLandManagement (landManagements) {
  const available = landManagements.filter(Boolean)
  if (!available.length) {
    return null
  }

  const pseudoSbis = new Set(available.flatMap(({ records }) => records.map(record => record.pseudoSbi)))
  return { records: [...pseudoSbis].map(pseudoSbi => ({ pseudoSbi })), ...sourceOf(available) }
}

/**
 * Lists each protected site once by code, with its summed overlap against the total area.
 *
 * @param {import('./model.js').ProtectedAreas[]} protectedAreas
 * @param {number} totalArea
 * @returns {import('./model.js').ProtectedAreas}
 */
function combineSites (protectedAreas, totalArea) {
  const byCode = new Map()
  for (const site of protectedAreas.flatMap(({ sites }) => sites)) {
    const area = (byCode.get(site.code)?.area ?? 0) + site.intersection.area
    byCode.set(site.code, { site, area })
  }

  return {
    sites: [...byCode.values()].map(({ site, area }) => ({ ...site, intersection: { area, percentage: percentageOf(area, totalArea) } })),
    ...sourceOf(protectedAreas)
  }
}

/**
 * @param {Array<import('./model.js').ProtectedAreas | null>} protectedAreas
 * @param {number} totalArea
 * @returns {import('./model.js').ProtectedAreas | import('./model.js').ProtectedAreasPresence | null}
 */
function combineProtectedAreas (protectedAreas, totalArea) {
  const available = protectedAreas.filter(Boolean)
  if (available.some(({ sites }) => sites)) {
    return combineSites(available, totalArea)
  }

  // TODO: grid squares only have a count of protected area types, which cannot be added up.
  // Showing if any cell contains a protected area until design is decided.
  if (available.some(({ count }) => count > 0)) {
    return { contains: true, ...sourceOf(available) }
  }

  if (protectedAreas.every(theme => theme?.count === 0)) {
    return { contains: false, ...sourceOf(available) }
  }

  // if count data is missing we cannot determine if there are any protected areas
  return null
}

/**
 * Combines selected land model records into one record.
 * Shares are worked out by area against the units total area.
 *
 * @param {Array<{ record: LandModelRecord | null, area: number }>} units
  * @returns {LandModelThemes}
 */
export function combineRecords (units) {
  const totalArea = units.reduce((sum, { area }) => sum + area, 0)
  const themes = key => units.map(({ record }) => record?.[key] ?? null)
  const themesWithArea = key => units
    .filter(({ record }) => record?.[key])
    .map(({ record, area }) => ({ theme: record[key], area }))

  return {
    landCover: combineTheme(themesWithArea('landCover'), totalArea),
    landUse: combineTheme(themesWithArea('landUse'), totalArea),
    ownership: combineOwnership(themesWithArea('ownership'), totalArea),
    landManagement: combineLandManagement(themes('landManagement')),
    protectedAreas: combineProtectedAreas(themes('protectedAreas'), totalArea),
    soils: combineTheme(themesWithArea('soils'), totalArea)
  }
}
