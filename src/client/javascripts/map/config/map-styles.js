export const OS_ATTRIBUTION = `© Crown copyright and database rights ${new Date().getFullYear()} OS AC0000805307`

const OS_NGD_COLLECTION_URL = '/os/ngd/collections/ngd-base'

// The tileset behind the NGD vector styles, and the only one carrying lnd_fts_land
export const OS_NGD_TILESET_URL = `${OS_NGD_COLLECTION_URL}/tiles/27700`

export const mapStyles = [
  {
    id: 'os-outdoor-ngd',
    label: 'OS Outdoor',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/27700',
    thumbnail: '/public/images/os-outdoor-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-road-ngd',
    label: 'OS Road',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/road-27700',
    thumbnail: '/public/images/os-road-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-light-ngd',
    label: 'OS Light',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/light-27700',
    thumbnail: '/public/images/os-light-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-bw-ngd',
    label: 'OS Black & White',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/blackwhite-27700',
    thumbnail: '/public/images/os-bw-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  // For testing a non os-ngd map with features, will be replaced with aerial imagery when available
  {
    id: 'os-outdoor-raster',
    label: 'OS Outdoor (raster)',
    url: '/os/raster/Outdoor_27700/{z}/{x}/{y}.png',
    type: 'raster',
    thumbnail: '/public/images/os-outdoor-raster.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  }
]

/**
 * Styles whose basemap draws from the NGD tileset, to test if the source can be reused.
 */
export const OS_NGD_STYLE_IDS = mapStyles
  .filter((style) => style.url.startsWith(OS_NGD_COLLECTION_URL))
  .map((style) => style.id)
