import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Clock3, LoaderCircle, LogOut, Mail, QrCode, RefreshCw, ShieldCheck, Ticket, Wallet } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { money, shortDate } from "@/features/checkout/checkout-utils";
import { payableTotal, type TicketOrder } from "@/features/checkout/order-api";
import { BuyerError, buyerCodeSchema, buyerEmailSchema, getBuyerOrder, getBuyerOrders, getBuyerSession, logoutBuyer, sendBuyerCode, verifyBuyerCode, type BuyerChallenge, type BuyerSession } from "./buyer-api";
import { buyerPayments, nextBuyerPayment } from "./buyer-plan";
import { BuyerQr } from './buyer-qr';

const message = (error: unknown) => error instanceof BuyerError ? error.message : "Ocurrió un problema. Intenta nuevamente.";
function Notice({ children }: { children: React.ReactNode }) { return <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{children}</p>; }
function Loading() { return <div role="status" className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Cargando tus cuotas…</div>; }

export function BuyerPortal() {
  const [session, setSession] = useState<BuyerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const { orderId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    void getBuyerSession(controller.signal).then(setSession).catch(error => {
      if (!controller.signal.aborted) { setSession(null); if (!(error instanceof BuyerError && error.status === 401)) setError(message(error)); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => { setSession(null); setError("Tu sesión terminó. Ingresa nuevamente para consultar tus cuotas."); }, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);
  const expired = useCallback(() => { setSession(null); setError("Tu sesión terminó. Ingresa nuevamente para consultar tus cuotas."); }, []);
  async function logout() {
    if (!session) return;
    setLoggingOut(true); setError("");
    try { await logoutBuyer(session.csrfToken); setSession(null); navigate("/mis-cuotas", { replace: true }); }
    catch (error) { if (error instanceof BuyerError && error.status === 401) setSession(null); else setError(message(error)); }
    finally { setLoggingOut(false); }
  }
  return <main className="mx-auto min-h-[calc(100svh-10rem)] max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
    {loading ? <Loading /> : session ? <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow mb-2">PLUGIN TICKETYA · TU CUENTA</p><h1 className="text-3xl font-bold tracking-tight">{orderId ? "Detalle de tu compra" : "Mis cuotas"}</h1><p className="mt-2 break-all text-sm text-muted-foreground">{session.email}</p></div>
        <Button variant="outline" disabled={loggingOut} onClick={() => void logout()}><LogOut className="size-4" />{loggingOut ? "Cerrando…" : "Salir"}</Button>
      </div>
      {error && <div className="mb-6"><Notice>{error}</Notice></div>}
      {orderId ? <PurchaseDetail key={`${session.email}:${orderId}`} orderId={orderId} expired={expired} csrfToken={session.csrfToken} /> : <Purchases key={session.email} expired={expired} />}
    </> : <>
      {error && <div className="mx-auto mb-6 max-w-md space-y-3"><Notice>{error}</Notice><Button variant="ghost" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}><RefreshCw className="size-4" />Reintentar conexión</Button></div>}
      <BuyerLogin onLogin={value => { setError(""); setSession(value); }} />
    </>}
  </main>;
}

function BuyerLogin({ onLogin }: { onLogin: (session: BuyerSession) => void }) {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<BuyerChallenge | null>(null);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const emailForm = useForm<z.infer<typeof buyerEmailSchema>>({ resolver: zodResolver(buyerEmailSchema), defaultValues: { email: "" } });
  const codeForm = useForm<z.infer<typeof buyerCodeSchema>>({ resolver: zodResolver(buyerCodeSchema), defaultValues: { code: "" } });
  useEffect(() => { if (!challenge) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [challenge]);
  const resendSeconds = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000)) : 0;
  const codeExpired = challenge && Date.parse(challenge.expiresAt) <= now;
  async function send(values: { email: string }) {
    setError("");
    try { const result = await sendBuyerCode(values.email); setEmail(values.email.trim()); setChallenge(result); setNow(() => Date.now()); codeForm.reset(); }
    catch (error) { setError(message(error)); }
  }
  async function verify(values: { code: string }) {
    if (!challenge) return;
    setError("");
    try { onLogin(await verifyBuyerCode(challenge.challengeId, values.code)); }
    catch (error) { setError(message(error)); }
  }
  async function resend() { setResending(true); await send({ email }); setResending(false); }
  return <section className="mx-auto max-w-md py-4 sm:py-10">
    <div className="mb-7 text-center"><span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary"><Wallet className="size-7" /></span><p className="eyebrow mb-3">PLUGIN TICKETYA</p><h1 className="text-3xl font-bold tracking-tight">Tus entradas, tus cuotas</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Consulta cuánto te falta pagar y las fechas de tus próximas cuotas.</p></div>
    <Card className="py-0 shadow-none"><CardContent className="p-6 sm:p-8">
      {challenge ? <>
        <div className="mb-6"><h2 className="text-lg font-semibold">Revisa tu correo</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Enviamos un código de 6 dígitos a <strong className="break-all font-medium text-foreground">{email}</strong>. Vence en 10 minutos.</p></div>
        <form onSubmit={codeForm.handleSubmit(verify)} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="buyer-code">Código de acceso</Label><Input id="buyer-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" className="h-12 text-center text-xl tracking-[0.35em]" aria-invalid={!!codeForm.formState.errors.code} aria-describedby="buyer-code-error" {...codeForm.register("code")} /><p id="buyer-code-error" className="text-xs text-destructive">{codeForm.formState.errors.code?.message}</p></div>
          {error && <Notice>{error}</Notice>}{codeExpired && <p role="status" className="text-sm text-muted-foreground">El código venció. Solicita uno nuevo para continuar.</p>}
          <Button className="h-12 w-full" type="submit" disabled={codeForm.formState.isSubmitting || resending || !!codeExpired}>{codeForm.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}Entrar a mis cuotas</Button>
        </form>
        <div className="mt-4 flex flex-col gap-1"><Button variant="ghost" disabled={resending || resendSeconds > 0 || codeForm.formState.isSubmitting} onClick={() => void resend()}>{resending ? "Enviando…" : resendSeconds > 0 ? `Reenviar código en ${resendSeconds}s` : "Reenviar código"}</Button><Button variant="link" disabled={resending || codeForm.formState.isSubmitting} onClick={() => { setChallenge(null); setError(""); }}>Usar otro correo</Button></div>
      </> : <>
        <h2 className="mb-5 text-lg font-semibold">Ingresa a tus compras</h2>
        <form onSubmit={emailForm.handleSubmit(send)} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="buyer-email">Correo de tu compra</Label><Input id="buyer-email" type="email" autoComplete="email" placeholder="tu@correo.com" className="h-12" aria-invalid={!!emailForm.formState.errors.email} aria-describedby="buyer-email-hint buyer-email-error" {...emailForm.register("email")} /><p id="buyer-email-hint" className="text-xs leading-5 text-muted-foreground">Usa el mismo correo que ingresaste al comprar tus entradas.</p><p id="buyer-email-error" className="text-xs text-destructive">{emailForm.formState.errors.email?.message}</p></div>
          {error && <Notice>{error}</Notice>}
          <Button type="submit" disabled={emailForm.formState.isSubmitting} className="h-12 w-full">{emailForm.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}Enviar código de acceso</Button>
        </form>
      </>}
    </CardContent></Card>
    <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />Accede con un código, sin crear una contraseña.</p>
  </section>;
}

function Purchases({ expired }: { expired: () => void }) {
  const [orders, setOrders] = useState<TicketOrder[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [before, setBefore] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getBuyerOrders(controller.signal, before).then(result => {
      setOrders(previous => before ? [...previous, ...result.orders.filter(order => !previous.some(item => item.orderId === order.orderId))] : result.orders); setCursor(result.nextCursor);
    }).catch(error => { if (!controller.signal.aborted) { if (error instanceof BuyerError && error.status === 401) expired(); else setError(message(error)); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [before, retry, expired]);
  if (loading && !orders.length) return <Loading />;
  if (error) return <div className="space-y-4"><Notice>{error}</Notice><Button variant="outline" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}><RefreshCw className="size-4" />Reintentar</Button></div>;
  if (!orders.length) return <Card className="py-0 shadow-none"><CardContent className="px-6 py-14 text-center"><Ticket className="mx-auto mb-4 size-10 text-muted-foreground" /><h2 className="text-xl font-semibold">Aún no hay compras con este correo</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Aquí aparecerán tus entradas cuando se confirme el primer pago. Si compraste con otro correo, sal e ingresa con esa dirección.</p></CardContent></Card>;
  return <div className="space-y-5"><p className="text-sm text-muted-foreground">Elige una compra para ver sus cuotas y pagos.</p><div className="grid gap-4 sm:grid-cols-2">
    {orders.map(order => {
      const next = nextBuyerPayment(order); const pending = buyerPayments(order).filter(payment => payment.status !== "PAID").length;
      return <Card key={order.orderId} className="gap-0 py-0 shadow-none"><CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><Ticket className="size-5" /></span><Badge variant={order.outstandingAmountMinor === 0 ? "secondary" : "outline"}>{order.status === "PAYMENT_REVIEW_REQUIRED" ? "En revisión" : order.outstandingAmountMinor === 0 ? "Completado" : `${pending} ${pending === 1 ? "cuota pendiente" : "cuotas pendientes"}`}</Badge></div>
        <h2 className="text-lg font-bold">{order.event.name}</h2><p className="mt-1 text-xs text-muted-foreground">{order.ticketera.name}</p><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{shortDate(order.event.startsAt, order.event.timeZone)}</p>
        <Separator className="my-5" /><div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Saldo pendiente</p><p className="mt-1 text-2xl font-bold">{money(order.outstandingAmountMinor)}</p></div>{next && <div className="text-right"><p className={`text-xs ${next.overdue ? "text-destructive" : "text-muted-foreground"}`}>{next.overdue ? "Cuota vencida" : "Próximo pago"}</p><p className="mt-1 text-sm font-semibold">{money(next.amountMinor)}</p><p className="mt-1 text-xs text-muted-foreground">{shortDate(next.dueAt, order.event.timeZone)}</p></div>}</div>
        <Button asChild variant="outline" className="mt-6 w-full"><Link to={`/mis-cuotas/${order.orderId}`}>Ver mis cuotas<ChevronRight className="ml-auto size-4" /></Link></Button>
      </CardContent></Card>;
    })}
  </div>{cursor && <div className="text-center"><Button variant="outline" disabled={loading} onClick={() => { setLoading(true); setBefore(cursor); }}>{loading ? "Cargando…" : "Cargar más compras"}</Button></div>}</div>;
}

function PurchaseDetail({ orderId, expired, csrfToken }: { orderId: string; expired: () => void; csrfToken: string }) {
  const [order, setOrder] = useState<TicketOrder>();
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [paymentNumber, setPaymentNumber] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getBuyerOrder(orderId, controller.signal).then(result => setOrder(result.order)).catch(error => { if (!controller.signal.aborted) { if (error instanceof BuyerError && error.status === 401) expired(); else setError(message(error)); } });
    return () => controller.abort();
  }, [orderId, retry, expired]);
  const payments = order ? buyerPayments(order) : [];
  const selected = payments.find(payment => payment.number === paymentNumber);
  const next = order ? nextBuyerPayment(order) : undefined;
  return <div className="space-y-6"><Button asChild variant="ghost" className="-ml-3"><Link to="/mis-cuotas"><ArrowLeft className="size-4" />Todas mis compras</Link></Button>
    {error ? <><Notice>{error}</Notice><Button variant="outline" onClick={() => { setOrder(undefined); setError(""); setRetry(value => value + 1); }}>Reintentar</Button></> : !order ? <Loading /> : <>
      <Card className="py-0 shadow-none"><CardContent className="p-6 sm:p-8"><p className="eyebrow mb-2">{order.ticketera.name}</p><h2 className="text-2xl font-bold">{order.event.name}</h2><p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><CalendarDays className="mt-0.5 size-4 shrink-0" />{shortDate(order.event.startsAt, order.event.timeZone)}{order.event.venue ? ` · ${order.event.venue}` : ""}</p><p className="mt-2 text-sm text-muted-foreground">{order.items.map(item => `${item.quantity} × ${item.ticketType}`).join(" · ")}</p><p className="mt-3 break-all text-xs text-muted-foreground">Pedido: {order.externalOrderId}</p><Separator className="my-6" />
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Total de la compra</dt><dd className="mt-1 text-lg font-semibold">{money(payableTotal(order))}</dd></div><div><dt className="text-xs text-muted-foreground">Ya pagaste</dt><dd className="mt-1 text-lg font-semibold">{money(order.paidAmountMinor)}</dd></div><div className="col-span-2 sm:col-span-1"><dt className="text-xs text-muted-foreground">Saldo pendiente</dt><dd className="mt-1 text-2xl font-bold">{money(order.outstandingAmountMinor)}</dd></div></dl>
      </CardContent></Card>
      {order.status === "PAYMENT_REVIEW_REQUIRED" && <p role="status" className="rounded-xl border bg-card p-4 text-sm leading-6">Tu compra está en revisión. Conservamos los pagos registrados; contacta a soporte antes de realizar otra cuota.</p>}
      <section aria-labelledby="buyer-schedule"><h2 id="buyer-schedule" className="mb-4 text-lg font-semibold">Tus cuotas</h2><Card className="py-0 shadow-none"><CardContent className="p-0"><ol className="divide-y">
        {payments.map(payment => <li key={payment.number} className="flex flex-wrap items-center gap-3 p-5 sm:gap-4 sm:p-6"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${payment.status === "PAID" ? "bg-accent text-primary" : "bg-muted text-muted-foreground"}`}>{payment.status === "PAID" ? <Check className="size-5" /> : <Clock3 className="size-5" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{payment.label}</p><time dateTime={payment.dueAt} className="mt-1 block text-xs text-muted-foreground">{shortDate(payment.dueAt, order.event.timeZone)}</time></div><div className="text-right"><p className="font-semibold">{money(payment.amountMinor)}</p><p className={`mt-1 text-xs ${payment.overdue ? "text-destructive" : "text-muted-foreground"}`}>{payment.status === "PAID" ? "Pagada" : payment.overdue ? "Vencida" : "Pendiente"}</p></div>{payment.number === next?.number && order.status !== "PAYMENT_REVIEW_REQUIRED" && order.outstandingAmountMinor > 0 && <Button className="ml-auto w-full sm:w-auto" onClick={() => setPaymentNumber(payment.number)}><QrCode className="size-4" />Pagar cuota</Button>}</li>)}
      </ol></CardContent></Card></section>
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setPaymentNumber(null); }}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{selected?.label}</DialogTitle><DialogDescription>{order.event.name}</DialogDescription></DialogHeader>{selected && <BuyerQr key={`${orderId}:${selected.number}`} orderId={orderId} installment={selected.number} amountMinor={selected.amountMinor} csrfToken={csrfToken} expired={expired} confirmed={updated => { setOrder(updated); setPaymentNumber(null); }} />}</DialogContent></Dialog>
    </>}
  </div>;
}
