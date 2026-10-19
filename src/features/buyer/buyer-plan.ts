import { checkoutPayments, type TicketOrder } from "@/features/checkout/order-api";

export function buyerPayments(order: TicketOrder, now = new Date()) {
  const timeZone = order.event.timeZone ?? "America/La_Paz";
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const today = day(now);
  return checkoutPayments(order.plan).map(payment => ({
    ...payment,
    overdue: payment.status !== "PAID" && (payment.status === "OVERDUE" || day(new Date(payment.dueAt)) < today),
    label: order.plan.ruleVersion === "TICKET_FINANCING_V3" && payment.number === 0 ? "Anticipo" : `Cuota ${payment.number}`,
  }));
}

export function nextBuyerPayment(order: TicketOrder) {
  return buyerPayments(order).find(payment => payment.status !== "PAID");
}
