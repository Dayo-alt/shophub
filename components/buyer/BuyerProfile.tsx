import { useEffect, useState, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { supabase } from '../../utils/supabase/client';
import { useLanguage, ALL_COUNTRIES } from '../../utils/i18n/LanguageContext';
import { Check, ChevronDown, Search, Phone, Globe, User } from 'lucide-react';

interface BuyerProfileProps {
  onBackToProducts: () => void;
}

export function BuyerProfile({ onBackToProducts }: BuyerProfileProps) {
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [name, setName]                 = useState('');
  const [email, setEmail]               = useState('');
  const [phone, setPhone]               = useState('');
  const [country, setCountryLocal]      = useState('');
  const [followingCount, setFollowingCount] = useState(0);
  const [userId, setUserId]             = useState<string | null>(null);

  const [countryOpen, setCountryOpen]   = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { t, setCountry: setCtxCountry } = useLanguage();

  const filteredCountries = (ALL_COUNTRIES as readonly string[]).filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) { setLoading(false); return; }
        setUserId(user.id);
        setEmail(user.email ?? '');

        const { data: profile } = await supabase
          .from('profiles')
          .select('name, phone, country')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          const p = profile as any;
          setName(p.name || (user.user_metadata?.name as string) || '');
          setPhone(p.phone || '');
          setCountryLocal(p.country || '');
        } else {
          setName((user.user_metadata?.name as string) || '');
        }

        const { count } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id);
        setFollowingCount(count || 0);
      } catch (e) {
        console.error('Failed to load buyer profile', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, name, email, phone: phone || null, country: country || null }, { onConflict: 'id' });
    if (error) { alert(`Failed to save: ${error.message}`); setSaving(false); return; }
    if (country) setCtxCountry(country);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('myProfileTitle') || 'My Profile'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('manageAccountInfo') || 'Manage your account information'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>{t('backToProducts')}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account details */}
        <Card className="p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="size-4 text-gray-500" /> {t('accountDetailsHeading')}
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{t('fullNameLabel')}</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/30"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Email</label>
            <input
              className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              value={email}
              readOnly
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Phone className="size-3" /> {t('phoneNumberLabel')}
            </label>
            <input
              type="tel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/30"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? (
              <span className="flex items-center gap-2"><Check className="size-4" /> {t('savedLabel')}</span>
            ) : saving ? 'Saving…' : t('saveChangesBtn')}
          </Button>
        </Card>

        {/* Country & Currency */}
        <Card className="p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="size-4 text-gray-500" /> {t('countryCurrencyHeading')}
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{t('yourCountryLabel')}</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setCountryOpen(v => !v)}
                className={`w-full h-10 px-3 flex items-center justify-between rounded-lg border text-sm bg-white transition-colors
                  ${countryOpen ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200 hover:border-gray-400'}
                  ${country ? 'text-gray-900' : 'text-gray-400'}`}
              >
                <span>{country || t('selectCountryPlaceholder')}</span>
                <ChevronDown className={`size-4 text-gray-400 transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
              </button>

              {countryOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        placeholder={t('searchCountryPlaceholder')}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredCountries.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-gray-400 text-center">{t('noResultsText')}</p>
                    ) : (
                      filteredCountries.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setCountryLocal(c); setCountryOpen(false); setCountrySearch(''); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors
                            ${c === country ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-700'}`}
                        >
                          <span>{c}</span>
                          {c === country && <Check className="size-3.5 text-gray-900" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">{t('currencyAutoUpdateText')}</p>
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? (
              <span className="flex items-center gap-2"><Check className="size-4" /> {t('savedLabel')}</span>
            ) : saving ? 'Saving…' : t('saveCountryBtn')}
          </Button>
        </Card>

        {/* Following */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('followingTitle') || 'Following'}</h2>
          <p className="text-sm text-gray-700">
            {t('followingCountText') || 'You are following'}{' '}
            <span className="font-semibold">{followingCount}</span>{' '}
            {t('followingSellersSuffix') || 'seller(s).'}
          </p>
        </Card>
      </div>
    </div>
  );
}
