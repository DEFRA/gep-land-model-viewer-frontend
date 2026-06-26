import path from 'node:path'
import hapi from '@hapi/hapi'
import Scooter from '@hapi/scooter'

import { router } from './router.js'
import { config } from '../config/config.js'
import { pulse } from './common/helpers/pulse.js'
import { catchAll } from './common/helpers/errors.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { sessionCache } from './common/helpers/session-cache/session-cache.js'
import { getCacheEngine } from './common/helpers/session-cache/cache-engine.js'
import { secureContext } from '@defra/hapi-secure-context'
import { contentSecurityPolicy } from './common/helpers/content-security-policy.js'
import { setCacheHeaders } from './common/helpers/cache-headers.js'
import { securityHeaders } from './common/helpers/security-headers.js'
import { metrics } from '@defra/cdp-metrics'
import { setupCaches } from './common/helpers/session/setup-caches.js'
import { getUserSession } from './common/helpers/auth/decorators.js'
import { oidcClient } from './common/helpers/auth/oidc-client.js'
import { federatedOidc } from './common/helpers/auth/federated-oidc.js'
import { cognitoClientAssertion } from './common/helpers/auth/client-assertion/cognito.js'
import { mockClientAssertion } from './common/helpers/auth/client-assertion/mock.js'
import { sessionStrategy } from './common/helpers/auth/session-strategy.js'

export async function createServer () {
  setupProxy()
  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      auth: {
        mode: 'required'
      },
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        // XSS Auditor is removed from modern browsers and can introduce
        // vulnerabilities when enabled. CSP provides modern XSS protection.
        // https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#x-xss-protection
        xss: 'disabled',
        noSniff: true,
        xframe: true,
        referrer: 'strict-origin-when-cross-origin'
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: {
      strictHeader: false
    }
  })
  setupCaches(server)
  server.decorate('request', 'getUserSession', getUserSession)

  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse
  ])

  const credentialProvider = config.get('cognito.enabled')
    ? cognitoClientAssertion
    : mockClientAssertion

  await server.register([
    sessionCache,
    credentialProvider,
    oidcClient,
    federatedOidc,
    sessionStrategy,
    nunjucksConfig,
    Scooter,
    contentSecurityPolicy,
    securityHeaders,
    router
  ])

  server.ext('onPreResponse', catchAll)
  server.ext('onPreResponse', setCacheHeaders)

  return server
}
