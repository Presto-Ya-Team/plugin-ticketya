import { CalendarDays, MapPin, Ticket, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { money, shortDate, eventDateTime } from "./checkout-utils";
import { checkoutPayments, payableTotal, type TicketOrder } from "./order-api";

export function TicketSummary({ order }: { order: TicketOrder }) {
  const financing = order.plan.ruleVersion === "TICKET_FINANCING_V3";
  const schedule = checkoutPayments(order.plan);
  const remaining = schedule.length - 1;
  const timeZone = order.event.timeZone ?? "America/La_Paz";
  return (
    <aside
      className="space-y-5 lg:sticky lg:top-8 lg:self-start"
      aria-label="Resumen de tu entrada"
    >
      <Card className="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
        <div className="flex items-center justify-between bg-primary/10 px-6 py-7 text-primary">
          <Ticket className="size-12 -rotate-12" aria-hidden />
          <Badge variant="secondary">Tu próximo plan</Badge>
        </div>
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="eyebrow mb-2">RESUMEN DE TU ENTRADA</p>
            <h2 className="text-xl font-bold tracking-tight">
              {order.event.name}
            </h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2.5">
              <CalendarDays className="size-4 shrink-0" />
              {eventDateTime(order.event.startsAt, timeZone)} · Hora del evento
            </p>
            {order.event.venue && <p className="flex items-center gap-2.5">
              <MapPin className="size-4 shrink-0" />
              {order.event.venue}
            </p>}
            {order.items.map((item, index) => <p key={`${item.ticketTypeId}-${index}`} className="flex items-center gap-2.5">
              <Ticket className="size-4 shrink-0" />
              {item.quantity} {item.quantity === 1 ? "entrada" : "entradas"} · {item.ticketType}
              <span className="ml-auto shrink-0 text-foreground">{money(item.quantity * item.unitPriceMinor)}</span>
            </p>)}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Precio de las entradas
            </span>
            <span className="font-semibold">
              {money(order.totalAmountMinor)}
            </span>
          </div>
          {order.plan.ruleVersion === "TICKET_FINANCING_V3" && <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Intereses de financiación</span>
              <span>{money(order.plan.interestMinor)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 font-semibold">
              <span>Total a pagar</span><span>{money(payableTotal(order))}</span>
            </div>
          </>}
          <div className="rounded-xl bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{financing ? "Anticipo del 25%" : "Primer pago"}</span>
              <span className="text-2xl font-bold tracking-tight text-primary">
                {money(schedule[0].amountMinor)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Después, {remaining} {remaining === 1 ? "cuota" : "cuotas"} hasta el{" "}
              {shortDate(schedule.at(-1)!.dueAt, timeZone)}.
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Entrada proporcionada por{" "}
            <span className="font-medium text-foreground">
              {order.ticketera.name}
            </span>
          </p>
        </CardContent>
      </Card>
      <div className="flex items-start gap-3 px-3 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">Todo claro desde el principio</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Revisa los importes y las fechas antes de confirmar. Todas las
            fechas corresponden al plan guardado en tu orden. El cobro se realiza mediante BCP sandbox.
          </p>
        </div>
      </div>
    </aside>
  );
}
