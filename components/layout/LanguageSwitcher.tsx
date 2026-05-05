import { Globe2 } from 'lucide-react';
import { useLanguage, Language } from '../../utils/i18n/LanguageContext';
import { useState } from 'react';

const languageLabels: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  zh: '中文',
};

interface LanguageSwitcherProps {
  /** When true, renders as an inline header button (no fixed positioning) */
  inline?: boolean;
}

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setOpen(false);
  };

  if (inline) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Globe2 className="size-3.5" />
          <span className="hidden sm:inline">{languageLabels[language]}</span>
        </button>

        {open && (
          <>
            {/* backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute top-full right-0 mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-50">
              {(Object.keys(languageLabels) as Language[]).map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleSelect(lang)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between ${
                    lang === language ? 'bg-gray-50 font-semibold text-blue-600' : 'text-gray-700'
                  }`}
                >
                  <span>{languageLabels[lang]}</span>
                  {lang === language && <span className="size-1.5 rounded-full bg-blue-500 inline-block" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 text-xs">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-white/90 border border-gray-200 px-3 py-1.5 shadow-sm hover:bg-gray-50"
        >
          <Globe2 className="size-3.5 text-gray-700" />
          <span className="text-gray-800">{languageLabels[language]}</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute bottom-9 right-0 w-40 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-50">
              {(Object.keys(languageLabels) as Language[]).map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleSelect(lang)}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 flex items-center justify-between ${
                    lang === language ? 'bg-gray-50 font-semibold' : ''
                  }`}
                >
                  <span>{languageLabels[lang]}</span>
                  {lang === language && <span className="text-[10px] text-blue-600">●</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
