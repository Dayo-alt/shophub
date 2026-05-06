import { Globe2 } from 'lucide-react';
import { useLanguage, Language } from '../../utils/i18n/LanguageContext';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const languageLabels: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
  zh: '中文',
};

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ bottom: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        bottom: window.innerHeight - rect.top + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(v => !v);
  };

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setOpen(false);
  };

  // Close on scroll/resize
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-50 text-xs">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 rounded-full bg-white/90 border border-gray-200 px-3 py-1.5 shadow-sm hover:bg-gray-50"
      >
        <Globe2 className="size-3.5 text-gray-700" />
        <span className="text-gray-800">{languageLabels[language]}</span>
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed w-40 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden z-[9999]"
            style={{ bottom: dropPos.bottom, right: dropPos.right }}
          >
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
        </>,
        document.body
      )}
    </div>
  );
}
