/**
 * Cloud configuration.
 *
 * All three values are public by design: the Stack Auth publishable key and the
 * Data API URL are meant to ship in a browser bundle. Nothing here grants any
 * access on its own — every row in the database is behind row-level security
 * keyed on the signed-in user, so an unauthenticated request reads nothing.
 *
 * Leave them unset and the game simply runs local-only: saves, exports and
 * imports all still work, there is just no sync.
 */
// `import.meta.env` only exists under Vite; reading it bare breaks plain-Node
// imports, which is how these modules get unit-tested.
const env = import.meta.env ?? {};

export const CLOUD = {
  dataApiUrl: env.VITE_NEON_DATA_API_URL || '',
  stackProjectId: env.VITE_STACK_PROJECT_ID || '',
  stackPublishableKey: env.VITE_STACK_PUBLISHABLE_CLIENT_KEY || '',
};

export function isCloudConfigured() {
  return Boolean(CLOUD.dataApiUrl && CLOUD.stackProjectId && CLOUD.stackPublishableKey);
}
