import type { TicketOrder } from "./order-api";

// Used only by the development preview; never requests an order or a payment.
export function createPreviewOrder(): TicketOrder {
  const now = new Date();
  const after = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
  return {
    orderId: "local-preview", externalOrderId: "VISTA-PREVIA-001",
    ticketera: { id: "demo", name: "Diego Tickets" },
    event: { id: "demo", name: "Festival de los sentidos", startsAt: after(75), venue: "Estadio", timeZone: "America/La_Paz" },
    items: [{ ticketTypeId: "general", ticketType: "Entrada General", quantity: 1, unitPriceMinor: 12000, originalUnitPriceMinor: 12000 }],
    currency: "BOB", totalAmountMinor: 12000, totalPayableMinor: 12720,
    paidAmountMinor: 0, outstandingAmountMinor: 12720, status: "AWAITING_FIRST_PAYMENT", createdAt: now.toISOString(),
    plan: {
      ruleVersion: "TICKET_FINANCING_V3", provisional: true, installmentCount: 3, paymentCount: 4,
      originalPriceMinor: 12000, contractPriceMinor: 12000, financedPrincipalMinor: 9000,
      feesMinor: 0, interestMinor: 720, financedTotalMinor: 9720, totalPayableMinor: 12720,
      downPayment: { number: 0, amountMinor: 3000, dueAt: now.toISOString(), status: "PENDING" },
      installments: [20, 35, 50].map((days, index) => ({ number: index + 1, amountMinor: 3240, dueAt: after(days), status: "PENDING" })),
      snapshot: {
        termsVersion: "LOCAL_PREVIEW", interestRateBps: 200, maxInstallments: 3, downPaymentBps: 2500,
        minimumGapCalendarDays: 7, preferredDays: [10, 25], eventTimeZone: "America/La_Paz",
        quotedAt: now.toISOString(), scheduleState: "ESTIMATED_UNTIL_DOWN_PAYMENT_CONFIRMED",
        lastScheduledDate: after(74).slice(0, 10), schedulerVersion: "LOCAL_PREVIEW", rounding: "HALF_UP_TOTALS_REMAINDER_IN_LAST_INSTALLMENT", environment: "LOCAL_TEST",
      },
    },
  };
}
