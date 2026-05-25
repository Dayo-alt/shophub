import { supabase } from './client';
import { CartItem } from '../../App';

export interface ProductDiscount {
  id: string;
  product_id: string;
  seller_id: string;
  original_price: number;
  discount_price: number;
  discount_percent: number;
  active_start_time: string;
  active_end_time: string;
  created_at: string;
}

export interface UserDiscountSession {
  id: string;
  user_id?: string;
  guest_email?: string;
  product_id: string;
  discount_id: string;
  applied_at: string;
  expires_at: string;
}

/**
 * Save cart to Supabase for persistence
 */
export async function saveCartToSupabase(
  cart: CartItem[],
  userIdOrEmail: string,
  isGuest: boolean = false
): Promise<void> {
  try {
    const cartData = {
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.image,
        category: item.product.category,
        sellerId: item.product.sellerId,
        sellerName: item.product.sellerName,
      })),
      lastUpdated: new Date().toISOString(),
    };

    if (isGuest) {
      // Store guest cart in localStorage + eventually to DB with email
      localStorage.setItem(`guest_cart_${userIdOrEmail}`, JSON.stringify(cartData));
    } else {
      // Store in Supabase for authenticated users
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('user_carts')
          .upsert(
            {
              user_id: user.id,
              cart_items: cart,
              last_updated: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        if (error) console.error('Error saving cart:', error);
      }
    }
  } catch (error) {
    console.error('Error in saveCartToSupabase:', error);
  }
}

/**
 * Load cart from Supabase on app startup
 */
export async function loadCartFromSupabase(
  isGuest: boolean = false,
  guestEmail?: string
): Promise<CartItem[]> {
  try {
    if (isGuest && guestEmail) {
      // Load guest cart from localStorage
      const stored = localStorage.getItem(`guest_cart_${guestEmail}`);
      if (stored) {
        const data = JSON.parse(stored);
        return data.items || [];
      }
    } else {
      // Load from Supabase for authenticated users
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('user_carts')
          .select('cart_items')
          .eq('user_id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error loading cart:', error);
        }
        if (data?.cart_items) {
          return data.cart_items;
        }
      }
    }
    return [];
  } catch (error) {
    console.error('Error in loadCartFromSupabase:', error);
    return [];
  }
}

/**
 * Get active discounts for products in cart
 */
export async function getActiveDiscountsForCart(
  cart: CartItem[]
): Promise<Map<string, ProductDiscount>> {
  try {
    const productIds = cart.map(item => item.product.id);
    if (productIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('active_product_discounts')
      .select('*')
      .in('product_id', productIds);

    if (error) {
      console.error('Error fetching discounts:', error);
      return new Map();
    }

    const discountMap = new Map<string, ProductDiscount>();
    (data || []).forEach((discount: any) => {
      discountMap.set(discount.product_id, discount);
    });
    return discountMap;
  } catch (error) {
    console.error('Error in getActiveDiscountsForCart:', error);
    return new Map();
  }
}

/**
 * Check if user has active discount session for a product
 */
export async function getUserActiveDiscount(
  productId: string,
  userIdOrEmail: string,
  isGuest: boolean = false
): Promise<UserDiscountSession | null> {
  try {
    const now = new Date().toISOString();
    
    let query = supabase
      .from('user_discount_sessions')
      .select('*')
      .eq('product_id', productId)
      .gt('expires_at', now);

    if (isGuest) {
      query = query.eq('guest_email', userIdOrEmail);
    } else {
      query = query.eq('user_id', userIdOrEmail);
    }

    const { data, error } = await query.single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user discount:', error);
    }
    
    return data || null;
  } catch (error) {
    console.error('Error in getUserActiveDiscount:', error);
    return null;
  }
}

/**
 * Apply discount session for user (when they click "Go to Cart")
 */
