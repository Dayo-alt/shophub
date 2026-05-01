import { ShoppingCart, Star } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Product } from '../App';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useLanguage } from '../utils/i18n/LanguageContext';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  onAddToCart: () => void;
  to?: string;
}

export function ProductCard({ product, onClick, onAddToCart, to }: ProductCardProps) {
  const { t, formatCurrency } = useLanguage();
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onAddToCart();
  };

  const firstImage = (product.image || '').split(',')[0]?.trim() || product.image;

  const cardContent = (
    <>
      <div className="relative aspect-3/4 overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={firstImage}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
        />
        {product.stock < 20 && (
          <Badge variant="destructive" className="absolute top-2 right-2">
            {t('lowStockBadge')}
          </Badge>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-gray-900 text-xs font-medium line-clamp-2 leading-snug">{product.name}</h3>
          <Badge variant="secondary" className="text-[11px] px-2 py-0.5 whitespace-nowrap">{product.category}</Badge>
        </div>

        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-700">
          <Star className="size-3 fill-yellow-400 text-yellow-400" />
          <span className="text-gray-900">
            {product.rating != null ? Number(product.rating).toFixed(1) : '—'}
          </span>
          <span className="text-gray-500">({product.reviews ?? 0})</span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="text-gray-900 text-xs font-semibold">{formatCurrency(product.price, product.currencyCode)}</span>
        </div>
      </div>
    </>
  );

  return (
    <Card className="group cursor-pointer overflow-hidden h-full flex flex-col hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <Link
        to={to ?? `/product/${product.id}`}
        onClick={onClick}
        className="flex flex-col h-full focus-visible:outline-none"
      >
        {cardContent}
      </Link>
    </Card>
  );
}
