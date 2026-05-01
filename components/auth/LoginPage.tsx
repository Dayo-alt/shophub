import { useEffect, useState } from 'react';
import { Store, LogIn, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToSignup: () => void;
  onGoogleLogin: () => void;
}

export function LoginPage({ onLogin, onSwitchToSignup, onGoogleLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isOnline) {
      setError('You are offline. Please connect to the internet to log in.');
      return;
    }
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8 shadow-xl border border-slate-100 animate-scale-in">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Store className="size-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">ShopHub</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-1">{t('login')}</h2>
            <p className="text-sm text-slate-500">{t('loginToAccount')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-slate-600">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="h-11"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-slate-600">{t('password')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-11 pr-11"
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2 h-11 text-base" disabled={loading || !isOnline}>
            {loading ? `${t('login')}...` : (
              <>
                <LogIn className="size-4" />
                {t('login')}
              </>
            )}
          </Button>
          {!isOnline && !error && (
            <p className="text-xs text-red-600 text-center mt-1">
              You are offline. Please connect to the internet to log in.
            </p>
          )}
        </form>

        <div className="mt-5">
          <Button
            type="button"
            variant="outline"
            className="w-full text-sm justify-center gap-2 h-11"
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

        <div className="mt-6 text-center text-sm text-slate-500">
          {t('dontHaveAccount')}{' '}
          <button
            onClick={onSwitchToSignup}
            className="text-blue-600 font-medium hover:underline"
          >
            {t('signUp')}
          </button>
        </div>
      </Card>
    </div>
  );
}
