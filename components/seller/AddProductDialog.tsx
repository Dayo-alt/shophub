import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { useLanguage } from '../../utils/i18n/LanguageContext';

interface AddProductDialogProps {
  onClose: () => void;
  onAdd: (productData: any) => Promise<void>;
  currencySymbol?: string;
}

export function AddProductDialog({ onClose, onAdd, currencySymbol = '₦' }: AddProductDialogProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: '',
    category: '',
    stock: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock, 10);

    if (Number.isNaN(price) || price < 0) {
      setError('Please enter a valid non-negative price.');
      return;
    }

    if (Number.isNaN(stock) || stock < 0) {
      setError('Please enter a valid non-negative stock quantity.');
      return;
    }

    setLoading(true);

    try {
      await onAdd({
        name: formData.name.trim(),
        price,
        description: formData.description.trim(),
        image: formData.image.trim(),
        category: formData.category,
        stock,
      });

      setFormData({ name: '', price: '', description: '', image: '', category: '', stock: '' });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('addProductTitle')}</DialogTitle>
          <DialogDescription>{t('addProductDesc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('productNameLabel')}</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder={t('productNamePlaceholder')}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">{t('priceLabel')} ({currencySymbol})</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={handleChange}
                required
                placeholder="0.00"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stock">{t('stockQtyFormLabel')}</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min="0"
                value={formData.stock}
                onChange={handleChange}
                required
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">{t('catLabel') || 'Category'}</Label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="h-10 px-3 py-2 border rounded-md text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">{t('selectCategoryPlaceholder')}</option>
              <option value="Appliances">{t('catAppliances')}</option>
              <option value="Phones & Tablets">{t('catPhones') || 'Phones & Tablets'}</option>
              <option value="Health & Beauty">{t('catHealthBeauty') || 'Health & Beauty'}</option>
              <option value="Home & Office">{t('catHomeOffice') || 'Home & Office'}</option>
              <option value="Electronics">{t('catElectronics')}</option>
              <option value="Fashion">{t('catFashion')}</option>
              <option value="Supermarket">{t('catSupermarket') || 'Supermarket'}</option>
              <option value="Computing">{t('catComputing') || 'Computing'}</option>
              <option value="Baby Products">{t('catBabyProducts') || 'Baby Products'}</option>
              <option value="Gaming">{t('catGaming') || 'Gaming'}</option>
              <option value="Musical Instruments">{t('catMusical') || 'Musical Instruments'}</option>
              <option value="Other categories">{t('catOther') || 'Other categories'}</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="image">{t('imageUrlLabel')}</Label>
            <Input
              id="image"
              name="image"
              type="url"
              value={formData.image}
              onChange={handleChange}
              required
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              placeholder={t('describeProductPlaceholder')}
              rows={4}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancelBtn')}
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('addingLabel')}
                </>
              ) : (
                t('addProduct')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
