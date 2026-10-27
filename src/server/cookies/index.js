import { cookiesGetController, cookiesPostController } from './controller.js'

export const cookies = {
  plugin: {
    name: 'cookies',
    register (server) {
      server.route([
        { method: 'GET', path: '/cookies', ...cookiesGetController },
        { method: 'POST', path: '/cookies', ...cookiesPostController }
      ])
    }
  }
}
