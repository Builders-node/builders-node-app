import { Pencil, Plus, Search, Trash2, Users as UsersIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import type { StatusTone } from '../data/dashboard';
import { apiRequest } from '../lib/api';

type Occupant = { userId: string; name: string; email: string; moveInDate?: string | null };

type Unit = {
  id: string;
  name: string;
  description: string;
  availability: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number | null;
  priceCents: number;
  currency: string;
  availableFrom?: string | null;
  unitType?: { id: string; name: string } | null;
  occupants: Occupant[];
  openRequests: number;
};

type UnitType = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number | null;
  description?: string | null;
  unitCount: number;
};

type TypeForm = { name: string; price: string; bedrooms: string; bathrooms: string; squareFeet: string; description: string };
const emptyTypeForm: TypeForm = { name: '', price: '', bedrooms: '1', bathrooms: '1', squareFeet: '', description: '' };

type UnitsResponse = {
  summary: { total: number; available: number; occupied: number; unavailable: number };
  apartments: Unit[];
};

type OverviewUser = { id: string; fullName?: string | null; email: string };

type UnitForm = {
  name: string;
  availability: string;
};

const availabilityOptions = ['AVAILABLE', 'AVAILABLE_SOON', 'ASSIGNED', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE'];
const emptyForm: UnitForm = { name: '', availability: 'AVAILABLE' };

function availabilityTone(status: string): StatusTone {
  if (status === 'AVAILABLE' || status === 'AVAILABLE_SOON') return 'good';
  if (status === 'ASSIGNED' || status === 'OCCUPIED') return 'attention';
  if (status === 'MAINTENANCE' || status === 'UNAVAILABLE') return 'danger';
  return 'neutral';
}

function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
}

function statusLabel(status: string) {
  return status.split('_').join(' ');
}

