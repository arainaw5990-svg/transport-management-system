import { useEffect, useState, useCallback } from 'react';
import { Wrench, Plus, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MaintenanceIssueWithDetails, Bus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { open: 'red', in_progress: 'yellow', resolved: 'green' } as const;

export function AdminIssues() {
  const [issues, setIssues] = useState<MaintenanceIssueWithDetails[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editTarget, setEditTarget] = useState<MaintenanceIssueWithDetails | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusForm, setStatusForm] = useState('open');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('maintenance_issues')
      .select('*, bus:buses(id, registration), reporter:profiles!reported_by(id, display_name)')
      .order('created_at', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setIssues((data || []) as MaintenanceIssueWithDetails[]);
    const { data: busData } = await supabase.from('buses').select('*').order('registration');
    setBuses(busData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (issue: MaintenanceIssueWithDetails) => {
    setEditTarget(issue);
    setStatusForm(issue.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setFormError(null);
    try {
      const { error } = await supabase.from('maintenance_issues').update({ status: statusForm }).eq('id', editTarget.id);
      if (error) throw error;
      await supabase.rpc('insert_audit_log', { p_action: 'update_issue', p_target_table: 'maintenance_issues', p_target_id: editTarget.id, p_detail: `Set issue status to ${statusForm}` });
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setSaving(false);
    }
  };

  const filtered = issues.filter((i) => statusFilter === 'all' || i.status === statusFilter);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Maintenance Issues</h1>
        <p className="text-sm text-slate-500 mt-1">Review and update reported bus issues</p>
      </div>

      <div className="flex gap-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No issues reported" message="Maintenance issues reported by drivers will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <div key={issue.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge color={statusColors[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
                    <span className="text-sm font-medium text-slate-700">Bus {issue.bus?.registration || '—'}</span>
                  </div>
                  <p className="text-sm text-slate-600">{issue.description}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Reported by {issue.reporter?.display_name || 'Unknown'} on {new Date(issue.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => openEdit(issue)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Update Issue Status">
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{editTarget?.description}</div>
          <Select label="Status" name="status" value={statusForm} onChange={(e) => setStatusForm(e.target.value)}>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
