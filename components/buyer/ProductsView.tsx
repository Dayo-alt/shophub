import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../App';
import { ProductCard } from '../ProductCard';
import {
  Search, SlidersHorizontal, X, Star, LayoutGrid, Smartphone,
  Heart, Home, Monitor, ShoppingBag, ShoppingCart, Laptop,
  Music, Gamepad2, Package, MoreHorizontal, Zap, ChevronDown, Tag,
} from 'lucide-react';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface ProductsViewProps {
  accessToken?: string;
  onAddToCart: (product: Product, quantity: number) => void;
  onOpenProduct?: (product: Product) => void;
}

type SortOption = 'featured' | 'price_asc' | 'price_desc' | 'newest' | 'rating';

const CATEGORY_CONFIG: { id: string; labelKey: string; Icon: React.ElementType }[] = [
  { id: 'all',                 labelKey: 'catAllProducts',  Icon: LayoutGrid    },
  { id: 'Phones & Tablets',    labelKey: 'catPhones',       Icon: Smartphone    },
  { id: 'Electronics',         labelKey: 'catElectronics',  Icon: Monitor       },
  { id: 'Fashion',             labelKey: 'catFashion',      Icon: ShoppingBag   },
  { id: 'Health & Beauty',     labelKey: 'catBeauty',       Icon: Heart         },
  { id: 'Home & Office',       labelKey: 'catHomeOffice',   Icon: Home          },
  { id: 'Appliances',          labelKey: 'catAppliances',   Icon: Zap           },
  { id: 'Computing',           labelKey: 'catComputing',    Icon: Laptop        },
  { id: 'Supermarket',         labelKey: 'catSupermarket',  Icon: ShoppingCart  },
  { id: 'Gaming',              labelKey: 'catGaming',       Icon: Gamepad2      },
  { id: 'Baby Products',       labelKey: 'catBaby',         Icon: Package       },
  { id: 'Musical Instruments', labelKey: 'catMusic',        Icon: Music         },
  { id: 'Other categories',    labelKey: 'catOther',        Icon: MoreHorizontal},
];

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-300 text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-gray-900 flex items-center">
        <X className="size-3" />
      </button>
    </span>
  );
}

