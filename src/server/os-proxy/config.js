import { config } from '../../config/config.js'

export function getApiKey () {
  return config.get('map.osApiKey')
}
