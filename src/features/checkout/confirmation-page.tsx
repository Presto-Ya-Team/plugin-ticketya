import { Check, RefreshCw } from "lucide-react";
import { Navigate, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { money } from "./checkout-utils";
import { CheckoutSession } from "./checkout-session";
import { checkoutPath, checkoutPayments, type TicketOrder } from "./order-api";
import { InstallmentTimeline } from "./installment-timeline";

export function ConfirmationPage() {
  return <CheckoutSession>{({ order, token }) => <Confirmation order={order} token={token} />}</CheckoutSession>;
}

function Confirmation({ order, token }: { order: TicketOrder; token: string }) {
  const { state } = useLocation();
  if (order.plan.ruleVersion !== "TICKET_FINANCING_V3" || order.plan.downPayment.status !== "PAID") return <Navigate to={checkoutPath(token)} replace />;
  const name = state && typeof state.name === "string" && state.orderId === order.orderId ? state.name.split(" ")[0] : "";
  const count = order.plan.installmentCount;
  const financing = order.plan.ruleVersion === "TICKET_FINANCING_V3";
  const schedule = checkoutPayments(order.plan);
  return (
    <main className="mx-auto max-w-xl px-5 py-14 sm:py-20">
      <div className="text-center">
        <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Check className="size-8" />
        </span>
        <Badge variant="secondary" className="mb-4">
          Anticipo confirmado · BCP sandbox
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          ¡Anticipo recibido{name ? `, ${name}` : ""}!
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          BCP confirmó tu anticipo de {money(schedule[0].amountMinor)}.
          El pago ya está registrado en tu orden.
        </p>
      </div>
      <Card className="my-8 gap-0 py-0 shadow-none">
        <CardContent className="p-6">
          <h2 className="font-semibold">{order.event.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.items.map((item) => `${item.quantity} × ${item.ticketType}`).join(" · ")} · {financing ? "Anticipo + " : ""}{count} {count === 1 ? "cuota" : "cuotas"}
          </p>
          <Separator className="my-5" />
          <InstallmentTimeline plan={order.plan} />
        </CardContent>
      </Card>
      <p className="mb-6 text-center text-xs leading-5 text-muted-foreground">
        {order.status === "PAYMENT_REVIEW_REQUIRED"
          ? "Recibimos tu pago, pero el calendario necesita revisión porque cambió respecto del aceptado. Conservamos las condiciones de tu cotización; soporte debe resolverlo antes de continuar."
          : "Tu calendario fue validado con la fecha del pago. Esta confirmación corresponde al sandbox de BCP; la emisión de la entrada se gestiona por separado."}
      </p>
      <Button
        variant="outline"
        className="h-12 w-full rounded-xl bg-card"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="size-4" />
        Actualizar estado
      </Button>
    </main>
  );
}
