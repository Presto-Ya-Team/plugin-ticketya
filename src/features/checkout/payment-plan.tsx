import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buyerPayments, nextBuyerPayment } from "@/features/buyer/buyer-plan";
import { money } from "./checkout-utils";
import { payableTotal, type TicketOrder } from "./order-api";

export function PaymentPlan({ order, onPay }: { order: TicketOrder; onPay?: (number: number) => void }) {
  const payments = buyerPayments(order);
  const next = nextBuyerPayment(order);
  const installments = payments.filter(payment => payment.number !== 0);
  const paid = installments.filter(payment => payment.status === "PAID").length;
  const date = (value: string) => new Intl.DateTimeFormat("es-BO", {
    day: "numeric", month: "long", year: "numeric", timeZone: order.event.timeZone ?? "America/La_Paz",
  }).format(new Date(value));
  return <section aria-labelledby="payment-plan-title">
    <div className="payment-plan-card">
      <div className="payment-plan-heading"><h2 id="payment-plan-title">Plan de pagos</h2><p>Total del pedido: <strong>{money(payableTotal(order))}</strong></p></div>
      <ol className="payment-plan-list">
        {payments.map(payment => {
          const active = payment.number === next?.number && order.outstandingAmountMinor > 0;
          const canPay = active && onPay && order.status !== "PAYMENT_REVIEW_REQUIRED";
          return <li key={payment.number} className={`payment-plan-row ${active ? "is-next" : ""}`}>
            <span aria-hidden="true" className={`payment-plan-number ${payment.status === "PAID" ? "is-paid" : ""}`}>{payment.status === "PAID" ? <Check size={17} strokeWidth={3} /> : payment.number === 0 ? "A" : payment.number}</span>
            <div className="payment-plan-label"><h3>{payment.number === 0 ? "Anticipo · 25%" : `Cuota ${payment.number} de ${order.plan.installmentCount}`}</h3><time dateTime={payment.dueAt}>{date(payment.dueAt)}</time></div>
            <div className="payment-plan-amount"><div><strong>{money(payment.amountMinor)}</strong><span className={`payment-status ${payment.status === "PAID" ? "is-paid" : payment.overdue ? "is-overdue" : ""}`}>{payment.status === "PAID" ? "Pagada" : payment.overdue ? "Vencida" : "Pendiente"}</span></div>
              {canPay && <Button className="payment-plan-pay" onClick={() => onPay(payment.number)}>{payment.number === 0 ? "Pagar anticipo" : "Pagar cuota"}<ArrowRight size={14} /></Button>}
            </div>
          </li>;
        })}
      </ol>
    </div>
    <p className="payment-plan-progress">{paid} de {installments.length} cuotas pagadas · Saldo pendiente: <strong>{money(order.outstandingAmountMinor)}</strong></p>
    {order.status === "PAYMENT_REVIEW_REQUIRED" && <p role="status" className="mt-4 rounded-xl border bg-white p-4 text-sm">Tu compra está en revisión. Conservamos los pagos registrados; contacta a soporte antes de realizar otra cuota.</p>}
  </section>;
}
