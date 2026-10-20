import { Card, CardContent } from "@/components/ui/card";
import { money } from "./checkout-utils";
import type { TicketOrder } from "./order-api";

export function FinancingBreakdown({ plan }: { plan: TicketOrder["plan"] }) {
  if (plan.ruleVersion !== "TICKET_FINANCING_V3") return null;
  const fields = [
    ["Precio original anunciado", plan.originalPriceMinor],
    ["Precio de la entrada al comprar", plan.contractPriceMinor],
    ["Anticipo · 25% del precio original", plan.downPayment.amountMinor],
    ["Capital a financiar", plan.financedPrincipalMinor],
    [`Intereses de ${plan.installmentCount} ${plan.installmentCount === 1 ? "cuota" : "cuotas"}`, plan.interestMinor],
    ["Total a pagar, incluido el anticipo", plan.totalPayableMinor],
  ] as const;
  return <Card className="gap-0 py-0 shadow-none">
    <CardContent className="p-5 sm:p-6">
      <h3 className="mb-4 text-sm font-semibold">El detalle de tu financiación</h3>
      <dl className="space-y-3 text-sm">
        {fields.map(([label, amount], index) => <div key={label} className={`flex items-start justify-between gap-4 ${index === fields.length - 1 ? "border-t pt-3 font-semibold" : ""}`}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="shrink-0">{money(amount)}</dd>
        </div>)}
      </dl>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {plan.snapshot.environment === "PRODUCTION_INITIAL" ? "Tasa inicial" : "Tasa de prueba"}: {plan.snapshot.interestRateBps / 100}% por cuota financiada,
        calculada sobre el precio de la entrada al comprar. Pagar antes no reduce los intereses.
      </p>
    </CardContent>
  </Card>;
}
