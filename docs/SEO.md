# Technical SEO

What is implemented, why, and the manual steps only the site owner can do.

**A caveat that belongs at the top:** everything here makes pickixo.com
*eligible* to be crawled and indexed. Google and Bing decide whether and when
that actually happens. Nothing in this document is a claim that any page is
indexed.

---

## Where metadata comes from

`apps/web/src/lib/seo.ts` is the single source. Every page builds its metadata
through `buildMetadata()`, which requires a `path` and therefore forces each page
to name its own canonical URL.

```ts
export const metadata = buildMetadata({
  title: 'Free PDF Compressor — reduce PDF file size online',
  description: 'Compress a PDF online for free. No sign-up needed.',
  path: '/tools/pdf-compressor',
  index: false,          // omit for indexable pages
});
```

That function returns title, description, canonical, robots, Open Graph and
Twitter metadata together, so a new page cannot end up with three of the five.

### The bug this replaced

The root layout used to carry `alternates: { canonical: '/' }`. Next inherits
layout metadata into any page that does not override it, so `/search`,
`/sign-in`, `/sign-up` and **every 404** declared themselves canonical to the
homepage — telling Google those URLs *are* the homepage. The layout now sets no
canonical at all; it is a per-page decision or it does not exist.

The same fix removed `alternateLocale: ['bn_BD']`. There are no Bengali pages.
Announcing a locale the site does not serve is a claim it cannot back up, which
is also why there is no `hreflang` anywhere: the database carries `name_bn`, but
until there are real Bengali URLs, adding hreflang would be inventing them.

---

## Indexing rules

| Page | Indexed | Sitemap | Why |
|---|---|---|---|
| `/` | yes | yes | |
| `/ai` … `/bangladesh` | yes | yes | real section content, even when a section has nothing shipped |
| product, `live`/`beta` | yes | yes | a working product with its own description |
| product, `planned` | **no** | **no** | the page says "not built yet"; that is thin content |
| `/search` | no | no | one URL per query — an unbounded set of thin pages |
| `/sign-in`, `/sign-up` | no | no | no content to rank |
| `/dashboard`, `/my-apps`, `/activity`, `/settings` | no | no | private; also 307 to sign-in when signed out |
| `/api/*` | no | no | JSON; `X-Robots-Tag: noindex` on every response |
| 404 | no | no | genuine 404 status, and deliberately **no canonical** |

Every one of those noindex pages stays **crawlable**. That is deliberate and is
the single most misunderstood part of this: `robots.txt` stops a crawler
*fetching* a URL, `noindex` stops it *indexing* one, and a URL blocked in
robots.txt can still be indexed from an external link — with no description,
because the crawler was never allowed to read the page that said "do not index
me". Blocking a page you want out of the index is the one reliable way to keep
it in.

So `robots.txt` disallows exactly one thing:

```
User-Agent: *
Allow: /
Disallow: /api/

Host: https://pickixo.com
Sitemap: https://pickixo.com/sitemap.xml
```

Nothing blocks `/_next/`, CSS, JavaScript, fonts or images. Google renders a page
before judging it, and a page whose stylesheet it cannot fetch is a page it sees
broken.

---

## sitemap.xml

Generated from the product registry, so it cannot drift from what the site
actually serves. Two properties worth stating:

**It cannot leak.** The API query behind it selects only
`is_public AND is_indexable AND status IN ('live','beta')`. A private page, a
`planned` one or a `noindex` one is not excluded by someone remembering to
exclude it — the query cannot return it.

**lastmod is real.** It used to be `new Date()` on the listing pages, which told
search engines every page changed on every regeneration. That is false, and a
feed that cries wolf gets its lastmod discounted. A listing page now takes the
newest `updated_at` of the products it lists — genuinely when its content
changed. A section with nothing shipped gets **no** lastmod rather than an
invented one, and a lower priority.

Canonical tags and sitemap entries always agree: both are built from
`absoluteUrl()`.

It becomes a sitemap index when it needs to be — not before. The limit is 50,000
URLs; Pickixo has nine.

---

## Structured data

Only what the page visibly supports.

| Page | Schema |
|---|---|
| `/` | `Organization` + `WebSite` with `SearchAction`, linked by `@id` |
| section pages | `BreadcrumbList` |
| product pages | `BreadcrumbList` |
| product, `live`/`beta` only | `+ SoftwareApplication` with a real free `Offer` |

A `planned` product gets **no** `SoftwareApplication`. Describing something as a
free, in-stock WebApplication on a page that says "this is not built yet" is a
claim the page does not make, and Google treats that as spam rather than
optimism.

`SearchAction` is declared because `/search?q=` genuinely works. No ratings, no
reviews, no prices that are not real. `JobPosting` is **not** implemented:
`/jobs` currently lists career tools, not individual vacancies, and JobPosting
without a real listing, employer and date would be fabricated markup.

---

## Social sharing

`apps/web/public/og.png`, 1200×630, generated by
`scripts/make-og-image.py`. Every page emits absolute `og:image` and
`twitter:image` with explicit width, height and alt.

It is a static file rather than a per-request `next/og` render for two reasons:
`@vercel/og` crashes on Windows (it hands `fileURLToPath` a path it cannot
parse, and the build fails at prerender), and on a 4 GB box not rendering an
image on every share is the better trade anyway. **Re-run that script if the
brand colours change** — that is the cost of the static version.

---

## IndexNow

Implemented, configured, and verified working.

- Key file: `https://pickixo.com/<key>.txt`, served by nginx from
  `C:\Pickixo\wellknown` — outside the repository, so the key is never a file in
  version control. The nginx location matches only a hex filename at the root and
  that directory holds exactly one file.
