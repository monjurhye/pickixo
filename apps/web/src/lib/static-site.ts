/**
 * Whether this build is the static site: plain files on a file host, with no
 * API, no database and no sessions behind it.
 *
 * Set by scripts/build-static.mjs and by nothing else. The ordinary build
 * (`npm run build`, served by `next start` behind nginx) leaves it false, and
 * every branch guarded by it is then dead code — so the server build behaves
 * exactly as it did before this flag existed.
 *
 * What the static site gives up is anything that needs to know who is asking:
 * accounts, My Apps, search, and the tools whose work happens on the server.
 * Those pages are left out of the build, and the links to them are hidden
 * rather than left pointing at a 404.
 */
export const IS_STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === '1';
