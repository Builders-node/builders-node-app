import { FileText, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import type { StatusTone } from '../data/dashboard';
import { apiRequest } from '../lib/api';

type AdminOverviewUser = {
  id: string;
  fullName?: string | null;
  email: string;
  referralCode?: string | null;
  role: string;
  membershipStatus?: string | null;
  residencyStatus: string;
  apartment?: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};

type AdminOverview = {
  users: AdminOverviewUser[];
};

type UserDetail = {
  id: string;
  email: string;
  referralCode?: string | null;
  role: string;
  mustChangePassword: boolean;
  emailVerifiedAt?: string | null;
  createdAt: string;
  profile?: { fullName?: string | null; phone?: string | null; location?: string | null } | null;
  membership?: { status: string; startingDate?: string | null; dueDate?: string | null; finishDate?: string | null } | null;
  residencyApplication?: { status: string; stage: string; requiredNextSteps?: string[]; lastSyncedAt?: string | null } | null;
  subscriptionPlan?: { planName: string; status: string; renewalDate?: string | null } | null;
  communityPlans: Array<{
    id: string;
    planName: string;
    status: string;
    amountCents: number;
    currency: string;
    purchasedAt: string;
    startsAt?: string | null;
    endsAt?: string | null;
    renewalDate?: string | null;
    source: string;
  }>;
  assignedApartment?: { moveInDate?: string | null; apartment: { name: string; availability: string; description: string } } | null;
  meals: Array<{ id: string; day: string; meal: string }>;
  cleaningSchedules: Array<{ id: string; frequency?: string | null; notes?: string | null; nextCleaning?: string | null }>;
  payments: Array<{ id: string; amountCents: number; currency: string; status: string; dueDate: string; description: string }>;
  supportTickets: Array<{ id: string; subject: string; status: string; createdAt: string }>;
  referredApplications: Array<{ id: string; fullName: string; email: string; status: string; createdAt: string; referralCode?: string | null }>;
  summary: { paidTotalCents: number; openPayments: number; supportTickets: number; rentalRequests: number };
};

type UserDrawerTab = 'account' | 'referrals' | 'residency' | 'housing' | 'plans' | 'payments' | 'meals' | 'support';
type UserFilterId = 'all' | 'current' | 'applicants' | 'past' | 'setup' | 'approved';

const userDrawerTabs: Array<{ id: UserDrawerTab; label: string }> = [
  { id: 'account', label: 'Account' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'residency', label: 'Residency' },
  { id: 'housing', label: 'Housing' },
  { id: 'plans', label: 'Plans' },
  { id: 'payments', label: 'Payments' },
  { id: 'meals', label: 'Meals' },
  { id: 'support', label: 'Support' },
];

const pastMembershipStatuses = new Set(['PAST_RESIDENT', 'PAST_MEMBER', 'FORMER_MEMBER', 'INACTIVE', 'CANCELLED', 'EXPIRED']);
const roleOptions = ['MEMBER', 'COMMUNITY_LEADER', 'MODERATOR', 'SUPER_ADMIN'];
const membershipStatusOptions = ['APPLICANT', 'APPROVED', 'ACTIVE_MEMBER', 'PAST_MEMBER', 'CANCELLED', 'SUSPENDED'];

type EditForm = { fullName: string; phone: string; location: string; membershipStatus: string; role: string };

const userFilters: Array<{ id: UserFilterId; label: string; matches: (user: AdminOverviewUser) => boolean }> = [
  { id: 'all', label: 'All', matches: () => true },
  {
    id: 'current',
    label: 'Current residents',
    matches: (user) => Boolean(user.apartment) || user.membershipStatus === 'ACTIVE_MEMBER',
  },
  {
    id: 'applicants',
    label: 'Applicants',
    matches: (user) => user.membershipStatus === 'APPLICANT' || user.residencyStatus !== 'APPROVED',
  },
  {
    id: 'past',
    label: 'Past residents',
    matches: (user) => pastMembershipStatuses.has(user.membershipStatus ?? ''),
  },
  {
    id: 'setup',
    label: 'Setup required',
    matches: (user) => user.mustChangePassword,
  },
  {
    id: 'approved',
    label: 'Approved',
    matches: (user) => user.residencyStatus === 'APPROVED' || user.membershipStatus === 'APPROVED',
  },
];

function toneForStatus(status: string): StatusTone {
  if (status === 'ACTIVE_MEMBER' || status === 'APPROVED' || status === 'PAID') return 'good';
  if (status === 'SUBMITTED' || status === 'IN_PROGRESS' || status === 'PENDING' || status === 'NOT_STARTED') return 'attention';
  if (status.includes('REJECTED') || status === 'OVERDUE' || status === 'FAILED') return 'danger';
  return 'neutral';
}

function roleLabel(role: string) {
  return role.split('_').join(' ');
}

function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isNewUser(createdAt?: string | null) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created <= NEW_USER_WINDOW_MS;
}

