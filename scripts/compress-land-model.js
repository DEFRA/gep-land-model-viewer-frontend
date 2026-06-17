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

function dominantLabel (intersecting) {
  let dominant = null
  let max = -1
  for (const [label, pct] of Object.entries(intersecting ?? {})) {
    if (pct > max) {
      max = pct
      dominant = label
    }
  }
  return dominant
}

console.log('Trimming and compressing grids.json...')

const grids = JSON.parse(readFileSync(resolve(staticDir, 'grids.json'), 'utf8'))

// Strip the intersecting properties and keep only the dominant label and code.
const trimmedGrids = grids.map((raw) => ({
  bng_ref: raw.bng_ref,
  land_use: dominantLabel(raw.land_use_intersecting),
  land_use_code: raw.land_use_code,
  land_cover: dominantLabel(raw.land_cover_intersecting),
  land_cover_code: raw.land_cover_code,
  soil: dominantLabel(raw.soil_intersecting),
  soil_code: raw.soil_code,
  elevation_min: raw.elevation_min,
  elevation_mean: raw.elevation_mean,
  elevation_max: raw.elevation_max,
  slope_min: raw.slope_min,
  slope_mode: raw.slope_mode,
  slope_max: raw.slope_max,
  aspect_aspect: raw.aspect_aspect
}))

compressBrotli(JSON.stringify(trimmedGrids), resolve(staticDir, 'grids.json.br'))

console.log('Compressing parcels.json...')
compressBrotli(readFileSync(resolve(staticDir, 'parcels.json')), resolve(staticDir, 'parcels.json.br'))

console.log('Done.')
