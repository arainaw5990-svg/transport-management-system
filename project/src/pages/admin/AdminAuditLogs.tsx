import { useEffect, useState, useCallback } from 'react';
import { UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AuditLog, Profile } from '@/types';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/State';
import { Input } from '@/components/ui/Input';

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<(AuditLog & { actor?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, actor:profiles!actor_id(id, display_name, email)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) { setError(error.message); setLoading(false); return; }
    setLogs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter((l) =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.detail.toLowerCase().includes(search.toLowerCase()) ||
    (l.actor?.display_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Track admin actions (latest 200)</p>
      </div>

      <Input placeholder="Search by action, detail, or actor..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState icon={UserCog} title="No audit logs" message="Admin actions will be recorded here." />
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600">{log.actor?.display_name || log.actor?.email || 'System'}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{log.action}</td>
                  <td className="px-4 py-3 text-slate-500">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
