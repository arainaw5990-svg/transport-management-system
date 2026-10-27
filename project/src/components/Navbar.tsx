import { useState } from 'react';
import { Bus, LogOut, Menu, X, LayoutDashboard, Users, Route as RouteIcon, Calendar, Wrench, CalendarOff, Search, UserCog } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

type NavKey = 'dashboard' | 'buses' | 'drivers' | 'routes' | 'schedules' | 'issues' | 'dayoff' | 'audit' | 'profile' | 'myschedules' | 'mybus' | 'search';

interface NavItem {
  key: NavKey;
  label: string;
  icon: typeof Bus;
  roles: Role[];
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { key: 'buses', label: 'Buses', icon: Bus, roles: ['admin'] },
  { key: 'drivers', label: 'Drivers', icon: Users, roles: ['admin'] },
  { key: 'routes', label: 'Routes & Stops', icon: RouteIcon, roles: ['admin'] },
  { key: 'schedules', label: 'Schedules', icon: Calendar, roles: ['admin'] },
  { key: 'issues', label: 'Maintenance', icon: Wrench, roles: ['admin'] },
  { key: 'dayoff', label: 'Day-Off Requests', icon: CalendarOff, roles: ['admin'] },
  { key: 'audit', label: 'Audit Logs', icon: UserCog, roles: ['admin'] },
  { key: 'myschedules', label: 'My Schedules', icon: Calendar, roles: ['driver'] },
  { key: 'mybus', label: 'My Bus', icon: Bus, roles: ['driver'] },
  { key: 'issues', label: 'Report Issue', icon: Wrench, roles: ['driver'] },
  { key: 'dayoff', label: 'Day-Off Requests', icon: CalendarOff, roles: ['driver'] },
  { key: 'profile', label: 'My Profile', icon: Users, roles: ['driver'] },
];

interface NavbarProps {
  activeView: NavKey;
  onNavigate: (view: NavKey) => void;
  onSignOut: () => void;
  role: Role;
  displayName: string;
}

export function Navbar({ activeView, onNavigate, onSignOut, role, displayName }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItems.filter((item) => item.roles.includes(role));

  const handleNav = (key: NavKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Bus className="h-7 w-7 text-blue-400" />
              <span className="text-lg font-bold tracking-tight">TMS</span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-2 capitalize">{role} portal</span>
            </div>

            <nav className="hidden lg:flex items-center gap-1">
              {items.map((item) => (
                <button
                  key={`${item.key}-${item.label}`}
                  onClick={() => handleNav(item.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeView === item.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-slate-300">{displayName}</span>
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden rounded-lg p-2 hover:bg-slate-800"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <nav className="lg:hidden border-t border-slate-800 px-4 py-3 space-y-1">
            {items.map((item) => (
              <button
                key={`${item.key}-${item.label}`}
                onClick={() => handleNav(item.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeView === item.key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}

export type { NavKey };
