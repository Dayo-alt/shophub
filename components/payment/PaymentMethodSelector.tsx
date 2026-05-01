import { PayStackPayment } from './PayStackPayment';

interface PaymentMethodSelectorProps {
  amount: number;
  email: string;
  onPaymentSuccess: (reference: string, method: 'paystack' | 'stripe') => void;
  onPaymentCancel: () => void;
  onError: (error: string) => void;
}

export function PaymentMethodSelector({
  amount,
  email,
  onPaymentSuccess,
  onPaymentCancel,
  onError,
}: PaymentMethodSelectorProps) {
  return (
    <PayStackPayment
      amount={amount}
      email={email}
      onSuccess={(reference) => onPaymentSuccess(reference, 'paystack')}
      onCancel={onPaymentCancel}
      onError={onError}
    />
  );
}
