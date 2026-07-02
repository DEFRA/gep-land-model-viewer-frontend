import inert from '@hapi/inert'

import { auth } from './auth/index.js'
import { cookies } from './cookies/index.js'
import { privacy } from './privacy/index.js'
import { accessibilityStatement } from './accessibility-statement/index.js'
import { health } from './health/index.js'
import { map } from './map/index.js'
import { osProxy } from './os-proxy/index.js'
import { wmsProxy } from './wms-proxy/index.js'
import { landModel } from './land-model/index.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'

export const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([auth, cookies, privacy, accessibilityStatement, map, osProxy, wmsProxy, landModel])

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
