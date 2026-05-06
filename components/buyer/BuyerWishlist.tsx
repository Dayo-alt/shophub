import { FC, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../App';
import { ProductCard } from '../ProductCard';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface BuyerWishlistProps {
  onBackToProducts: () => void;
}

type WishlistItem = {
  product: Product;
  productId: string;
};

export const BuyerWishlist: FC<BuyerWishlistProps> = ({ onBackToProducts }) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!uid) {
          setItems([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('wishlist_items')
          .select('product_id, products:product_id (*)')
          .eq('user_id', uid);

        if (error) {
          console.error('Failed to load wishlist:', error);
          setItems([]);
        } else {
          const rows = (data as any[]) || [];
          const mapped: WishlistItem[] = rows
            .map((row) => {
              const product = row.products as Product | null;
              if (!product) return null;
              return {
                product,
                productId: row.product_id as string,
              };
            })
            .filter((x): x is WishlistItem => !!x);
          setItems(mapped);
        }
      } catch (e) {
        console.error('Unexpected error loading wishlist:', e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleRemove = async (productId: string) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) return;

      const { error } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('user_id', uid)
        .eq('product_id', productId);

      if (error) {
        console.error('Failed to remove wishlist item:', error);
        return;
      }

      setItems((prev) => prev.filter((item) => item.productId !== productId));
    } catch (e) {
      console.error('Unexpected error removing wishlist item:', e);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-2xl font-semibold">{t('wishlistTitle')}</h1>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>
          {t('backToProducts')}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">{t('loadingWishlist')}</p>
      ) : items.length === 0 ? (
        <div className="mt-6 text-sm text-gray-600">
          <p className="mb-3">{t('wishlistEmpty')}</p>
          <Button size="sm" onClick={onBackToProducts}>
            {t('browseProducts')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {items.map((item) => (
            <div key={item.product.id} className="flex flex-col gap-2">
              <ProductCard
                product={item.product}
                onClick={() => {}}
                onAddToCart={() => {}}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(item.productId)}
              >
                {t('removeFromWishlist')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
