import { FC } from 'react';
import { Button } from '../ui/button';

interface BuyerHelpProps {
  onBackToProducts: () => void;
}

export const BuyerHelp: FC<BuyerHelpProps> = ({ onBackToProducts }) => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-2xl font-semibold">Help</h1>
        <Button variant="outline" size="sm" onClick={onBackToProducts}>
          Back to products
        </Button>
      </div>
      <p className="text-sm text-gray-600">
        Find quick answers to common questions about shopping on ShopHub.
      </p>
    </section>
  );
};
