/**
 * @param {string} [sessionId]
 * @returns {Promise<import('./user-session.js').UserSession | null>}
 */
async function getUserSession (
  sessionId = this.state?.userSessionCookie?.sessionId
) {
  return sessionId ? this.server.session.get(sessionId) : null
}

export { getUserSession }