type AllUsersProps = {
  currentUserId?: string | null;
  currentUserRole?: string | null;
};

export function AllUsers({ currentUserId, currentUserRole }: AllUsersProps) {
  const [users, setUsers] = useState<AdminOverviewUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeUserTab, setActiveUserTab] = useState<UserDrawerTab>('account');
  const [activeFilter, setActiveFilter] = useState<UserFilterId>('all');
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<EditForm & { email: string }>({ email: '', fullName: '', phone: '', location: '', membershipStatus: 'ACTIVE_MEMBER', role: 'MEMBER' });
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ to: string; setupUrl: string; temporaryPassword: string } | null>(null);
  const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

  useEffect(() => {
    apiRequest<AdminOverview>('/admin/overview')
      .then((data) => setUsers(data.users))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load users.'))
      .finally(() => setIsLoading(false));
  }, []);

  async function openUser(userId: string) {
    setIsDrawerLoading(true);
    setError(null);
    setNotice(null);
    setActiveUserTab('account');
    setIsEditing(false);
    try {
      setSelectedUser(await apiRequest<UserDetail>(`/admin/users/${userId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load user detail.');
    } finally {
      setIsDrawerLoading(false);
    }
  }

  function openAddForm() {
    setAddForm({ email: '', fullName: '', phone: '', location: '', membershipStatus: 'ACTIVE_MEMBER', role: 'MEMBER' });
    setCreatedInvite(null);
    setError(null);
    setNotice(null);
    setShowAddForm(true);
  }

  async function createUser() {
    setIsCreating(true);
    setError(null);
    try {
      const result = await apiRequest<{ userId: string; invitation: { to: string; setupUrl: string; temporaryPassword: string } }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      setCreatedInvite(result.invitation);
      setNotice(`Created ${addForm.fullName || addForm.email}.`);
      await refreshUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create user.');
    } finally {
      setIsCreating(false);
    }
  }

  async function refreshUsers() {
    try {
      const data = await apiRequest<AdminOverview>('/admin/overview');
      setUsers(data.users);
    } catch {
      /* keep existing list on refresh failure */
    }
  }

  function startEditing() {
    if (!selectedUser) return;
    setEditForm({
      fullName: selectedUser.profile?.fullName ?? '',
      phone: selectedUser.profile?.phone ?? '',
      location: selectedUser.profile?.location ?? '',
      membershipStatus: selectedUser.membership?.status ?? 'APPLICANT',
      role: selectedUser.role,
    });
    setIsEditing(true);
    setNotice(null);
    setError(null);
  }

  async function saveUser() {
    if (!selectedUser || !editForm) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<UserDetail>(`/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setSelectedUser(updated);
      setIsEditing(false);
      setNotice('User updated.');
      await refreshUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update user.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUser() {
    if (!selectedUser) return;
    const label = selectedUser.profile?.fullName ?? selectedUser.email;
    if (!window.confirm(`Permanently delete ${label} and all their data? This cannot be undone.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest(`/admin/users/${selectedUser.id}`, { method: 'DELETE' });
      setSelectedUser(null);
      setNotice(`Deleted ${label}.`);
      await refreshUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete user.');
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleSelect(userId: string) {
    setSelectedIds((current) => (current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]));
  }

  async function bulkDelete() {
    const deletable = selectedIds.filter((id) => id !== currentUserId);
    if (deletable.length === 0) return;
    if (!window.confirm(`Permanently delete ${deletable.length} account${deletable.length === 1 ? '' : 's'} and all their data? This cannot be undone.`)) return;
    setIsBulkDeleting(true);
    setError(null);
    try {
      const result = await apiRequest<{ deleted: number }>('/admin/users/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ userIds: deletable }),
      });
      setSelectedIds([]);
      setSelectedUser(null);
      setNotice(`Deleted ${result.deleted} account${result.deleted === 1 ? '' : 's'}.`);
      await refreshUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete selected users.');
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const activeFilterConfig = userFilters.find((filter) => filter.id === activeFilter) ?? userFilters[0];
  const query = search.trim().toLowerCase();
  const filteredUsers = users
    .filter(activeFilterConfig.matches)
    .filter((user) => !query || (user.fullName ?? '').toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
  const selectableUsers = filteredUsers.filter((user) => user.id !== currentUserId);
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((user) => selectedIds.includes(user.id));

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : selectableUsers.map((user) => user.id));
  }
  const countForFilter = (filterId: UserFilterId) => {
    const filter = userFilters.find((item) => item.id === filterId);
    return filter ? users.filter(filter.matches).length : 0;
  };

  return (
    <div className="page-stack admin-page">
      <PageHeader
        title="All users"
        description="Review members, applicants, account setup, housing, payments, meals, and support state."
        action={
          <button className="primary-button" onClick={openAddForm}>
            <UserPlus size={16} />
            Add user
          </button>
        }
      />
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {notice ? <section className="panel"><p className="form-success">{notice}</p></section> : null}

      {showAddForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setShowAddForm(false)}>
        <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-label="Add user" onClick={(event) => event.stopPropagation()}>
          <div className="admin-panel__head">
            <div>
              <h2>Add user</h2>
              <p>Manually create a member account. They receive a setup link to choose their own password.</p>
            </div>
            <button className="icon-button" onClick={() => setShowAddForm(false)} aria-label="Close add user">
              <X size={18} />
            </button>
          </div>

          {createdInvite ? (
            <div className="invite-box">
              <p className="form-success">Account created for {createdInvite.to}.</p>
              <div className="detail-box">
                <div><span>Setup link</span><strong>{createdInvite.setupUrl}</strong></div>
                <div><span>Temporary password</span><strong>{createdInvite.temporaryPassword}</strong></div>
              </div>
              <p className="custom-plan-hint">Share the setup link (and temporary password) with the new member so they can set their own password.</p>
              <div className="user-edit-actions">
                <button className="ghost-button compact-button" onClick={() => setShowAddForm(false)}>Done</button>
                <button className="primary-button compact-button" onClick={openAddForm}>Add another</button>
              </div>
            </div>
          ) : (
            <>
              <div className="user-edit-form">
                <label>
                  Email *
                  <input type="email" value={addForm.email} onChange={(event) => setAddForm({ ...addForm, email: event.target.value })} placeholder="name@example.com" />
                </label>
                <label>
                  Full name
                  <input value={addForm.fullName} onChange={(event) => setAddForm({ ...addForm, fullName: event.target.value })} placeholder="Full name" />
                </label>
                <label>
                  Phone
                  <input value={addForm.phone} onChange={(event) => setAddForm({ ...addForm, phone: event.target.value })} placeholder="Phone" />
                </label>
                <label>
                  Location
                  <input value={addForm.location} onChange={(event) => setAddForm({ ...addForm, location: event.target.value })} placeholder="Location" />
                </label>
                <label>
                  Membership status
                  <select value={addForm.membershipStatus} onChange={(event) => setAddForm({ ...addForm, membershipStatus: event.target.value })}>
                    {membershipStatusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Role {isSuperAdmin ? '' : '(Super Admin only)'}
                  <select value={addForm.role} disabled={!isSuperAdmin} onChange={(event) => setAddForm({ ...addForm, role: event.target.value })}>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{roleLabel(role)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="user-edit-actions">
                <button className="ghost-button compact-button" onClick={() => setShowAddForm(false)} disabled={isCreating}>Cancel</button>
                <button className="primary-button compact-button" onClick={() => void createUser()} disabled={isCreating || !addForm.email.trim()}>
                  {isCreating ? 'Creating…' : 'Create user'}
                </button>
              </div>
            </>
          )}
        </section>
        </div>
      ) : null}
      {isLoading ? <section className="panel">Loading users...</section> : null}
      {isDrawerLoading ? <section className="panel">Loading user information...</section> : null}

      <section className="panel all-users-panel">
        <div className="designation-search all-users-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
          />
        </div>
        <div className="user-filter-bar" aria-label="User filters">
          {userFilters.map((filter) => (
            <button
              className={activeFilter === filter.id ? 'user-filter-button user-filter-button--active' : 'user-filter-button'}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >
              <span>{filter.label}</span>
              <strong>{countForFilter(filter.id)}</strong>
            </button>
          ))}
        </div>

        {isSuperAdmin ? (
          <div className="bulk-bar">
            <label className="bulk-select-all">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
              <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}</span>
            </label>
            {selectedIds.length > 0 ? (
              <div className="bulk-bar__actions">
                <button className="ghost-button compact-button" onClick={() => setSelectedIds([])}>Clear</button>
                <button className="compact-button drawer-delete" disabled={isBulkDeleting} onClick={() => void bulkDelete()}>
                  <Trash2 size={15} />
                  {isBulkDeleting ? 'Deleting…' : `Delete ${selectedIds.length}`}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="all-users-list">
          {filteredUsers.length === 0 ? <div className="empty-state user-filter-empty">No users match this search or filter.</div> : null}
          {filteredUsers.map((user) => (
            <div className={selectedIds.includes(user.id) ? 'all-user-item all-user-item--selected' : 'all-user-item'} key={user.id}>
              {isSuperAdmin ? (
                <input
                  type="checkbox"
                  className="all-user-check"
                  checked={selectedIds.includes(user.id)}
                  disabled={user.id === currentUserId}
                  onChange={() => toggleSelect(user.id)}
                  aria-label={`Select ${user.fullName ?? user.email}`}
                />
              ) : null}
              <button className="all-user-row" onClick={() => void openUser(user.id)}>
                <span className="all-user-avatar">{(user.fullName ?? user.email).slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>
                    {user.fullName ?? user.email}
                    {isNewUser(user.createdAt) ? <span className="badge-new">NEW</span> : null}
                  </strong>
                  <small>{user.email} · Joined {formatDate(user.createdAt)}</small>
                </span>
                <StatusBadge tone={toneForStatus(user.residencyStatus)}>{user.residencyStatus}</StatusBadge>
                <StatusBadge tone={user.mustChangePassword ? 'attention' : 'good'}>{user.mustChangePassword ? 'Setup required' : 'Ready'}</StatusBadge>
              </button>
            </div>
          ))}
        </div>
      </section>

      {selectedUser ? (
        <div className="drawer-overlay" role="presentation" onClick={() => setSelectedUser(null)}>
          <aside className="user-drawer" role="dialog" aria-modal="true" aria-label="User information" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-sticky-header">
              <button className="icon-button drawer-close" onClick={() => setSelectedUser(null)} aria-label="Close user detail">
                <X size={18} />
              </button>

              <header className="drawer-header">
                <span className="all-user-avatar all-user-avatar--large">{(selectedUser.profile?.fullName ?? selectedUser.email).slice(0, 2).toUpperCase()}</span>
                <div>
                  <h1>{selectedUser.profile?.fullName ?? selectedUser.email}</h1>
                  <p>{selectedUser.email}</p>
                </div>
                <div className="status-stack">
                  <StatusBadge tone={toneForStatus(selectedUser.residencyApplication?.status ?? 'NOT_STARTED')}>{selectedUser.residencyApplication?.status ?? 'NOT_STARTED'}</StatusBadge>
                  <StatusBadge tone={selectedUser.mustChangePassword ? 'attention' : 'good'}>{selectedUser.mustChangePassword ? 'Setup required' : 'Password set'}</StatusBadge>
                </div>
              </header>

              <div className="drawer-actions">
                {!isEditing ? (
                  <button className="ghost-button compact-button" onClick={startEditing}>
                    <Pencil size={15} />
                    Edit
                  </button>
                ) : null}
                {isSuperAdmin && currentUserId !== selectedUser.id ? (
                  <button className="compact-button drawer-delete" disabled={isDeleting} onClick={() => void deleteUser()}>
                    <Trash2 size={15} />
                    {isDeleting ? 'Deleting…' : 'Delete account'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="drawer-scroll">
              <nav className="admin-user-tabs">
                {userDrawerTabs.map((tab) => (
                  <button
                    className={activeUserTab === tab.id ? 'admin-user-tab admin-user-tab--active' : 'admin-user-tab'}
                    key={tab.id}
                    onClick={() => setActiveUserTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {activeUserTab === 'account' ? (
                <>
                  <section className="admin-user-stat-grid">
                    <article className="admin-user-stat"><span>Payments</span><strong>{selectedUser.payments.length}</strong><p>{selectedUser.summary.openPayments} open</p></article>
                    <article className="admin-user-stat"><span>Rentals</span><strong>{selectedUser.summary.rentalRequests}</strong><p>{selectedUser.assignedApartment?.apartment.name ?? 'No assignment'}</p></article>
                    <article className="admin-user-stat"><span>Support</span><strong>{selectedUser.summary.supportTickets}</strong><p>Tickets</p></article>
                  </section>
                  {isEditing && editForm ? (
                    <section className="panel">
                      <h2>Edit user</h2>
                      <div className="user-edit-form">
                        <label>
                          Full name
                          <input value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} placeholder="Full name" />
                        </label>
                        <label>
                          Phone
                          <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="Phone" />
                        </label>
                        <label>
                          Location
                          <input value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} placeholder="Location" />
                        </label>
                        <label>
                          Membership status
                          <select value={editForm.membershipStatus} onChange={(event) => setEditForm({ ...editForm, membershipStatus: event.target.value })}>
                            {membershipStatusOptions.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Role {isSuperAdmin ? '' : '(Super Admin only)'}
                          <select value={editForm.role} disabled={!isSuperAdmin} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>{roleLabel(role)}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="user-edit-actions">
                        <button className="ghost-button compact-button" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
                        <button className="primary-button compact-button" onClick={() => void saveUser()} disabled={isSaving}>
                          {isSaving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </section>
                  ) : (
                    <section className="panel">
                      <h2>Account</h2>
                      <div className="detail-box">
                        <div><span>Role</span><strong>{roleLabel(selectedUser.role)}</strong></div>
                        <div><span>Email verified</span><strong>{selectedUser.emailVerifiedAt ? 'Yes' : 'No'}</strong></div>
                        <div><span>Membership</span><strong>{selectedUser.membership?.status ?? '-'}</strong></div>
                        <div><span>Joined</span><strong>{formatDate(selectedUser.createdAt)}</strong></div>
                      </div>
                    </section>
                  )}
                </>
              ) : null}

              {activeUserTab === 'referrals' ? (
                <section className="panel admin-user-list-panel">
                  <h2>Referrals</h2>
                  <div className="detail-box">
                    <div><span>Referral code</span><strong>{selectedUser.referralCode ?? '-'}</strong></div>
                    <div><span>Apply link</span><strong>{selectedUser.referralCode ? `${window.location.origin}/?ref=${selectedUser.referralCode}` : '-'}</strong></div>
                    <div><span>Applicants referred</span><strong>{selectedUser.referredApplications.length}</strong></div>
                  </div>
                  {selectedUser.referredApplications.length === 0 ? <div className="empty-state">No referred applicants yet.</div> : null}
                  {selectedUser.referredApplications.map((application) => (
                    <div className="admin-user-list-row" key={application.id}>
                      <FileText size={18} />
                      <div><strong>{application.fullName}</strong><span>{application.email} · Applied {formatDate(application.createdAt)}</span></div>
                      <StatusBadge tone={toneForStatus(application.status)}>{application.status}</StatusBadge>
                    </div>
                  ))}
                </section>
              ) : null}

              {activeUserTab === 'residency' ? (
                <section className="panel">
                  <h2>E-Residency</h2>
                  <p>{selectedUser.residencyApplication?.stage ?? 'Not started'}</p>
                  <div className="next-step-list">
                    {(selectedUser.residencyApplication?.requiredNextSteps?.length ? selectedUser.residencyApplication.requiredNextSteps : ['No required next steps.']).map((step) => (
                      <div className="next-step" key={step}>{step}</div>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeUserTab === 'housing' ? (
                <section className="panel">
                  <h2>Housing</h2>
                  <div className="detail-box">
                    <div><span>Apartment</span><strong>{selectedUser.assignedApartment?.apartment.name ?? '-'}</strong></div>
                    <div><span>Status</span><strong>{selectedUser.assignedApartment?.apartment.availability ?? '-'}</strong></div>
                    <div><span>Move-in</span><strong>{formatDate(selectedUser.assignedApartment?.moveInDate)}</strong></div>
                  </div>
                </section>
              ) : null}

              {activeUserTab === 'plans' ? (
                <>
                  <section className="panel">
                    <h2>Subscription</h2>
                    <div className="detail-box">
                      <div><span>Plan</span><strong>{selectedUser.subscriptionPlan?.planName ?? '-'}</strong></div>
                      <div><span>Status</span><strong>{selectedUser.subscriptionPlan?.status ?? '-'}</strong></div>
                      <div><span>Renewal</span><strong>{formatDate(selectedUser.subscriptionPlan?.renewalDate)}</strong></div>
                      <div><span>Community plans</span><strong>{selectedUser.communityPlans.length}</strong></div>
                    </div>
                  </section>
                  <section className="panel admin-user-list-panel">
                    <h2>Community plans</h2>
                    <p>All Builders Node community plan purchases for this user.</p>
                    {selectedUser.communityPlans.length === 0 ? <div className="empty-state">No community plans purchased yet.</div> : null}
                    {selectedUser.communityPlans.map((plan) => (
                      <div className="admin-user-list-row" key={plan.id}>
                        <FileText size={18} />
                        <div><strong>{plan.planName}</strong><span>{plan.source} · Purchased {formatDate(plan.purchasedAt)} · {formatMoney(plan.amountCents, plan.currency)}</span></div>
                        <StatusBadge tone={toneForStatus(plan.status)}>{plan.status}</StatusBadge>
                      </div>
                    ))}
                  </section>
                </>
              ) : null}

              {activeUserTab === 'payments' ? (
                <section className="panel admin-user-list-panel">
                  <h2>Payments</h2>
                  <p>Total paid: {formatMoney(selectedUser.summary.paidTotalCents)}</p>
                  {selectedUser.payments.length === 0 ? <div className="empty-state">No payment records yet.</div> : null}
                  {selectedUser.payments.map((payment) => (
                    <div className="admin-user-list-row" key={payment.id}>
                      <FileText size={18} />
                      <div><strong>{payment.description}</strong><span>{formatMoney(payment.amountCents, payment.currency)} · Due {formatDate(payment.dueDate)}</span></div>
                      <StatusBadge tone={toneForStatus(payment.status)}>{payment.status}</StatusBadge>
                    </div>
                  ))}
                </section>
              ) : null}

              {activeUserTab === 'meals' ? (
                <section className="admin-user-grid">
                  <article className="panel">
                    <h2>Meals</h2>
                    {selectedUser.meals.length === 0 ? <div className="empty-state">No meals assigned.</div> : null}
                    {selectedUser.meals.map((meal) => <div className="next-step" key={meal.id}><strong>{meal.day}</strong><span>{meal.meal}</span></div>)}
                  </article>
                  <article className="panel">
                    <h2>Cleaning</h2>
                    {selectedUser.cleaningSchedules.length === 0 ? <div className="empty-state">No cleaning schedule.</div> : null}
                    {selectedUser.cleaningSchedules.map((cleaning) => <div className="next-step" key={cleaning.id}><strong>{cleaning.frequency ?? 'Cleaning'}</strong><span>{cleaning.notes ?? '-'}</span></div>)}
                  </article>
                </section>
              ) : null}

              {activeUserTab === 'support' ? (
                <section className="panel admin-user-list-panel">
                  <h2>Support</h2>
                  {selectedUser.supportTickets.length === 0 ? <div className="empty-state">No support tickets yet.</div> : null}
                  {selectedUser.supportTickets.map((ticket) => (
                    <div className="admin-user-list-row" key={ticket.id}>
                      <FileText size={18} />
                      <div><strong>{ticket.subject}</strong><span>Created {formatDate(ticket.createdAt)}</span></div>
                      <StatusBadge tone={toneForStatus(ticket.status)}>{ticket.status}</StatusBadge>
                    </div>
                  ))}
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
