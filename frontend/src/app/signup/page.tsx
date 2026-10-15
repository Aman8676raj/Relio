'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Loader2, Check, ArrowRight, Sparkles } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function SignupPage() {
  const { signup, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pwStrength = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try { await signup(email, password, name); } catch (err: any) { setError(err.message || 'Failed to create account'); } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="hidden lg:flex w-[480px] shrink-0 flex-col justify-between p-12 relative overflow-hidden" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(circle at 70% 20%, var(--accent), transparent 60%)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)' }}>
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)' }}>Relio</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-[36px] font-extrabold tracking-tight mb-4 text-white" style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>
            Your investor network,<br />finally organized.
          </h2>
          <p className="text-[16px] mb-8" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Track warmth, pipeline stage, follow-up timing — never miss the right moment.
          </p>
          <ul className="space-y-3">
            {['Free 14-day trial', 'Gmail sync in 2 minutes', 'AI drafts trained on your tone', 'Cancel anytime'].map(p => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(211,92,62,0.25)' }}>
                  <Check className="h-3 w-3" style={{ color: 'var(--primary)' }} />
                </span>
                <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-[12px]" style={{ color: 'rgba(255,255,255,0.2)' }}>2026 Relio. Built for founders.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold mb-4"
              style={{ background: 'var(--hot-bg)', color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} /> 14-day free trial
            </span>
            <h1 className="text-[32px] font-extrabold tracking-tight mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Create your account</h1>
            <p className="text-[15px]" style={{ color: 'var(--text-muted)' }}>Join 2,400+ founders closing rounds with better relationships.</p>
          </div>

          <button data-testid="signup-google" onClick={loginWithGoogle} type="button"
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-3.5 text-[14px] font-semibold mb-6 transition-all"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-clay)', border: '1px solid rgba(255,255,255,0.6)', color: 'var(--text)' }}>
            <GoogleIcon /> Continue with Google
          </button>

          <div className="relative flex items-center mb-6">
            <div className="flex-grow border-t" style={{ borderColor: 'var(--border)' }} />
            <span className="mx-4 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>or</span>
            <div className="flex-grow border-t" style={{ borderColor: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Full Name</label>
              <input data-testid="signup-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Chen" className="clay-input w-full" />
            </div>
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Email</label>
              <input data-testid="signup-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="alex@startup.co" required className="clay-input w-full" autoFocus />
            </div>
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Password</label>
              <div className="relative">
                <input data-testid="signup-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Min 8 chars" required className="clay-input w-full pr-11" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70" tabIndex={-1}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">{[0, 1, 2].map(i => (
                    <div key={i} className="h-1.5 flex-1 rounded-full transition-all" style={{ backgroundColor: pwStrength ? 'var(--success)' : password.length >= 4 ? 'var(--accent)' : 'var(--border-strong)' }} />
                  ))}</div>
                  <span className="text-[11px] font-bold" style={{ color: pwStrength ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
                    {pwStrength ? 'Strong' : password.length >= 4 ? 'Fair' : 'Weak'}
                  </span>
                </div>
              )}
            </div>
            {error && <div className="rounded-2xl px-4 py-3 text-[13px] font-medium animate-fade-in" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
            <button data-testid="signup-submit" type="submit" disabled={loading} className="clay-btn w-full flex items-center justify-center gap-2 py-3.5 text-[15px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Start free trial <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <p className="mt-6 text-center text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Already have an account? <Link href="/login" className="font-bold" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
