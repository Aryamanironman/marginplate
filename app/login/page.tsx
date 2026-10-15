'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">MarginPlate</h1>
        <p className="text-sm text-ink-muted mb-6">Sign in to your restaurant&apos;s food-cost dashboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface rounded focus:outline-none focus:ring-2 focus:ring-corten"
              placeholder="you@restaurant.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface rounded focus:outline-none focus:ring-2 focus:ring-corten"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-corten hover:bg-corten-hover disabled:opacity-50 text-on-corten font-medium rounded transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-xs text-ink-faint">
          Demo: <code>maria@test.dev</code> / <code>DemoPass2026!</code>
        </p>
      </div>
    </div>
  );
}