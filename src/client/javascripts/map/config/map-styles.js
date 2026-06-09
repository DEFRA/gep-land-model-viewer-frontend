export const OS_ATTRIBUTION = `© Crown copyright and database rights ${new Date().getFullYear()} OS AC0000805307`

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
  }
]
