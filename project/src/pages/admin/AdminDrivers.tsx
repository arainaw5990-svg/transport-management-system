import { useEffect, useState, useCallback } from 'react';
import { Users, Shield, Mail, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';
import { Input } from '@/components/ui/Input';

const roleColors = { admin: 'red', driver: 'blue', passenger: 'slate' } as const;

export function AdminDrivers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setProfiles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = profiles.filter((p) => {
    const matchesSearch = p.email.toLowerCase().includes(search.toLowerCase()) || p.display_name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Users & Drivers</h1>
        <p className="text-sm text-slate-500 mt-1">View all registered users and their roles</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="driver">Drivers</option>
          <option value="passenger">Passengers</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${p.role === 'admin' ? 'bg-red-100' : p.role === 'driver' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    {p.role === 'admin' ? <Shield className="h-5 w-5 text-red-600" /> : <Users className="h-5 w-5 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{p.display_name || 'Unnamed'}</p>
                    <Badge color={roleColors[p.role]}>{p.role}</Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-slate-500">
                <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {p.email}</p>
                {p.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
