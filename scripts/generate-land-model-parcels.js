// Generates the dev land model parcels in compose/garage from the pipeline GeoPackage
// Usage: node scripts/generate-land-model-parcels.js <poc_v2_5.gpkg>
// Needs GDAL (ogr2ogr)

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = 'compose/garage/data/land-model/parcels'

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

execFileSync('ogr2ogr', [
  '-f', 'FlatGeobuf',
  '-a_srs', 'EPSG:27700',
  '-nln', 'parcels',
  join(outDir, 'data.fgb'), process.argv[2], 'parcel_elevation_crs_v2_5'
], { stdio: 'inherit' })

const style = {
  themes: [{
    label: 'OS features',
    type: 'uniform',
    band: 1,
    classes: [{
      bandValue: 1,
      label: 'OS feature',
      fill: [0, 133, 49, 0.12],
      stroke: { color: [0, 106, 39, 0.6], width: 1.5 }
    }]
  }]
}
writeFileSync(join(outDir, 'style.json'), JSON.stringify(style, null, 2) + '\n')

const manifest = { generatedAt: new Date().toISOString(), files: { 'style.json': null, 'data.fgb': null } }
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`Done - ${outDir}`)
