import { Ticket } from "lucide-react";
import { money, shortDate } from "./checkout-utils";
import { payableTotal, type TicketOrder } from "./order-api";

export function PlanSummary({ order }: { order: TicketOrder }) {
  return <aside className="order-sidebar" aria-label="Resumen del pedido">
    <div className="prestaya-brand-card"><img src="/prestaya-logo.png" alt="Presta Ya" /><p>Préstamos e inversiones seguras.</p></div>
    <section className="order-summary-card">
      <h2>Resumen del Pedido</h2>
      <div className="order-summary-event"><span className="order-event-icon"><Ticket aria-hidden="true" /></span><div><p className="order-summary-venue">{order.event.venue ?? order.ticketera.name}</p><h3>{order.event.name}</h3><p>{shortDate(order.event.startsAt, order.event.timeZone)}</p></div></div>
      <dl className="order-summary-lines">
        {order.items.map((item, index) => <div key={`${item.ticketTypeId}-${index}`}><dt>{item.ticketType} (×{item.quantity})</dt><dd>{money(item.quantity * item.unitPriceMinor)}</dd></div>)}
        {order.plan.ruleVersion === "TICKET_FINANCING_V3" && <div><dt>Intereses de financiación</dt><dd>{money(order.plan.interestMinor)}</dd></div>}
        {order.plan.feesMinor > 0 && <div><dt>Cargos por servicio</dt><dd>{money(order.plan.feesMinor)}</dd></div>}
        <div className="order-summary-total"><dt>Total a pagar</dt><dd>{money(payableTotal(order))}</dd></div>
      </dl>
      <p className="order-summary-note">Entradas proporcionadas por {order.ticketera.name}.</p>
      <p className="order-summary-reference">Pedido: {order.externalOrderId}</p>
    </section>
  </aside>;
}