export function Units() {
  const [data, setData] = useState<UnitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'unavailable'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<UnitForm>(emptyForm);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UnitForm>(emptyForm);
  const [editTemplateId, setEditTemplateId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<OverviewUser[]>([]);
  const [assignSelect, setAssignSelect] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<UnitType[]>([]);
  const [addTemplateId, setAddTemplateId] = useState('');
  const [showTypes, setShowTypes] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState<TypeForm>(emptyTypeForm);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);

  useEffect(() => {
    apiRequest<UnitsResponse>('/admin/apartments')
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load units.'))
      .finally(() => setIsLoading(false));
    apiRequest<{ users: OverviewUser[] }>('/admin/overview')
      .then((overview) => setUsers(overview.users))
      .catch(() => {
        /* non-fatal: the assign dropdown just stays empty */
      });
    apiRequest<UnitType[]>('/admin/unit-types')
      .then(setTypes)
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  function openAddForm() {
    setShowAddForm(true);
    setAddForm(emptyForm);
    setAddTemplateId('');
    setError(null);
  }

  function startTypeCreate() {
    setEditingTypeId(null);
    setTypeForm(emptyTypeForm);
    setShowTypeForm(true);
    setError(null);
  }

  function startTypeEdit(type: UnitType) {
    setEditingTypeId(type.id);
    setTypeForm({
      name: type.name,
      price: type.priceCents ? String(type.priceCents / 100) : '',
      bedrooms: String(type.bedrooms),
      bathrooms: String(type.bathrooms),
      squareFeet: type.squareFeet ? String(type.squareFeet) : '',
      description: type.description ?? '',
    });
    setShowTypeForm(true);
    setError(null);
  }

  async function saveType() {
    setIsSavingType(true);
    setError(null);
    const payload = {
      name: typeForm.name.trim(),
      priceCents: typeForm.price !== '' && Number.isFinite(Number(typeForm.price)) ? Math.round(Number(typeForm.price) * 100) : 0,
      bedrooms: Number(typeForm.bedrooms) || 0,
      bathrooms: Number(typeForm.bathrooms) || 0,
      squareFeet: typeForm.squareFeet !== '' && Number.isFinite(Number(typeForm.squareFeet)) ? Math.round(Number(typeForm.squareFeet)) : undefined,
      description: typeForm.description.trim(),
    };
    try {
      const path = editingTypeId ? `/admin/unit-types/${editingTypeId}` : '/admin/unit-types';
      setTypes(await apiRequest<UnitType[]>(path, { method: editingTypeId ? 'PATCH' : 'POST', body: JSON.stringify(payload) }));
      setShowTypeForm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save type.');
    } finally {
      setIsSavingType(false);
    }
  }

  async function deleteType(type: UnitType) {
    if (!window.confirm(`Delete type "${type.name}"? Units keep their data but lose the type link.`)) return;
    setError(null);
    try {
      setTypes(await apiRequest<UnitType[]>(`/admin/unit-types/${type.id}`, { method: 'DELETE' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete type.');
    }
  }

  async function assignResident(unitId: string) {
    const userId = assignSelect[unitId];
    if (!userId) return;
    setSavingId(unitId);
    setError(null);
    try {
      setData(await apiRequest<UnitsResponse>(`/admin/apartments/${unitId}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }));
      setAssignSelect((current) => ({ ...current, [unitId]: '' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not assign resident.');
    } finally {
      setSavingId(null);
    }
  }

  async function removeResident(unitId: string, userId: string) {
    setSavingId(unitId);
    setError(null);
    try {
      setData(await apiRequest<UnitsResponse>(`/admin/apartments/${unitId}/unassign`, { method: 'POST', body: JSON.stringify({ userId }) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove resident.');
    } finally {
      setSavingId(null);
    }
  }

  async function changeAvailability(unitId: string, availability: string) {
    setSavingId(unitId);
    setError(null);
    try {
      setData(await apiRequest<UnitsResponse>(`/admin/apartments/${unitId}`, { method: 'PATCH', body: JSON.stringify({ availability }) }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update availability.');
    } finally {
      setSavingId(null);
    }
  }

  async function createUnit() {
    setIsCreating(true);
    setError(null);
    try {
      const payload = { name: addForm.name.trim(), availability: addForm.availability, unitTypeId: addTemplateId };
      setData(await apiRequest<UnitsResponse>('/admin/apartments', { method: 'POST', body: JSON.stringify(payload) }));
      setShowAddForm(false);
      setAddForm(emptyForm);
      setAddTemplateId('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create unit.');
    } finally {
      setIsCreating(false);
    }
  }

  function startEdit(unit: Unit) {
    setEditingId(unit.id);
    setEditTemplateId(unit.unitType?.id ?? '');
    setEditForm({ name: unit.name, availability: unit.availability });
    setError(null);
  }

  async function saveEdit(unitId: string) {
    setIsSaving(true);
    setError(null);
    try {
      const payload = { name: editForm.name.trim(), availability: editForm.availability, unitTypeId: editTemplateId };
      setData(await apiRequest<UnitsResponse>(`/admin/apartments/${unitId}`, { method: 'PATCH', body: JSON.stringify(payload) }));
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update unit.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteUnit(unit: Unit) {
    if (!window.confirm(`Delete unit "${unit.name}"? This cannot be undone.`)) return;
    setSavingId(unit.id);
    setError(null);
    try {
      setData(await apiRequest<UnitsResponse>(`/admin/apartments/${unit.id}`, { method: 'DELETE' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete unit.');
    } finally {
      setSavingId(null);
    }
  }

  const summary = data?.summary;
  const query = search.trim().toLowerCase();
  const units = (data?.apartments ?? [])
    .filter((unit) => {
      if (filter === 'available') return unit.availability === 'AVAILABLE' || unit.availability === 'AVAILABLE_SOON';
      if (filter === 'occupied') return unit.occupants.length > 0;
      if (filter === 'unavailable') return unit.availability === 'UNAVAILABLE' || unit.availability === 'MAINTENANCE';
      return true;
    })
    .filter((unit) => !query || unit.name.toLowerCase().includes(query) || unit.description.toLowerCase().includes(query));

  const filters: Array<{ id: typeof filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: summary?.total ?? 0 },
    { id: 'available', label: 'Available', count: summary?.available ?? 0 },
    { id: 'occupied', label: 'Occupied', count: summary?.occupied ?? 0 },
    { id: 'unavailable', label: 'Unavailable', count: summary?.unavailable ?? 0 },
  ];

  return (
    <div className="page-stack admin-page">
      <PageHeader
        title="Units"
        description="All housing units — availability status, occupants, and open requests."
        action={
          <button className="primary-button" onClick={openAddForm}>
            <Plus size={16} />
            Add unit
          </button>
        }
      />
      {error ? <section className="panel"><p className="form-error">{error}</p></section> : null}
      {isLoading ? <section className="panel">Loading units...</section> : null}

      {showAddForm ? (
        <div className="modal-overlay" role="presentation" onClick={() => setShowAddForm(false)}>
        <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-label="Add unit" onClick={(event) => event.stopPropagation()}>
          <div className="admin-panel__head">
            <div>
              <h2>Add unit</h2>
              <p>Pick a type template, then just enter the unit number — price &amp; specs come from the template.</p>
            </div>
            <button className="icon-button" onClick={() => setShowAddForm(false)} aria-label="Close add unit"><X size={18} /></button>
          </div>

          {types.length === 0 ? (
            <div className="empty-state">Create a unit type first (in “Unit types” above) — units are always based on a type.</div>
          ) : (
            <>
              <div className="add-unit-grid">
                <label>
                  Type template *
                  <select value={addTemplateId} onChange={(event) => setAddTemplateId(event.target.value)}>
                    <option value="">Choose a type…</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} — {formatMoney(type.priceCents, type.currency)}/mo · {type.bedrooms} bed
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Unit number *
                  <input value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} placeholder="e.g. 207" />
                </label>
                <label>
                  Availability
                  <select value={addForm.availability} onChange={(event) => setAddForm({ ...addForm, availability: event.target.value })}>
                    {availabilityOptions.map((status) => (
                      <option key={status} value={status}>{statusLabel(status)}</option>
                    ))}
                  </select>
                </label>
              </div>

              {addTemplateId ? (
                (() => {
                  const template = types.find((type) => type.id === addTemplateId);
                  return template ? (
                    <p className="add-unit-preview">
                      From <strong>{template.name}</strong>: {formatMoney(template.priceCents, template.currency)}/mo · {template.bedrooms} bed · {template.bathrooms} bath
                      {template.squareFeet ? ` · ${template.squareFeet} ft²` : ''}
                    </p>
                  ) : null;
                })()
              ) : null}

              <div className="user-edit-actions">
                <button className="ghost-button compact-button" onClick={() => setShowAddForm(false)} disabled={isCreating}>Cancel</button>
                <button className="primary-button compact-button" onClick={() => void createUnit()} disabled={isCreating || !addForm.name.trim() || !addTemplateId}>
                  {isCreating ? 'Creating…' : 'Create unit'}
                </button>
              </div>
            </>
          )}
        </section>
        </div>
      ) : null}

      <section className="panel">
        <div className="admin-panel__head">
          <div>
            <h2>Unit types (templates)</h2>
            <p>Reusable apartment types (e.g. Studio, 1 Bedroom) with a shared price. Create units from a type — just enter the number.</p>
          </div>
          <div className="type-panel__actions">
            <button className="ghost-button compact-button" onClick={() => setShowTypes((value) => !value)}>{showTypes ? 'Hide' : `Show (${types.length})`}</button>
            <button className="primary-button compact-button" onClick={startTypeCreate}><Plus size={15} />Add type</button>
          </div>
        </div>

        {showTypeForm ? (
          <div className="modal-overlay" role="presentation" onClick={() => setShowTypeForm(false)}>
          <div className="profile-edit-modal" role="dialog" aria-modal="true" aria-label={editingTypeId ? 'Edit type' : 'Add type'} onClick={(event) => event.stopPropagation()}>
            <div className="admin-panel__head">
              <div><h2>{editingTypeId ? 'Edit type' : 'Add type'}</h2></div>
              <button className="icon-button" onClick={() => setShowTypeForm(false)} aria-label="Close type form"><X size={18} /></button>
            </div>
            <div className="user-edit-form">
              <label>Type name *<input value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} placeholder="e.g. Studio" /></label>
              <label>Monthly price (USD)<input type="number" min="0" value={typeForm.price} onChange={(event) => setTypeForm({ ...typeForm, price: event.target.value })} placeholder="950" /></label>
              <label>Bedrooms<input type="number" min="0" value={typeForm.bedrooms} onChange={(event) => setTypeForm({ ...typeForm, bedrooms: event.target.value })} /></label>
              <label>Bathrooms<input type="number" min="0" value={typeForm.bathrooms} onChange={(event) => setTypeForm({ ...typeForm, bathrooms: event.target.value })} /></label>
              <label>Square feet<input type="number" min="0" value={typeForm.squareFeet} onChange={(event) => setTypeForm({ ...typeForm, squareFeet: event.target.value })} /></label>
              <label className="user-edit-form__wide">Description<input value={typeForm.description} onChange={(event) => setTypeForm({ ...typeForm, description: event.target.value })} /></label>
            </div>
            <div className="user-edit-actions">
              <button className="ghost-button compact-button" onClick={() => setShowTypeForm(false)} disabled={isSavingType}>Cancel</button>
              <button className="primary-button compact-button" onClick={() => void saveType()} disabled={isSavingType || !typeForm.name.trim()}>{isSavingType ? 'Saving…' : editingTypeId ? 'Save type' : 'Create type'}</button>
            </div>
          </div>
          </div>
        ) : null}

        {showTypes ? (
          types.length === 0 ? (
            <div className="empty-state">No types yet. Add one to create units faster.</div>
          ) : (
            <div className="type-list">
              {types.map((type) => (
                <article className="type-chip" key={type.id}>
                  <div>
                    <strong>{type.name}</strong>
                    <span>{formatMoney(type.priceCents, type.currency)}/mo · {type.bedrooms} bed · {type.bathrooms} bath{type.squareFeet ? ` · ${type.squareFeet} ft²` : ''} · {type.unitCount} unit{type.unitCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="type-chip__actions">
                    <button className="ghost-button compact-button" onClick={() => startTypeEdit(type)}><Pencil size={13} />Edit</button>
                    <button className="compact-button applicant-action applicant-action--danger" onClick={() => void deleteType(type)}><Trash2 size={13} />Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : null}
      </section>

      {summary ? (
        <section className="status-grid admin-metrics">
          <article className="status-card"><div className="status-card__top"><span>Total units</span><StatusBadge tone="neutral">{String(summary.total)}</StatusBadge></div></article>
          <article className="status-card"><div className="status-card__top"><span>Available</span><StatusBadge tone="good">{String(summary.available)}</StatusBadge></div></article>
          <article className="status-card"><div className="status-card__top"><span>Occupied</span><StatusBadge tone="attention">{String(summary.occupied)}</StatusBadge></div></article>
          <article className="status-card"><div className="status-card__top"><span>Unavailable</span><StatusBadge tone="danger">{String(summary.unavailable)}</StatusBadge></div></article>
        </section>
      ) : null}

      <section className="panel">
        <div className="designation-toolbar">
          <div className="designation-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search units…" aria-label="Search units" />
          </div>
          <div className="designation-filter-bar" role="group" aria-label="Unit filters">
            {filters.map((item) => (
              <button className={filter === item.id ? 'designation-filter designation-filter--active' : 'designation-filter'} key={item.id} onClick={() => setFilter(item.id)}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </div>

        {!isLoading && units.length === 0 ? (
          <div className="empty-state">No units match this search or filter.</div>
        ) : (
          <div className="units-table-wrap">
            <table className="units-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Details</th>
                  <th>Price</th>
                  <th>Resident</th>
                  <th>Availability</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {units.map((unit) =>
                  editingId === unit.id ? (
                    <tr className="units-table__editrow" key={unit.id}>
                      <td colSpan={6}>
                        <div className="add-unit-grid">
                          <label>
                            Type template *
                            <select value={editTemplateId} onChange={(event) => setEditTemplateId(event.target.value)}>
                              <option value="">Choose a type…</option>
                              {types.map((type) => (
                                <option key={type.id} value={type.id}>{type.name} — {formatMoney(type.priceCents, type.currency)}/mo</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Unit number *
                            <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} placeholder="e.g. 207" />
                          </label>
                          <label>
                            Availability
                            <select value={editForm.availability} onChange={(event) => setEditForm({ ...editForm, availability: event.target.value })}>
                              {availabilityOptions.map((status) => (
                                <option key={status} value={status}>{statusLabel(status)}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {editTemplateId
                          ? (() => {
                              const template = types.find((type) => type.id === editTemplateId);
                              return template ? (
                                <p className="add-unit-preview">
                                  Specs from <strong>{template.name}</strong>: {formatMoney(template.priceCents, template.currency)}/mo · {template.bedrooms} bed · {template.bathrooms} bath
                                  {template.squareFeet ? ` · ${template.squareFeet} ft²` : ''}. Edit these in the type template.
                                </p>
                              ) : null;
                            })()
                          : null}
                        <div className="user-edit-actions">
                          <button className="ghost-button compact-button" onClick={() => setEditingId(null)} disabled={isSaving}>Cancel</button>
                          <button className="primary-button compact-button" onClick={() => void saveEdit(unit.id)} disabled={isSaving || !editForm.name.trim() || !editTemplateId}>
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={unit.id}>
                      <td>
                        <div className="units-table__unit">
                          <strong>{unit.name}</strong>
                          {unit.unitType ? <span className="unit-type-tag">{unit.unitType.name}</span> : null}
                        </div>
                      </td>
                      <td className="units-table__muted">
                        {unit.bedrooms} bed · {unit.bathrooms} bath{unit.squareFeet ? ` · ${unit.squareFeet} ft²` : ''}
                      </td>
                      <td>{unit.priceCents > 0 ? <strong>{formatMoney(unit.priceCents, unit.currency)}/mo</strong> : <span className="units-table__muted">—</span>}</td>
                      <td>
                        {unit.occupants.length > 0 ? (
                          <div className="units-table__residents">
                            {unit.occupants.map((occupant) => (
                              <span className="resident-chip" key={occupant.userId}>
                                <UsersIcon size={13} />
                                {occupant.name}
                                <button className="resident-chip__remove" disabled={savingId === unit.id} onClick={() => void removeResident(unit.id, occupant.userId)} aria-label={`Remove ${occupant.name}`}>
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="unit-assign unit-assign--table">
                            <select value={assignSelect[unit.id] ?? ''} onChange={(event) => setAssignSelect((current) => ({ ...current, [unit.id]: event.target.value }))}>
                              <option value="">Assign resident…</option>
                              {users
                                .filter((user) => !unit.occupants.some((occupant) => occupant.userId === user.id))
                                .map((user) => (
                                  <option key={user.id} value={user.id}>{user.fullName ?? user.email}</option>
                                ))}
                            </select>
                            <button className="primary-button compact-button" disabled={!assignSelect[unit.id] || savingId === unit.id} onClick={() => void assignResident(unit.id)}>
                              Assign
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <select className={`units-table__status units-table__status--${availabilityTone(unit.availability)}`} value={unit.availability} disabled={savingId === unit.id} onChange={(event) => void changeAvailability(unit.id, event.target.value)}>
                          {availabilityOptions.map((status) => (
                            <option key={status} value={status}>{statusLabel(status)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="units-table__actions">
                          <button className="icon-button" title="Edit unit" aria-label="Edit unit" onClick={() => startEdit(unit)}><Pencil size={16} /></button>
                          <button className="icon-button units-table__delete" title="Delete unit" aria-label="Delete unit" disabled={savingId === unit.id} onClick={() => void deleteUnit(unit)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
