import type { Metadata } from 'next';
import Link from 'next/link';
import { PickbotControls } from '@/components/apps/PickbotControls';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/States';
import { apiFetchOrNull } from '@/lib/api';
import { forwardCookies, getCurrentUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Pickbot',
  robots: { index: false, follow: false },
};

/** Never cached: the bot rewrites the snapshot on its own schedule. */
export const dynamic = 'force-dynamic';

type Holding = {
  symbol: string;
  units: number;
  entryPrice: number;
  lastPrice: number;
  value: number;
  pnlPct: number;
  since: string;
};

type Pick = { day: string; exposure: number; equity: number; symbols: string[] };

type Trade = {
  time: string;
  day: string;
  action: string;
  symbol: string;
  units: number;
  price: number;
  value: number;
  reason: string;
};

type Snapshot = {
  generatedAt: string;
  mode: string;
  strategy: string;
  quoteAsset: string;
  lastClosedDay: string;
  lastRebalance: string | null;
  nextRebalance: string | null;
  startEquity: number;
  equity: number;
  cash: number;
  invested: number;
  exposurePct: number;
  peakEquity: number;
  drawdownPct: number;
  returnPct: number;
  halted: boolean;
  haltReason: string;
  holdings: Holding[];
  picks: Pick[];
  trades: Trade[];
};

