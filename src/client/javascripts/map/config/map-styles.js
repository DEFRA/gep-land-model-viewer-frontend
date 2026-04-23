const attribution = `© Crown copyright and database rights ${new Date().getFullYear()} Ordnance Survey`

export const mapStyles = [
  {
    id: 'os-outdoor',
    label: 'OS Outdoor',
    url: '/map/style/OS_VTS_27700_ESRI.json',
    thumbnail: '/public/images/os-outdoor.jpg',
    attribution,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  },
  {
    id: 'os-road',
    label: 'OS Road',
    url: '/map/style/OS_VTS_27700_Road.json',
    thumbnail: '/public/images/os-road.jpg',
    attribution,
    mapColorScheme: 'light',
    appColorScheme: 'light'
  }
]
