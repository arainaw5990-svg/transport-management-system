import { useEffect, useState, useCallback } from 'react';
import { CalendarOff, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DayOffRequestWithDetails } from '@/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { pending: 'yellow', approved: 'green', rejected: 'red' } as const;

export function AdminDayOff() {
  const [requests, setRequests] = useState<DayOffRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewTarget, setReviewTarget] = useState<DayOffRequestWithDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('day_off_requests')
      .select('*, driver:profiles!driver_id(id, display_name, email)')
      .order('request_date', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    setRequests((data || []) as DayOffRequestWithDetails[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReview = (req: DayOffRequestWithDetails) => {
    setReviewTarget(req);
    setAdminNote(req.admin_note);
    setFormError(null);
    setModalOpen(true);
  };

  const handleApprove = async (status: 'approved' | 'rejected') => {
    if (!reviewTarget) return;
    setSaving(true);
    setFormError(null);
    try {
      const { error } = await supabase.rpc('approve_day_off', {
        p_request_id: reviewTarget.id,
        p_status: status,
        p_admin_note: adminNote,
      });
      if (error) throw error;
      await supabase.rpc('insert_audit_log', { p_action: `${status}_day_off`, p_target_table: 'day_off_requests', p_target_id: reviewTarget.id, p_detail: `${status} day-off for ${reviewTarget.driver?.display_name}` });
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update request');
    } finally {
      setSaving(false);
    }
  };

  const filtered = requests.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Day-Off Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Review driver day-off requests</p>
      </div>

      <div className="flex gap-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No day-off requests" />
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div key={req.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={statusColors[req.status]}>{req.status}</Badge>
                    <span className="text-sm font-medium text-slate-700">{req.driver?.display_name || req.driver?.email}</span>
                  </div>
                  <p className="text-sm text-slate-600"><span className="font-medium">Date:</span> {req.request_date}</p>
                  {req.reason && <p className="text-sm text-slate-600 mt-1"><span className="font-medium">Reason:</span> {req.reason}</p>}
                  {req.admin_note && <p className="text-sm text-slate-500 mt-1"><span className="font-medium">Admin note:</span> {req.admin_note}</p>}
                </div>
                {req.status === 'pending' && (
                  <Button size="sm" variant="outline" onClick={() => openReview(req)}>Review</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Review Day-Off Request">
        {formError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
        <div className="space-y-4">
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            <p><span className="font-medium">Driver:</span> {reviewTarget?.driver?.display_name}</p>
            <p><span className="font-medium">Date:</span> {reviewTarget?.request_date}</p>
            <p><span className="font-medium">Reason:</span> {reviewTarget?.reason || '—'}</p>
          </div>
          <Textarea label="Admin Note" name="admin_note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} placeholder="Optional note for the driver" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="danger" onClick={() => handleApprove('rejected')} loading={saving}><X className="h-4 w-4" /> Reject</Button>
            <Button type="button" onClick={() => handleApprove('approved')} loading={saving}><Check className="h-4 w-4" /> Approve</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
