export const OS_ATTRIBUTION = `© Crown copyright and database rights ${new Date().getFullYear()} OS AC0000805307`

export const mapStyles = [
  {
    id: 'os-outdoor',
    label: 'OS Outdoor',
    url: '/map/style/OS_VTS_27700_Outdoor.json',
    thumbnail: '/public/images/os-outdoor.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-road',
    label: 'OS Road',
    url: '/map/style/OS_VTS_27700_Road.json',
    thumbnail: '/public/images/os-road.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-dark',
    label: 'OS Dark',
    url: '/map/style/OS_VTS_27700_Dark.json',
    thumbnail: '/public/images/os-dark.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'dark',
    appColorScheme: 'dark'
  },
  {
    id: 'os-outdoor-ngd',
    label: 'OS Outdoor (NGD)',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/27700',
    thumbnail: '/public/images/os-outdoor-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-road-ngd',
    label: 'OS Road (NGD)',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/road-27700',
    thumbnail: '/public/images/os-road-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-light-ngd',
    label: 'OS Light (NGD)',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/light-27700',
    thumbnail: '/public/images/os-light-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-bw-ngd',
    label: 'OS Black & White (NGD)',
    type: 'ogc-vt',
    url: '/os/ngd/collections/ngd-base/styles/blackwhite-27700',
    thumbnail: '/public/images/os-bw-ngd.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-outdoor-raster',
    label: 'OS Outdoor (raster)',
    url: '/os/raster/Outdoor_27700/{z}/{x}/{y}.png',
    type: 'raster',
    thumbnail: '/public/images/os-outdoor-raster.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-road-raster',
    label: 'OS Road (raster)',
    url: '/os/raster/Road_27700/{z}/{x}/{y}.png',
    type: 'raster',
    thumbnail: '/public/images/os-road-raster.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-light-raster',
    label: 'OS Light (raster)',
    url: '/os/raster/Light_27700/{z}/{x}/{y}.png',
    type: 'raster',
    thumbnail: '/public/images/os-light-raster.jpg',
    attribution: OS_ATTRIBUTION,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  }
]
