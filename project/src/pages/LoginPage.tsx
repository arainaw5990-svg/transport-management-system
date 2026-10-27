import { useState } from 'react';
import { Bus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Role } from '@/types';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('driver');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, role, displayName);
      if (error) {
        setError(error);
      } else {
        setSuccess('Account created. You can now sign in.');
        setMode('signin');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Bus className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Transport Management</h1>
          <p className="text-sm text-slate-400 mt-1">Admin & Driver Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex gap-2 mb-6 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Create Account
            </button>
          </div>

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Full Name"
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Jane Doe"
              />
            )}
            <Input
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Passengers don't need an account — they use the public search.
                </p>
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Passengers can search routes without signing in.
        </p>
      </div>
    </div>
  );
}
