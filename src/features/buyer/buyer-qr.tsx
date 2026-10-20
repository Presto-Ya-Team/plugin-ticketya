import { useEffect, useRef, useState } from 'react';
import { RefreshCw, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { money, eventDateTime } from '@/features/checkout/checkout-utils';
import type { CheckoutPayment, TicketOrder } from '@/features/checkout/order-api';
import { BuyerError, createBuyerPayment, getBuyerPayment } from './buyer-api';

export function BuyerQr({ orderId, installment, amountMinor, csrfToken, confirmed, expired }: {
  orderId: string; installment: number; amountMinor: number; csrfToken: string; confirmed: (order: TicketOrder) => void; expired: () => void;
}) {
  const [result, setResult] = useState<CheckoutPayment>(); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0); const [now, setNow] = useState(() => Date.now());
  const callbacks = useRef({ confirmed, expired }); useEffect(() => { callbacks.current = { confirmed, expired }; }, [confirmed, expired]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer: number | undefined;
    async function load(initial: boolean) {
      setLoading(true); setError('');
      try {
        let value = await getBuyerPayment(orderId, installment, controller.signal);
        const paid = () => value.order.plan.installments.find(row => row.number === installment)?.status === 'PAID';
        if (initial && !paid() && !value.payment) value = await createBuyerPayment(orderId, installment, csrfToken, controller.signal);
        if (controller.signal.aborted) return;
        if (value.payment && value.payment.amountMinor !== amountMinor) throw new BuyerError('El importe del QR no coincide con tu cuota.');
        setResult(value);
        if (paid()) { callbacks.current.confirmed(value.order); return; }
        if (value.payment && ['requested', 'processing', 'qr_ready'].includes(value.payment.status)) timer = window.setTimeout(() => void load(false), 5000);
      } catch (cause) {
        if (!controller.signal.aborted) {
          if (cause instanceof BuyerError && cause.status === 401) callbacks.current.expired();
          else setError(cause instanceof BuyerError ? cause.message : 'No pudimos consultar el pago. Intenta nuevamente.');
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(true); return () => { controller.abort(); clearTimeout(timer); };
  }, [orderId, installment, amountMinor, csrfToken, retry]);
  const payment = result?.payment; const isExpired = payment && Date.parse(payment.expiresAt) <= now;
  const ready = payment?.status === 'qr_ready' && !isExpired && payment.qrImageBase64;
  const unavailable = payment && ['expired', 'cancelled', 'failed', 'review_required'].includes(payment.status);
  return <div className="space-y-4 text-center">
    <Badge variant="secondary">BCP{result?.environment === 'sandbox' ? ' · Pruebas' : ''}</Badge>
    <p className="text-3xl font-bold text-primary">{money(amountMinor)}</p>
    {error ? <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : <>
      {ready && <div className="mx-auto w-fit rounded-xl border bg-white p-3"><img src={`data:image/png;base64,${payment.qrImageBase64}`} width={240} height={240} alt={`QR BCP para pagar la cuota ${installment}`} className="h-auto max-w-full" /></div>}
      <p role="status" className="text-sm text-muted-foreground">{isExpired || unavailable ? 'Este cobro venció o requiere revisión. Consulta el estado y contacta con soporte antes de volver a pagar.' : ready ? 'Esperando confirmación de BCP…' : loading ? 'Solicitando QR a BCP…' : 'Estamos verificando el cobro. No vuelvas a pagar mientras consultamos su estado.'}</p>
      {payment && <p className="break-all text-xs text-muted-foreground">Referencia: {payment.paymentOrderId}<br />Vencimiento: {eventDateTime(payment.expiresAt)}</p>}
    </>}
    {(error || isExpired || unavailable) && <Button variant="outline" className="w-full" disabled={loading} onClick={() => setRetry(value => value + 1)}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Consultar estado</Button>}
    <p className="text-xs leading-5 text-muted-foreground">Escanear el QR no confirma el pago. Puedes cerrar esta ventana; actualizaremos tu cuota cuando el banco lo confirme.</p>
  </div>;
}
