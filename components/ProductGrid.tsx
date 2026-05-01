import { useState } from 'react';
import { ProductCard } from './ProductCard';
import { Product } from '../App';
import { Button } from './ui/button';

interface ProductGridProps {
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Wireless Headphones',
    price: 89.99,
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life',
    image: 'https://picsum.photos/seed/headphones/500/500.jpg',
    category: 'Electronics',
    stock: 45,
    rating: 4.5,
    reviews: 234,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Smart Watch',
    price: 299.99,
    description: 'Advanced fitness tracking with heart rate monitor and GPS',
    image: 'https://picsum.photos/seed/smartwatch/500/500.jpg',
    category: 'Electronics',
    stock: 28,
    rating: 4.7,
    reviews: 189,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Leather Backpack',
    price: 79.99,
    description: 'Stylish genuine leather backpack with laptop compartment',
    image: 'https://picsum.photos/seed/backpack/500/500.jpg',
    category: 'Fashion',
    stock: 67,
    rating: 4.3,
    reviews: 156,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Running Shoes',
    price: 129.99,
    description: 'Lightweight running shoes with superior cushioning',
    image: 'https://picsum.photos/seed/shoes/500/500.jpg',
    category: 'Fashion',
    stock: 92,
    rating: 4.6,
    reviews: 412,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'Coffee Maker',
    price: 149.99,
    description: 'Programmable coffee maker with thermal carafe',
    image: 'https://picsum.photos/seed/coffee/500/500.jpg',
    category: 'Home',
    stock: 34,
    rating: 4.4,
    reviews: 278,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'Yoga Mat',
    price: 34.99,
    description: 'Extra thick non-slip yoga mat with carrying strap',
    image: 'https://picsum.photos/seed/yoga/500/500.jpg',
    category: 'Sports',
    stock: 156,
    rating: 4.5,
    reviews: 345,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '7',
    name: 'Desk Lamp',
    price: 59.99,
    description: 'LED desk lamp with adjustable brightness and color temperature',
    image: 'https://picsum.photos/seed/lamp/500/500.jpg',
    category: 'Home',
    stock: 78,
    rating: 4.2,
    reviews: 167,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '8',
    name: 'Wireless Mouse',
    price: 29.99,
    description: 'Ergonomic wireless mouse with precision tracking',
    image: 'https://picsum.photos/seed/mouse/500/500.jpg',
    category: 'Electronics',
    stock: 203,
    rating: 4.4,
    reviews: 521,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '9',
    name: 'Sunglasses',
    price: 159.99,
    description: 'Polarized sunglasses with UV protection',
    image: 'https://picsum.photos/seed/sunglasses/500/500.jpg',
    category: 'Fashion',
    stock: 45,
    rating: 4.6,
    reviews: 289,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '10',
    name: 'Bluetooth Speaker',
    price: 79.99,
    description: 'Waterproof portable speaker with 360° sound',
    image: 'https://picsum.photos/seed/speaker/500/500.jpg',
    category: 'Electronics',
    stock: 112,
    rating: 4.5,
    reviews: 445,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '11',
    name: 'Organic Basmati Rice',
    price: 24.99,
    description: 'Premium organic basmati rice, 5kg pack',
    image: 'https://picsum.photos/seed/rice/500/500.jpg',
    category: 'Groceries',
    stock: 89,
    rating: 4.8,
    reviews: 167,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '12',
    name: 'Stainless Steel Water Bottle',
    price: 19.99,
    description: 'Insulated water bottle, keeps drinks cold for 24 hours',
    image: 'https://picsum.photos/seed/bottle/500/500.jpg',
    category: 'Sports',
    stock: 234,
    rating: 4.3,
    reviews: 298,
    sellerId: 'mock-seller',
    sellerName: 'Mock Seller',
    createdAt: '2024-01-01T00:00:00Z',
  }
];

const CATEGORIES = ['all', 'Electronics', 'Fashion', 'Home', 'Sports', 'Groceries'];

export function ProductGrid({ onProductClick, onAddToCart, selectedCategory, onCategoryChange }: ProductGridProps) {
  const filteredProducts = selectedCategory === 'all'
    ? MOCK_PRODUCTS
    : MOCK_PRODUCTS.filter(p => p.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 mb-2">Discover Products</h1>
        <p className="text-gray-600 mb-6">Browse our curated collection of quality products</p>
        
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(category)}
            >
              {category === 'all' ? 'All Products' : category}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onClick={() => onProductClick(product)}
            onAddToCart={() => onAddToCart(product)}
          />
        ))}
      </div>
    </div>
  );
}
