import { useEffect, useRef, useState } from 'react';
import { Camera, Eye, EyeOff, Github, Globe, Linkedin, Lock, MapPin, Trash2, Twitter, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useProfile, useSaveProfile, type Links } from '../lib/queries';

type ProfileForm = {
  fullName: string;
  phone: string;
  location: string;
  headline: string;
  bio: string;
  skills: string[];
  links: Links;
  directoryOptIn: boolean;
  avatarUrl: string | null;
};

const LINK_FIELDS = [
  { key: 'website', label: 'Website', icon: Globe, placeholder: 'https://yoursite.com' },
  { key: 'twitter', label: 'X / Twitter', icon: Twitter, placeholder: 'https://x.com/you' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/you' },
  { key: 'github', label: 'GitHub', icon: Github, placeholder: 'https://github.com/you' },
] as const;

const EMPTY: ProfileForm = {
  fullName: '', phone: '', location: '', headline: '', bio: '',
  skills: [], links: {}, directoryOptIn: false, avatarUrl: null,
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

/**
 * Downscale to a 256px square JPEG before upload. Avatars ride inline in the
 * profile/directory JSON (see avatarUrlFor on the server), so keeping them
 * ~20 KB is what makes that affordable.
 */
function resizeToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image.'));
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process that image.'));
        // Centre-crop the short edge so faces don't get squashed.
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function MyProfile({ currentUserId }: { currentUserId?: string | null }) {
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isPending, error: loadError } = useProfile(currentUserId);
  const saveProfile = useSaveProfile(currentUserId);
  const saving = saveProfile.isPending;
  const email = data?.email ?? '';

  // Seed the form from the server once. Re-seeding on every cache update would
  // wipe whatever the member is in the middle of typing.
  const seeded = useRef(false);
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    const p = data.profile;
    setForm({
      fullName: p?.fullName ?? '',
      phone: p?.phone ?? '',
      location: p?.location ?? '',
      headline: p?.headline ?? '',
      bio: p?.bio ?? '',
      skills: p?.skills ?? [],
      links: p?.links ?? {},
      directoryOptIn: p?.directoryOptIn ?? false,
      avatarUrl: p?.avatarUrl ?? null,
    });
  }, [data]);

  function patch(next: Partial<ProfileForm>) {
    setForm((current) => ({ ...current, ...next }));
    setDirty(true);
    setNotice(null);
  }

  async function save(overrides: Partial<ProfileForm> = {}) {
    if (!currentUserId) return;
    const payload = { ...form, ...overrides };
    setError(null);
    try {
      await saveProfile.mutateAsync({
        fullName: payload.fullName,
        phone: payload.phone,
        location: payload.location,
        headline: payload.headline,
        bio: payload.bio,
        skills: payload.skills,
        links: payload.links,
        directoryOptIn: payload.directoryOptIn,
      });
      setDirty(false);
      setNotice('Profile saved.');
      // The mutation invalidates the profile cache, so the header name/avatar
      // and the directory card update on their own.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your profile.');
    }
  }

  async function onAvatarPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUserId) return;
    setError(null);
    try {
      const dataUrl = await resizeToAvatar(file);
      await saveProfile.mutateAsync({ avatarBase64: dataUrl, avatarFileType: 'image/jpeg' });
      patch({ avatarUrl: dataUrl });
      setDirty(false);
      setNotice('Photo updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload that photo.');
    }
  }

  async function removeAvatar() {
    if (!currentUserId) return;
    setError(null);
    try {
      await saveProfile.mutateAsync({ avatarBase64: null });
      patch({ avatarUrl: null });
      setDirty(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove the photo.');
    }
  }

  function addSkill() {
    const value = skillDraft.trim();
    if (!value) return;
    if (form.skills.some((s) => s.toLowerCase() === value.toLowerCase())) { setSkillDraft(''); return; }
    patch({ skills: [...form.skills, value] });
    setSkillDraft('');
  }

  if (isPending) {
    return (
      <div className="page-stack">
        <PageHeader title="Your profile" description="Loading…" />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Your profile"
        description="One place for everything about you — what other members see, and what stays private."
      />

      {error || loadError ? (
        <section className="panel">
          <p className="form-error">{error ?? loadError?.message ?? 'Could not load your profile.'}</p>
        </section>
      ) : null}
      {notice ? <section className="panel"><p className="form-success">{notice}</p></section> : null}

      {/* Identity */}
      <section className="panel profile-identity">
        <div className="profile-avatar">
          {form.avatarUrl ? <img src={form.avatarUrl} alt="" /> : <span>{initials(form.fullName || email)}</span>}
          <button
            type="button"
            className="profile-avatar__edit"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            aria-label="Change photo"
          >
            <Camera size={15} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarPicked} />
        </div>
        <div className="profile-identity__fields">
          <label>
            Full name
            <input value={form.fullName} onChange={(e) => patch({ fullName: e.target.value })} placeholder="Your name" />
          </label>
          <label>
            What are you building?
            <input
              value={form.headline}
              onChange={(e) => patch({ headline: e.target.value })}
              placeholder="e.g. An AI copilot for surgeons"
              maxLength={120}
            />
          </label>
          {form.avatarUrl ? (
            <button type="button" className="text-button profile-avatar__remove" onClick={() => void removeAvatar()} disabled={saving}>
              <Trash2 size={13} /> Remove photo
            </button>
          ) : null}
        </div>
      </section>

      {/* Everything below is grouped by who can see it, not by field type —
          that's the question a member actually has. */}
      <section className="panel">
        <div className="profile-section__head">
          <span className="profile-visibility profile-visibility--shared"><Eye size={13} /> Other members can see this</span>
        </div>

        <label>
          About you
          <textarea
            value={form.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            rows={4}
            maxLength={600}
            placeholder="A couple of sentences — background, what you're looking for, what you can help with."
          />
        </label>

        <label>
          Where you're from
          <input value={form.location} onChange={(e) => patch({ location: e.target.value })} placeholder="e.g. Lisbon, Portugal" />
        </label>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.85rem' }}>
            Skills — what could someone ask you about?
          </label>
          <div className="directory-card__skills" style={{ marginBottom: 8 }}>
            {form.skills.map((skill) => (
              <button
                type="button"
                key={skill}
                className="directory-skill directory-skill--removable"
                onClick={() => patch({ skills: form.skills.filter((s) => s !== skill) })}
              >
                {skill} <X size={11} />
              </button>
            ))}
            {form.skills.length === 0 ? <span className="profile-hint">None yet</span> : null}
          </div>
          <div className="directory-skill-input">
            <input
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="Add a skill and press Enter"
              maxLength={32}
              disabled={form.skills.length >= 12}
            />
            <button type="button" className="ghost-button compact-button" onClick={addSkill} disabled={form.skills.length >= 12}>
              Add
            </button>
          </div>
        </div>

        {LINK_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
          <label key={key}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={13} /> {label}</span>
            <input
              value={form.links[key] ?? ''}
              onChange={(e) => patch({ links: { ...form.links, [key]: e.target.value } })}
              placeholder={placeholder}
            />
          </label>
        ))}
      </section>

      {/* Directory listing + a preview of exactly what gets shown. */}
      <section className="panel">
        <label className="directory-optin">
          <input
            type="checkbox"
            checked={form.directoryOptIn}
            onChange={(e) => patch({ directoryOptIn: e.target.checked })}
          />
          <span>
            <strong>List me in the member directory</strong>
            <small>Only other active members — never public, never applicants. Turn it off and you disappear immediately.</small>
          </span>
        </label>

        {form.directoryOptIn ? (
          <>
            <p className="profile-hint" style={{ marginTop: 14 }}>This is how you appear:</p>
            <div className="directory-card directory-card--preview">
              <span className="directory-card__avatar">
                {form.avatarUrl ? <img src={form.avatarUrl} alt="" /> : initials(form.fullName || email)}
              </span>
              <span className="directory-card__body">
                <strong>{form.fullName || 'Your name'}</strong>
                {form.headline ? <span className="directory-card__headline">{form.headline}</span> : null}
                {form.location ? <span className="directory-card__meta"><MapPin size={12} /> {form.location}</span> : null}
                {form.skills.length > 0 ? (
                  <span className="directory-card__skills">
                    {form.skills.slice(0, 4).map((s) => <span className="directory-skill" key={s}>{s}</span>)}
                    {form.skills.length > 4 ? <span className="directory-skill directory-skill--more">+{form.skills.length - 4}</span> : null}
                  </span>
                ) : null}
              </span>
            </div>
          </>
        ) : null}
      </section>

      {/* Private */}
      <section className="panel">
        <div className="profile-section__head">
          <span className="profile-visibility profile-visibility--private"><Lock size={13} /> Private — staff only</span>
        </div>
        <label>
          Email
          <input value={email} disabled />
          <small className="profile-hint">Contact us if this needs to change.</small>
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+504 …" />
        </label>
      </section>

      <div className="profile-savebar">
        <span className="profile-hint">
          {dirty ? 'You have unsaved changes.' : <><EyeOff size={12} style={{ verticalAlign: '-2px' }} /> All changes saved.</>}
        </span>
        <button className="primary-button" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
