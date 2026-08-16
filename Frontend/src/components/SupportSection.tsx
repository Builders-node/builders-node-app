import { LifeBuoy, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useCreateTicket, useReplyToTicket, useTickets, type SupportTicket } from '../lib/queries';
import { useEscapeToClose } from '../lib/useModalA11y';

/**
 * Support, from the member's side.
 *
 * There was no member's side: the endpoints and the whole admin queue existed,
 * and no screen in the app ever called them, so nothing could reach that queue
 * and a member with a problem had nowhere to say so.
 */
export function SupportSection({ currentUserId }: { currentUserId: string | null }) {
  const { data: tickets, isLoading } = useTickets(currentUserId);
  const createTicket = useCreateTicket(currentUserId);
  // The form lives in a dialog, like Maintenance next to it — the panel itself
  // is the thread list, and it used to lose its place as soon as the composer
  // pushed everything down.
  const [composing, setComposing] = useState(false);
  useEscapeToClose(composing, () => setComposing(false));
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!currentUserId) return null;

  function openComposer() {
    setSubject('');
    setMessage('');
    setError(null);
    setComposing(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createTicket.mutateAsync({ subject, message });
      setSubject('');
      setMessage('');
      setComposing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send that.');
    }
  }

  const open = tickets?.filter((ticket) => ticket.status !== 'RESOLVED') ?? [];
  const resolved = tickets?.filter((ticket) => ticket.status === 'RESOLVED') ?? [];

  return (
    <>
      <section className="panel support-panel">
        <div className="support-panel__head">
          <span className="support-panel__title">
            <span className="support-panel__icon" aria-hidden="true"><LifeBuoy size={16} /></span>
            Ask us anything
          </span>
          <button className="primary-button compact-button" onClick={openComposer}>
            New request
          </button>
        </div>

        {isLoading ? <p className="support-empty">Loading…</p> : null}
        {!isLoading && open.length === 0 && resolved.length === 0 ? (
          <p className="support-empty">Nothing open. Anything at all — the apartment, billing, your stay — starts here.</p>
        ) : null}

        {open.map((ticket) => (
          <Thread key={ticket.id} ticket={ticket} currentUserId={currentUserId} />
        ))}

        {resolved.length > 0 ? (
          <details className="support-history">
            <summary>Resolved ({resolved.length})</summary>
            {resolved.map((ticket) => (
              <Thread key={ticket.id} ticket={ticket} currentUserId={currentUserId} />
            ))}
          </details>
        ) : null}
      </section>

      {composing ? (
        <div className="modal-overlay" role="presentation" onClick={() => setComposing(false)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="New support request"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="modal-head">
              <div>
                <h2>Ask us anything</h2>
                <p>The apartment, billing, your stay — whatever it is, it starts here.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setComposing(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <label>
              Subject
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Wi-Fi in 602"
                required
                autoFocus
              />
            </label>
            <label>
              What do you need?
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                placeholder="A sentence is fine."
                required
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" type="submit" disabled={createTicket.isPending}>
              {createTicket.isPending ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Thread({ ticket, currentUserId }: { ticket: SupportTicket; currentUserId: string }) {
  const reply = useReplyToTicket(currentUserId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await reply.mutateAsync({ ticketId: ticket.id, message: body });
      setBody('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send your reply.');
    }
  }

  return (
    <article className="support-thread">
      <header className="support-thread__head">
        <strong>{ticket.subject}</strong>
        <span className={`support-status support-status--${ticket.status.toLowerCase()}`}>{label(ticket.status)}</span>
      </header>

      <div className="support-thread__messages">
        {ticket.messages.map((entry) => (
          <div
            key={entry.id}
            className={entry.author === 'ADMIN' ? 'support-message support-message--admin' : 'support-message'}
          >
            <span className="support-message__who">{entry.author === 'ADMIN' ? 'Builders Node' : 'You'}</span>
            <p>{entry.body}</p>
            <time dateTime={entry.createdAt}>{when(entry.createdAt)}</time>
          </div>
        ))}
      </div>

      {/* Resolved threads stay answerable — replying reopens them, which beats
          making someone file a second ticket about the same thing. */}
      <form className="support-reply" onSubmit={send}>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={ticket.status === 'RESOLVED' ? 'Reply to reopen…' : 'Reply…'}
          aria-label={`Reply to ${ticket.subject}`}
        />
        <button className="ghost-button compact-button" type="submit" disabled={reply.isPending || !body.trim()}>
          <Send size={14} />
          {reply.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
    </article>
  );
}

function label(status: string): string {
  return status === 'IN_PROGRESS' ? 'In progress' : status.charAt(0) + status.slice(1).toLowerCase();
}

function when(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
