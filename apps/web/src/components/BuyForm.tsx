import Link from 'next/link';

const field =
  'mt-1 block w-full rounded-control border border-border-strong bg-canvas px-3 py-2 text-body text-ink ' +
  'focus:border-accent focus:outline-none';

/**
 * A plain HTML form: it posts to the Pages Function /api/eps/checkout, which
 * prices the order from products.json and sends the buyer on to EPS. Works
 * with JavaScript off.
 */
export function BuyForm({ slug, price }: { slug: string; price: string }) {
  return (
    <details className="sm:col-span-2">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-control bg-accent px-5 py-2.5
                          text-body font-medium text-white hover:bg-accent-hover">
        Buy now — {price}
      </summary>
      <form method="post" action="/api/eps/checkout" className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="product" value={slug} />
        <label className="text-small text-ink sm:col-span-2">Your name
          <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={field} />
        </label>
        <label className="text-small text-ink">Email (the download link goes here)
          <input name="email" type="email" required maxLength={120} autoComplete="email" className={field} />
        </label>
        <label className="text-small text-ink">Mobile number
          <input name="phone" type="tel" required pattern="(\+?88)?01[3-9][0-9]{8}" placeholder="01XXXXXXXXX"
                 autoComplete="tel" className={field} />
        </label>
        <label className="text-small text-ink">City or district
          <input name="city" required minLength={2} maxLength={60} autoComplete="address-level2" className={field} />
        </label>
        <label className="text-small text-ink">Postcode (optional)
          <input name="postcode" maxLength={10} inputMode="numeric" autoComplete="postal-code" className={field} />
        </label>
        <label className="flex items-start gap-2 text-small text-ink-muted sm:col-span-2">
          <input type="checkbox" name="agree" value="yes" required className="mt-1" />
          <span>
            I have read the <Link href="/refund-policy">refund policy</Link> and{' '}
            <Link href="/terms">terms</Link>. This is a digital product: once it
            works as described, it is not refunded for a change of mind.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-control bg-accent px-5 py-2.5 text-body font-medium text-white hover:bg-accent-hover">
            Pay {price} with EPS
          </button>
          <p className="mt-2 text-micro text-ink-subtle">
            You will be taken to EPS&apos;s secure payment page.
          </p>
        </div>
      </form>
    </details>
  );
}

