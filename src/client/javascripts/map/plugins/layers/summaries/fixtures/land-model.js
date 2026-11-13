const coverSource = { name: 'UKCEH LCM2024', updated: new Date(2024, 0, 1) }
const soilSource = { name: 'Cranfield Soils Data', updated: new Date(2023, 9, 5) }
const ownershipSource = { name: 'HM Land Registry' }
const managementSource = { name: 'Rural Payments Agency' }
const protectionSource = { name: 'Natural England', updated: new Date(2025, 0, 1) }

const TENURES = ['Freehold', 'Leasehold', 'Rentcharge']

const BNG_REFS = { 10: 'SE60007000', 100: 'SE600700', 1000: 'SE6070', 10000: 'SE67', 100000: 'SE' }

/** @returns {import('../model.js').GridUnit} */
function gridUnit (cellSize) {
  return { kind: 'grid', bngRef: BNG_REFS[cellSize], cellSize }
}

/** @returns {import('../model.js').TitleRecord[]} */
function titleRecords (count) {
  return Array.from({ length: count }, (_, index) => ({
    inspireId: String(47540258 + index),
    titleDescriptor: TENURES[index % TENURES.length]
  }))
}

/** @returns {import('../model.js').ManagementRecord[]} */
function managementRecords (count) {
  return Array.from({ length: count }, (_, index) => ({ pseudoSbi: String(108815123 + index) }))
}

/** @type {import('../model.js').LandModelRecord} */
export const grid10mRecord = {
  unit: gridUnit(10),
  landCover: { dominant: { label: 'Improved grass' }, source: coverSource },
  landUse: { dominant: { label: 'Agriculture' } },
  ownership: { titles: [{ inspireId: '47540258', titleDescriptor: 'Leasehold' }], source: ownershipSource },
  landManagement: { records: [{ pseudoSbi: '108815123', refreshed: new Date(2024, 0, 1) }], source: managementSource },
  protectedAreas: { count: 1, source: protectionSource },
  soils: { dominant: { label: 'Brown soils' }, source: soilSource }
}

/** @returns {import('../model.js').LandModelRecord} */
function largerGridRecord (cellSize, titleCount, holdingCount) {
  return {
    unit: gridUnit(cellSize),
    landCover: {
      dominant: { label: 'Cropped land' },
      intersections: [
        { label: 'Cropped land', percentage: 60.2 },
        { label: 'Improved grass', percentage: 29.8 },
        { label: 'Broad leaved & mixed woodland', percentage: 7.1 },
        { label: 'Suburban', percentage: 2.9 }
      ],
      source: coverSource
    },
    landUse: {
      dominant: { label: 'Agriculture' },
      intersections: [
        { label: 'Agriculture', percentage: 70.4 },
        { label: 'Dwellings', percentage: 18.3 },
        { label: 'Transport tracks and ways', percentage: 11.3 }
      ]
    },
    ownership: {
      titles: titleRecords(titleCount),
      tenureIntersections: [{ label: 'Freehold', percentage: 70.1 }, { label: 'Leasehold', percentage: 29.9 }],
      source: ownershipSource
    },
    landManagement: { records: managementRecords(holdingCount), source: managementSource },
    protectedAreas: { count: 2, source: protectionSource },
    soils: {
      dominant: { label: 'Brown soils' },
      intersections: [{ label: 'Brown soils', percentage: 65.4 }, { label: 'Surface-water gley soils', percentage: 34.6 }],
      source: soilSource
    }
  }
}

export const grid100mRecord = largerGridRecord(100, 56, 42)
export const grid1kmRecord = largerGridRecord(1000, 134, 259)
export const grid10kmRecord = largerGridRecord(10000, 1247, 1587)
export const grid100kmRecord = largerGridRecord(100000, 12483, 15962)

