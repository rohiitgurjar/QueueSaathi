import { useCallback, useEffect, useState } from 'react';
import Alert from '../components/Alert.jsx';
import LoadingState from '../components/LoadingState.jsx';
import { apiRequest } from '../services/api.js';

const emptyClinic = {
  name: '', description: '', categoryId: '', address: '', openingHours: '', averageServiceDurationMinutes: 10,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingClinicId, setEditingClinicId] = useState('');
  const [clinicForm, setClinicForm] = useState(emptyClinic);
  const [categoryName, setCategoryName] = useState('');
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', clinicIds: [] });
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStaffClinicIds, setSelectedStaffClinicIds] = useState([]);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsResult, clinicResult, categoryResult, staffResult] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest('/clinics?includeInactive=true'),
        apiRequest('/clinics/categories?includeInactive=true'),
        apiRequest('/admin/staff'),
      ]);
      setStats(statsResult);
      setClinics(clinicResult.clinics || []);
      setCategories(categoryResult.categories || []);
      setStaff(staffResult.staff || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdminData(); }, [loadAdminData]);

  function setClinicField(field, value) {
    setClinicForm((current) => ({ ...current, [field]: value }));
  }

  function startEditClinic(clinic) {
    setEditingClinicId(clinic._id);
    setClinicForm({
      name: clinic.name,
      description: clinic.description,
      categoryId: clinic.category?._id || '',
      address: clinic.address,
      openingHours: clinic.openingHours,
      averageServiceDurationMinutes: clinic.averageServiceDurationMinutes,
    });
    document.getElementById('clinic-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetClinicForm() {
    setEditingClinicId('');
    setClinicForm(emptyClinic);
  }

  async function saveClinic(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const body = { ...clinicForm, averageServiceDurationMinutes: Number(clinicForm.averageServiceDurationMinutes) };
    try {
      await apiRequest(editingClinicId ? `/clinics/${editingClinicId}` : '/clinics', {
        method: editingClinicId ? 'PATCH' : 'POST', body,
      });
      setNotice(editingClinicId ? 'Clinic updated.' : 'Clinic created.');
      resetClinicForm();
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleClinic(clinic) {
    const nextActive = !clinic.active;
    const verb = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${verb} ${clinic.name}?`)) return;
    setError('');
    setNotice('');
    try {
      await apiRequest(`/clinics/${clinic._id}`, { method: 'PATCH', body: { active: nextActive } });
      setNotice(`${clinic.name} ${nextActive ? 'activated' : 'deactivated'}.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await apiRequest('/clinics/categories', { method: 'POST', body: { name: categoryName } });
      setCategoryName('');
      setNotice('Category created.');
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function toggleCategory(category) {
    const nextActive = !category.active;
    setError('');
    try {
      await apiRequest(`/clinics/categories/${category._id}`, { method: 'PATCH', body: { active: nextActive } });
      setNotice(`${category.name} ${nextActive ? 'activated' : 'deactivated'}.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeCategory(category) {
    if (!window.confirm(`Delete category “${category.name}”? Categories used by a clinic cannot be deleted.`)) return;
    setError('');
    try {
      await apiRequest(`/clinics/categories/${category._id}`, { method: 'DELETE', body: {} });
      setNotice('Category deleted.');
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function toggleNewStaffClinic(clinicId) {
    setStaffForm((current) => ({
      ...current,
      clinicIds: current.clinicIds.includes(clinicId)
        ? current.clinicIds.filter((id) => id !== clinicId)
        : [...current.clinicIds, clinicId],
    }));
  }

  async function createStaff(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await apiRequest('/admin/staff', { method: 'POST', body: staffForm });
      setNotice(`Staff account created for ${result.staff.email}.`);
      setStaffForm({ name: '', email: '', password: '', clinicIds: [] });
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function chooseStaff(staffId) {
    setSelectedStaffId(staffId);
    const selected = staff.find((member) => member.id === staffId);
    setSelectedStaffClinicIds(selected?.clinics.map((clinic) => clinic.id) || []);
  }

  function toggleAssignedClinic(clinicId) {
    setSelectedStaffClinicIds((current) => current.includes(clinicId)
      ? current.filter((id) => id !== clinicId)
      : [...current, clinicId]);
  }

  async function saveAssignments(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/admin/staff/${selectedStaffId}/clinics`, { method: 'PATCH', body: { clinicIds: selectedStaffClinicIds } });
      setNotice('Clinic assignments updated.');
      await loadAdminData();
      // Keep the just-saved selection checked while the fresh staff list renders.
      setSelectedStaffClinicIds([...selectedStaffClinicIds]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateStaff(member) {
    if (!window.confirm(`Deactivate ${member.name}’s staff account?`)) return;
    setError('');
    try {
      await apiRequest(`/admin/staff/${member.id}`, { method: 'DELETE', body: {} });
      setNotice('Staff account deactivated.');
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading && !stats) return <section className="container page-pad"><LoadingState label="Loading administrator dashboard…" /></section>;

  return (
    <section className="container page-pad dashboard-page">
      <div className="page-title-row">
        <div><p className="eyebrow">ADMIN SPACE</p><h1>Platform settings</h1><p className="muted">Manage clinics, service categories, and staff access.</p></div>
        <button className="button button-secondary" type="button" onClick={loadAdminData} disabled={loading}>Refresh data</button>
      </div>
      {notice && <Alert variant="success" onDismiss={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {stats && <div className="stats-grid admin-stats">
        <div className="stat-card"><span>Active clinics</span><strong>{stats.clinics.active}<small> / {stats.clinics.total}</small></strong></div>
        <div className="stat-card"><span>Patients</span><strong>{stats.users.patients}</strong></div>
        <div className="stat-card"><span>Staff</span><strong>{stats.users.staff}</strong></div>
        <div className="stat-card"><span>Tokens today</span><strong>{stats.queueToday.waiting + stats.queueToday.called + stats.queueToday.served + stats.queueToday.skipped + stats.queueToday.cancelled}</strong></div>
      </div>}

      <div className="admin-columns">
        <section className="panel" id="clinic-editor">
          <div className="subsection-heading"><h2>{editingClinicId ? 'Edit clinic' : 'Add a clinic'}</h2>{editingClinicId && <button className="text-button" type="button" onClick={resetClinicForm}>Cancel edit</button>}</div>
          <form className="form-stack" onSubmit={saveClinic}>
            <label>Clinic name<input required minLength={2} maxLength={120} value={clinicForm.name} onChange={(event) => setClinicField('name', event.target.value)} /></label>
            <label>Description<textarea required minLength={10} maxLength={1200} rows={3} value={clinicForm.description} onChange={(event) => setClinicField('description', event.target.value)} /></label>
            <label>Category<select required value={clinicForm.categoryId} onChange={(event) => setClinicField('categoryId', event.target.value)}><option value="">Choose a category</option>{categories.filter((category) => category.active).map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
            <label>Address<input required minLength={4} maxLength={240} value={clinicForm.address} onChange={(event) => setClinicField('address', event.target.value)} /></label>
            <label>Opening hours<input required minLength={3} maxLength={120} placeholder="Mon–Sat, 9:00 AM–6:00 PM" value={clinicForm.openingHours} onChange={(event) => setClinicField('openingHours', event.target.value)} /></label>
            <label>Average service duration (minutes)<input required type="number" min="1" max="240" value={clinicForm.averageServiceDurationMinutes} onChange={(event) => setClinicField('averageServiceDurationMinutes', event.target.value)} /></label>
            <button className="button button-primary" disabled={saving || !categories.some((category) => category.active)}>{saving ? 'Saving…' : editingClinicId ? 'Save clinic changes' : 'Create clinic'}</button>
          </form>
          <p className="field-hint">New clinics are created active and are not marked as demo data.</p>
          {!categories.some((category) => category.active) && <p className="field-hint">Add or reactivate a category before creating a clinic.</p>}
        </section>

        <section className="panel">
          <div className="subsection-heading"><h2>Categories</h2></div>
          <form className="inline-form" onSubmit={addCategory}>
            <label className="visually-hidden" htmlFor="new-category">New category name</label>
            <input id="new-category" required minLength={2} maxLength={60} placeholder="Add category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            <button className="button button-secondary" type="submit">Add</button>
          </form>
          <div className="admin-list">
            {categories.map((category) => (
              <div className="admin-list-row" key={category._id}>
                <span>{category.name} {!category.active && <span className="muted">(inactive)</span>}</span>
                <div>
                  <button className="text-button" type="button" onClick={() => toggleCategory(category)}>{category.active ? 'Deactivate' : 'Activate'}</button>
                  <button className="text-button danger-text" type="button" onClick={() => removeCategory(category)}>Delete</button>
                </div>
              </div>
            ))}
            {!categories.length && <p className="muted small">No categories yet.</p>}
          </div>
        </section>
      </div>

      <section className="panel admin-clinic-panel">
        <div className="subsection-heading"><div><h2>Clinics</h2><p className="muted small">Deactivation hides a clinic from public browsing without deleting its history.</p></div></div>
        <div className="admin-list">
          {clinics.map((clinic) => (
            <div className="admin-list-row clinic-admin-row" key={clinic._id}>
              <div><strong>{clinic.name}</strong><span>{clinic.category?.name} · {clinic.active ? 'Active' : 'Inactive'}{clinic.isDemo ? ' · Demo' : ''}</span></div>
              <div><button className="text-button" type="button" onClick={() => startEditClinic(clinic)}>Edit</button><button className="text-button" type="button" onClick={() => toggleClinic(clinic)}>{clinic.active ? 'Deactivate' : 'Activate'}</button></div>
            </div>
          ))}
          {!clinics.length && <p className="muted small">No clinics created yet.</p>}
        </div>
      </section>

      <div className="admin-columns">
        <section className="panel">
          <div className="subsection-heading"><h2>Create staff account</h2></div>
          <form className="form-stack" onSubmit={createStaff}>
            <label>Staff name<input required minLength={2} maxLength={80} value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} /></label>
            <label>Email<input required type="email" maxLength={254} value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
            <label>Temporary password<input required type="password" minLength={8} maxLength={128} value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /><span className="field-hint">Share securely; ask the staff member to use a unique password.</span></label>
            <fieldset className="checkbox-fieldset"><legend>Initial clinic assignments</legend>{clinics.filter((clinic) => clinic.active).map((clinic) => <label className="checkbox-label" key={clinic._id}><input type="checkbox" checked={staffForm.clinicIds.includes(clinic._id)} onChange={() => toggleNewStaffClinic(clinic._id)} />{clinic.name}</label>)}</fieldset>
            <button className="button button-primary" disabled={saving}>{saving ? 'Creating…' : 'Create staff'}</button>
          </form>
        </section>

        <section className="panel">
          <div className="subsection-heading"><h2>Staff assignments</h2></div>
          {staff.length ? <>
            <label className="form-label">Staff member<select value={selectedStaffId} onChange={(event) => chooseStaff(event.target.value)}><option value="">Choose staff</option>{staff.filter((member) => member.active).map((member) => <option value={member.id} key={member.id}>{member.name} · {member.email}</option>)}</select></label>
            {selectedStaffId && <form className="form-stack assignment-form" onSubmit={saveAssignments}>
              <fieldset className="checkbox-fieldset"><legend>Authorized clinics</legend>{clinics.map((clinic) => {
                const alreadyAssigned = selectedStaffClinicIds.includes(clinic._id);
                return <label className="checkbox-label" key={clinic._id}><input type="checkbox" checked={alreadyAssigned} disabled={!clinic.active && !alreadyAssigned} onChange={() => toggleAssignedClinic(clinic._id)} />{clinic.name}{!clinic.active && <span className="muted">(inactive — remove assignment)</span>}</label>;
              })}</fieldset>
              <button className="button button-secondary" disabled={saving}>Save assignments</button>
            </form>}
            <div className="admin-list compact-list">
              {staff.map((member) => <div className="admin-list-row" key={member.id}><span>{member.name} <span className="muted">({member.active ? 'active' : 'inactive'})</span></span>{member.active && <button className="text-button danger-text" type="button" onClick={() => deactivateStaff(member)}>Deactivate</button>}</div>)}
            </div>
          </> : <p className="muted small">No staff accounts yet.</p>}
        </section>
      </div>
    </section>
  );
}
