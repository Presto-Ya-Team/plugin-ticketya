import { Check } from "lucide-react";
import { Confetti } from "@/components/ui/confetti";
import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { CheckoutSession } from "./checkout-session";
import { checkoutPath, type TicketOrder } from "./order-api";
import { createPreviewOrder } from "./preview-order";

export function ConfirmationPage() {
  const [params] = useSearchParams();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [previewOrder] = useState(() => {
    if (!import.meta.env.DEV) return null;
    const order = createPreviewOrder();
    if (order.plan.ruleVersion !== "TICKET_FINANCING_V3") return null;
    order.plan.downPayment.status = "PAID";
    order.plan.snapshot.scheduleState = "CONFIRMED";
    order.paidAmountMinor = order.plan.downPayment.amountMinor;
    order.outstandingAmountMinor -= order.paidAmountMinor;
    order.status = "FINANCING_ACTIVE";
    return order;
  });
  if (import.meta.env.DEV && params.get("preview") === "confirmation" && previewOrder) {
    return <Confirmation order={previewOrder} token="local-preview" preview />;
  }
  return <CheckoutSession>{({ order, token }) => <Confirmation order={order} token={token} />}</CheckoutSession>;
}

function Confirmation({ order, token, preview = false }: { order: TicketOrder; token: string; preview?: boolean }) {
  if (order.plan.ruleVersion !== "TICKET_FINANCING_V3" || order.plan.downPayment.status !== "PAID") {
    return <Navigate to={checkoutPath(token)} replace />;
  }
  const reviewing = order.status === "PAYMENT_REVIEW_REQUIRED" || order.plan.snapshot.scheduleState === "REQUIRES_REVIEW";
  return <main className="payment-confirmation" aria-labelledby="confirmation-title">
    {!reviewing && <Confetti
      className="confirmation-confetti"
      aria-hidden="true"
      globalOptions={{ resize: true, useWorker: false, disableForReducedMotion: true }}
      options={{
        particleCount: 110, spread: 180, angle: 270, origin: { x: 0.5, y: 0 },
        colors: ["#04BE89", "#00876c", "#d6a000"], shapes: ["square"],
        startVelocity: 28, gravity: 0.55, decay: 0.94, ticks: 280, scalar: 0.75,
        disableForReducedMotion: true,
      }}
    />}
    <section className="confirmation-message">
      <span className="confirmation-check" aria-hidden="true"><Check size={30} strokeWidth={3.5} /></span>
      <h1 id="confirmation-title">{reviewing ? "¡Recibimos tu primer pago!" : "¡Tu pago ha sido confirmado!"}</h1>
      <p className="confirmation-next-step">Te enviaremos un correo con los siguientes pasos.</p>
      <p className="confirmation-description">{reviewing
        ? "Tu pago está registrado. Estamos revisando tu plan y te contactaremos por correo para continuar con el proceso."
        : "Tu primer pago ya está registrado. Revisa tu correo electrónico para continuar con el proceso y conocer los próximos pasos de tu plan de pagos."}</p>
    </section>
    {preview && <p className="confirmation-preview">Vista previa local · Pago de demostración</p>}
  </main>;
}
