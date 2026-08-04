import { useEffect, useState } from 'react';
import { CalendarDays, Github, Globe, Linkedin, MapPin, Search, Twitter, UserRound, Users, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiRequest } from '../lib/api';
import { useDirectory, useDirectoryProfile, type DirectoryDetail } from '../lib/queries';
import { useEscapeToClose } from '../lib/useModalA11y';
import { EventsTab } from './CommunityEvents';
import type { PageId } from '../data/dashboard';

const LINK_META = [
  { key: 'website', label: 'Website', icon: Globe },
  { key: 'twitter', label: 'X / Twitter', icon: Twitter },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'github', label: 'GitHub', icon: Github },
] as const;

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

export function Community({ currentUserId, setActivePage }: { currentUserId?: string | null; setActivePage?: (page: PageId) => void }) {
  const [tab, setTab] = useState<'members' | 'events'>('members');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const [selected, setSelected] = useState<DirectoryDetail | null>(null);
  useEscapeToClose(Boolean(selected), () => setSelected(null));

  // Debounce typing into the query key, not the request — that way a superseded
  // search is cancelled outright instead of racing the one that replaced it.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const directory = useDirectory(debouncedSearch, activeSkill);
  // The chip list comes from the *unfiltered* query, so filtering never shrinks
  // the very chips you're filtering with. When nothing is filtered this is the
  // same cache entry as above — one request, not two.
  const unfiltered = useDirectory('', null);
  // Swallowing this used to hide the "Add your profile" prompt entirely, so a
  // member whose request failed simply never learned they could join.
  const { data: mine, error: mineError } = useDirectoryProfile(currentUserId);

  const items = directory.data?.items ?? [];
  const skills = unfiltered.data?.skills ?? [];
  const isLoading = directory.isPending;
  const firstError = openError ?? directory.error ?? mineError ?? null;
  const error =
    firstError === null
      ? null
      : typeof firstError === 'string'
        ? firstError
        : firstError.message || 'Could not load the directory.';

  async function openMember(userId: string) {
    setOpenError(null);
    try {
      setSelected(await apiRequest<DirectoryDetail>(`/directory/${userId}`));
    } catch (caught) {
      setOpenError(caught instanceof Error ? caught.message : 'Could not open this profile.');
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Community"
        description="The people building alongside you, and what's happening this week."
        action={
          mine && tab === 'members' ? (
            <button className="ghost-button" onClick={() => setActivePage?.('myProfile')}>
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
          <button className="primary-button compact-button" onClick={() => setActivePage?.('myProfile')}>Add profile</button>
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

    </div>
  );
}