export function ProductsView({ onAddToCart, onOpenProduct }: ProductsViewProps) {
  const [products, setProducts]           = useState<Product[]>([]);
  const [randomOrder, setRandomOrder]     = useState<string[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchText, setSearchText]       = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [sortOption, setSortOption]       = useState<SortOption>('featured');
  const [priceMin, setPriceMin]           = useState('');
  const [priceMax, setPriceMax]           = useState('');
  const [minRating, setMinRating]         = useState(0);
  const [inStockOnly, setInStockOnly]     = useState(false);
  const [showFilters, setShowFilters]     = useState(false);
  const [heroWallpapers, setHeroWallpapers] = useState<string[]>([]);
  const [heroIndex, setHeroIndex]         = useState(0);
  const [sectionsConfig, setSectionsConfig] = useState<any[]>([]);
  const [activeSectionView, setActiveSectionView] = useState<null | 'best_sellers' | 'new_arrivals' | 'flash_sales'>(null);
  const [now, setNow]                     = useState<Date>(() => new Date());
  const [mounted, setMounted]             = useState(false);
  const searchTimer                       = useRef<ReturnType<typeof setTimeout>>();
  const { t } = useLanguage();

  /* ── debounced search ────────────────────────────────────────────── */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(searchText), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText]);

  /* ── data loading ────────────────────────────────────────────────── */
  useEffect(() => {
    fetchProducts();

    supabase
      .from('admin_settings')
      .select('hero_wallpapers, sections_config')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        const w = (data as any)?.hero_wallpapers;
        if (Array.isArray(w) && w.length) setHeroWallpapers(w);
        const s = (data as any)?.sections_config;
        if (Array.isArray(s)) setSectionsConfig(s);
      });

    const ch = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { setMounted(true); }, []);

  /* countdown tick */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* hero slideshow */
  useEffect(() => {
    if (heroWallpapers.length <= 1) return;
    const id = setInterval(() => setHeroIndex(i => (i + 1) % heroWallpapers.length), 5000);
    return () => clearInterval(id);
  }, [heroWallpapers]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      const base: Product[] = ((data as any[]) || []).map(p => ({
        ...p,
        sellerId:     p.sellerId     ?? p.seller_id     ?? '',
        sellerName:   p.sellerName   ?? p.seller_name   ?? 'Seller',
        currencyCode: p.currency_code ?? p.currencyCode ?? 'NGN',
      }));
      const ids = base.map(p => p.id);
      if (ids.length) {
        const { data: revs } = await supabase
          .from('reviews')
          .select('product_id, rating')
          .in('product_id', ids);
        const agg: Record<string, { sum: number; count: number }> = {};
        ((revs as any[]) || []).forEach(r => {
          if (!agg[r.product_id]) agg[r.product_id] = { sum: 0, count: 0 };
          agg[r.product_id].sum   += Number(r.rating) || 0;
          agg[r.product_id].count += 1;
        });
        const withRatings = base.map(p => {
          const a = agg[p.id];
          return a ? { ...p, rating: a.sum / a.count, reviews: a.count } : { ...p, rating: 0, reviews: 0 };
        });
        setProducts(withRatings);
        setRandomOrder([...withRatings.map(p => p.id)].sort(() => Math.random() - 0.5));
      } else {
        setProducts(base);
        setRandomOrder([...base.map(p => p.id)].sort(() => Math.random() - 0.5));
      }
    } catch { setProducts([]); }
    finally { setLoading(false); }
  };

  /* ── categories ──────────────────────────────────────────────────── */
  const dynamicCats = Array.from(new Set(products.map(p => p.category)))
    .filter(cat => cat && !CATEGORY_CONFIG.find(c => c.id === cat))
    .map(cat => ({ id: cat, labelKey: cat, Icon: Tag }));
  const allCategories = [...CATEGORY_CONFIG, ...dynamicCats];

  /* ── filtering ───────────────────────────────────────────────────── */
  const q = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
    if (priceMin && p.price < Number(priceMin)) return false;
    if (priceMax && p.price > Number(priceMax)) return false;
    if (minRating > 0 && ((p as any).rating || 0) < minRating) return false;
    if (inStockOnly && typeof p.stock === 'number' && p.stock <= 0) return false;
    return true;
  });

  const activeFilterCount = [
    selectedCategory !== 'all', !!priceMin, !!priceMax,
    minRating > 0, inStockOnly, !!searchQuery,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSelectedCategory('all'); setPriceMin(''); setPriceMax('');
    setMinRating(0); setInStockOnly(false);
    setSearchQuery(''); setSearchText('');
  };

  /* ── sorting ─────────────────────────────────────────────────────── */
  const sortProducts = (list: Product[]): Product[] => {
    switch (sortOption) {
      case 'price_asc':  return [...list].sort((a, b) => a.price - b.price);
      case 'price_desc': return [...list].sort((a, b) => b.price - a.price);
      case 'newest':     return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'rating':     return [...list].sort((a, b) => ((b as any).rating || 0) - ((a as any).rating || 0));
      default:
        if (!activeSectionView && randomOrder.length)
          return [...list].sort((a, b) => randomOrder.indexOf(a.id) - randomOrder.indexOf(b.id));
        return list;
    }
  };

  /* ── featured sections ───────────────────────────────────────────── */
  const bestSellerProducts = [...products]
    .filter(p => (p as any).reviews > 0)
    .sort((a, b) => {
      const d = ((b as any).rating || 0) - ((a as any).rating || 0);
      return d !== 0 ? d : ((b as any).reviews || 0) - ((a as any).reviews || 0);
    }).slice(0, 10);

  const newArrivalProducts = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const flashThreshold = (sectionsConfig.find(s => s.type === 'flash_sales')?.low_stock_threshold as number | undefined) ?? 20;
  const flashSaleProducts = products
    .filter(p => typeof p.stock === 'number' && p.stock <= flashThreshold)
    .slice(0, 10);

  const formatCountdown = (end: string | null | undefined) => {
    if (!end) return '';
    const ms = new Date(end).getTime() - now.getTime();
    if (isNaN(ms) || ms <= 0) return t('endedLabel');
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
  };

  const getSectionLabel = (type: string, fallback: string) => {
    try {
      if (type === 'best_sellers') return t('bestSellersSectionTitle') || fallback;
      if (type === 'new_arrivals') return t('newArrivalsSectionTitle') || fallback;
      if (type === 'flash_sales')  return t('flashSalesSectionTitle')  || fallback;
    } catch {}
    return fallback;
  };

  const randomizedForStrips: Product[] = randomOrder.length
    ? [...products].sort((a, b) => randomOrder.indexOf(a.id) - randomOrder.indexOf(b.id))
    : products;

  const gridProducts = (() => {
    if (activeSectionView === 'best_sellers') return sortProducts(bestSellerProducts);
    if (activeSectionView === 'new_arrivals') return sortProducts(newArrivalProducts);
    if (activeSectionView === 'flash_sales')  return sortProducts(flashSaleProducts);
    return sortProducts(filteredProducts);
  })();

  const openProduct = (p: Product) => onOpenProduct?.(p);

  /* ── render ──────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="loading"><span/><span/><span/><span/><span/></div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 mb-8">
        <div className="absolute inset-0">
          {(heroWallpapers.length ? heroWallpapers : [
            'https://images.pexels.com/photos/3965545/pexels-photo-3965545.jpeg?auto=compress&cs=tinysrgb&w=1200',
          ]).map((url, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${idx === heroIndex ? 'opacity-40' : 'opacity-0'}`}
              style={{ backgroundImage: `url(${url})` }}
            />
          ))}
        </div>
        <div className="relative px-6 sm:px-10 py-10 sm:py-14 flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-slate-200/80 mb-1">{t('heroEyebrow')}</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white">{t('heroTitle')}</h1>
            <p className="mt-3 max-w-xl text-sm sm:text-base text-slate-100/80">{t('heroSubtitle')}</p>
          </div>
          {/* Search bar */}
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-lg">
              <Search className="size-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search products, brands, categories…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setSearchQuery(searchText)}
                className="flex-1 border-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
              {searchText && (
                <button onClick={() => { setSearchText(''); setSearchQuery(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="size-4" />
                </button>
              )}
              <button
                onClick={() => setSearchQuery(searchText)}
                className="bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-full px-5 py-1.5 transition-colors"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category strip ────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-4 px-4 mb-6" style={{ scrollbarWidth: 'none' }}>
        <div className="flex gap-2 min-w-max pb-1">
          {allCategories.map(({ id, labelKey, Icon }) => {
            const active = selectedCategory === id && !activeSectionView;
            const label = t(labelKey) || labelKey;
            return (
              <button
                key={id}
                onClick={() => { setSelectedCategory(id); setActiveSectionView(null); }}
                className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md shadow-gray-400/30'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`size-5 ${active ? 'text-white' : 'text-gray-400'}`} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter / Sort toolbar ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-sm text-gray-500 flex-1 min-w-0">
          <span className="font-semibold text-gray-800">{gridProducts.length}</span>{' '}
          {activeSectionView ? t('products') : t('resultsLabel')}
          {q && <span className="text-gray-400"> for "<span className="text-gray-600">{q}</span>"</span>}
        </p>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="size-4" />
          {t('filtersLabel')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        <div className="relative">
          <select
            value={sortOption}
            onChange={e => setSortOption(e.target.value as SortOption)}
            className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-sm bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-400/30"
          >
            <option value="featured">{t('sortFeatured')}</option>
            <option value="price_asc">{t('sortPriceLowHigh')}</option>
            <option value="price_desc">{t('sortPriceHighLow')}</option>
            <option value="newest">{t('sortNewest')}</option>
            <option value="rating">{t('sortTopRated')}</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Price */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{t('priceRangeLabel')}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} placeholder={t('minPricePlaceholder')}
                  value={priceMin} onChange={e => setPriceMin(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                />
                <span className="text-gray-400 shrink-0">—</span>
                <input
                  type="number" min={0} placeholder={t('maxPricePlaceholder')}
                  value={priceMax} onChange={e => setPriceMax(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/30"
                />
              </div>
            </div>

            {/* Rating */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{t('minRatingLabel')}</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onClick={() => setMinRating(minRating === s ? 0 : s)}
                    className={`flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      minRating === s
                        ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-yellow-50'
                    }`}
                  >
                    <Star className={`size-3 ${minRating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    {s}+
                  </button>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">{t('availabilityLabel')}</p>
              <label className="inline-flex items-center gap-2.5 cursor-pointer group" onClick={() => setInStockOnly(v => !v)}>
                <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                  inStockOnly ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-600'
                }`}>
                  {inStockOnly && (
                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700 select-none">{t('inStockOnly')}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── Active filter chips ────────────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {selectedCategory !== 'all' && <FilterChip label={selectedCategory} onRemove={() => setSelectedCategory('all')} />}
          {(priceMin || priceMax) && (
            <FilterChip label={`₦${priceMin || '0'} – ₦${priceMax || '∞'}`} onRemove={() => { setPriceMin(''); setPriceMax(''); }} />
          )}
          {minRating > 0 && <FilterChip label={`${minRating}+ stars`} onRemove={() => setMinRating(0)} />}
          {inStockOnly && <FilterChip label="In stock" onRemove={() => setInStockOnly(false)} />}
          {searchQuery && (
            <FilterChip label={`"${searchQuery}"`} onRemove={() => { setSearchQuery(''); setSearchText(''); }} />
          )}
          <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline">
            {t('clearAll')}
          </button>
        </div>
      )}

      {/* ── Featured sections ─────────────────────────────────────────── */}
      {activeSectionView === null && (
        <div className="space-y-8 mb-10">
          {sectionsConfig.filter(s => s.enabled).map((section, index) => {
            let items: Product[] = [];
            if (section.type === 'best_sellers') items = bestSellerProducts;
            if (section.type === 'new_arrivals') items = newArrivalProducts;
            if (section.type === 'flash_sales')  items = flashSaleProducts;
            if (!items.length) return null;

            const isFlash = section.type === 'flash_sales';
            const sectionLabel = getSectionLabel(section.type, section.title);
            const countdown = isFlash ? formatCountdown(section.flash_ends_at) : '';
            const bg = isFlash
              ? 'linear-gradient(90deg, #dc2626, #b91c1c)'
              : 'linear-gradient(90deg, #111827, #374151)';
            const stripItems = randomizedForStrips.slice(index * 4, index * 4 + 4);

            return (
              <div key={section.id} className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="px-4 sm:px-6 py-3 flex items-center text-sm text-white gap-3" style={{ background: bg }}>
                    <span className={`font-bold drop-shadow-sm flex-1 ${isFlash ? 'text-base sm:text-lg' : ''}`}>
                      {sectionLabel}
                    </span>
                    {isFlash && countdown && (
                      <span className="text-xs bg-black/25 rounded-full px-3 py-0.5 font-mono font-semibold shrink-0">
                        ⏱ {countdown}
                      </span>
                    )}
                    <button
                      type="button"
                      className="text-xs font-medium hover:underline shrink-0 ml-auto"
                      onClick={() => setActiveSectionView(section.type)}
                    >
                      See all →
                    </button>
                  </div>
                  <div className="px-3 sm:px-4 py-4 overflow-x-auto">
                    <div className="flex gap-3 min-w-max">
                      {items.map(product => (
                        <div key={product.id} className="w-44 sm:w-52 shrink-0">
                          <ProductCard
                            product={product}
                            onClick={onOpenProduct ? () => openProduct(product) : undefined}
                            to={onOpenProduct ? '#' : undefined}
                            onAddToCart={() => onAddToCart(product, 1)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── Section banner (when "see all" is active) ─────────────────── */}
      {activeSectionView && (() => {
        const sec = sectionsConfig.find(s => s.type === activeSectionView);
        if (!sec) return null;
        const isFlash = sec.type === 'flash_sales';
        const bg = isFlash ? 'linear-gradient(90deg,#dc2626,#b91c1c)' : 'linear-gradient(90deg,#111827,#374151)';
        return (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm mb-5">
            <div className="px-4 sm:px-6 py-3 flex items-center text-sm text-white gap-3" style={{ background: bg }}>
              <span className="font-bold flex-1">{getSectionLabel(sec.type, sec.title)}</span>
              {isFlash && (
                <span className="text-xs bg-black/25 rounded-full px-3 py-0.5 font-mono font-semibold">
                  ⏱ {formatCountdown(sec.flash_ends_at)}
                </span>
              )}
            </div>
            {sec.wallpaper_url && (
              <div
                className="h-32 md:h-48 w-full bg-cover bg-center border-t border-gray-100"
                style={{ backgroundImage: `url(${sec.wallpaper_url})` }}
              />
            )}
            <div className="px-4 sm:px-6 py-2.5">
              <button onClick={() => setActiveSectionView(null)} className="text-sm text-gray-700 hover:underline font-medium">
                {t('backToAllProducts')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Product grid ──────────────────────────────────────────────── */}
      {gridProducts.length === 0 ? (
        <div className="text-center py-20">
          <Search className="size-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">{t('noProductsFoundTitle')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('noProductsFoundSubtitle')}</p>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="mt-4 text-sm text-gray-700 font-medium hover:underline">
              {t('clearAllFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {gridProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={onOpenProduct ? () => openProduct(product) : undefined}
              to={onOpenProduct ? '#' : undefined}
              onAddToCart={() => onAddToCart(product, 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
