import { useState } from 'react';
import { Store, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface AdminLoginPageProps {
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => void;
}

export function AdminLoginPage({ onEmailLogin, onGoogleLogin }: AdminLoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onEmailLogin(email, password);
    } catch (err: any) {
      setError(err?.message || t('adminLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-sm shadow-2xl border border-slate-200/80 rounded-2xl animate-scale-in">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 text-center">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <Store className="size-5" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">{t('adminConsole')}</h2>
          </div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Admin login</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pt-5 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-xs font-medium text-slate-700">
              {t('adminEmailLabel')}
            </Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-xs font-medium text-slate-700">
              {t('adminPasswordLabel')}
            </Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t('adminPasswordPlaceholder')}
                className="h-10 text-sm pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md border border-red-200 bg-red-50 text-xs text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2 mt-2" disabled={loading}>
            {loading ? t('adminSigningIn') : (
              <>
                <LogIn className="size-4" />
                {t('enterAdminConsole')}
              </>
            )}
          </Button>
        </form>

        <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full text-sm justify-center gap-2"
            onClick={onGoogleLogin}
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google logo"
              className="w-4 h-4"
            />
            {t('continueWithGoogle')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
