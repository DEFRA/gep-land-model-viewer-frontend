// Generates the dev land model grid in compose/garage from the old SE67 grids.json.br
// Usage: node scripts/generate-land-model-grid.js scripts/grids.json.br
// Needs GDAL (gdal_translate, ogr2ogr)

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync } from 'node:zlib'

const outDir = 'compose/garage/data/land-model/grid'
const tmp = mkdtempSync(join(tmpdir(), 'land-model-grid-'))

// SE67 at 10m
const west = 460000
const north = 480000
const size = 1000

const themes = [
  { name: 'land_cover', key: 'landCover', labelCol: 3, codeCol: 4, source: { name: 'UKCEH LCM2024', date: '2024' } },
  { name: 'land_use', key: 'landUse', labelCol: 1, codeCol: 2, source: { name: 'OS NGD', date: '24/09/2024' } },
  { name: 'soil', key: 'soils', labelCol: 5, codeCol: 6, source: { name: 'Cranfield Soils Data', date: '05/10/2023' } }
]

const titleDescriptors = ['Freehold', 'Leasehold', 'Rentcharge']

// fake data for the other summary sections
const fakeBands = [
  { name: 'inspire_id', value: () => randomInt(10000000, 99999999) },
  { name: 'title_descriptor', value: () => randomInt(1, titleDescriptors.length) },
  { name: 'pseudo_sbi', value: () => randomInt(100000000, 999999999) },
  { name: 'protected_area_count', value: () => randomInt(0, 4) }
]

