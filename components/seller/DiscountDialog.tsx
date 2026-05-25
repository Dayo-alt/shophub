import { useState } from 'react';
import { Loader2, Clock, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ProductDiscount, createOrUpdateDiscount, deactivateDiscount } from '../../utils/supabase/cartService';
import { Product } from '../../App';

interface DiscountDialogProps {
  product: Product;
  existingDiscount: ProductDiscount | null;
  onClose: () => void;
  onSuccess: () => void;
  currencySymbol?: string;
}

export function DiscountDialog({
  product,
  existingDiscount,
  onClose,
  onSuccess,
  currencySymbol = '₦',
}: DiscountDialogProps) {
  const [discountPrice, setDiscountPrice] = useState(
    existingDiscount?.discount_price.toString() || ''
  );
  const [durationHours, setDurationHours] = useState(
    existingDiscount
      ? Math.ceil(
          (new Date(existingDiscount.active_end_time).getTime() -
            new Date(existingDiscount.active_start_time).getTime()) /
            (1000 * 60 * 60)
        )
      : 2
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const originalPrice = product.price;
  const discountAmount = originalPrice - (parseFloat(discountPrice) || 0);
  const discountPercent =
    discountPrice && parseFloat(discountPrice) > 0
      ? Math.round(((originalPrice - parseFloat(discountPrice)) / originalPrice) * 100)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const finalPrice = parseFloat(discountPrice);

      // Validation
      if (!finalPrice || finalPrice <= 0) {
        throw new Error('Discount price must be greater than 0');
      }
      if (finalPrice >= originalPrice) {
        throw new Error('Discount price must be less than original price');
      }
      if (durationHours <= 0) {
        throw new Error('Duration must be at least 1 hour');
      }

      // Calculate end time
      const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

      // Create/update discount
      await createOrUpdateDiscount(
        product.id,
        originalPrice,
        finalPrice,
        endTime
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save discount');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingDiscount) return;
    if (!confirm('Are you sure you want to remove this discount?')) return;

    setLoading(true);
    try {
      await deactivateDiscount(existingDiscount.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove discount');
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingDiscount ? 'Edit Discount' : 'Create Discount'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Info */}
          <Card className="p-3 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900">{product.name}</p>
            <p className="text-sm text-gray-600">
              Original Price: {currencySymbol}{product.price.toLocaleString()}
            </p>
          </Card>

          {/* Discount Price */}
          <div>
            <Label htmlFor="discountPrice" className="flex items-center gap-2 mb-2">
              <DollarSign className="size-4" />
              Discount Price
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-600">{currencySymbol}</span>
              <Input
                id="discountPrice"
                type="number"
                step="0.01"
                min="0"
                max={originalPrice}
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="Enter discounted price"
                disabled={loading}
              />
            </div>
            {discountPrice && parseFloat(discountPrice) > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                <p className="text-blue-900">
                  <strong>Savings:</strong> {currencySymbol}{discountAmount.toLocaleString()} ({discountPercent}% off)
                </p>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <Label htmlFor="duration" className="flex items-center gap-2 mb-2">
              <Clock className="size-4" />
              Discount Duration
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="duration"
                type="number"
                min="1"
                max="720"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value) || 1)}
                placeholder="Hours"
                disabled={loading}
                className="flex-1"
              />
              <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                {durationHours === 1 ? 'hour' : 'hours'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Discount will expire in {durationHours}h {durationHours === 1 && ' from now'}
            </p>
          </div>

          {/* Info Box */}
          <Card className="p-3 bg-yellow-50 border border-yellow-200">
            <p className="text-xs text-yellow-900">
              💡 <strong>Tip:</strong> This discount will appear in the exit popup when users try to leave the site with items in their cart.
            </p>
          </Card>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              disabled={loading || !discountPrice}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{existingDiscount ? 'Update' : 'Create'} Discount</>
              )}
            </Button>

            {existingDiscount && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="w-full"
              >
                Remove Discount
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
