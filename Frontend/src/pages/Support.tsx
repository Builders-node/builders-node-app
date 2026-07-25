import { PageHeader } from '../components/PageHeader';

export function Support() {
  return (
    <div className="page-stack">
      <PageHeader title="Support" description="Ask for help with membership, E-Residency sync, subscriptions, payments, or apartments." />
      <section className="panel form-panel">
        <label>Topic<input placeholder="Subscription activation" /></label>
        <label>Message<textarea placeholder="Tell the Builders Node team what you need." rows={6} /></label>
        <button className="primary-button">Send support request</button>
      </section>
    </div>
  );
}
