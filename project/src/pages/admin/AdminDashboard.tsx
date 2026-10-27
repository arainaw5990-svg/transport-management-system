import { useEffect, useState } from 'react';
import { Bus, Users, Route as RouteIcon, Calendar, Wrench, CalendarOff, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LoadingState, ErrorState, Badge } from '@/components/ui/State';

interface DashboardStats {
  buses: number;
  drivers: number;
  routes: number;
  schedulesToday: number;
  openIssues: number;
  pendingDayOff: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [buses, drivers, routes, schedules, issues, dayOff] = await Promise.all([
        supabase.from('buses').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'driver'),
        supabase.from('routes').select('id', { count: 'exact', head: true }),
        supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('trip_date', new Date().toISOString().split('T')[0]),
        supabase.from('maintenance_issues').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('day_off_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      if (buses.error) throw buses.error;

      setStats({
        buses: buses.count ?? 0,
        drivers: drivers.count ?? 0,
        routes: routes.count ?? 0,
        schedulesToday: schedules.count ?? 0,
        openIssues: issues.count ?? 0,
        pendingDayOff: dayOff.count ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const cards = [
    { label: 'Total Buses', value: stats.buses, icon: Bus, color: 'bg-blue-500' },
    { label: 'Drivers', value: stats.drivers, icon: Users, color: 'bg-green-500' },
    { label: 'Routes', value: stats.routes, icon: RouteIcon, color: 'bg-purple-500' },
    { label: 'Schedules Today', value: stats.schedulesToday, icon: Calendar, color: 'bg-orange-500' },
    { label: 'Open Issues', value: stats.openIssues, icon: Wrench, color: 'bg-red-500' },
    { label: 'Pending Day-Off', value: stats.pendingDayOff, icon: CalendarOff, color: 'bg-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your transport system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{card.value}</p>
              </div>
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${card.color}`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Status</h2>
        <div className="flex flex-wrap gap-3">
          {stats.openIssues > 0 ? (
            <Badge color="red"><AlertCircle className="h-3 w-3 inline mr-1" />{stats.openIssues} open issues need attention</Badge>
          ) : (
            <Badge color="green"><CheckCircle className="h-3 w-3 inline mr-1" />No open issues</Badge>
          )}
          {stats.pendingDayOff > 0 && (
            <Badge color="yellow"><Clock className="h-3 w-3 inline mr-1" />{stats.pendingDayOff} day-off requests pending</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
