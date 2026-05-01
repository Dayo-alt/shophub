import { useEffect, useState, useRef } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../utils/supabase/client';
import { useLanguage, ALL_COUNTRIES } from '../../utils/i18n/LanguageContext';
import { Check, ChevronDown, Search } from 'lucide-react';

export function SellerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountryLocal] = useState('');
  const [followersCount, setFollowersCount] = useState(0);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t, setCountry: setCtxCountry } = useLanguage();

  const filteredCountries = (ALL_COUNTRIES as readonly string[]).filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setCountryOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, address, phone, country')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          const p: any = profile;
          setName(p.name || '');
          setEmail(p.email || user.email || '');
          setAvatarUrl(p.avatar_url || '');
          setAddress(p.address || '');
          setPhone(p.phone || '');
          setCountryLocal(p.country || '');
        } else {
          setEmail(user.email || '');
        }

        const { count } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id);
        setFollowersCount(count || 0);
      } catch (e) {
        console.error('Failed to load seller profile page', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = auth.user;
      if (!user) return;

      const payload = {
        id: user.id,
        name,
        email,
        avatar_url: avatarUrl,
        address,
        phone: phone || null,
        country: country || null,
      };
      if (country) setCtxCountry(country);

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Failed to save seller profile', error);
        alert(`Failed to save profile: ${error.message}`);
      }
    } catch (e) {
      console.error('Failed to save seller profile', e);
    } finally {
      setSaving(false);
    }
  };

if (loading) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="loading">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-1">{t('sellerProfileTitle')}</h1>
          <p className="text-gray-600 text-sm">{t('sellerProfileSubtitle')}</p>
        </div>
        <Card className="p-4">
          <p className="text-sm text-gray-600 mb-1">{t('followersLabel')}</p>
          <p className="text-gray-900 text-xl">{followersCount}</p>
        </Card>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('nameLabel') || 'Name:'}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your store or personal name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('contactEmailLabel')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">{t('profileImageUrlLabel')}</Label>
            <Input
              id="avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
            <p className="text-xs text-gray-500">{t('profileImageHelper')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('phoneNumberLabel')}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('countryLabel')}</Label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setCountryOpen(v => !v)}
                className={`w-full h-10 px-3 flex items-center justify-between rounded-md border text-sm bg-white transition-colors
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
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCountries.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCountryLocal(c); setCountryOpen(false); setCountrySearch(''); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${c === country ? 'bg-gray-50 font-medium' : 'text-gray-700'}`}
                      >
                        <span>{c}</span>
                        {c === country && <Check className="size-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400">{t('currencyMatchCountryText')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('addressLocationLabel')}</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('addressLocationPlaceholder')}
              rows={3}
            />
          </div>

          <Button type="submit" disabled={saving} className="mt-2">
            {saving ? t('savingProfile') : t('saveProfile')}
          </Button>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-500 text-2xl font-semibold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span>{(name || email || 'S').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="text-center">
            <p className="text-gray-900 font-medium">{name || t('sellerFallbackName')}</p>
            <p className="text-gray-600 text-sm">{t('sellerProfilePreviewHelper')}</p>
          </div>
        </Card>
      </form>
    </div>
  );
}
