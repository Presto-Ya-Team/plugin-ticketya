import { useEffect, useRef, useState } from "react";
import { LoaderCircle, QrCode, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckoutError, requestCheckoutPayment, type CheckoutPayment } from "./order-api";
import { eventDateTime, money } from "./checkout-utils";
import { SessionCountdown } from "./session-countdown";

export function BcpQrPayment({ amountMinor, token, buyer, termsVersion, expiresAt, onConfirmed }: {
  amountMinor: number; token: string; buyer: { name: string; email: string; phone: string };
  termsVersion: string | undefined; expiresAt: string; onConfirmed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CheckoutPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const confirmRef = useRef(onConfirmed);
  useEffect(() => { confirmRef.current = onConfirmed; }, [onConfirmed]);
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let poll: number | undefined;
    const controller = new AbortController();
    let timeout: number | undefined;
    async function load(initial: boolean) {
      setLoading(true);
      setError(null);
      timeout = window.setTimeout(() => controller.abort(), 40_000);
      try {
        if (!termsVersion) throw new CheckoutError("Esta orden antigua requiere una nueva cotización para pagar con BCP.");
        let response = await requestCheckoutPayment(token, controller.signal);
        const alreadyPaid = response.order.plan.ruleVersion === "TICKET_FINANCING_V3" && response.order.plan.downPayment.status === "PAID";
        // Revalidate the buyer when reopening an existing QR, rather than
        // showing a previously accepted buyer's charge after editing the form.
        if (initial && !alreadyPaid && (!response.payment || attempt === 0)) response = await requestCheckoutPayment(token, controller.signal, {
          buyer: { name: buyer.name, email: buyer.email, phone: buyer.phone }, accepted: true, termsVersion,
        });
        if (!active) return;
        if (response.payment && response.payment.amountMinor !== amountMinor) throw new CheckoutError("El importe del QR no coincide con el anticipo aceptado.");
        setResult(response);
        const paid = response.order.plan.ruleVersion === "TICKET_FINANCING_V3" && response.order.plan.downPayment.status === "PAID";
        if (paid) { confirmRef.current(); return; }
        if (response.payment && ["requested", "processing", "qr_ready"].includes(response.payment.status)) {
          poll = window.setTimeout(() => void load(false), 5000);
        }
      } catch (cause) {
        if (active) setError(cause instanceof CheckoutError ? cause.message
          : "No pudimos conectar con Meteor. Consulta el estado antes de volver a pagar.");
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load(true);
    return () => { active = false; controller.abort(); window.clearTimeout(poll); window.clearTimeout(timeout); };
  }, [open, attempt, token, buyer.name, buyer.email, buyer.phone, termsVersion, amountMinor]);

  const payment = result?.payment;
  const expired = payment && (payment.status === "expired" || Date.parse(payment.expiresAt) <= now);
  const ready = !expired && payment?.status === "qr_ready" && payment.qrImageBase64;
  const failed = payment && ["failed", "cancelled", "review_required"].includes(payment.status);
  return <Dialog open={open} onOpenChange={(value) => {
    setOpen(value);
    if (value) { setAttempt(0); setResult(null); setError(null); }
  }}>
    <DialogTrigger asChild><Button size="lg" className="h-12 w-full rounded-xl">
      Pagar {money(amountMinor)} <QrCode className="size-4" />
    </Button></DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <DialogHeader className="items-center pt-3 text-center">
        <Badge variant="secondary">BCP{result?.environment === "sandbox" ? " · Pruebas" : ""}</Badge>
        <DialogTitle className="text-xl">Paga tu anticipo</DialogTitle>
        <DialogDescription>El pago se confirmará cuando recibamos la verificación del banco.</DialogDescription>
      </DialogHeader>
      <SessionCountdown expiresAt={expiresAt} className="mx-auto w-fit" />
      <div className="space-y-4 text-center">
        <p className="text-3xl font-bold text-primary">{money(amountMinor)}</p>
        {error ? <p role="alert" className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : <>
          {ready && <div className="mx-auto w-fit rounded-2xl border bg-white p-3">
            <img src={`data:image/png;base64,${payment.qrImageBase64}`} alt="QR BCP para pagar el anticipo" width={240} height={240} className="h-auto max-w-full" />
          </div>}
          <p role="status" className="text-sm text-muted-foreground">
            {expired ? "Este QR venció. Consulta su estado antes de solicitar otro cobro."
              : failed ? "El cobro no está disponible o requiere revisión. Consulta con soporte antes de volver a pagar."
              : ready ? "Esperando confirmación de BCP…"
              : loading ? "Solicitando QR a BCP…"
              : "BCP está procesando la solicitud. No vuelvas a pagar mientras verificamos el resultado."}
          </p>
          {payment && <p className="text-xs text-muted-foreground">Referencia: {payment.paymentOrderId}<br />Vencimiento del QR: {eventDateTime(payment.expiresAt)}</p>}
        </>}
        {(error || expired || failed) && <Button variant="outline" className="w-full" disabled={loading} onClick={() => setAttempt((value) => value + 1)}>
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Consultar estado
        </Button>}
        <p className="text-xs leading-5 text-muted-foreground">Mostrar o escanear el QR no confirma el pago. Puedes cerrar esta ventana: Meteor seguirá recibiendo las confirmaciones del banco.</p>
      </div>
    </DialogContent>
  </Dialog>;
}
