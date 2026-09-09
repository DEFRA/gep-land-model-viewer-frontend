import catalog from '../../../data/ea-wms-catalog.json'
import { operationalDatasets } from './operational-datasets.js'

const EA_WMS_PREFIX = 'https://environment.data.gov.uk/spatialdata/'
const EA_ATTRIBUTION = `© Environment Agency copyright and/or database right ${new Date().getFullYear()}. All rights reserved.`

const eaDatasets = catalog
  .filter(item => item.wmsUrl.startsWith(EA_WMS_PREFIX))
  .map(item => ({
    id: item.id,
    label: item.title,
    source: {
      type: 'wms',
      url: item.wmsUrl,
      opacity: 0.5,
      attribution: EA_ATTRIBUTION
    }
  }))

export const datasets = [...operationalDatasets, ...eaDatasets]
