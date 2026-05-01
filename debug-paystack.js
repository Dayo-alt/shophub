// Debug PayStack integration - run this in browser console
console.log('=== PayStack Debug ===');
console.log('Environment Variables:');
console.log('VITE_PAYSTACK_PUBLIC_KEY:', import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);

// Check if PayStack is loaded
if (typeof window !== 'undefined' && window.PaystackPop) {
  console.log('✅ PayStack SDK loaded');
} else {
  console.log('❌ PayStack SDK NOT loaded');
}

// Check PaymentMethodSelector component
if (typeof window !== 'undefined' && window.PaymentMethodSelector) {
  console.log('✅ PaymentMethodSelector component available');
} else {
  console.log('❌ PaymentMethodSelector component NOT available');
}

console.log('=== End Debug ===');
