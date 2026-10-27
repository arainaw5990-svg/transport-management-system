import { useEffect, useState, useCallback } from 'react';
import { Calendar, CheckCircle, Bus, Route as RouteIcon, Clock, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { ScheduleWithDetails } from '@/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

const statusColors = { scheduled: 'blue', completed: 'green', cancelled: 'red' } as const;

export function DriverSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ScheduleWithDetails | null>(null);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('schedules')
      .select('*, bus:buses(id, registration, model, capacity), driver:profiles!driver_id(id, display_name, email), route:routes(id, name, origin, destination)')
      .eq('driver_id', user.id)
      .order('trip_date', { ascending: true })
      .order('departure_time', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    setSchedules((data || []) as ScheduleWithDetails[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async () => {
    if (!completeTarget) return;
    setCompleting(true);
    try {
      const { error } = await supabase.rpc('update_schedule_status', { p_schedule_id: completeTarget.id, p_status: 'completed' });
      if (error) throw error;
      setCompleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark trip complete');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const upcoming = schedules.filter((s) => s.status === 'scheduled');
  const past = schedules.filter((s) => s.status !== 'scheduled');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Schedules</h1>
        <p className="text-sm text-slate-500 mt-1">Your assigned trips</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">Upcoming Trips</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={Calendar} title="No upcoming trips" message="You have no scheduled trips." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <Badge color={statusColors[s.status]}>{s.status}</Badge>
                  <span className="text-sm font-medium text-slate-700">{s.trip_date}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 text-slate-600"><Clock className="h-4 w-4 text-slate-400" /> {s.departure_time} — {s.arrival_time}</p>
                  <p className="flex items-center gap-2 text-slate-600"><Bus className="h-4 w-4 text-slate-400" /> {s.bus?.registration} — {s.bus?.model} ({s.bus?.capacity} seats)</p>
                  <p className="flex items-center gap-2 text-slate-600"><RouteIcon className="h-4 w-4 text-slate-400" /> {s.route?.name}</p>
                  <p className="flex items-center gap-2 text-slate-500"><MapPin className="h-4 w-4 text-slate-400" /> {s.route?.origin} → {s.route?.destination}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <Button size="sm" onClick={() => setCompleteTarget(s)} className="w-full"><CheckCircle className="h-4 w-4" /> Mark Complete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Past Trips</h2>
          <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                  <th className="text-left px-4 py-3 font-medium">Bus</th>
                  <th className="text-left px-4 py-3 font-medium">Route</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {past.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{s.trip_date}</td>
                    <td className="px-4 py-3 text-slate-600">{s.departure_time} — {s.arrival_time}</td>
                    <td className="px-4 py-3 text-slate-600">{s.bus?.registration}</td>
                    <td className="px-4 py-3 text-slate-600">{s.route?.name}</td>
                    <td className="px-4 py-3"><Badge color={statusColors[s.status]}>{s.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!completeTarget}
        title="Mark Trip Complete"
        message={`Mark the trip on ${completeTarget?.trip_date} (${completeTarget?.departure_time}—${completeTarget?.arrival_time}) as completed?`}
        confirmLabel="Mark Complete"
        variant="primary"
        onConfirm={handleComplete}
        onCancel={() => setCompleteTarget(null)}
        loading={completing}
      />
    </div>
  );
}
