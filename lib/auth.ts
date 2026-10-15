/**
 * supabase-js v2.117+ throws AuthSessionMissingError ("Auth session missing!")
 * from getUser() when no session exists. Pages catch it and, when it happens,
 * bounce to /login instead of showing a dead error screen.
 */
export function ensureSession(err: unknown): boolean {
  if (err instanceof Error && (err.message === 'Auth session missing!' || err.message === 'No user found')) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return true;
  }
  return false;
}