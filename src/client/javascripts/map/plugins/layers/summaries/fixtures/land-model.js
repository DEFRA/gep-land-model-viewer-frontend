const coverSource = { name: 'UKCEH LCM2024', updated: new Date(2015, 3, 28) }
const soilSource = { name: 'Cranfield Soils Data', updated: new Date(2026, 3, 28) }
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
  landCover: { dominant: { label: 'Improved grass', code: 'C021' }, source: coverSource },
  landUse: { dominant: { label: 'Agriculture', code: 'U011' } },
  ownership: { titles: [{ inspireId: '47540258', titleDescriptor: 'Leasehold' }], source: ownershipSource },
  landManagement: { records: [{ pseudoSbi: '108815123', refreshed: new Date(2024, 0, 1) }], source: managementSource },
  protectedAreas: { count: 1, source: protectionSource },
  soils: { dominant: { label: 'Brown soils', code: 'S050' }, source: soilSource }
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
    dominant: { label: 'Improved grass', code: 'C021' },
    intersections: [{ label: 'Improved grass', percentage: 82.2 }, { label: 'Broad leaved & mixed woodland', percentage: 17.8 }],
    source: coverSource
  },
  landUse: { dominant: { label: 'Agriculture', code: 'U011' } },
  ownership: { titles: [{ inspireId: '47540258', titleDescriptor: 'Freehold' }], source: ownershipSource },
  landManagement: { records: [{ pseudoSbi: '108815123', refreshed: new Date(2024, 0, 1) }], source: managementSource },
  protectedAreas: {
    sites: [
      { code: '1000123', name: 'Example Meadows', designation: { label: 'Site of Special Scientific Interest', code: 'SSSI' }, intersection: { percentage: 47.3 } }
    ],
    source: protectionSource
  },
  soils: {
    dominant: { label: 'Brown soils', code: 'S050' },
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
