import catalog from '../../../data/ea-wms-catalog.json'

const EA_WMS_PREFIX = 'https://environment.data.gov.uk/spatialdata/'
const EA_ATTRIBUTION = `© Environment Agency copyright and/or database right ${new Date().getFullYear()}. All rights reserved.`

export const datasets = catalog
  .filter(item => item.wmsUrl.startsWith(EA_WMS_PREFIX))
  .map(item => ({
    id: item.id,
    label: item.title,
    source: {
      type: 'wms',
      url: item.wmsUrl,
      opacity: 0.7,
      attribution: EA_ATTRIBUTION
    }
  }))
