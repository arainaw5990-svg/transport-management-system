import { useEffect, useState, useCallback } from 'react';
import { Wrench, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { BusWithDriver, MaintenanceIssueWithDetails } from '@/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { open: 'red', in_progress: 'yellow', resolved: 'green' } as const;

export function DriverIssues() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<MaintenanceIssueWithDetails[]>([]);
  const [assignedBus, setAssignedBus] = useState<BusWithDriver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: busData } = await supabase
        .from('buses')
        .select('*, assigned_driver:profiles!assigned_driver_id(id, display_name, email)')
        .eq('assigned_driver_id', user.id)
        .maybeSingle();
      setAssignedBus(busData as BusWithDriver | null);

      const { data: issueData } = await supabase
        .from('maintenance_issues')
        .select('*, bus:buses(id, registration), reporter:profiles!reported_by(id, display_name)')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false });
      setIssues((issueData || []) as MaintenanceIssueWithDetails[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !assignedBus) return;
    setSaving(true);
    setFormError(null);
    if (!description.trim()) { setFormError('Description is required.'); setSaving(false); return; }
    try {
      const { error } = await supabase.from('maintenance_issues').insert({
        bus_id: assignedBus.id,
        reported_by: user.id,
        description: description.trim(),
      });
      if (error) throw error;
      setModalOpen(false);
      setDescription('');
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to report issue');
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
          <h1 className="text-2xl font-bold text-slate-800">Report an Issue</h1>
          <p className="text-sm text-slate-500 mt-1">Report maintenance problems with your assigned bus</p>
        </div>
        {assignedBus && <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> New Issue</Button>}
      </div>

      {assignedBus && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          Reporting issues for bus <strong>{assignedBus.registration}</strong> ({assignedBus.model})
        </div>
      )}

      {!assignedBus && (
        <EmptyState icon={Wrench} title="No bus assigned" message="Contact your admin to get a bus assigned before reporting issues." />
      )}

      {assignedBus && issues.length === 0 && (
        <EmptyState icon={Wrench} title="No issues reported" message="Everything looking good. Report an issue if you find a problem." />
      )}

      {issues.length > 0 && (
        <div className="space-y-3">
          {issues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Badge color={statusColors[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
                <span className="text-xs text-slate-400">{new Date(issue.created_at).toLocaleDateString()}</span>
                <span className="text-xs text-slate-400">Bus {issue.bus?.registration}</span>
              </div>
              <p className="text-sm text-slate-600">{issue.description}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Report Issue">
        <form onSubmit={handleReport} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bus</label>
            <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              {assignedBus?.registration} — {assignedBus?.model}
            </div>
          </div>
          <Textarea label="Description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required placeholder="Describe the issue..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Report</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
