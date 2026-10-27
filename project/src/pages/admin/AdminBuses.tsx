import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Bus as BusIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Bus, BusWithDriver, Profile } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { active: 'green', maintenance: 'yellow', retired: 'red' } as const;

export function AdminBuses() {
  const [buses, setBuses] = useState<BusWithDriver[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bus | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ registration: '', model: '', capacity: '40', status: 'active', assigned_driver_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('buses')
      .select('*, assigned_driver:profiles!assigned_driver_id(id, display_name, email)')
      .order('created_at', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setBuses((data || []) as BusWithDriver[]);

    const { data: driverData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .order('display_name');
    setDrivers(driverData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ registration: '', model: '', capacity: '40', status: 'active', assigned_driver_id: '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (bus: Bus) => {
    setEditing(bus);
    setForm({
      registration: bus.registration,
      model: bus.model,
      capacity: String(bus.capacity),
      status: bus.status,
      assigned_driver_id: bus.assigned_driver_id || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const payload = {
      registration: form.registration.trim(),
      model: form.model.trim(),
      capacity: parseInt(form.capacity, 10),
      status: form.status,
      assigned_driver_id: form.assigned_driver_id || null,
    };

    if (!payload.registration) {
      setFormError('Registration is required.');
      setSaving(false);
      return;
    }
    if (isNaN(payload.capacity) || payload.capacity <= 0) {
      setFormError('Capacity must be a positive number.');
      setSaving(false);
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase.from('buses').update(payload).eq('id', editing.id);
        if (error) throw error;
        await supabase.rpc('insert_audit_log', {
          p_action: 'update_bus', p_target_table: 'buses', p_target_id: editing.id,
          p_detail: `Updated bus ${payload.registration}`,
        });
      } else {
        const { error } = await supabase.from('buses').insert(payload);
        if (error) throw error;
        await supabase.rpc('insert_audit_log', {
          p_action: 'create_bus', p_target_table: 'buses', p_target_id: '',
          p_detail: `Created bus ${payload.registration}`,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save bus');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('buses').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await supabase.rpc('insert_audit_log', {
        p_action: 'delete_bus', p_target_table: 'buses', p_target_id: deleteTarget.id,
        p_detail: `Deleted bus ${deleteTarget.registration}`,
      });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bus');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = buses.filter((b) =>
    b.registration.toLowerCase().includes(search.toLowerCase()) ||
    b.model.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Buses</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your fleet</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Bus</Button>
      </div>

      <Input placeholder="Search by registration or model..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState icon={BusIcon} title="No buses found" message="Add your first bus to get started." action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Bus</Button>} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Registration</th>
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-left px-4 py-3 font-medium">Capacity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Driver</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((bus) => (
                <tr key={bus.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{bus.registration}</td>
                  <td className="px-4 py-3 text-slate-600">{bus.model || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{bus.capacity}</td>
                  <td className="px-4 py-3"><Badge color={statusColors[bus.status]}>{bus.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{bus.assigned_driver?.display_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(bus)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTarget(bus)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Bus' : 'Add Bus'}>
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Input label="Registration" name="registration" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} required placeholder="ABC-1234" />
          <Input label="Model" name="model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Volvo 7900" />
          <Input label="Capacity" type="number" name="capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required min={1} />
          <Select label="Status" name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </Select>
          <Select label="Assigned Driver" name="assigned_driver_id" value={form.assigned_driver_id} onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}>
            <option value="">No driver assigned</option>
            {drivers.map((d) => (<option key={d.id} value={d.id}>{d.display_name || d.email}</option>))}
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Bus"
        message={`Are you sure you want to delete bus "${deleteTarget?.registration}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
