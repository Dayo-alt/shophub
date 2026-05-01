import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type OtpReason = 'signup' | 'login' | 'google';

interface OtpPageProps {
  email: string;
  reason: OtpReason;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onCancel: () => void;
}

const INITIAL_COOLDOWN = 30;

export function OtpPage({ email, reason, onVerify, onResend, onCancel }: OtpPageProps) {
  const [code,        setCode]        = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [resending,   setResending]   = useState(false);
  const [cooldown,    setCooldown]    = useState(INITIAL_COOLDOWN);
  const [verifyError, setVerifyError] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendNote,  setResendNote]  = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) { setVerifyError('Enter the 6-digit code.'); return; }

    setSubmitting(true);
    setVerifyError('');
    try {
      await onVerify(code);
    } catch (err: any) {
      const msg: string = err.message ?? '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('403')) {
        setVerifyError('Code expired or invalid. Click "Resend code" below to get a fresh one, then wait for the new email before trying again.');
      } else {
        setVerifyError(msg || 'Invalid or expired code. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendError('');
    setResendNote('');
    setVerifyError('');
    try {
      await onResend();
      setCode('');
      setCooldown(INITIAL_COOLDOWN);
      setResendNote('New code sent — wait for the new email before entering it.');
    } catch (err: any) {
      const msg: string = err.message ?? '';
      // Supabase rate-limit message contains the wait time — extract it and set cooldown
      const waitMatch = msg.match(/(\d+)\s*second/i);
      if (waitMatch) {
        const waitSecs = parseInt(waitMatch[1], 10);
        setCooldown(waitSecs + 2);
        setResendError(`Rate limited. Please wait ${waitSecs} seconds before requesting a new code.`);
      } else {
        setResendError(msg || 'Could not send a new code. Please wait a moment and try again.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md px-8 py-7 shadow-lg border border-slate-100 animate-scale-in">

        <button
          type="button"
          onClick={onCancel}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <Mail className="size-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Verify your email</h2>
          <p className="text-sm text-slate-500">We sent a 6-digit code to</p>
          <p className="text-sm font-semibold text-slate-800">{email}</p>
        </div>

        {/* Delivery notice */}
        <div className="mb-5 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
          <Clock className="size-3.5 shrink-0 mt-0.5" />
          <span>
            Code usually arrives in <strong>seconds</strong>. Check your spam folder if it doesn't appear. Resending replaces the previous code.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setVerifyError('');
              }}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              placeholder="Enter 6-digit code"
              className="h-14 text-center text-2xl tracking-[0.5em] border-2 border-slate-300 bg-white shadow-sm"
            />
          </div>

          {verifyError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{verifyError}</span>
            </div>
          )}

          {resendNote && !verifyError && (
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              {resendNote}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold"
            disabled={submitting || code.length < 6}
          >
            {submitting ? 'Verifying…' : 'Verify & Continue'}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-500 space-y-1.5">
          <p>Didn't receive it?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
          >
            <RefreshCw className={`size-3.5 ${resending ? 'animate-spin' : ''}`} />
            {resending
              ? 'Sending new code…'
              : cooldown > 0
              ? `Resend available in ${cooldown}s`
              : 'Resend code'}
          </button>

          {/* Resend-specific error shown near the resend button */}
          {resendError && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 mt-1">
              {resendError}
            </p>
          )}

          {cooldown > 0 && !resendError && (
            <p className="text-xs text-slate-400">Not in inbox? Check your spam folder.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
