import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Markdown } from '../components/Markdown';
import { apiRequest } from '../lib/api';

type Resource = {
  id: string;
  title: string;
  slug: string;
  category: string;
  body: string;
};

export function Resources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Resource[]>('/resources')
      .then((data) => setResources(data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load resources.'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const item of resources) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [resources]);

  const active = resources.find((r) => r.id === openId) ?? null;

  if (active) {
    return (
      <div className="page-stack">
        <button className="ghost-button compact-button resource-back" onClick={() => setOpenId(null)}>
          <ArrowLeft size={16} /> All resources
        </button>
        <article className="panel resource-article">
          <span className="section-label">{active.category}</span>
          <h1>{active.title}</h1>
          <Markdown text={active.body} />
        </article>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="Resources" description="Guides and answers for living and building at Builders Node." />
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {loading ? <section className="panel"><p>Loading resources…</p></section> : null}
      {!loading && resources.length === 0 && !error ? (
        <section className="panel empty-state">No resources published yet.</section>
      ) : null}

      {grouped.map(([category, items]) => (
        <section className="panel resource-group" key={category}>
          <h2 className="resource-group__title">{category}</h2>
          <ul className="resource-list">
            {items.map((item) => (
              <li key={item.id}>
                <button className="resource-item" onClick={() => setOpenId(item.id)}>
                  <BookOpen size={16} className="resource-item__icon" />
                  <span>{item.title}</span>
                  <ChevronRight size={16} className="resource-item__chev" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