- Ledger: `indexnow_submissions` records each URL with the content timestamp it
  had when announced. A URL is resubmitted only when its source row is **newer**
  than that, so rendering a page or a `use_count` ticking up submits nothing.
- Candidates come from the same query as the sitemap, so a private or unbuilt URL
  cannot be submitted.
- Failure is isolated: IndexNow being down never affects publishing.

```
GET  /api/admin/indexnow                     status, pending changes
POST /api/admin/indexnow/submit              submit what changed
POST /api/admin/indexnow/submit?dry_run=true report without sending
```

Verified end to end: one URL (`/ai/chat`, the only shipped product) accepted by
the endpoint; an immediate second run submitted nothing.

**Not yet automatic.** There is no admin UI for editing products, so nothing
currently changes `apps` rows at runtime for a trigger to hook. When product
editing is built, call `indexnow.submit(settings)` after the write. Until then
the endpoint above is the integration point, and it is safe to call on a
schedule — it sends only genuine changes.

---

## Google Search Console — exact steps

1. Go to <https://search.google.com/search-console> and sign in.
2. **Add property → URL prefix**, enter `https://pickixo.com`.
   (Choose *Domain* instead only if you want subdomains covered; that requires a
   DNS TXT record in Cloudflare rather than the meta tag below.)
3. Choose the **HTML tag** verification method. Copy the `content` value.
4. On the server, put it in the **repository-root** `.env` (the same file as
   everything else — `next.config.mjs` reads these four keys from there):
   ```
   GOOGLE_SITE_VERIFICATION=<the content value>
   ```
   Paste only the `content` value, not the whole `<meta>` tag.
5. Rebuild and restart the web tier:
   ```powershell
   cd C:\Users\Administrator\Desktop\Pickixo\apps\web
   npm run build
   Restart-Service Pickixo-Web -Force
   ```
6. Confirm the tag is live:
   ```bash
   curl -s https://pickixo.com/ | grep google-site-verification
   ```
7. Back in Search Console, click **Verify**.
8. **Sitemaps** → enter `sitemap.xml` → **Submit**. It should report *Success*
   and 9 discovered URLs.
9. **URL Inspection**: paste `https://pickixo.com/` → **Request indexing**.
   Repeat for `https://pickixo.com/ai/chat` and each section page you care about.
   There is a daily quota on manual requests; the sitemap covers the rest.
10. Check **Pages** (coverage) after a few days. Expect the `planned` product
    pages to appear as *Excluded by ‘noindex’ tag* — that is correct, not an
    error.

The verification token is never committed. An absent tag is correct; a made-up
one would fail verification anyway.

**Worth knowing:** Next only reads `.env` files inside `apps/web`, so the root
`.env` is invisible to it by default. `next.config.mjs` therefore copies an
allowlist of four keys across — `NEXT_PUBLIC_SITE_URL`, `INTERNAL_API_URL`,
`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`. Without that the build
succeeds and the tag silently never appears, which is only noticeable if you go
and look. It is an allowlist rather than the whole file so the database password
and JWT secret stay out of the web process.

---

## Bing Webmaster Tools — exact steps

1. Go to <https://www.bing.com/webmasters> and sign in.
2. The fastest route is **Import from Google Search Console**, which brings the
   property and sitemap across. Do that if GSC is already verified.
3. Otherwise **Add site manually**, enter `https://pickixo.com`, and choose the
   **Meta tag** option. Then:
   ```
   BING_SITE_VERIFICATION=<the content value of msvalidate.01>
   ```
   Rebuild and restart as in step 5 above, confirm with:
   ```bash
   curl -s https://pickixo.com/ | grep msvalidate
   ```
   then click **Verify**.
4. **Sitemaps** → **Submit sitemap** → `https://pickixo.com/sitemap.xml`.
5. **URL Inspection** for individual pages; **Site Explorer** for what Bing has
   found.
6. **Crawl information** for fetch errors.
7. IndexNow is already wired, so Bing is notified of changes without waiting for
   a crawl. Bing Webmaster Tools shows submissions under **IndexNow**.

Because Cloudflare proxies the site, Bing sees Cloudflare's IPs. That is normal
and needs no configuration.

---

## Performance notes

Measured, not assumed:

- Every public page is server-rendered. Titles, headings, descriptions, links
  and JSON-LD are in the HTML a crawler receives, not added by JavaScript.
- First Load JS ≈ 100 kB shared.
- Fonts use `display: swap` and are self-hosted by `next/font`, so no
  render-blocking request to a third party.
- `/_next/static/` is served with `Cache-Control: immutable, max-age=31536000`;
  the hashed filename changes when the content does.
- The only raster image is the social card, which no page loads.
- `viewport` is set in the root layout; the layout is responsive and was checked
  at 375 px.

Not measured here: real Core Web Vitals. Those need field data, which arrives in
Search Console once there is traffic.

---

## Known gaps

- ~~Cloudflare SSL mode~~ — now **Full (strict)**, set and verified 2026-09-12.

  Worth knowing why it mattered for SEO: while the zone was on Flexible,
  Cloudflare cached a 301 for `/robots.txt` and served it back pointing at the
  same URL. Every crawler that fetched robots.txt got an infinite redirect on the
  one file it reads before anything else. Fixed by purging the cache; prevented
  from recurring by Full (strict). **If anything ever produces a redirect again,
  purge the Cloudflare cache afterwards** — the origin being correct is not
  enough.
- **Eight of nine indexed pages are section listings.** Until products ship,
  there is little unique content to rank. That is a content problem, and the
  honest fix is shipping products, not more markup.
- **No `JobPosting`, `Course` or `FAQPage` schema.** Correct today, because there
  are no real job listings, courses or FAQs. Add them with the content.
- **IndexNow is not yet triggered automatically** — see above.
