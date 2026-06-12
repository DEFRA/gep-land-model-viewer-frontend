/**
 * @param {string} osid
 * @returns {Promise<{ osid: string, description: string | null }>}
 */
export async function getFeatureDetails (osid) {
  return {
    osid,
    description: null
  }
}
