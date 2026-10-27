import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { PassengerPage } from '@/pages/PassengerPage';
import { Navbar, type NavKey } from '@/components/Navbar';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminBuses } from '@/pages/admin/AdminBuses';
import { AdminDrivers } from '@/pages/admin/AdminDrivers';
import { AdminRoutes } from '@/pages/admin/AdminRoutes';
import { AdminSchedules } from '@/pages/admin/AdminSchedules';
import { AdminIssues } from '@/pages/admin/AdminIssues';
import { AdminDayOff } from '@/pages/admin/AdminDayOff';
import { AdminAuditLogs } from '@/pages/admin/AdminAuditLogs';
import { DriverSchedules } from '@/pages/driver/DriverSchedules';
import { DriverProfile } from '@/pages/driver/DriverProfile';
import { DriverDayOff } from '@/pages/driver/DriverDayOff';
import { DriverIssues } from '@/pages/driver/DriverIssues';
import { LoadingState } from '@/components/ui/State';
import { Bus } from 'lucide-react';

function AppContent() {
  const { session, profile, loading, signOut } = useAuth();
  const [activeView, setActiveView] = useState<NavKey>('dashboard');
  const [showPassenger, setShowPassenger] = useState(false);

  useEffect(() => {
    if (profile?.role === 'driver' && activeView === 'dashboard') {
      setActiveView('myschedules');
    }
  }, [profile, activeView]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState message="Loading..." />
      </div>
    );
  }

  // Public passenger mode (no login required)
  if (showPassenger || (!session && !profile)) {
    if (showPassenger) {
      return (
        <div>
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={() => setShowPassenger(false)}
              className="flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2.5 text-sm shadow-lg hover:bg-slate-800 transition-colors"
            >
              <Bus className="h-4 w-4" /> Staff Login
            </button>
          </div>
          <PassengerPage />
        </div>
      );
    }
    return (
      <div className="relative">
        <LoginPage />
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => setShowPassenger(true)}
            className="flex items-center gap-2 rounded-full bg-white border border-slate-200 text-slate-700 px-4 py-2.5 text-sm shadow-lg hover:bg-slate-50 transition-colors"
          >
            <Bus className="h-4 w-4" /> Passenger Search
          </button>
        </div>
      </div>
    );
  }

  // Authenticated users
  const role = profile?.role || 'passenger';

  const renderView = () => {
    if (role === 'admin') {
      switch (activeView) {
        case 'dashboard': return <AdminDashboard />;
        case 'buses': return <AdminBuses />;
        case 'drivers': return <AdminDrivers />;
        case 'routes': return <AdminRoutes />;
        case 'schedules': return <AdminSchedules />;
        case 'issues': return <AdminIssues />;
        case 'dayoff': return <AdminDayOff />;
        case 'audit': return <AdminAuditLogs />;
        default: return <AdminDashboard />;
      }
    }
    if (role === 'driver') {
      switch (activeView) {
        case 'myschedules': return <DriverSchedules />;
        case 'mybus': return <DriverProfile />;
        case 'profile': return <DriverProfile />;
        case 'issues': return <DriverIssues />;
        case 'dayoff': return <DriverDayOff />;
        default: return <DriverSchedules />;
      }
    }
    return <PassengerPage />;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        activeView={activeView}
        onNavigate={setActiveView}
        onSignOut={signOut}
        role={role}
        displayName={profile?.display_name || profile?.email || 'User'}
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
