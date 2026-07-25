import { PageHeader } from '../components/PageHeader';

export function About() {
  return (
    <div className="page-stack">
      <PageHeader title="About Builders Node" description="A community for ambitious builders who want aligned residency, membership, and living infrastructure." />
      <section className="panel editorial-panel">
        <h2>What is Builders Node?</h2>
        <p>
          Builders Node is a private community experience built around practical membership operations: clear expectations, reliable payments, support, housing coordination, and a separate path for Prospera E-Residency.
        </p>
        <div className="benefit-grid">
          <div><strong>Community access</strong><span>Member status, onboarding, and expectations.</span></div>
          <div><strong>Operational clarity</strong><span>Dues, plan activation, and account history.</span></div>
          <div><strong>Housing support</strong><span>Apartment inventory and rental request tracking.</span></div>
        </div>
      </section>
      <section className="panel editorial-panel">
        <h2>Rules and expectations</h2>
        <p>
          Members are expected to keep dues current, maintain accurate profile information, follow community conduct standards, and complete any required external residency steps directly with Prospera.
        </p>
      </section>
    </div>
  );
}
