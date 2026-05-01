import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Loader2, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => { openIframe: () => void };
    };
  }
}

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  callback: (response: { reference: string; status: string }) => void;
  onClose: () => void;
}

interface PayStackPaymentProps {
  amount: number;
  email: string;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

// Singleton script load — avoids duplicate <script> tags across re-renders
let scriptLoadPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  if (window.PaystackPop) {
    scriptLoadPromise = Promise.resolve();
    return scriptLoadPromise;
  }
  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      // Script tag already in DOM — wait for it
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Paystack script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Paystack script failed to load. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export function PayStackPayment({ amount, email, onSuccess, onCancel, onError }: PayStackPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(!!window.PaystackPop);
  const [initError, setInitError] = useState('');
  // Track whether the callback already fired so onClose doesn't double-fire cancel
  const paymentSucceeded = useRef(false);

  useEffect(() => {
    if (window.PaystackPop) return;
    loadPaystackScript()
      .then(() => setScriptReady(true))
      .catch((e) => setInitError(e.message));
  }, []);

  const pay = async () => {
    setInitError('');

    if (!PAYSTACK_PUBLIC_KEY) {
      const msg = 'Paystack public key is not configured. Please contact support.';
      setInitError(msg);
      onError(msg);
      return;
    }
    if (!email) {
      const msg = 'An email address is required to process payment.';
      setInitError(msg);
      onError(msg);
      return;
    }
    if (!amount || amount <= 0) {
      const msg = 'Invalid payment amount.';
      setInitError(msg);
      onError(msg);
      return;
    }

    setLoading(true);

    try {
      if (!window.PaystackPop) {
        await loadPaystackScript();
        setScriptReady(true);
      }

      const reference = `shophub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      paymentSucceeded.current = false;

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        // Paystack requires kobo (NGN smallest unit = 1/100 of ₦)
        amount: Math.round(amount * 100),
        currency: 'NGN',
        ref: reference,
        callback: (response) => {
          paymentSucceeded.current = true;
          setLoading(false);
          if (response.status === 'success') {
            onSuccess(response.reference);
          } else {
            const msg = `Payment was not completed (status: ${response.status}).`;
            setInitError(msg);
            onError(msg);
          }
        },
        onClose: () => {
          setLoading(false);
          // Only treat as cancel if the callback never fired
          if (!paymentSucceeded.current) {
            onCancel();
          }
        },
      });

      handler.openIframe();
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Payment initialisation failed.';
      setInitError(msg);
      onError(msg);
    }
  };

  const amountDisplay = `₦${Math.round(amount).toLocaleString('en-NG')}`;

  return (
    <div className="space-y-4">
      {/* Payment summary row */}
      <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-green-800">
          <ShieldCheck className="size-4 shrink-0" />
          <span>Secured by Paystack</span>
        </div>
        <span className="text-base font-semibold text-green-900">{amountDisplay}</span>
      </div>

      {/* Supported methods */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {['Card', 'Bank Transfer', 'USSD', 'Mobile Money', 'QR Code'].map((m) => (
          <span key={m} className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5">
            {m}
          </span>
        ))}
      </div>

      {/* Inline error */}
      {initError && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{initError}</span>
        </div>
      )}

      <Button
        onClick={pay}
        disabled={loading || (!scriptReady && !window.PaystackPop)}
        className="w-full bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform h-11 text-base"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Opening Paystack…
          </>
        ) : (
          <>
            <CreditCard className="size-4 mr-2" />
            Pay {amountDisplay} with Paystack
          </>
        )}
      </Button>

      <p className="text-center text-[11px] text-gray-400">
        You will be redirected to Paystack's secure payment page.
        Your card details are never stored on our servers.
      </p>
    </div>
  );
}
