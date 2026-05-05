import inert from '@hapi/inert'

import { home } from './home/index.js'
import { about } from './about/index.js'
import { cookies } from './cookies/index.js'
import { privacy } from './privacy/index.js'
import { accessibilityStatement } from './accessibility-statement/index.js'
import { health } from './health/index.js'
import { map } from './map/index.js'
import { osBaseMap } from './os-base-map/index.js'
import { osNamesSearch } from './os-names-search/index.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'

export const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([home, about, cookies, privacy, accessibilityStatement, map, osBaseMap, osNamesSearch])

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
