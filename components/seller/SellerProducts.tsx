import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Store, Star, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { supabase } from '../../utils/supabase/client';
import { Product } from '../../App';
import { AddProductDialog } from './AddProductDialog';
import { EditProductDialog } from './EditProductDialog';
import { DiscountDialog } from './DiscountDialog';
import { getSellerActiveDiscounts, ProductDiscount } from '../../utils/supabase/cartService';
// Removed invalid ImageWithFallback import; using native img with fallback
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface SellerProductsProps {
  accessToken: string;
}

export function SellerProducts({ accessToken }: SellerProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [discountingProduct, setDiscountingProduct] = useState<Product | null>(null);
  const [discountsByProduct, setDiscountsByProduct] = useState<Record<string, ProductDiscount | null>>({});
  const [reviewsByProduct, setReviewsByProduct] = useState<Record<string, Array<{ id: string; product_id: string; user_email: string | null; user_id?: string | null; user_name?: string | null; rating: number; comment: string; created_at: string }>>>({});
  const { t, formatCurrency, currencyCode, currencySymbol } = useLanguage();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const sellerId = auth.user?.id ?? null;
      const query = supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: false });
      const { data, error } = sellerId
        ? await query.eq('seller_id', sellerId)
        : await query;
      if (error) throw error;
      const list: Product[] = ((data as any[]) || []).map(p => ({
        ...p,
        sellerId:     p.sellerId     ?? p.seller_id     ?? '',
        sellerName:   p.sellerName   ?? p.seller_name   ?? 'Seller',
        currencyCode: p.currency_code ?? p.currencyCode ?? 'NGN',
      }));
      setProducts(list);
      
      // Load discounts for this seller
      if (sellerId) {
        const activeDiscounts = await getSellerActiveDiscounts(sellerId);
        const discountMap: Record<string, ProductDiscount | null> = {};
        activeDiscounts.forEach(discount => {
          discountMap[discount.product_id] = discount;
        });
        setDiscountsByProduct(discountMap);
      }
      
      const ids = list.map(p => p.id);
      if (ids.length) {
        const { data: revs } = await supabase
          .from('reviews')
          .select('id, product_id, user_email, user_id, rating, comment, created_at')
          .in('product_id', ids)
          .order('created_at', { ascending: false });
        // Lookup names from profiles
        const listAll = (revs as any[]) || [];
        const uidSet = Array.from(new Set(listAll.map(r => r.user_id).filter(Boolean)));
        let nameById: Record<string, string | null> = {};
        if (uidSet.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', uidSet as string[]);
          nameById = Object.fromEntries(((profs as any[]) || []).map(p => [p.id, p.name]));
        }
        const map: Record<string, Array<{ id: string; product_id: string; user_email: string | null; user_id?: string | null; user_name?: string | null; rating: number; comment: string; created_at: string }>> = {};
        listAll.forEach(r => {
          const pid = (r as any).product_id as string;
          if (!map[pid]) map[pid] = [];
          map[pid].push({ ...(r as any), user_name: r.user_id ? nameById[r.user_id as string] || null : null });
        });
        setReviewsByProduct(map);
      } else {
        setReviewsByProduct({});
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (productData: any) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const sellerId = auth.user?.id ?? null;
      const sellerName = auth.user?.user_metadata?.name ?? auth.user?.email ?? 'Seller';

      const { error } = await supabase
        .from('products')
        .insert({
          name:          productData.name,
          price:         productData.price,
          description:   productData.description,
          image:         productData.image,
          category:      productData.category,
          stock:         productData.stock,
          seller_id:     sellerId,
          seller_name:   sellerName,
          currency_code: currencyCode || 'NGN',
        });
      if (error) throw error;
      await fetchProducts();
      setShowAddDialog(false);
    } catch (error) {
      console.error('Failed to add product:', error);
      throw error;
    }
  };

  const handleUpdateProduct = async (productId: string, productData: any) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: productData.name,
          price: productData.price,
          description: productData.description,
          image: productData.image,
          category: productData.category,
          stock: productData.stock,
        })
        .eq('id', productId);
      if (error) throw error;
      await fetchProducts();
      setEditingProduct(null);
    } catch (error) {
      console.error('Failed to update product:', error);
      throw error;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm(t('deleteProductConfirm'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      if (error) throw error;
      await fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-gray-900 mb-2">{t('sellerProductsTitle')}</h1>
          <p className="text-gray-600">{t('sellerProductsSubtitle')}</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="size-4" />
          {t('addProduct')}
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="size-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-gray-900 mb-2">{t('noProductsYetTitle')}</h2>
          <p className="text-gray-600 mb-6">{t('noProductsYetSubtitle')}</p>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="size-4" />
            {t('addProduct')}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => {
            const firstImage = (product.image || '').split(',')[0]?.trim() || product.image;
            return (
              <Card
                key={product.id}
                className="overflow-hidden animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={firstImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/600x600?text=No+Image';
                    }}
                  />
                  {product.stock < 10 && (
                    <Badge variant="destructive" className="absolute top-2 right-2">
                      {t('lowStockBadge')}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-gray-900">{product.name}</h3>
                  <Badge variant="secondary">{product.category}</Badge>
                </div>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-900">{formatCurrency(product.price, product.currencyCode)}</span>
                  <span className="text-sm text-gray-600">Stock: {product.stock}</span>
                </div>
                <div className="mb-4">
                  <div className="text-sm text-gray-900 mb-2">{t('reviewsTitle')}</div>
                  {(() => {
                    const list = reviewsByProduct[product.id] || [];
                    if (list.length === 0) {
                      return <div className="text-sm text-gray-500">{t('noReviewsYet')}</div>;
                    }
                    const latest = list.slice(0, 3);
                    const avg = (list.reduce((s, r) => s + (r.rating || 0), 0) / list.length) || 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`size-4 ${i < Math.round(avg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                          <span>({list.length})</span>
                        </div>
                        {latest.map(r => (
                          <div key={r.id} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900">{r.user_name || r.user_email || t('anonymousReviewer')}</span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`size-3 ${i < Math.floor(r.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                ))}
                              </div>
                            </div>
                            <div className="text-gray-600 line-clamp-2">{r.comment}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setDiscountingProduct(product)}
                  >
                    <Tag className="size-4" />
                    {discountsByProduct[product.id] ? t('editDiscount') || 'Edit Discount' : t('setDiscount') || 'Set Discount'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setEditingProduct(product)}
                  >
                    <Edit className="size-4" />
                    {t('edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteProduct(product.id)}
                  >
                    <Trash2 className="size-4" />
                    {t('delete')}
                  </Button>
                </div>
                
                {discountsByProduct[product.id] && (
                  <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200 text-xs">
                    <div className="flex items-center gap-1 text-orange-700 font-semibold">
                      <Tag className="size-3" />
                      {discountsByProduct[product.id]?.discount_percent?.toFixed(0)}% OFF
                    </div>
                    <div className="text-orange-600 text-xs mt-1">
                      {formatCurrency(discountsByProduct[product.id]?.discount_price || 0, product.currencyCode)}
                      {' '}<span className="line-through text-orange-500">{formatCurrency(discountsByProduct[product.id]?.original_price || 0, product.currencyCode)}</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );})}
        </div>
      )}

      {showAddDialog && (
        <AddProductDialog
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAddProduct}
          currencySymbol={currencySymbol}
        />
      )}

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onUpdate={handleUpdateProduct}
          currencySymbol={currencySymbol}
        />
      )}

      {discountingProduct && (
        <DiscountDialog
          product={discountingProduct}
          existingDiscount={discountsByProduct[discountingProduct.id] || null}
          onClose={() => setDiscountingProduct(null)}
          onSuccess={() => {
            setDiscountingProduct(null);
            fetchProducts();
          }}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}