/** @type {import('../model.js').LandModelRecord} */
export const featureRecord = {
  unit: { kind: 'feature', osid: '035bc758-5ea7-4897-aa25-f6ec56a9f708', toid: 'osgb1000000082252199' },
  landCover: {
    dominant: { label: 'Improved grass' },
    intersections: [{ label: 'Improved grass', percentage: 82.2 }, { label: 'Broad leaved & mixed woodland', percentage: 17.8 }],
    source: coverSource
  },
  landUse: { dominant: { label: 'Agriculture' } },
  ownership: { titles: [{ inspireId: '47540258', titleDescriptor: 'Freehold' }], source: ownershipSource },
  landManagement: { records: [{ pseudoSbi: '108815123', refreshed: new Date(2024, 0, 1) }], source: managementSource },
  protectedAreas: {
    sites: [
      { code: '1000123', name: 'Example Meadows', designation: { label: 'Site of Special Scientific Interest', code: 'SSSI' }, intersection: { percentage: 47.3 } }
    ],
    source: protectionSource
  },
  soils: {
    dominant: { label: 'Brown soils' },
    intersections: [{ label: 'Brown soils', percentage: 100 }],
    source: soilSource
  }
}

/** @type {import('../model.js').LandModelRecord} */
export const featureMultipleRecord = {
  unit: { kind: 'feature', osid: '9d1f0c2a-3b4e-4c5d-8e6f-7a8b9c0d1e2f', toid: 'osgb1000002034561234' },
  landCover: {
    dominant: { label: 'Water' },
    intersections: [{ label: 'Water', percentage: 62.3 }, { label: 'Broad leaved & mixed woodland', percentage: 37.7 }],
    source: coverSource
  },
  landUse: {
    dominant: { label: 'Water storage and treatment' },
    intersections: [{ label: 'Water storage and treatment', percentage: 73.2 }, { label: 'Outdoor amenity and open spaces', percentage: 26.8 }]
  },
  ownership: {
    titles: titleRecords(3),
    tenureIntersections: [{ label: 'Freehold', percentage: 70 }, { label: 'Leasehold', percentage: 20 }, { label: 'Rentcharge', percentage: 10 }],
    source: ownershipSource
  },
  landManagement: { records: managementRecords(3), source: managementSource },
  protectedAreas: {
    sites: [
      { code: 'UK0038654', name: 'Sefton Coast', designation: { label: 'Special Areas of Conservation', code: 'SAC' }, intersection: { percentage: 100 } },
      { code: 'UK9018059', name: 'Bowland Fells', designation: { label: 'Special Protection Areas', code: 'SPA' }, intersection: { percentage: 43 } }
    ],
    source: protectionSource
  },
  soils: {
    dominant: { label: 'Ground-water gley soils' },
    intersections: [{ label: 'Ground-water gley soils', percentage: 61.2 }, { label: 'Brown soils', percentage: 38.8 }],
    source: soilSource
  }
}

/** @type {import('../model.js').LandModelRecord} */
export const zeroRecord = {
  ...grid100mRecord,
  ownership: { titles: [], source: ownershipSource },
  landManagement: { records: [], source: managementSource },
  protectedAreas: { count: 0, source: protectionSource }
}

/** @type {import('../model.js').LandModelRecord} */
export const partialRecord = {
  ...grid10mRecord,
  ownership: null,
  landManagement: null,
  protectedAreas: null
}

const releaseSources = {
  landCover: { name: 'UKCEH Land Cover Map', updated: new Date('2026-10-21T15:20:31.309Z') },
  landUse: { name: 'OS NGD', updated: new Date('2026-10-22T11:17:40.971Z') },
  ownership: { name: 'HM Land Registry', updated: new Date('2026-10-22T00:00:00.000Z') },
  landManagement: { name: 'RPA', updated: new Date('2026-10-22T00:00:00.000Z') },
  protectedAreas: { name: 'Natural England SSSI, SAC, SPA, Ramsar, NNR', updated: new Date('2026-10-21T15:07:42.158Z') },
  soils: { name: 'National Soil Map', updated: new Date('2026-10-22T11:42:03.320Z') }
}

/** @returns {import('../model.js').GridUnit} */
function tenMetreSquare (bngRef) {
  return { kind: 'grid', bngRef, cellSize: 10 }
}

/** @returns {import('../model.js').LandModelRecord} */
function tenMetreRecord (bngRef, landCover, landUse, protectedAreaCount) {
  return {
    unit: tenMetreSquare(bngRef),
    landCover: { dominant: { label: landCover }, source: releaseSources.landCover },
    landUse: { dominant: { label: landUse }, source: releaseSources.landUse },
    ownership: { titles: [{ inspireId: '57896977', titleDescriptor: 'Freehold' }], source: releaseSources.ownership },
    landManagement: { records: [{ pseudoSbi: '448991231' }], source: releaseSources.landManagement },
    protectedAreas: { count: protectedAreaCount, source: releaseSources.protectedAreas },
    soils: { dominant: { label: 'Brown soils' }, source: releaseSources.soils }
  }
}

