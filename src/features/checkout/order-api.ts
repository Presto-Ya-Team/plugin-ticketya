import { z } from "zod";

const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const installment = z.object({
  number: z.number().int().positive(), amountMinor: amount,
  dueAt: z.iso.datetime({ offset: true }), status: z.enum(["PENDING", "PAID", "OVERDUE"]),
});
const commonPlan = {
  provisional: z.boolean(), installmentCount: z.number().int().positive(), feesMinor: amount,
  installments: z.array(installment).min(1),
};
const legacyPlan = z.object({
  ...commonPlan, ruleVersion: z.enum(["PROVISIONAL_THREE_INSTALLMENTS_V1", "PROVISIONAL_EVENT_DATE_V2"]),
});
const financingPlan = z.object({
  ...commonPlan, ruleVersion: z.literal("TICKET_FINANCING_V3"),
  paymentCount: z.number().int().min(2),
  originalPriceMinor: amount, contractPriceMinor: amount, financedPrincipalMinor: amount,
  interestMinor: amount, financedTotalMinor: amount, totalPayableMinor: amount,
  downPayment: installment.extend({ number: z.literal(0) }),
  snapshot: z.object({
    termsVersion: z.string().min(1), interestRateBps: z.number().int().nonnegative(),
    maxInstallments: z.number().int().positive(), downPaymentBps: z.literal(2500),
    minimumGapCalendarDays: z.literal(7), preferredDays: z.tuple([z.literal(10), z.literal(25)]),
    eventTimeZone: z.string().min(1), quotedAt: z.iso.datetime({ offset: true }),
    scheduleState: z.enum(["ESTIMATED_UNTIL_DOWN_PAYMENT_CONFIRMED", "CONFIRMED", "REQUIRES_REVIEW"]),
    confirmedAt: z.iso.datetime({ offset: true }).optional(),
    lastScheduledDate: z.iso.date(), schedulerVersion: z.string(), rounding: z.string(),
    environment: z.enum(["LOCAL_TEST", "NON_PRODUCTION_TEST"]),
  }),
});
export const ticketOrderSchema = z.object({
  orderId: z.string().min(1),
  externalOrderId: z.string().min(1),
  ticketera: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  event: z.object({
    id: z.string().min(1), name: z.string().min(1),
    startsAt: z.iso.datetime({ offset: true }), venue: z.string().optional(), timeZone: z.string().optional(),
  }),
  items: z.array(z.object({
    ticketTypeId: z.string(), ticketType: z.string(), ticketId: z.string().optional(),
    quantity: z.number().int().positive(), unitPriceMinor: amount, originalUnitPriceMinor: amount.optional(),
  })).min(1),
  currency: z.literal("BOB"),
  totalAmountMinor: amount,
  totalPayableMinor: amount.optional(),
  paidAmountMinor: amount,
  outstandingAmountMinor: amount,
  status: z.string(),
  plan: z.discriminatedUnion("ruleVersion", [legacyPlan, financingPlan]),
  createdAt: z.iso.datetime({ offset: true }),
}).refine((order) => {
  const plan = order.plan;
  const rows = plan.installments;
  const sum = rows.reduce((total, row) => total + BigInt(row.amountMinor), 0n);
  const scheduled = rows.length === plan.installmentCount
    && rows.every((row, i) => row.number === i + 1
      && (i === 0 || Date.parse(row.dueAt) >= Date.parse(rows[i - 1].dueAt)));
  if (!scheduled) return false;
  if (plan.ruleVersion !== "TICKET_FINANCING_V3") return sum === BigInt(order.totalAmountMinor) + BigInt(plan.feesMinor);
  return plan.paymentCount === plan.installmentCount + 1
    && plan.contractPriceMinor === order.totalAmountMinor
    && sum === BigInt(plan.financedTotalMinor)
    && BigInt(plan.financedPrincipalMinor) + BigInt(plan.downPayment.amountMinor) === BigInt(plan.contractPriceMinor)
    && BigInt(plan.financedPrincipalMinor) + BigInt(plan.interestMinor) === sum
    && BigInt(plan.downPayment.amountMinor) + sum === BigInt(plan.totalPayableMinor)
    && BigInt(plan.contractPriceMinor) + BigInt(plan.interestMinor) + BigInt(plan.feesMinor) === BigInt(plan.totalPayableMinor)
    && (order.totalPayableMinor === undefined || order.totalPayableMinor === plan.totalPayableMinor)
    && Date.parse(rows[0].dueAt) > Date.parse(plan.downPayment.dueAt);
}, "El plan recibido no es válido.");

