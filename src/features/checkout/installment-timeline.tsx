import { CalendarDays, Check, CreditCard } from "lucide-react";
import { money, shortDate } from "./checkout-utils";
import { checkoutPayments, type TicketOrder } from "./order-api";

export function InstallmentTimeline({ plan }: {
  plan: TicketOrder["plan"];
}) {
  const payments = checkoutPayments(plan);
  const financing = plan.ruleVersion === "TICKET_FINANCING_V3";
  const timeZone = financing ? plan.snapshot.eventTimeZone : "America/La_Paz";
  return <ol aria-label="Calendario de cuotas" className="space-y-0">
    {payments.map((payment, index) => {
      const paid = payment.status === "PAID";
      const status = paid ? "Pagada"
        : payment.status === "OVERDUE" ? "Vencida" : "Pendiente";
      return <li key={payment.number} className="relative flex gap-4 pb-6 last:pb-0">
        {index < payments.length - 1 && <span aria-hidden className="absolute bottom-0 left-[17px] top-9 w-px bg-border" />}
        <span className={`relative flex size-9 shrink-0 items-center justify-center rounded-full ${index === 0 || paid ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {paid ? <Check className="size-4" /> : index === 0
            ? <CreditCard className="size-4" /> : <CalendarDays className="size-4" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 pt-1">
          <div>
            <p className="text-sm font-semibold">{financing && index === 0 ? "Anticipo · 25% del precio original" : `Cuota ${payment.number}${index === 0 ? " · Primer pago" : ""}`}</p>
            <p className="mt-1 text-xs text-muted-foreground"><time dateTime={payment.dueAt}>{shortDate(payment.dueAt, timeZone)}</time></p>
            <p className={`mt-1 text-xs ${paid ? "text-primary" : "text-muted-foreground"}`}>{status}</p>
          </div>
          <p className="text-sm font-semibold">{money(payment.amountMinor)}</p>
        </div>
      </li>;
    })}
  </ol>;
}
