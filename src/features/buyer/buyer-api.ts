import { z } from "zod";
import { ticketOrderSchema, paymentResponseSchema } from "@/features/checkout/order-api";

export const buyerEmailSchema = z.object({ email: z.string().trim().max(254).pipe(z.email("Escribe un correo válido.")) });
export const buyerCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Escribe el código de 6 dígitos.") });
const sessionSchema = z.object({ email: z.email(), expiresAt: z.iso.datetime({ offset: true }), csrfToken: z.string().min(32) });
const challengeSchema = z.object({ challengeId: z.uuid(), expiresAt: z.iso.datetime({ offset: true }), resendAt: z.iso.datetime({ offset: true }) });
const ordersSchema = z.object({ orders: z.array(ticketOrderSchema).max(20), nextCursor: z.uuid().nullable() });
const orderSchema = z.object({ order: ticketOrderSchema });
export type BuyerSession = z.infer<typeof sessionSchema>;
export type BuyerChallenge = z.infer<typeof challengeSchema>;

export class BuyerError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

async function request<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_BUYER_API_BASE_URL ?? import.meta.env.VITE_TICKET_API_BASE_URL
    ?? (import.meta.env.DEV ? "http://localhost:3131" : "");
  if (!base) throw new BuyerError("El acceso a tus cuotas todavía no está disponible.");
  const timeout = AbortSignal.timeout(path.includes('/installments/') ? 40_000 : 15_000);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/api/v1/ticket-buyer${path}`, {
      ...options, credentials: "include", cache: "no-store", referrerPolicy: "no-referrer",
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new BuyerError("No pudimos conectar. Revisa tu conexión e intenta nuevamente.");
  }
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(body);
    throw new BuyerError(error.success ? error.data.error.message : "No pudimos consultar tus cuotas. Intenta nuevamente.", response.status);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new BuyerError("No pudimos validar la respuesta. Vuelve a intentarlo.");
  return result.data;
}

export const getBuyerSession = (signal?: AbortSignal) => request("/session", sessionSchema, { signal });
export const sendBuyerCode = (email: string) => request("/code", challengeSchema, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
});
export const verifyBuyerCode = (challengeId: string, code: string) => request("/verify", sessionSchema, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, code }),
});
export const logoutBuyer = (csrfToken: string) => request("/session", z.null(), {
  method: "DELETE", headers: { "x-csrf-token": csrfToken },
});
export const getBuyerOrders = (signal: AbortSignal, before?: string) => request(`/orders${before ? `?${new URLSearchParams({ before })}` : ""}`, ordersSchema, { signal });
export const getBuyerOrder = (id: string, signal: AbortSignal) => request(`/orders/${encodeURIComponent(id)}`, orderSchema, { signal });
export const getBuyerPayment = (id: string, installment: number, signal: AbortSignal) => request(`/orders/${encodeURIComponent(id)}/installments/${installment}/payment`, paymentResponseSchema, { signal });
export const createBuyerPayment = (id: string, installment: number, csrfToken: string, signal: AbortSignal) => request(`/orders/${encodeURIComponent(id)}/installments/${installment}/payment-qr`, paymentResponseSchema,
  { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: '{}', signal });