const checkoutSchema = z.object({
  order: ticketOrderSchema,
  expiresAt: z.iso.datetime({ offset: true }),
});
export type TicketOrder = z.infer<typeof ticketOrderSchema>;
export type CheckoutSession = z.infer<typeof checkoutSchema>;

export function checkoutPayments(plan: TicketOrder["plan"]) {
  return plan.ruleVersion === "TICKET_FINANCING_V3" ? [plan.downPayment, ...plan.installments] : plan.installments;
}
export function payableTotal(order: TicketOrder) {
  return order.plan.ruleVersion === "TICKET_FINANCING_V3" ? order.plan.totalPayableMinor : order.totalAmountMinor + order.plan.feesMinor;
}

export class CheckoutError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

export function checkoutPath(token: string) {
  return `/pago?${new URLSearchParams({ session: token })}`;
}

const paymentResponseSchema = z.object({
  provider: z.literal("BCP"), environment: z.literal("sandbox"), order: ticketOrderSchema,
  payment: z.object({
    paymentOrderId: z.string().min(1),
    status: z.enum(["requested", "processing", "qr_ready", "paid", "expired", "cancelled", "failed", "review_required"]),
    amountMinor: amount, currency: z.literal("BOB"), expiresAt: z.iso.datetime({ offset: true }),
    providerPaymentId: z.string().optional(), qrImageBase64: z.string().min(1).max(2_100_000).optional(),
    paidAt: z.iso.datetime({ offset: true }).optional(),
  }).nullable(),
});
export type CheckoutPayment = z.infer<typeof paymentResponseSchema>;

function apiBase() {
  const base = import.meta.env.VITE_TICKET_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3130" : "");
  if (!base) throw new CheckoutError("El checkout todavía no tiene configurada la conexión con el servidor.");
  return base.replace(/\/$/, "");
}

export async function requestCheckoutPayment(token: string, signal: AbortSignal, input?: {
  buyer: { name: string; email: string; phone: string }; accepted: true; termsVersion: string;
}): Promise<CheckoutPayment> {
  const response = await fetch(`${apiBase()}/api/v1/ticket-checkout/${input ? "payment-qr" : "payment"}`, {
    method: input ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}),
    credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(body);
    throw new CheckoutError(error.success ? error.data.error.message : "No pudimos consultar el pago con BCP.", response.status >= 500);
  }
  const parsed = paymentResponseSchema.safeParse(body);
  if (!parsed.success) throw new CheckoutError("La respuesta del pago no es válida. Vuelve a consultar el estado.", true);
  return parsed.data;
}

export async function fetchCheckoutSession(token: string, signal: AbortSignal): Promise<CheckoutSession> {
  const base = import.meta.env.VITE_TICKET_API_BASE_URL
    ?? (import.meta.env.DEV ? "http://localhost:3130" : "");
  if (!base) throw new CheckoutError("El checkout todavía no tiene configurada la conexión con el servidor.");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/ticket-checkout/session`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal,
  });
  if (!response.ok) {
    if (response.status === 410) throw new CheckoutError("Este enlace de pago venció. Solicita uno nuevo a tu ticketera.");
    if (response.status === 401) throw new CheckoutError("El enlace de pago no es válido. Abre el enlace proporcionado por tu ticketera.");
    if (response.status === 403) throw new CheckoutError("Esta orden no está disponible. Comunícate con tu ticketera.");
    throw new CheckoutError("No pudimos cargar tu orden. Vuelve a intentarlo.", true);
  }
  const result = checkoutSchema.safeParse(await response.json());
  if (!result.success) throw new CheckoutError("No pudimos validar el plan de esta orden. Comunícate con tu ticketera.");
  if (Date.parse(result.data.expiresAt) <= Date.now()) {
    throw new CheckoutError("Este enlace de pago venció. Solicita uno nuevo a tu ticketera.");
  }
  return result.data;
}
