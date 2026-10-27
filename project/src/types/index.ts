export type Role = 'admin' | 'driver' | 'passenger';

export interface Profile {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  registration: string;
  model: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'retired';
  assigned_driver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  name: string;
  stop_order: number;
  created_at: string;
}

export interface Schedule {
  id: string;
  bus_id: string;
  driver_id: string;
  route_id: string;
  trip_date: string;
  departure_time: string;
  arrival_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface DayOffRequest {
  id: string;
  driver_id: string;
  request_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceIssue {
  id: string;
  bus_id: string;
  reported_by: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string;
  detail: string;
  created_at: string;
}

export interface ScheduleWithDetails extends Schedule {
  bus?: Pick<Bus, 'id' | 'registration' | 'model' | 'capacity'>;
  driver?: Pick<Profile, 'id' | 'display_name' | 'email'>;
  route?: Pick<Route, 'id' | 'name' | 'origin' | 'destination'>;
}

export interface BusWithDriver extends Bus {
  assigned_driver?: Pick<Profile, 'id' | 'display_name' | 'email'> | null;
}

export interface RouteWithStops extends Route {
  route_stops?: RouteStop[];
}

export interface MaintenanceIssueWithDetails extends MaintenanceIssue {
  bus?: Pick<Bus, 'id' | 'registration'>;
  reporter?: Pick<Profile, 'id' | 'display_name'>;
}

export interface DayOffRequestWithDetails extends DayOffRequest {
  driver?: Pick<Profile, 'id' | 'display_name' | 'email'>;
}
