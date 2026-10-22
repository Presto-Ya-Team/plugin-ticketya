import { useEffect, useRef, useState } from "react";
import { Clock3, Copy, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutError, requestCheckoutPayment, type CheckoutPayment } from "./order-api";
import { money } from "./checkout-utils";

export function BcpQrPayment({ amountMinor, token, buyer, termsVersion, expiresAt, onConfirmed, onCancel, preview = false }: {
  amountMinor: number; token: string; buyer: { name: string; email: string; phone: string };
  termsVersion: string | undefined; expiresAt: string; onConfirmed: () => void; onCancel: () => void; preview?: boolean;
}) {
  const [previewExpiresAt] = useState(() => Date.now() + 300_000);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<CheckoutPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const confirmRef = useRef(onConfirmed);
  useEffect(() => { confirmRef.current = onConfirmed; }, [onConfirmed]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (preview) return;
    let active = true;
    let poll: number | undefined;
    const controller = new AbortController();
    let timeout: number | undefined;
    async function load(initial: boolean) {
      setLoading(true);
      setError(null);
      timeout = window.setTimeout(() => controller.abort(), 40_000);
      try {
        if (initial && Date.parse(expiresAt) <= Date.now()) throw new CheckoutError("Este enlace de pago venció. Solicita uno nuevo.");
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
  }, [preview, attempt, token, buyer.name, buyer.email, buyer.phone, termsVersion, amountMinor, expiresAt]);

  const payment = result?.payment;
  const expired = payment && (payment.status === "expired" || Date.parse(payment.expiresAt) <= now);
  const ready = !expired && payment?.status === "qr_ready" && payment.qrImageBase64;
  const failed = payment && ["failed", "cancelled", "review_required"].includes(payment.status);
  const seconds = Math.max(0, Math.ceil(((preview ? previewExpiresAt : Date.parse(payment?.expiresAt ?? expiresAt)) - now) / 1000));
  const countdown = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
  async function copyAmount() {
    try { await navigator.clipboard.writeText((amountMinor / 100).toFixed(2)); setNotice("Importe copiado."); }
    catch { setNotice("No pudimos copiar el importe."); }
  }
  return <div className="inline-qr-card">
    <div className="inline-qr-image">
      {preview ? <DemoQr /> : ready ? <img src={`data:image/png;base64,${payment.qrImageBase64}`} alt="QR para pagar el anticipo" width={240} height={240} /> : <div role="status" className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">{loading ? <><LoaderCircle className="mr-2 size-5 animate-spin" />Preparando QR…</> : expired ? "QR vencido" : failed ? "Pago no disponible" : "Esperando el código QR…"}</div>}
    </div>
    <div className="inline-qr-timer" aria-label={`Tiempo restante: ${countdown}`}><Clock3 size={16} /><span>{countdown}</span></div>
    {!preview && result?.environment === "sandbox" && <p className="text-center text-xs text-muted-foreground">Ambiente de pruebas</p>}
    {preview && <p className="text-center text-xs text-muted-foreground">QR de demostración · No válido para pagos</p>}
    <div className="inline-qr-total"><div><p>MONTO DE LA CUOTA INICIAL</p><strong>{money(amountMinor)}</strong></div><Button variant="ghost" size="icon" aria-label="Copiar importe" onClick={() => void copyAmount()}><Copy size={18} /></Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!preview && <p role="status" className="text-center text-xs text-muted-foreground">{expired ? "Este QR venció. Consulta su estado antes de volver a pagar." : failed ? "El cobro no está disponible o requiere revisión. Contacta a soporte." : "El pago se registrará cuando recibamos la confirmación bancaria."}</p>}
    {notice && <p role="status" className="text-center text-xs text-muted-foreground">{notice}</p>}
    <div className="inline-qr-actions"><Button className="rounded-full bg-[#04BE89] px-6 font-bold text-white hover:bg-[#03aa7a]" disabled={!preview && loading} onClick={() => { if (preview) setNotice("Esta es una demostración: no se ha realizado ningún pago."); else setAttempt(value => value + 1); }}>{loading && !preview ? <LoaderCircle className="size-4 animate-spin" /> : null}{error || expired || failed ? "Consultar estado" : "Ya realicé el pago"}</Button><Button variant="ghost" className="font-bold text-[#009e72]" onClick={onCancel}>Cancelar</Button></div>
  </div>;
}
function DemoQr() {
  // Decorative pattern only: no banking or payment payload.
  const finder = (x: number, y: number) => <g key={x + ":" + y}><rect x={x} y={y} width="7" height="7" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="white" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>;
  return <svg viewBox="-2 -2 25 25" role="img" aria-label="QR ficticio de demostración" fill="#04BE89" shapeRendering="crispEdges">
    <rect x="-2" y="-2" width="25" height="25" fill="white" />
    {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
    {Array.from({ length: 441 }, (_, index) => { const x = index % 21; const y = Math.floor(index / 21); if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return null; return (x * 7 + y * 11 + x * y) % 5 < 3 ? <rect key={index} x={x} y={y} width="1" height="1" /> : null; })}
  </svg>;
}
