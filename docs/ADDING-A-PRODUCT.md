# Adding a product

The registry is the point of the architecture: adding a product to the
catalogue, navigation, global search, My Apps, recommendations and the sitemap is
**one database row**, not a code change.

---

## 1. The row

```sql
INSERT INTO apps (
    slug, vertical, category_id, name, name_bn, tagline, description, icon, route,
    status, supports_my_apps, requires_auth,
    seo_title, seo_description, structured_data_type, sort_order
) VALUES (
    'image-resizer',
    'tools',
    (SELECT id FROM app_categories WHERE vertical='tools' AND slug='image'),
    'Image Resizer',
    'ইমেজ রিসাইজার',
    'Exact pixel sizes, no guessing',
    'Resize a JPEG or PNG to exact dimensions, with or without keeping the aspect ratio.',
    'crop',
    '/tools/image-resizer',
    'planned',          -- see status, below. This matters.
    true,
    false,
    'Free Image Resizer — resize JPG and PNG online',
    'Resize images to exact pixel dimensions online, free and without sign-up.',
    'WebApplication',
    70
);
```

That is the whole registration. The product now appears in `/tools`, in search,
in recommendations, and can be added to My Apps.

---

## 2. `status` is not decoration

| Status | Means | Landing page | Sitemap | Robots |
|---|---|---|---|---|
| `planned` | **not built** | says so plainly, no controls | excluded | `noindex, follow` |
| `beta` | built, rough | works, badged Beta | included | indexable |
| `live` | built | works | included | indexable |
| `disabled` | hidden | 404 | excluded | — |

Set `planned` until the thing actually works. This is not bureaucracy: a
`planned` product gets no software structured data, is kept out of the sitemap,
and tells the visitor it is not ready. Marking something `live` early produces a
page that lies to a user and a thin page submitted to Google as content.

A test enforces the honest end of this — `registry: nothing is marked live that
has not shipped` — and another checks every route in the registry actually
resolves.

---

## 3. `route` and `slug` may differ

`slug` is globally unique and is how the product is named in My Apps, activity
and search. `route` is the canonical URL.

They are usually the same shape (`pdf-compressor` → `/tools/pdf-compressor`) but
need not be: AI Chat has slug `ai-chat` and route `/ai/chat`, because
`/ai/ai-chat` reads badly.

Landing pages resolve by **route**, via `/api/app-by-route`. Resolving by the
last path segment would 404 exactly the products whose slug differs — which it
did, while those products were still being listed in the sitemap. Two tests now
guard it.

---

## 4. Building the actual thing

The row gives you a landing page. The working product is a page at
`route + '/start'`:

```
apps/web/src/app/tools/image-resizer/start/page.tsx
```

A static route wins over the dynamic `[vertical]/[slug]` segment, so this takes
precedence automatically.

While you are building it, record that it was opened so Recently Used works:

```ts
await apiFetch('/apps/image-resizer/opened', { method: 'POST' });
```

Product-level only — never the file, the prompt or the result (§21).

---

## 5. Flip the status

```sql
UPDATE apps SET status = 'beta', launched_at = now() WHERE slug = 'image-resizer';
```

The sitemap picks it up within the hour (`revalidate = 3600`), the landing page
becomes indexable, and the "Coming soon" badge disappears — everywhere at once,
because everywhere reads the same row.

---

## Adding a category

```sql
INSERT INTO app_categories (vertical, slug, name, name_bn, sort_order)
VALUES ('tools', 'audio', 'Audio', 'অডিও', 60);
```

## Adding a vertical

The one change that is not just a row, because routing has to know the segment
before it can ask the API anything:

1. Add it to the `CHECK` constraint on `apps.vertical` and
   `app_categories.vertical`.
2. Add it to `VERTICALS` in `apps/web/src/lib/verticals.ts`.
3. Add it to `PRIMARY_NAV` only if it earns a header slot — five is about the
   limit before the search box loses its room.
