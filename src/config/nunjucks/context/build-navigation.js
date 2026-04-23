export function buildNavigation (request) {
  return [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: 'Map',
      href: '/map',
      current: request?.path === '/map'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    }
  ]
}
