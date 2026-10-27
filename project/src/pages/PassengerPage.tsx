import { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, MapPin, Route as RouteIcon, Bus, Clock, Calendar, Navigation, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Route, RouteStop, ScheduleWithDetails } from '@/types';
import { Input } from '@/components/ui/Input';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

type RouteWithStops = Route & { route_stops: RouteStop[] };

export function PassengerPage() {
  const [routes, setRoutes] = useState<RouteWithStops[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'origin' | 'destination' | 'stop'>('all');
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: routeData, error: routeErr } = await supabase
        .from('routes')
        .select('*, route_stops(*)')
        .order('name');
      if (routeErr) throw routeErr;
      const sorted = (routeData || []).map((r) => ({
        ...r,
        route_stops: (r.route_stops || []).sort((a: RouteStop, b: RouteStop) => a.stop_order - b.stop_order),
      }));
      setRoutes(sorted as RouteWithStops[]);

      const { data: schedData, error: schedErr } = await supabase
        .from('schedules')
        .select('*, bus:buses(id, registration, model), driver:profiles!driver_id(id, display_name), route:routes(id, name, origin, destination)')
        .eq('status', 'scheduled')
        .order('trip_date', { ascending: true })
        .order('departure_time', { ascending: true });
      if (schedErr) throw schedErr;
      setSchedules((schedData || []) as ScheduleWithDetails[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRoutes = useMemo(() => {
    if (!search.trim()) return routes;
    const q = search.toLowerCase().trim();
    return routes.filter((r) => {
      const matchOrigin = r.origin.toLowerCase().includes(q);
      const matchDest = r.destination.toLowerCase().includes(q);
      const matchName = r.name.toLowerCase().includes(q);
      const matchStop = r.route_stops.some((s) => s.name.toLowerCase().includes(q));
      switch (searchType) {
        case 'origin': return matchOrigin;
        case 'destination': return matchDest;
        case 'stop': return matchStop;
        default: return matchOrigin || matchDest || matchName || matchStop;
      }
    });
  }, [routes, search, searchType]);

  const filteredSchedules = useMemo(() => {
    if (!search.trim()) return schedules;
    const q = search.toLowerCase().trim();
    return schedules.filter((s) => {
      const matchOrigin = (s.route?.origin || '').toLowerCase().includes(q);
      const matchDest = (s.route?.destination || '').toLowerCase().includes(q);
      const matchRoute = (s.route?.name || '').toLowerCase().includes(q);
      return matchOrigin || matchDest || matchRoute;
    });
  }, [schedules, search, searchType]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600">
              <Bus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Transport Management System</h1>
              <p className="text-slate-300 text-sm">Find routes, stops, and schedules</p>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by origin, destination, or stop name..."
                    className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Filter By</label>
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as typeof searchType)}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">Everything</option>
                  <option value="origin">Origin</option>
                  <option value="destination">Destination</option>
                  <option value="stop">Stop Name</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Routes */}
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-blue-500" /> Routes
          </h2>
          {filteredRoutes.length === 0 ? (
            <EmptyState icon={RouteIcon} title="No routes found" message="Try a different search term." />
          ) : (
            <div className="space-y-3">
              {filteredRoutes.map((route) => (
                <div key={route.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <button
                      onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                        <Navigation className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{route.name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          {route.origin} <ArrowRight className="h-3 w-3" /> {route.destination}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      <Badge color="blue">{route.route_stops.length} stops</Badge>
                      <button onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                        {expandedRoute === route.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {expandedRoute === route.id && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      {route.description && <p className="text-sm text-slate-600 mb-3">{route.description}</p>}
                      <div className="space-y-2">
                        {route.route_stops.map((stop, idx) => (
                          <div key={stop.id} className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">{stop.stop_order}</span>
                              {idx < route.route_stops.length - 1 && <div className="w-0.5 h-6 bg-slate-300" />}
                            </div>
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-700">{stop.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Schedules */}
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" /> Upcoming Schedules
          </h2>
          {filteredSchedules.length === 0 ? (
            <EmptyState icon={Calendar} title="No schedules found" message="No upcoming trips match your search." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchedules.map((s) => (
                <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Badge color="blue">Scheduled</Badge>
                    <span className="text-sm font-medium text-slate-700">{s.trip_date}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-slate-600"><Clock className="h-4 w-4 text-slate-400" /> {s.departure_time} — {s.arrival_time}</p>
                    <p className="flex items-center gap-2 text-slate-600"><RouteIcon className="h-4 w-4 text-slate-400" /> {s.route?.name}</p>
                    <p className="flex items-center gap-2 text-slate-500"><Navigation className="h-4 w-4 text-slate-400" /> {s.route?.origin} → {s.route?.destination}</p>
                    <p className="flex items-center gap-2 text-slate-500"><Bus className="h-4 w-4 text-slate-400" /> Bus {s.bus?.registration}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-center text-sm text-slate-400">
          Transport Management System — Public Portal
        </div>
      </footer>
    </div>
  );
}
