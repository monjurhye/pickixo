import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { SHOWN_VERTICALS } from '@/lib/verticals';
import { BUSINESS, BUSINESS_NAME } from '@/lib/business';

const COMPANY = [
  { href: '/about', label: 'About' },
  { href: '/our-apps', label: 'Our Android apps' },
  { href: '/pricing', label: 'Products & pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/shop', label: 'Shop: ebooks & tools' },
  { href: 'https://shop.pickixo.com', label: 'Amazon finds', external: true },
];

const LEGAL = [
  { href: '/terms', label: 'Terms of service' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/refund-policy', label: 'Refund & return policy' },
];

function FooterList({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p className="text-micro font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.href}>
            {item.external ? (
              <a href={item.href} className="text-small text-ink-muted hover:text-ink">
                {item.label}
              </a>
            ) : (
              <Link href={item.href} className="text-small text-ink-muted hover:text-ink">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The footer carries every section, the company pages and the policies, so all
 * of them are one click from any page — which is also what a payment gateway's
 * reviewer looks for first.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border-strong bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="font-display text-[1.25rem] font-medium text-ink">Pickixo</span>
            </div>
            <p className="mt-3 max-w-xs text-small text-ink-muted">
              Apps, games and useful tools, made in Bangladesh.
            </p>
            <p className="mt-4 text-small text-ink-muted">
              <a href={`mailto:${BUSINESS.email}`} className="hover:text-ink">
                {BUSINESS.email}
              </a>
              {BUSINESS.phone ? (
                <>
                  <br />
                  <a href={`tel:${BUSINESS.phone.replace(/[^+\d]/g, '')}`} className="hover:text-ink">
                    {BUSINESS.phone}
                  </a>
                </>
              ) : null}
            </p>
          </div>

          <FooterList
            title="Sections"
            items={SHOWN_VERTICALS.map((v) => ({ href: `/${v.slug}`, label: v.name }))}
          />
          <FooterList title="Company" items={COMPANY} />
          <FooterList title="Policies" items={LEGAL} />
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6
                        text-micro text-ink-subtle sm:flex-row sm:items-center
                        sm:justify-between">
          <p>© {new Date().getFullYear()} {BUSINESS_NAME}</p>
          {BUSINESS.tradeLicenceNo ? <p>Trade licence {BUSINESS.tradeLicenceNo}</p> : null}
        </div>
      </div>
    </footer>
  );
}
