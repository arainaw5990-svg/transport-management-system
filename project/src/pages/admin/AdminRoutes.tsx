import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Route as RouteIcon, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Route, RouteStop, RouteWithStops } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState, EmptyState, ErrorState, Badge } from '@/components/ui/State';

export function AdminRoutes() {
  const [routes, setRoutes] = useState<RouteWithStops[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [stopRouteId, setStopRouteId] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'route' | 'stop'; id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [routeForm, setRouteForm] = useState({ name: '', origin: '', destination: '', description: '' });
  const [stopForm, setStopForm] = useState({ name: '', stop_order: '1' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('routes')
      .select('*, route_stops(*)')
      .order('created_at', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    const sorted = (data || []).map((r) => ({
      ...r,
      route_stops: (r.route_stops || []).sort((a: RouteStop, b: RouteStop) => a.stop_order - b.stop_order),
    }));
    setRoutes(sorted as RouteWithStops[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreateRoute = () => {
    setEditingRoute(null);
    setRouteForm({ name: '', origin: '', destination: '', description: '' });
    setFormError(null);
    setRouteModalOpen(true);
  };

  const openEditRoute = (route: Route) => {
    setEditingRoute(route);
    setRouteForm({ name: route.name, origin: route.origin, destination: route.destination, description: route.description });
    setFormError(null);
    setRouteModalOpen(true);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = { name: routeForm.name.trim(), origin: routeForm.origin.trim(), destination: routeForm.destination.trim(), description: routeForm.description.trim() };
    if (!payload.name) { setFormError('Route name is required.'); setSaving(false); return; }
    try {
      if (editingRoute) {
        const { error } = await supabase.from('routes').update(payload).eq('id', editingRoute.id);
        if (error) throw error;
        await supabase.rpc('insert_audit_log', { p_action: 'update_route', p_target_table: 'routes', p_target_id: editingRoute.id, p_detail: `Updated route ${payload.name}` });
      } else {
        const { error } = await supabase.from('routes').insert(payload);
        if (error) throw error;
        await supabase.rpc('insert_audit_log', { p_action: 'create_route', p_target_table: 'routes', p_target_id: '', p_detail: `Created route ${payload.name}` });
      }
      setRouteModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  const openAddStop = (routeId: string) => {
    setStopRouteId(routeId);
    setEditingStop(null);
    const route = routes.find((r) => r.id === routeId);
    const nextOrder = route?.route_stops ? Math.max(...route.route_stops.map((s) => s.stop_order)) + 1 : 1;
    setStopForm({ name: '', stop_order: String(nextOrder) });
    setFormError(null);
    setStopModalOpen(true);
  };

  const openEditStop = (stop: RouteStop) => {
    setEditingStop(stop);
    setStopRouteId(stop.route_id);
    setStopForm({ name: stop.name, stop_order: String(stop.stop_order) });
    setFormError(null);
    setStopModalOpen(true);
  };

  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = { route_id: stopRouteId, name: stopForm.name.trim(), stop_order: parseInt(stopForm.stop_order, 10) };
    if (!payload.name) { setFormError('Stop name is required.'); setSaving(false); return; }
    if (isNaN(payload.stop_order) || payload.stop_order < 1) { setFormError('Stop order must be a positive integer.'); setSaving(false); return; }
    try {
      if (editingStop) {
        const { error } = await supabase.from('route_stops').update({ name: payload.name, stop_order: payload.stop_order }).eq('id', editingStop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('route_stops').insert(payload);
        if (error) throw error;
      }
      setStopModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save stop');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'route') {
        const { error } = await supabase.from('routes').delete().eq('id', deleteTarget.id);
        if (error) throw error;
        await supabase.rpc('insert_audit_log', { p_action: 'delete_route', p_target_table: 'routes', p_target_id: deleteTarget.id, p_detail: `Deleted route ${deleteTarget.name}` });
      } else {
        const { error } = await supabase.from('route_stops').delete().eq('id', deleteTarget.id);
        if (error) throw error;
      }
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = routes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.origin.toLowerCase().includes(search.toLowerCase()) ||
    r.destination.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Routes & Stops</h1>
          <p className="text-sm text-slate-500 mt-1">Manage bus routes and their ordered stops</p>
        </div>
        <Button onClick={openCreateRoute}><Plus className="h-4 w-4" /> Add Route</Button>
      </div>

      <Input placeholder="Search routes..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState icon={RouteIcon} title="No routes found" message="Add your first route to get started." action={<Button onClick={openCreateRoute}><Plus className="h-4 w-4" /> Add Route</Button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((route) => (
            <div key={route.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <RouteIcon className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-800">{route.name}</p>
                    <p className="text-sm text-slate-500">{route.origin} → {route.destination}</p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <Badge color="blue">{route.route_stops?.length || 0} stops</Badge>
                  <button onClick={() => openEditRoute(route)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteTarget({ type: 'route', id: route.id, name: route.name })} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  <button onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                    {expandedRoute === route.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {expandedRoute === route.id && (
                <div className="border-t border-slate-200 bg-slate-50 p-4">
                  {route.description && <p className="text-sm text-slate-600 mb-3">{route.description}</p>}
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-700">Ordered Stops</h4>
                    <Button size="sm" variant="outline" onClick={() => openAddStop(route.id)}><Plus className="h-3 w-3" /> Add Stop</Button>
                  </div>
                  {route.route_stops && route.route_stops.length > 0 ? (
                    <div className="space-y-2">
                      {route.route_stops.map((stop, idx) => (
                        <div key={stop.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-slate-200">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{stop.stop_order}</span>
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-700 flex-1">{stop.name}</span>
                          <button onClick={() => openEditStop(stop)} className="p-1 rounded text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteTarget({ type: 'stop', id: stop.id, name: stop.name })} className="p-1 rounded text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No stops yet. Add at least 2 stops to enable scheduling.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={routeModalOpen} onClose={() => setRouteModalOpen(false)} title={editingRoute ? 'Edit Route' : 'Add Route'}>
        <form onSubmit={handleSaveRoute} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Input label="Route Name" name="name" value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} required placeholder="Route 42 — Downtown Express" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Origin" name="origin" value={routeForm.origin} onChange={(e) => setRouteForm({ ...routeForm, origin: e.target.value })} placeholder="Central Station" />
            <Input label="Destination" name="destination" value={routeForm.destination} onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })} placeholder="Airport" />
          </div>
          <Textarea label="Description" name="description" value={routeForm.description} onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })} rows={2} placeholder="Optional description" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setRouteModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingRoute ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={stopModalOpen} onClose={() => setStopModalOpen(false)} title={editingStop ? 'Edit Stop' : 'Add Stop'}>
        <form onSubmit={handleSaveStop} className="space-y-4">
          {formError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{formError}</div>}
          <Input label="Stop Name" name="name" value={stopForm.name} onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })} required placeholder="Main Street & 5th Ave" />
          <Input label="Stop Order" type="number" name="stop_order" value={stopForm.stop_order} onChange={(e) => setStopForm({ ...stopForm, stop_order: e.target.value })} required min={1} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setStopModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingStop ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'route' ? 'Delete Route' : 'Delete Stop'}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? ${deleteTarget?.type === 'route' ? 'All stops for this route will also be deleted.' : 'A route must keep at least 2 stops.'}`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
