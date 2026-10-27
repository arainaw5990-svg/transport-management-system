import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ScheduleWithDetails, Bus, Profile, Route } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { scheduled: 'blue', completed: 'green', cancelled: 'red' } as const;
const statusIcons = { scheduled: Clock, completed: CheckCircle, cancelled: XCircle };

export function AdminSchedules() {
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleWithDetails | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({ bus_id: '', driver_id: '', route_id: '', trip_date: '', departure_time: '08:00', arrival_time: '09:00' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bus:buses(id, registration, model), driver:profiles!driver_id(id, display_name, email), route:routes(id, name, origin, destination)')
      .order('trip_date', { ascending: true })
      .order('departure_time', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    setSchedules((data || []) as ScheduleWithDetails[]);

    const [busRes, driverRes, routeRes] = await Promise.all([
      supabase.from('buses').select('*').neq('status', 'retired').order('registration'),
      supabase.from('profiles').select('*').eq('role', 'driver').order('display_name'),
      supabase.from('routes').select('*').order('name'),
    ]);
    setBuses(busRes.data || []);
    setDrivers(driverRes.data || []);
    setRoutes(routeRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ bus_id: '', driver_id: '', route_id: '', trip_date: new Date().toISOString().split('T')[0], departure_time: '08:00', arrival_time: '09:00' });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    if (!form.bus_id || !form.driver_id || !form.route_id || !form.trip_date) {
      setFormError('All fields are required.');
      setSaving(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('create_schedule', {
        p_bus_id: form.bus_id,
        p_driver_id: form.driver_id,
        p_route_id: form.route_id,
        p_trip_date: form.trip_date,
        p_departure_time: form.departure_time,
        p_arrival_time: form.arrival_time,
      });
      if (error) throw error;
      await supabase.rpc('insert_audit_log', {
        p_action: 'create_schedule', p_target_table: 'schedules', p_target_id: data || '',
        p_detail: `Scheduled bus on ${form.trip_date} ${form.departure_time}-${form.arrival_time}`,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (schedule: ScheduleWithDetails, newStatus: 'scheduled' | 'completed' | 'cancelled') => {
    try {
      const { error } = await supabase.rpc('update_schedule_status', { p_schedule_id: schedule.id, p_status: newStatus });
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await supabase.rpc('insert_audit_log', { p_action: 'delete_schedule', p_target_table: 'schedules', p_target_id: deleteTarget.id, p_detail: `Deleted schedule for ${deleteTarget.trip_date}` });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = schedules.filter((s) => {
    const matchesDate = !dateFilter || s.trip_date === dateFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesDate && matchesStatus;
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Schedules</h1>
          <p className="text-sm text-slate-500 mt-1">Manage trip assignments (overlap-safe)</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Schedule Trip</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Input type="date" label="Filter by date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} title="No schedules found" message="Create a trip schedule to get started." action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Schedule Trip</Button>} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Time</th>
                <th className="text-left px-4 py-3 font-medium">Bus</th>
                <th className="text-left px-4 py-3 font-medium">Driver</th>
                <th className="text-left px-4 py-3 font-medium">Route</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => {
                const StatusIcon = statusIcons[s.status];
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{s.trip_date}</td>
                    <td className="px-4 py-3 text-slate-600">{s.departure_time} — {s.arrival_time}</td>
                    <td className="px-4 py-3 text-slate-600">{s.bus?.registration || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.driver?.display_name || s.driver?.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.route?.name || '—'}</td>
                    <td className="px-4 py-3"><Badge color={statusColors[s.status]}><StatusIcon className="h-3 w-3 inline mr-1" />{s.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {s.status === 'scheduled' && (
                          <>
                            <button onClick={() => handleStatusChange(s, 'completed')} title="Mark complete" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-green-600"><CheckCircle className="h-4 w-4" /></button>
                            <button onClick={() => handleStatusChange(s, 'cancelled')} title="Cancel" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-orange-600"><XCircle className="h-4 w-4" /></button>
                          </>
                        )}
                        <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule Trip">
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Select label="Bus" name="bus_id" value={form.bus_id} onChange={(e) => setForm({ ...form, bus_id: e.target.value })} required>
            <option value="">Select a bus</option>
            {buses.map((b) => (<option key={b.id} value={b.id}>{b.registration} — {b.model} ({b.capacity} seats)</option>))}
          </Select>
          <Select label="Driver" name="driver_id" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} required>
            <option value="">Select a driver</option>
            {drivers.map((d) => (<option key={d.id} value={d.id}>{d.display_name || d.email}</option>))}
          </Select>
          <Select label="Route" name="route_id" value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })} required>
            <option value="">Select a route</option>
            {routes.map((r) => (<option key={r.id} value={r.id}>{r.name} ({r.origin} → {r.destination})</option>))}
          </Select>
          <Input label="Trip Date" type="date" name="trip_date" value={form.trip_date} onChange={(e) => setForm({ ...form, trip_date: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Departure" type="time" name="departure_time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} required />
            <Input label="Arrival" type="time" name="arrival_time" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Schedule"
        message={`Delete the trip on ${deleteTarget?.trip_date}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
