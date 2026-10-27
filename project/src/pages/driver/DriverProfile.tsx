import { useEffect, useState, useCallback } from 'react';
import { Bus as BusIcon, Wrench, Plus, Phone, Mail, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { BusWithDriver, Profile, MaintenanceIssueWithDetails } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { open: 'red', in_progress: 'yellow', resolved: 'green' } as const;

export function DriverProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [assignedBus, setAssignedBus] = useState<BusWithDriver | null>(null);
  const [issues, setIssues] = useState<MaintenanceIssueWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueDesc, setIssueDesc] = useState('');
  const [issueBusId, setIssueBusId] = useState('');
  const [issueError, setIssueError] = useState<string | null>(null);
  const [savingIssue, setSavingIssue] = useState(false);

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

      if (busData) setIssueBusId(busData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    if (profile) {
      setDisplayName(profile.display_name);
      setPhone(profile.phone);
    }
  }, [load, profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim(), phone: phone.trim() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setProfileSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingIssue(true);
    setIssueError(null);
    if (!issueDesc.trim()) { setIssueError('Description is required.'); setSavingIssue(false); return; }
    if (!issueBusId) { setIssueError('No bus assigned. Contact admin.'); setSavingIssue(false); return; }
    try {
      const { error } = await supabase.from('maintenance_issues').insert({
        bus_id: issueBusId,
        reported_by: user.id,
        description: issueDesc.trim(),
      });
      if (error) throw error;
      setIssueModalOpen(false);
      setIssueDesc('');
      await load();
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Failed to report issue');
    } finally {
      setSavingIssue(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Update your contact information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Contact Information</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email (read-only)</label>
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                <Mail className="h-4 w-4" /> {profile?.email}
              </div>
            </div>
            <Input label="Full Name" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <Input label="Phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0100" />
            {profileSaved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">Profile updated successfully.</div>}
            <Button type="submit" loading={savingProfile}>Save Changes</Button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Assigned Bus</h2>
          {assignedBus ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100">
                  <BusIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{assignedBus.registration}</p>
                  <p className="text-sm text-slate-500">{assignedBus.model}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs">Capacity</p>
                  <p className="font-medium text-slate-700">{assignedBus.capacity} seats</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs">Status</p>
                  <Badge color={assignedBus.status === 'active' ? 'green' : assignedBus.status === 'maintenance' ? 'yellow' : 'red'}>{assignedBus.status}</Badge>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={BusIcon} title="No bus assigned" message="Contact your admin to get a bus assigned." />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Reported Issues</h2>
          {assignedBus && (
            <Button size="sm" variant="outline" onClick={() => setIssueModalOpen(true)}><Plus className="h-4 w-4" /> Report Issue</Button>
          )}
        </div>
        {issues.length === 0 ? (
          <EmptyState icon={Wrench} title="No issues reported" message="Report a problem with your assigned bus." />
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className="flex items-start justify-between border border-slate-200 rounded-lg p-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color={statusColors[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
                    <span className="text-xs text-slate-400">{new Date(issue.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">{issue.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={issueModalOpen} onClose={() => setIssueModalOpen(false)} title="Report Issue">
        <form onSubmit={handleReportIssue} className="space-y-4">
          {issueError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{issueError}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bus</label>
            <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              {assignedBus?.registration} — {assignedBus?.model}
            </div>
          </div>
          <Textarea label="Description" name="description" value={issueDesc} onChange={(e) => setIssueDesc(e.target.value)} rows={3} required placeholder="Describe the issue in detail..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIssueModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={savingIssue}>Report</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