function randomInt (min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

const coarseLevels = [
  { cellSize: 100, digits: 3 },
  { cellSize: 1000, digits: 2 },
  { cellSize: 10000, digits: 1 },
  { cellSize: 100000, digits: 0 }
]

const data = JSON.parse(brotliDecompressSync(readFileSync(process.argv[2])).toString())

// pick the most common label for each code, band values are the codes in order (0 is nodata)
for (const theme of themes) {
  const pairs = new Map()
  for (const row of data.rows) {
    const code = data.lookups[`${theme.name}_code`][row[theme.codeCol]]
    const label = data.lookups[theme.name][row[theme.labelCol]]
    if (code) {
      const key = `${code}\t${label}`
      pairs.set(key, (pairs.get(key) ?? 0) + 1)
    }
  }

  theme.labels = new Map()
  for (const [key] of [...pairs].sort((a, b) => b[1] - a[1])) {
    const [code, label] = key.split('\t')
    if (!theme.labels.has(code)) {
      theme.labels.set(code, label)
    }
  }
  theme.values = new Map([...theme.labels.keys()].sort().map((code, i) => [code, i + 1]))
}

const cells = data.rows.map(row => ({
  easting: 400000 + Number.parseInt(row[0].slice(2, 6)) * 10,
  northing: 400000 + Number.parseInt(row[0].slice(6)) * 10,
  codes: themes.map(theme => data.lookups[`${theme.name}_code`][row[theme.codeCol]])
}))

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

// keyed by summary section, with the band for each of the section's fields
const bands = Object.fromEntries([
  ...themes.map((theme, i) => [theme.key, {
    source: theme.source,
    fields: {
      dominant: {
        band: i + 1,
        classes: [...theme.values].map(([code, bandValue]) => ({ bandValue, code, label: theme.labels.get(code) }))
      }
    }
  }]),
  ['ownership', {
    source: { name: 'HM Land Registry' },
    fields: {
      inspireId: { band: 4 },
      titleDescriptor: { band: 5, classes: titleDescriptors.map((label, i) => ({ bandValue: i + 1, label })) }
    }
  }],
  ['landManagement', { source: { name: 'RPA', date: '2022' }, fields: { pseudoSbi: { band: 6 } } }],
  ['protectedAreas', { source: { name: 'Natural England / JNCC', date: '2025' }, fields: { count: { band: 7 } } }]
])
writeFileSync(join(outDir, 'bands.json'), JSON.stringify(bands, null, 2) + '\n')

const style = {
  opacity: 0.01,
  themes: [{
    label: 'Grid squares',
    type: 'uniform',
    band: 1,
    classes: [{ bandValue: 1, label: 'Grid square', fill: [0, 133, 49, 1] }]
  }]
}
writeFileSync(join(outDir, 'style.json'), JSON.stringify(style, null, 2) + '\n')

const files = ['style.json', 'bands.json', '10.tif', ...coarseLevels.map(level => `${level.cellSize}.fgb`)]
const manifest = { generatedAt: new Date().toISOString(), files: Object.fromEntries(files.map(file => [file, null])) }
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

// 10m COG - write each band as raw UInt32s and wrap them in a VRT for gdal_translate
// UInt32 as INSPIRE IDs and pseudo SBIs don't fit in anything smaller, and every band in a GeoTIFF has the same type
const bandNames = [...themes.map(theme => theme.name), ...fakeBands.map(fakeBand => fakeBand.name)]
const rasters = bandNames.map(() => new Uint32Array(size * size))
for (const cell of cells) {
  const col = (cell.easting - west) / 10
  const row = (north - 10 - cell.northing) / 10
  themes.forEach((theme, i) => {
    rasters[i][row * size + col] = theme.values.get(cell.codes[i]) ?? 0
  })
  fakeBands.forEach((fakeBand, i) => {
    rasters[themes.length + i][row * size + col] = fakeBand.value()
  })
}

let vrt = `<VRTDataset rasterXSize="${size}" rasterYSize="${size}">
  <SRS>EPSG:27700</SRS>
  <GeoTransform>${west}, 10, 0, ${north}, 0, -10</GeoTransform>
`
bandNames.forEach((name, i) => {
  writeFileSync(join(tmp, `${name}.raw`), rasters[i])
  vrt += `  <VRTRasterBand dataType="UInt32" band="${i + 1}" subClass="VRTRawRasterBand">
    <Description>${name}</Description>
    <NoDataValue>0</NoDataValue>
    <SourceFilename relativeToVRT="1">${name}.raw</SourceFilename>
    <ImageOffset>0</ImageOffset>
    <PixelOffset>4</PixelOffset>
    <LineOffset>${size * 4}</LineOffset>
    <ByteOrder>LSB</ByteOrder>
  </VRTRasterBand>
`
})
vrt += '</VRTDataset>\n'
writeFileSync(join(tmp, '10.vrt'), vrt)

execFileSync('gdal_translate', [
  '-q', '-of', 'COG',
  '-co', 'COMPRESS=DEFLATE',
  '-co', 'LEVEL=9',
  '-co', 'BLOCKSIZE=256',
  '-co', 'OVERVIEW_RESAMPLING=MODE',
  join(tmp, '10.vrt'), join(outDir, '10.tif')
], { stdio: 'inherit' })

// coarser levels - points at cell centres with the same properties as the parcels
for (const level of coarseLevels) {
  const groups = new Map()
  for (const cell of cells) {
    const easting = Math.floor(cell.easting / level.cellSize) * level.cellSize
    const northing = Math.floor(cell.northing / level.cellSize) * level.cellSize
    const key = `${easting},${northing}`
    if (!groups.has(key)) {
      groups.set(key, { easting, northing, total: 0, counts: themes.map(() => new Map()) })
    }

    const group = groups.get(key)
    group.total++
    cell.codes.forEach((code, i) => {
      if (code) {
        group.counts[i].set(code, (group.counts[i].get(code) ?? 0) + 1)
      }
    })
  }

  const features = [...groups.values()].map(group => {
    const ref = level.digits === 0
      ? 'SE'
      : 'SE' + [group.easting, group.northing].map(v => String((v - 400000) / level.cellSize).padStart(level.digits, '0')).join('')
    const properties = { bng_ref: ref }

    themes.forEach((theme, i) => {
      const sorted = [...group.counts[i]].sort((a, b) => b[1] - a[1])
      const proportions = Object.fromEntries(sorted.map(([code, count]) => [theme.labels.get(code), Math.round(count / group.total * 1000) / 10]))
      const dominant = sorted[0][0]
      properties[`${theme.name}_dom_code`] = dominant
      properties[`${theme.name}_dom_name`] = theme.labels.get(dominant)
      properties[`${theme.name}_proportions`] = JSON.stringify(proportions)
      properties[`${theme.name}_source`] = theme.source.name
      properties[`${theme.name}_date`] = theme.source.date
    })

    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [group.easting + level.cellSize / 2, group.northing + level.cellSize / 2] },
      properties
    }
  })

  const geojson = join(tmp, `${level.cellSize}.geojson`)
  writeFileSync(geojson, JSON.stringify({ type: 'FeatureCollection', features }))
  execFileSync('ogr2ogr', [
    '-f', 'FlatGeobuf',
    '-a_srs', 'EPSG:27700',
    '-nln', `grid_${level.cellSize}`,
    join(outDir, `${level.cellSize}.fgb`), geojson
  ], { stdio: 'inherit' })
}

rmSync(tmp, { recursive: true })
console.log(`Done - ${outDir}`)
