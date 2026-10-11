// The owner of the pieces no DM holds right now (a demoted DM's monsters, until the
// next DM elevates and takes them: apps/server/src/domains/room/dmDemotion.ts). It
// can never be a uid (a uid is [A-Za-z0-9_-]), so no player ever matches it. Its own
// sub-module for the reason npcLimits.ts gives: an `export const` in the barrel is
// erased for the server.
export const DM_ROLE_OWNER = "@dm";