/**
 * Six neighbouring 10m grid squares from the grid COG, by Dalby Bush Fen SSSI
 *
 * @type {Array<{ record: import('../model.js').LandModelRecord, area: number }>}
 */
export const gridSelection = [
  tenMetreRecord('SE64567169', 'Broad leaved & mixed woodland', 'Unused land', 1),
  tenMetreRecord('SE64577169', 'Improved grass', 'Transport tracks and ways', 1),
  tenMetreRecord('SE64587169', 'Improved grass', 'Agriculture', 0),
  tenMetreRecord('SE64567168', 'Broad leaved & mixed woodland', 'Unused land', 1),
  tenMetreRecord('SE64577168', 'Improved grass', 'Transport tracks and ways', 1),
  tenMetreRecord('SE64587168', 'Improved grass', 'Agriculture', 0)
].map(record => ({ record, area: 100 }))

function dalbyBushFen (percentage, area) {
  return { code: '1003409', name: 'Dalby Bush Fen SSSI', designation: { label: 'SSSI' }, intersection: { percentage, area } }
}

function wholly (label, area) {
  return { dominant: { label }, intersections: [{ label, percentage: 100, area }] }
}

/** @returns {import('../model.js').LandModelRecord} */
function parcelRecord ({ osid, toid, landCover, landUse, titles, pseudoSbis, site, area }) {
  return {
    unit: { kind: 'feature', osid, toid },
    landCover: { ...landCover, source: releaseSources.landCover },
    landUse: { ...wholly(landUse, area), source: releaseSources.landUse },
    ownership: {
      titles: titles.map(([inspireId, titleArea]) => ({ inspireId, area: titleArea, titleDescriptor: 'Freehold' })),
      tenureIntersections: [{ label: 'Freehold', area, percentage: 100 }],
      source: releaseSources.ownership
    },
    landManagement: { records: pseudoSbis.map(pseudoSbi => ({ pseudoSbi })), source: releaseSources.landManagement },
    protectedAreas: { sites: [site], source: releaseSources.protectedAreas },
    soils: { ...wholly('Brown soils', area), source: releaseSources.soils }
  }
}

/**
 * Three neighbouring OS features from the parcels FlatGeobuf, in Dalby Bush Fen SSSI, with their geometry's area
 *
 * @type {Array<{ record: import('../model.js').LandModelRecord, area: number }>}
 */
export const featureSelection = [
  {
    osid: '21e8c649-507a-4028-9eff-772b6e8107bf',
    toid: 'osgb5000005337170180',
    landCover: wholly('Improved grass', 1273.8),
    landUse: 'Transport tracks and ways',
    titles: [['30183545', 308.5], ['60622154', 965.3]],
    pseudoSbis: ['344046374911'],
    site: dalbyBushFen(8.3, 106.3),
    area: 1273.8
  },
  {
    osid: '48f705a5-c265-4f4c-88c7-5314e91b0cc0',
    toid: 'osgb1000000082135676',
    landCover: {
      dominant: { label: 'Improved grass' },
      intersections: [{ label: 'Broad leaved & mixed woodland', percentage: 1.3, area: 35.2 }, { label: 'Improved grass', percentage: 98.7, area: 2623 }]
    },
    landUse: 'Unused land',
    titles: [['30183545', 2658.4]],
    pseudoSbis: ['344046374911'],
    site: dalbyBushFen(100, 2658.4),
    area: 2658.4
  },
  {
    osid: '124f3508-5495-44a6-b373-5388d7980d6a',
    toid: 'osgb1000000082135675',
    landCover: {
      dominant: { label: 'Broad leaved & mixed woodland' },
      intersections: [{ label: 'Improved grass', percentage: 10.5, area: 907.9 }, { label: 'Broad leaved & mixed woodland', percentage: 89.5, area: 7773.8 }]
    },
    landUse: 'Unused land',
    titles: [['60622154', 8681.7]],
    pseudoSbis: ['344046374911', '344046374911'],
    site: dalbyBushFen(94.4, 8195.9),
    area: 8681.7
  }
].map(parcel => ({ record: parcelRecord(parcel), area: parcel.area }))
