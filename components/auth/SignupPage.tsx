import { useState, useRef, useEffect } from 'react';
import { Store, UserPlus, ChevronDown, Search, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { ALL_COUNTRIES, ARAB_COUNTRIES, useLanguage } from '../../utils/i18n/LanguageContext';

interface SignupPageProps {
  onSignup: (email: string, password: string, name: string, role: 'buyer' | 'seller', country: string, phone?: string) => Promise<void>;
  onSwitchToLogin: () => void;
  onGoogleLogin: () => void;
}

export function SignupPage({ onSignup, onSwitchToLogin, onGoogleLogin }: SignupPageProps) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [role,     setRole]     = useState<'buyer' | 'seller'>('buyer');
  const [country,  setCountry]  = useState('');
  const [phone,    setPhone]    = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Country dropdown state
  const [countryOpen,   setCountryOpen]   = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { setCountry: setCtxCountry } = useLanguage();

  const filteredCountries = (ALL_COUNTRIES as readonly string[]).filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectCountry = (c: string) => {
    setCountry(c);
    setCountryOpen(false);
    setCountrySearch('');
    // Auto-switch language context (will be saved after signup, but preview now)
    setCtxCountry(c);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSignup(email, password, name, role, country, phone);
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const isArabCountry = ARAB_COUNTRIES.has(country);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md p-8 shadow-xl border border-slate-100 animate-scale-in">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Store className="size-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">ShopHub</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-1">Create account</h2>
            <p className="text-sm text-slate-500">Sign up to get started</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-slate-600">Full name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="John Doe"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-slate-600">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm text-slate-600">Phone number <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-slate-600">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Create a password"
                className="h-11 pr-11"
                minLength={6}
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

          {/* Country selector */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Country</Label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setCountryOpen(v => !v)}
                className={`w-full h-11 px-3 flex items-center justify-between rounded-md border text-sm bg-white transition-colors
                  ${countryOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}
                  ${country ? 'text-slate-900' : 'text-slate-400'}`}
              >
                <span>{country || 'Select your country'}</span>
                <div className="flex items-center gap-1">
                  {isArabCountry && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                      AR
                    </span>
                  )}
                  <ChevronDown className={`size-4 text-slate-400 transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {countryOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search country…"
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredCountries.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-400 text-center">No results</p>
                    ) : (
                      filteredCountries.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleSelectCountry(c)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors
                            ${c === country ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                        >
                          <span>{c}</span>
                          {ARAB_COUNTRIES.has(c) && (
                            <span className="text-[10px] text-blue-500">Arabic</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {isArabCountry && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                ✓ Language will switch to Arabic for your region
              </p>
            )}
          </div>

          {/* Account type */}
          <div className="space-y-3">
            <Label className="text-sm text-slate-600">Account type</Label>
            <RadioGroup
              value={role}
              onValueChange={(value: 'buyer' | 'seller') => setRole(value)}
              className="grid gap-3"
            >
              <label
                htmlFor="buyer"
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                  role === 'buyer' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value="buyer" id="buyer" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Buyer</p>
                  <p className="text-xs text-slate-500">Discover and purchase products</p>
                </div>
              </label>
              <label
                htmlFor="seller"
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${
                  role === 'seller' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value="seller" id="seller" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Seller</p>
                  <p className="text-xs text-slate-500">List products and manage orders</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full gap-2 h-11 text-base" disabled={loading}>
            {loading ? 'Creating account…' : (
              <>
                <UserPlus className="size-4" />
                Create Account
              </>
            )}
          </Button>
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
            Continue with Google
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-blue-600 font-medium hover:underline">
            Login
          </button>
        </div>
      </Card>
    </div>
  );
}
