import { supabase } from '../utils/supabase/client';
import { useEffect, useState } from 'react';
import { useLanguage } from '../utils/i18n/LanguageContext';

interface FooterSettings {
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
}

interface FooterProps {
  isLoggedIn: boolean;
  onOpenAdmin: () => void;
  showAdminLink: boolean;
}

export function Footer({ isLoggedIn, onOpenAdmin, showAdminLink }: FooterProps) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<FooterSettings | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('contact_email, contact_phone, contact_address')
        .eq('id', 1)
        .maybeSingle();
      setSettings((data as any) ?? null);
    };
    load();
  }, []);

  return (
    <footer className="border-t bg-white mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-2 text-sm text-gray-600">
        <div className="flex flex-wrap gap-4 justify-between">
          <div>
            <div className="font-medium text-gray-900 mb-1">{t('contactUsLabel')}</div>
            <div>{settings?.contact_email || 'contact@shophub.local'}</div>
            {settings?.contact_phone && <div>{settings.contact_phone}</div>}
            {settings?.contact_address && <div>{settings.contact_address}</div>}
          </div>
          {showAdminLink && !isLoggedIn && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-xs text-gray-500 hover:text-gray-800 underline self-end"
            >
              Admin
            </button>
          )}
        </div>
        <div className="text-xs text-gray-400">© {new Date().getFullYear()} ShopHub. {t('allRightsReservedText')}</div>
      </div>
    </footer>
  );
}
