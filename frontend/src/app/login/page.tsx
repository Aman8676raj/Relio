'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try { await login(email, password); } catch (err: any) { setError(err.message || 'Invalid credentials'); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Left branding */}
      <div className="hidden lg:flex w-[480px] shrink-0 flex-col justify-between p-12 relative overflow-hidden" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(circle at 30% 80%, var(--primary), transparent 60%)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)' }}>
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)' }}>Relio</span>
        </div>
        <div className="relative z-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] mb-6" style={{ color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>What founders say</p>
          <blockquote className="text-xl font-medium leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-heading)' }}>
            "Relio turned my scattered investor notes into a real system. I closed my seed round knowing exactly who to warm up and when."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>MK</div>
            <div><p className="text-[14px] font-semibold text-white">Marcus Kim</p><p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>CEO, Stackline</p></div>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-6">
          {[['2,400+', 'Founders'], ['$180M+', 'Raised'], ['94%', 'Reply rate']].map(([v, l]) => (
            <div key={l}><p className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>{v}</p><p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{l}</p></div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h1 className="text-[32px] font-extrabold tracking-tight mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Welcome back</h1>
            <p className="text-[15px]" style={{ color: 'var(--text-muted)' }}>Sign in to your relationship intelligence hub.</p>
          </div>

          <button data-testid="login-google" onClick={loginWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-3.5 text-[14px] font-semibold mb-6 transition-all"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-clay)', border: '1px solid rgba(255,255,255,0.6)', color: 'var(--text)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay)'; }}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="relative flex items-center mb-6">
            <div className="flex-grow border-t" style={{ borderColor: 'var(--border)' }} />
            <span className="mx-4 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>or</span>
            <div className="flex-grow border-t" style={{ borderColor: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Email</label>
              <input data-testid="login-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="you@startup.co" className="clay-input w-full" autoFocus />
            </div>
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Password</label>
              <div className="relative">
                <input data-testid="login-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter password" className="clay-input w-full pr-11" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70" tabIndex={-1}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-2xl px-4 py-3 text-[13px] font-medium animate-fade-in" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
            <button data-testid="login-submit" type="submit" disabled={loading} className="clay-btn w-full flex items-center justify-center gap-2 py-3.5 text-[15px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <p className="mt-8 text-center text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Don&apos;t have an account? <Link href="/signup" className="font-bold" style={{ color: 'var(--primary)' }}>Start free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
