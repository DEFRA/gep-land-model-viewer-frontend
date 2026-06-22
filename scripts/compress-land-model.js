import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

const staticDir = resolve('src/server/land-model/static')

const BROTLI_OPTS = {
  params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY }
}

function compressBrotli (input, outputPath) {
  const compressed = brotliCompressSync(input, BROTLI_OPTS)
  writeFileSync(outputPath, compressed)

  const rawMB = (Buffer.byteLength(input) / 1024 / 1024).toFixed(1)
  const brMB = (compressed.length / 1024 / 1024).toFixed(1)
  console.log(`  ${rawMB} MB -> ${brMB} MB (brotli)`)
}

function normalise (value) {
  if (value == null || value === '' || value === 'NULL') {
    return null
  }
  return value
}

function dominantLabel (intersecting) {
  let dominant = null
  let max = -1
  for (const [label, pct] of Object.entries(intersecting ?? {})) {
    if (pct > max) {
      max = pct
      dominant = label
    }
  }
  return normalise(dominant)
}

console.log('Trimming and compressing grids.json...')

const parcelsRaw = readFileSync(resolve(staticDir, 'parcels.json'))
const parcels = JSON.parse(parcelsRaw)
const grids = JSON.parse(readFileSync(resolve(staticDir, 'grids.json'), 'utf8'))

const gridMetadata = {
  land_cover_source: parcels[0].land_cover_source,
  land_cover_date: parcels[0].land_cover_date,
  soil_source: parcels[0].soil_source,
  soil_date: parcels[0].soil_date,
  topography_source: 'LIDAR Composite Digital Terrain Model (DTM) 1m',
  topography_date: '08/03/2023'
}

const gridIndexMaps = {
  land_use: new Map(),
  land_use_code: new Map(),
  land_cover: new Map(),
  land_cover_code: new Map(),
  soil: new Map(),
  soil_code: new Map(),
  aspect_aspect: new Map()
}

function lookupIndex (field, value) {
  if (value == null) {
    return null
  }
  const map = gridIndexMaps[field]
  if (!map.has(value)) {
    map.set(value, map.size)
  }
  return map.get(value)
}

const gridRows = grids.map((raw) => [
  raw.bng_ref,
  lookupIndex('land_use', dominantLabel(raw.land_use_intersecting)),
  lookupIndex('land_use_code', normalise(raw.land_use_code)),
  lookupIndex('land_cover', dominantLabel(raw.land_cover_intersecting)),
  lookupIndex('land_cover_code', normalise(raw.land_cover_code)),
  lookupIndex('soil', dominantLabel(raw.soil_intersecting)),
  lookupIndex('soil_code', normalise(raw.soil_code)),
  raw.elevation_min,
  raw.elevation_mean,
  raw.elevation_max,
  raw.slope_min,
  raw.slope_mode,
  raw.slope_max,
  lookupIndex('aspect_aspect', normalise(raw.aspect_aspect))
])

const gridLookups = {}
for (const [field, map] of Object.entries(gridIndexMaps)) {
  gridLookups[field] = [...map.keys()]
  console.log(`  ${field}: ${map.size} unique values`)
}

compressBrotli(
  JSON.stringify({ metadata: gridMetadata, lookups: gridLookups, rows: gridRows }),
  resolve(staticDir, 'grids.json.br')
)

console.log('Compressing parcels.json...')
compressBrotli(parcelsRaw, resolve(staticDir, 'parcels.json.br'))

console.log('Done.')