export async function applyDiscountSession(
  discountId: string,
  productId: string,
  userIdOrEmail: string,
  isGuest: boolean = false,
  durationMinutes: number = 120
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

    const payload: any = {
      product_id: productId,
      discount_id: discountId,
      applied_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    if (isGuest) {
      payload.guest_email = userIdOrEmail;
    } else {
      payload.user_id = userIdOrEmail;
    }

    const { error } = await supabase
      .from('user_discount_sessions')
      .insert(payload);

    if (error) console.error('Error applying discount session:', error);
  } catch (error) {
    console.error('Error in applyDiscountSession:', error);
  }
}

/**
 * Get price for product (with or without discount)
 */
export async function getPriceWithDiscount(
  productId: string,
  originalPrice: number,
  userIdOrEmail: string,
  isGuest: boolean = false
): Promise<number> {
  try {
    // Check if user has active discount session
    const discountSession = await getUserActiveDiscount(
      productId,
      userIdOrEmail,
      isGuest
    );

    if (discountSession) {
      // Get the discount details
      const { data, error } = await supabase
        .from('product_discounts')
        .select('discount_price')
        .eq('id', discountSession.discount_id)
        .single();

      if (!error && data) {
        return data.discount_price;
      }
    }

    return originalPrice;
  } catch (error) {
    console.error('Error in getPriceWithDiscount:', error);
    return originalPrice;
  }
}

/**
 * Get all active discounts for seller's products
 */
export async function getSellerActiveDiscounts(
  sellerId: string
): Promise<ProductDiscount[]> {
  try {
    const { data, error } = await supabase
      .from('product_discounts')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .gt('active_end_time', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching seller discounts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSellerActiveDiscounts:', error);
    return [];
  }
}

/**
 * Get discount for specific product
 */
export async function getProductDiscount(
  productId: string
): Promise<ProductDiscount | null> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('product_discounts')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .gt('active_end_time', now)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching product discount:', error);
    }

    return data || null;
  } catch (error) {
    console.error('Error in getProductDiscount:', error);
    return null;
  }
}

/**
 * Create or update discount for product
 */
export async function createOrUpdateDiscount(
  productId: string,
  originalPrice: number,
  discountPrice: number,
  endTime: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if discount exists
    const { data: existing } = await supabase
      .from('product_discounts')
      .select('id')
      .eq('product_id', productId)
      .eq('seller_id', user.id)
      .eq('is_active', true)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('product_discounts')
        .update({
          original_price: originalPrice,
          discount_price: discountPrice,
          active_end_time: endTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new
      const { error } = await supabase
        .from('product_discounts')
        .insert({
          product_id: productId,
          seller_id: user.id,
          original_price: originalPrice,
          discount_price: discountPrice,
          active_start_time: new Date().toISOString(),
          active_end_time: endTime,
          is_active: true,
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error in createOrUpdateDiscount:', error);
    throw error;
  }
}

/**
 * Deactivate/delete discount
 */
export async function deactivateDiscount(discountId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('product_discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', discountId);

    if (error) throw error;
  } catch (error) {
    console.error('Error in deactivateDiscount:', error);
    throw error;
  }
}

/**
 * Get recent active discounts (for exit popup when cart is empty)
 * Returns up to N most recent active discounts with product info
 */
export async function getRecentActiveDiscounts(limit: number = 2): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('active_product_discounts')
      .select(`
        id,
        product_id,
        seller_id,
        original_price,
        discount_price,
        discount_percent,
        active_end_time,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Fetch product details for each discount
    if (data && data.length > 0) {
      const productsWithDetails = await Promise.all(
        data.map(async (discount) => {
          const { data: product } = await supabase
            .from('products')
            .select('id, name, image, category')
            .eq('id', discount.product_id)
            .single();
          return { ...discount, product };
        })
      );
      return productsWithDetails;
    }

    return [];
  } catch (error) {
    console.error('Error in getRecentActiveDiscounts:', error);
    return [];
  }
}

/**
 * Get time remaining for discount (in minutes)
 */
export function getTimeRemaining(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 60000)); // Convert to minutes
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes < 0) return 'Expired';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
