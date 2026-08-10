import { CreditCard, ExternalLink } from 'lucide-react';
import { useBilling, type MemberInvoice } from '../lib/queries';

/**
 * The member's invoices.
 *
 * Until now this side simply did not exist: an admin could issue an invoice and
 * the member had no screen on which to discover it, no amount, no due date and
 * no way to pay. The data had been served by the API from the beginning.
 */
export function BillingSection({ currentUserId }: { currentUserId: string | null }) {
  const { data, isLoading, error } = useBilling(currentUserId);

  if (!currentUserId) return null;
  // Nothing ever billed: show nothing at all rather than a heading over empty
  // space implying something is missing.
  if (!isLoading && !error && data && data.open.length === 0 && data.history.length === 0) return null;

  return (
    // The heading belongs to this component, not the page, because this is
    // where the "is there anything to show" decision is made.
    <section className="home-section">
      <h3 className="home-section__title">Billing</h3>

      <section className="panel billing-panel">
        {data && data.open.length > 0 ? (
          <div className="billing-panel__head">
            <span className="section-label">Open</span>
            <strong className="billing-panel__total">{money(data.openTotalCents, data.currency)}</strong>
          </div>
        ) : null}

        {isLoading ? <p className="billing-empty">Loading your invoices…</p> : null}
        {error ? <p className="form-error">Could not load your invoices.</p> : null}

        {data && data.open.length === 0 && data.history.length > 0 ? (
          <p className="billing-empty">Nothing outstanding — you&apos;re all paid up.</p>
        ) : null}

        {data?.open.map((invoice) => (
          <Invoice key={invoice.id} invoice={invoice} />
        ))}

        {data && data.history.length > 0 ? (
          <details className="billing-history">
            <summary>Past invoices ({data.history.length})</summary>
            {data.history.map((invoice) => (
              <Invoice key={invoice.id} invoice={invoice} past />
            ))}
          </details>
        ) : null}
      </section>
    </section>
  );
}

function Invoice({ invoice, past = false }: { invoice: MemberInvoice; past?: boolean }) {
  const overdue = invoice.status === 'OVERDUE';
  return (
    <article className={`invoice-row${overdue ? ' invoice-row--overdue' : ''}${past ? ' invoice-row--past' : ''}`}>
      <span className="invoice-row__icon" aria-hidden="true">
        <CreditCard size={15} />
      </span>
      <span className="invoice-row__body">
        <strong>{invoice.description}</strong>
        <small>
          {money(invoice.amountCents, invoice.currency)}
          {' · '}
          {invoice.paidAt ? `paid ${day(invoice.paidAt)}` : `${overdue ? 'was due' : 'due'} ${day(invoice.dueDate)}`}
        </small>
      </span>
      <span className="invoice-row__end">
        <span className={`invoice-status invoice-status--${invoice.severity}`}>{label(invoice.status)}</span>
        {/* Only where there's somewhere to go. An invoice settled by bank
            transfer just needs to be visible, not clickable. */}
        {invoice.payUrl && !invoice.paidAt ? (
          <a className="primary-button compact-button" href={invoice.payUrl} target="_blank" rel="noopener noreferrer">
            Pay
            <ExternalLink size={14} />
          </a>
        ) : null}
        {invoice.receiptUrl ? (
          <a className="ghost-button compact-button" href={invoice.receiptUrl} target="_blank" rel="noopener noreferrer">
            Receipt
          </a>
        ) : null}
      </span>
    </article>
  );
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

/** Due dates are calendar days — read them in UTC so they don't shift a day. */
function day(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function label(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
