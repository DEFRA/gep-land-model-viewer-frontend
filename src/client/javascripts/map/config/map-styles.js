export const OS_ATTRIBUTION = `© Crown copyright and database rights ${new Date().getFullYear()} OS AC0000805307`

export const mapStyles = [
  {
    id: 'os-outdoor',
    label: 'OS Outdoor',
    url: '/map/style/OS_VTS_27700_ESRI.json',
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
  }
]