function money(v: number, asset: string): string {
  return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${asset}`;
}

function signed(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function tone(v: number): 'success' | 'danger' | 'neutral' {
  if (v > 0.05) return 'success';
  if (v < -0.05) return 'danger';
  return 'neutral';
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface-sunken px-4 py-3">
      <p className="text-micro uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 text-subheading text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-micro text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

/**
 * Pickbot.
 *
 * A record, not a recommendation: what the bot decided and what those decisions are
 * worth, losses included. There is no buy button for the reader, no exchange
 * connection and no per-reader advice — see database/schema/019_markets.sql for why
 * that line is drawn in the product rather than left to a disclaimer.
 *
 * Running the bot is offered only to an admin, and the API checks that again.
 */
export default async function PickbotPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="Sign in to view Pickbot"
          body="This is a private research record rather than a published feed."
          action={
            <Link href="/sign-in">
              <Button>Sign in</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const snap = await apiFetchOrNull<Snapshot>('/markets/pickbot', { cookie: forwardCookies() });

  if (!snap) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="No snapshot yet"
          body="Pickbot writes one every hour once it has seen a closed daily candle. If this persists, check PICKBOT_SNAPSHOT_PATH in the API environment."
        />
      </div>
    );
  }

  const isAdmin = user.role === 'admin';
  const picks = [...snap.picks].reverse();
  const trades = [...snap.trades].reverse().slice(0, 40);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title text-ink">Pickbot</h1>
          <p className="mt-1 text-body text-ink-muted">
            A momentum bot that holds the strongest few coins, sells them when they turn,
            and shows every decision it has made.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={snap.mode === 'LIVE' ? 'danger' : 'accent'}>
            {snap.mode === 'PAPER' ? 'Paper money' : snap.mode}
          </Badge>
          {snap.halted ? <Badge tone="danger">Halted</Badge> : null}
        </div>
      </div>

      {snap.halted ? (
        <Card className="mt-6 border-danger/30">
          <CardBody>
            <p className="text-body text-ink">
              The kill switch is latched: {snap.haltReason || 'drawdown limit reached'}. Pickbot is
              in cash and will not trade again until a human clears it.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {isAdmin ? <PickbotControls halted={snap.halted} /> : null}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Return"
          value={signed(snap.returnPct)}
          hint={`from ${money(snap.startEquity, snap.quoteAsset)}`}
        />
        <Stat
          label="Equity"
          value={money(snap.equity, snap.quoteAsset)}
          hint={`cash ${money(snap.cash, snap.quoteAsset)}`}
        />
        <Stat label="Exposure" value={`${snap.exposurePct.toFixed(0)}%`} hint="rest sits in cash" />
        <Stat
          label="Drawdown"
          value={`${Math.max(0, snap.drawdownPct).toFixed(1)}%`}
          hint={`peak ${money(snap.peakEquity, snap.quoteAsset)}`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Holdings"
          description={
            snap.nextRebalance
              ? `Next rebalance ${snap.nextRebalance}. Data through ${snap.lastClosedDay}.`
              : `Data through ${snap.lastClosedDay}.`
          }
        />
        <CardBody className="pt-3">
          {snap.holdings.length === 0 ? (
            <p className="text-body text-ink-muted">
              Fully in cash — nothing currently passes the entry rules.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="text-left text-ink-subtle">
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 font-medium">Since</th>
                    <th className="pb-2 text-right font-medium">Entry</th>
                    {/*
                      "Close", not "Last": every figure in this table is the last CLOSED daily
                      candle, which is the only world the bot makes decisions in. Intraday it can
                      be several percent from the live price. The card description above says which
                      day that is.
                    */}
                    <th className="pb-2 text-right font-medium">Close</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                    <th className="pb-2 text-right font-medium">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.holdings.map((h) => (
                    <tr key={h.symbol} className="border-t border-border">
                      <td className="py-2 text-ink">{h.symbol.replace(/USDT$/, '')}</td>
                      <td className="py-2 text-ink-muted">{h.since}</td>
                      <td className="py-2 text-right text-ink-muted">{h.entryPrice}</td>
                      <td className="py-2 text-right text-ink-muted">{h.lastPrice}</td>
                      <td className="py-2 text-right text-ink">{money(h.value, snap.quoteAsset)}</td>
                      <td className="py-2 text-right">
                        <Badge tone={tone(h.pnlPct)}>{signed(h.pnlPct)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Every decision"
          description="Newest first. Nothing here is ever edited or removed — that is the whole point."
        />
        <CardBody className="pt-3">
          {picks.length === 0 ? (
            <p className="text-body text-ink-muted">No rebalance has happened yet.</p>
          ) : (
            <ul className="space-y-2">
              {picks.map((p) => (
                <li
                  key={p.day}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0"
                >
                  <span className="text-small text-ink-muted">{p.day}</span>
                  <span className="text-small text-ink">
                    {p.symbols.length === 0
                      ? 'Cash'
                      : p.symbols.map((s) => s.replace(/USDT$/, '')).join(' · ')}
                  </span>
                  <span className="text-micro text-ink-subtle">
                    {(p.exposure * 100).toFixed(0)}% invested
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Trades" description="The orders those decisions produced." />
        <CardBody className="pt-3">
          {trades.length === 0 ? (
            <p className="text-body text-ink-muted">No trades yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="text-left text-ink-subtle">
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Symbol</th>
                    <th className="pb-2 text-right font-medium">Price</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                    <th className="pb-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => (
                    <tr key={`${t.time}-${t.symbol}-${i}`} className="border-t border-border">
                      <td className="py-2 text-ink-muted">{t.time}</td>
                      <td className="py-2">
                        <Badge tone={t.action === 'BUY' ? 'accent' : 'neutral'}>{t.action}</Badge>
                      </td>
                      <td className="py-2 text-ink">{t.symbol.replace(/USDT$/, '')}</td>
                      <td className="py-2 text-right text-ink-muted">{t.price}</td>
                      <td className="py-2 text-right text-ink-muted">
                        {money(t.value, snap.quoteAsset)}
                      </td>
                      <td className="py-2 text-ink-subtle">{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="How Pickbot works, and what it is not" />
        <CardBody className="space-y-3 pt-3 text-small text-ink-muted">
          <p>
            Every 14 days it ranks liquid USDT pairs by their 60-day return, keeps only those
            trading above their own 200-day average, and holds the top three in equal weight.
            Exposure is scaled down so the basket targets 50% annualised volatility, so most of the
            time a large part of the book is cash. A holding that closes below its own 20-day
            average is sold the next day. Rules as configured:{' '}
            <code className="text-ink">{snap.strategy}</code>.
          </p>
          <p>
            Out-of-sample testing put the median return over 21 months at about +49% against BTC
            buy-and-hold at −10%, with a median drawdown near 33% — and the same rules returned
            anywhere from −17% to +99% depending only on which day they started. They beat 300 of
            300 random-pick control runs, which is the part worth believing. The tested universe
            excludes coins that have since been delisted, which flatters every number here.
          </p>
          <p className="text-ink">
            This page is an educational research record, not financial advice and not a signal
            service. It does not connect to anyone&rsquo;s exchange account and cannot place an
            order for you. Crypto trading carries the risk of total loss, past results do not
            predict future results, and trading digital assets is prohibited in some countries,
            Bangladesh among them.
          </p>
          <p className="text-micro text-ink-subtle">
            Snapshot generated {snap.generatedAt}. Mode: {snap.mode}. Pickbot refreshes itself once
            an hour without anyone pressing anything, but the figures above only move when a new
            daily candle closes — prices here are {snap.lastClosedDay}&rsquo;s closes, not the
            market right now.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
