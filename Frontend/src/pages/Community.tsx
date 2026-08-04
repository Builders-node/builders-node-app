import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Github, Globe, Linkedin, MapPin, Search, Twitter, UserRound, Users, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiRequest } from '../lib/api';
import { useEscapeToClose } from '../lib/useModalA11y';
import { EventsTab } from './CommunityEvents';

type DirectoryItem = {
  userId: string;
  fullName: string;
  location: string | null;
  avatarUrl: string | null;
  headline: string | null;
  skills: string[];
  memberSince: string | null;
  isSelf: boolean;
};

type DirectoryDetail = DirectoryItem & {
  bio: string | null;
  links: { website?: string; twitter?: string; linkedin?: string; github?: string };
  discordUsername: string | null;
};

type MyProfile = {
  fullName: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  links: { website?: string; twitter?: string; linkedin?: string; github?: string };
  directoryOptIn: boolean;
};

const LINK_META = [
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://yoursite.com' },
  { key: 'twitter', label: 'X / Twitter', icon: Twitter, placeholder: 'https://x.com/you' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/you' },
  { key: 'github', label: 'GitHub', icon: Github, placeholder: 'https://github.com/you' },
] as const;

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

export function Community({ currentUserId }: { currentUserId?: string | null }) {
  const [tab, setTab] = useState<'members' | 'events'>('members');
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [skills, setSkills] = useState<Array<{ name: string; count: number }>>([]);
  const [search, setSearch] = useState('');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<DirectoryDetail | null>(null);
  useEscapeToClose(Boolean(selected), () => setSelected(null));

  const [mine, setMine] = useState<MyProfile | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  useEscapeToClose(editorOpen, () => setEditorOpen(false));
  const [saving, setSaving] = useState(false);
  const [skillDraft, setSkillDraft] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (activeSkill) params.set('skill', activeSkill);
      const qs = params.toString();
      const data = await apiRequest<{ items: DirectoryItem[]; skills: Array<{ name: string; count: number }> }>(
        `/directory${qs ? `?${qs}` : ''}`,
      );
      setItems(data.items);
      // Only refresh the chip list on an unfiltered load, so filtering doesn't
      // shrink the very chips you're filtering with.
      if (!search.trim() && !activeSkill) setSkills(data.skills);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the directory.');
    } finally {
      setIsLoading(false);
    }
  }, [search, activeSkill]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200); // debounce typing
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!currentUserId) return;
    apiRequest<MyProfile>(`/users/${currentUserId}/directory-profile`)
      .then(setMine)
      .catch(() => undefined);
  }, [currentUserId]);

  async function openMember(userId: string) {
    try {
      setSelected(await apiRequest<DirectoryDetail>(`/directory/${userId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open this profile.');
    }
  }

  async function saveMine(next: Partial<MyProfile>) {
    if (!currentUserId || !mine) return;
    setSaving(true);
    try {
      const updated = await apiRequest<MyProfile>(`/users/${currentUserId}/directory-profile`, {
        method: 'PATCH',
        body: JSON.stringify(next),
      });
      setMine(updated);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  function addSkill() {
    const value = skillDraft.trim();
    if (!value || !mine) return;
    if (mine.skills.some((s) => s.toLowerCase() === value.toLowerCase())) { setSkillDraft(''); return; }
    setMine({ ...mine, skills: [...mine.skills, value] });
    setSkillDraft('');
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Community"
        description="The people building alongside you, and what's happening this week."
        action={
          mine && tab === 'members' ? (
            <button className="ghost-button" onClick={() => setEditorOpen(true)}>
              <UserRound size={16} />
              {mine.directoryOptIn ? 'Edit your profile' : 'Add your profile'}
            </button>
          ) : undefined
        }
      />

      <nav className="tab-row admin-group-tabs" aria-label="Community sections">
        <button className={tab === 'members' ? 'tab-chip tab-chip--active' : 'tab-chip'} onClick={() => setTab('members')}>
          <Users size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
          Members
        </button>
        <button className={tab === 'events' ? 'tab-chip tab-chip--active' : 'tab-chip'} onClick={() => setTab('events')}>
          <CalendarDays size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />
          Events
        </button>
      </nav>

      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}

      {tab === 'events' ? <EventsTab /> : null}

      {tab === 'members' ? (
      <>
      {/* Nudge: you can browse without being listed, but the directory only
          works if people join it. */}
      {mine && !mine.directoryOptIn ? (
        <div className="status-row status-row--action">
          <span className="status-row__icon" aria-hidden="true"><UserRound size={16} /></span>
          <span className="status-row__body">
            <strong>You're not in the directory yet</strong>
            <span>Add a short profile so other members know what you're working on.</span>
          </span>
          <button className="primary-button compact-button" onClick={() => setEditorOpen(true)}>Add profile</button>
        </div>
      ) : null}

      <section className="panel">
        <div className="directory-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members, skills, what they're building…"
            aria-label="Search the directory"
          />
          {search ? (
            <button className="icon-button" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>
          ) : null}
        </div>

        {skills.length > 0 ? (
          <div className="tab-row directory-skills">
            <button
              className={activeSkill === null ? 'tab-chip tab-chip--active' : 'tab-chip'}
              onClick={() => setActiveSkill(null)}
            >
              Everyone
            </button>
            {skills.map((skill) => (
              <button
                key={skill.name}
                className={activeSkill === skill.name ? 'tab-chip tab-chip--active' : 'tab-chip'}
                onClick={() => setActiveSkill(activeSkill === skill.name ? null : skill.name)}
              >
                {skill.name}
                <strong className="tab-chip__count">{skill.count}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {isLoading && items.length === 0 ? (
        <section className="panel"><p>Loading members…</p></section>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <section className="panel empty-state">
          {search || activeSkill
            ? 'No members match this search.'
            : 'Nobody has joined the directory yet — be the first.'}
        </section>
      ) : null}

      <div className="directory-grid">
        {items.map((member) => (
          <button className="directory-card" key={member.userId} onClick={() => void openMember(member.userId)}>
            <span className="directory-card__avatar">
              {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : initials(member.fullName)}
            </span>
            <span className="directory-card__body">
              <strong>
                {member.fullName}
                {member.isSelf ? <span className="directory-card__you">You</span> : null}
              </strong>
              {member.headline ? <span className="directory-card__headline">{member.headline}</span> : null}
              {member.location ? (
                <span className="directory-card__meta"><MapPin size={12} /> {member.location}</span>
              ) : null}
              {member.skills.length > 0 ? (
                <span className="directory-card__skills">
                  {member.skills.slice(0, 4).map((skill) => (
                    <span className="directory-skill" key={skill}>{skill}</span>
                  ))}
                  {member.skills.length > 4 ? (
                    <span className="directory-skill directory-skill--more">+{member.skills.length - 4}</span>
                  ) : null}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
      </>
      ) : null}

      {/* Member detail */}
      {selected ? (
        <div className="modal-overlay" role="presentation" onClick={() => setSelected(null)}>
          <div
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.fullName} profile`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div className="directory-detail__id">
                <span className="directory-card__avatar directory-card__avatar--lg">
                  {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" /> : initials(selected.fullName)}
                </span>
                <div>
                  <h2>{selected.fullName}</h2>
                  {selected.headline ? <p>{selected.headline}</p> : null}
                </div>
              </div>
              <button className="icon-button" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button>
            </div>

            {selected.location ? (
              <p className="directory-card__meta"><MapPin size={13} /> {selected.location}</p>
            ) : null}

            {selected.bio ? <p className="directory-detail__bio">{selected.bio}</p> : null}

            {selected.skills.length > 0 ? (
              <div className="directory-card__skills">
                {selected.skills.map((skill) => <span className="directory-skill" key={skill}>{skill}</span>)}
              </div>
            ) : null}

            {(Object.keys(selected.links).length > 0 || selected.discordUsername) ? (
              <div className="directory-detail__links">
                {LINK_META.map(({ key, label, icon: Icon }) => {
                  const href = selected.links[key];
                  if (!href) return null;
                  return (
                    <a key={key} className="ghost-button compact-button" href={href} target="_blank" rel="noopener noreferrer">
                      <Icon size={14} /> {label}
                    </a>
                  );
                })}
                {selected.discordUsername ? (
                  <span className="ghost-button compact-button">@{selected.discordUsername}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Your own profile */}
      {editorOpen && mine ? (
        <div className="modal-overlay" role="presentation" onClick={() => setEditorOpen(false)}>
          <form
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Your directory profile"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void saveMine(mine).then(() => setEditorOpen(false)); }}
          >
            <div className="modal-head">
              <div>
                <h2>Your directory profile</h2>
                <p>Shown to other active members only — never public, never to applicants.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditorOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <label className="directory-optin">
              <input
                type="checkbox"
                checked={mine.directoryOptIn}
                onChange={(event) => setMine({ ...mine, directoryOptIn: event.target.checked })}
              />
              <span>
                <strong>List me in the directory</strong>
                <small>Turn this off any time and you disappear from it immediately.</small>
              </span>
            </label>

            <label>
              What are you building?
              <input
                value={mine.headline ?? ''}
                onChange={(event) => setMine({ ...mine, headline: event.target.value })}
                placeholder="e.g. An AI copilot for surgeons"
                maxLength={120}
              />
            </label>

            <label>
              About you
              <textarea
                value={mine.bio ?? ''}
                onChange={(event) => setMine({ ...mine, bio: event.target.value })}
                rows={4}
                maxLength={600}
                placeholder="A couple of sentences — background, what you're looking for, what you can help with."
              />
            </label>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.85rem' }}>
                Skills — what could someone ask you about?
              </label>
              <div className="directory-card__skills" style={{ marginBottom: 8 }}>
                {mine.skills.map((skill) => (
                  <button
                    type="button"
                    className="directory-skill directory-skill--removable"
                    key={skill}
                    onClick={() => setMine({ ...mine, skills: mine.skills.filter((s) => s !== skill) })}
                  >
                    {skill} <X size={11} />
                  </button>
                ))}
              </div>
              <div className="directory-skill-input">
                <input
                  value={skillDraft}
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(); } }}
                  placeholder="Add a skill and press Enter"
                  maxLength={32}
                  disabled={mine.skills.length >= 12}
                />
                <button type="button" className="ghost-button compact-button" onClick={addSkill} disabled={mine.skills.length >= 12}>
                  Add
                </button>
              </div>
            </div>

            {LINK_META.map(({ key, label, placeholder }) => (
              <label key={key}>
                {label}
                <input
                  value={mine.links[key] ?? ''}
                  onChange={(event) => setMine({ ...mine, links: { ...mine.links, [key]: event.target.value } })}
                  placeholder={placeholder}
                />
              </label>
            ))}

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
