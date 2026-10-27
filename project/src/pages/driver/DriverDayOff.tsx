import { useEffect, useState, useCallback } from 'react';
import { CalendarOff, Plus, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { DayOffRequest } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { pending: 'yellow', approved: 'green', rejected: 'red' } as const;

export function DriverDayOff() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DayOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ request_date: '', reason: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('day_off_requests')
      .select('*')
      .eq('driver_id', user.id)
      .order('request_date', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    setRequests(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    setSaving(true);
    if (!form.request_date) { setFormError('Date is required.'); setSaving(false); return; }
    try {
      const { error } = await supabase.from('day_off_requests').insert({
        driver_id: user.id,
        request_date: form.request_date,
        reason: form.reason.trim(),
      });
      if (error) throw error;
      setModalOpen(false);
      setForm({ request_date: '', reason: '' });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Day-Off Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Request time off and track status</p>
        </div>
        <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Request Day Off</Button>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No day-off requests" message="Submit a request when you need a day off." action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Request Day Off</Button>} />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Badge color={statusColors[req.status]}>{req.status}</Badge>
                <span className="text-sm font-medium text-slate-700">{req.request_date}</span>
              </div>
              {req.reason && <p className="text-sm text-slate-600">{req.reason}</p>}
              {req.admin_note && <p className="text-sm text-slate-500 mt-1 italic">Admin: {req.admin_note}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request Day Off">
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Input label="Date" type="date" name="request_date" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} required />
          <Textarea label="Reason" name="reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} placeholder="Optional reason" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
