import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CreditCard,
  Info,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  buyerSchema,
  money,
  shortDate,
  type Buyer,
} from "./checkout-utils";
import { TicketSummary } from "./ticket-summary";
import { CheckoutSession } from "./checkout-session";
import { InstallmentTimeline } from "./installment-timeline";
import { CheckoutActions } from "./checkout-actions";
import { SessionCountdown } from "./session-countdown";
import { checkoutPayments, payableTotal, type TicketOrder } from "./order-api";
import { FinancingBreakdown } from "./financing-breakdown";
const BcpQrPayment = lazy(() =>
  import("./bcp-qr-payment").then((module) => ({
    default: module.BcpQrPayment,
  })),
);

export function CheckoutPage() {
  return <CheckoutSession>{({ order, token, expiresAt }) => <CheckoutFlow order={order} token={token} expiresAt={expiresAt} />}</CheckoutSession>;
}

function CheckoutFlow({ order, token, expiresAt }: { order: TicketOrder; token: string; expiresAt: string }) {
  const count = order.plan.installmentCount;
  const financingPlan = order.plan.ruleVersion === "TICKET_FINANCING_V3" ? order.plan : null;
  const financing = financingPlan !== null;
  const timeZone = financingPlan?.snapshot.eventTimeZone ?? "America/La_Paz";
  const steps = ["Tu plan de pago", "Tus datos", financing ? "Anticipo" : "Primer pago"];
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const form = useForm<Buyer>({
    resolver: zodResolver(buyerSchema),
    defaultValues: { name: "", email: "", phone: "", accepted: false },
  });
  const schedule = checkoutPayments(order.plan);
  const financedRows = order.plan.installments;
  const equalAmounts = financedRows.every((row) => row.amountMinor === financedRows[0].amountMinor);
  const remainingCount = schedule.length - 1;
  const installmentLabel = `${count} ${count === 1 ? "cuota" : "cuotas"}`;
  useEffect(() => {
    if (step === 0) return;
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);
  const changeStep = (next: number) => setStep(next);
  const confirmationPath = `/confirmacion?${new URLSearchParams({ session: token })}`;
  const confirmPayment = () => navigate(confirmationPath, { state: { name: form.getValues("name"), orderId: order.orderId } });
  if (financingPlan?.downPayment.status === "PAID") return <Navigate to={confirmationPath} replace />;

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <div className="mb-9 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tu entrada</span>
          <ChevronRight className="size-3" />
          <span className="font-medium text-foreground">Paga a cuotas</span>
        </div>
        <SessionCountdown expiresAt={expiresAt} className="hidden sm:flex" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div className="min-w-0">
          <Badge
            variant="secondary"
            className="mb-4 gap-1.5 bg-secondary text-secondary-foreground"
          >
            <Sparkles className="size-3" /> Tu próxima experiencia empieza aquí
          </Badge>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            Tus planes,
            <br />
            <span className="text-primary">a tu ritmo.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
            Divide el pago de tu entrada y haz espacio para eso que no te
            quieres perder.
          </p>
          <ol
            className="my-8 grid grid-cols-3 gap-2"
            aria-label="Pasos del pago"
          >
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={index === step ? "step" : undefined}
                className={`flex items-center gap-2 border-b-2 pb-4 text-xs font-medium sm:text-sm ${index <= step ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${index <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {index < step ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>

          <section aria-labelledby="step-heading">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2
                id="step-heading"
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight outline-none"
              >
                {step === 0
                  ? "Tu plan de pago"
                  : step === 1
                    ? "Primero, nos conocemos"
                    : financing ? "Revisa tu anticipo" : "Revisa tu primer pago"}
              </h2>
              <span className="shrink-0 text-xs text-muted-foreground">
                Paso {step + 1} de 3
              </span>
            </div>
            {step === 0 && (
              <div className="space-y-6">
                <Card className="gap-0 border-primary/20 bg-primary/5 py-0 shadow-none">
                  <CardContent className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        Un plan para tu entrada
                      </p>
                      <Badge variant="secondary">Plan asignado</Badge>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-3xl font-bold tracking-tight text-primary">
                          {financing ? `Anticipo de ${money(schedule[0].amountMinor)}` : `${installmentLabel}${equalAmounts ? ` de ${money(schedule[0].amountMinor)}` : " para tu entrada"}`}
                        </p>
                        {financing && <p className="mt-2 text-lg font-semibold">
                          + {installmentLabel} {equalAmounts ? "de" : "desde"} {money(financedRows[0].amountMinor)}
                        </p>}
                        <p className="mt-2 text-sm text-muted-foreground">
                          Hasta el {shortDate(schedule.at(-1)!.dueAt, timeZone)} · Total{" "}
                          {money(payableTotal(order))}
                        </p>
                      </div>
                      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CreditCard className="size-6" />
                      </span>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      Este es el plan asignado a tu entrada. Revisa cada fecha y
                      el importe {financing ? "del anticipo" : "de la primera cuota"} antes de continuar.
                    </p>
                  </CardContent>
                </Card>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCheck className="size-4 text-primary" />
                  {financingPlan ? `Intereses de prueba incluidos: ${money(financingPlan.interestMinor)}` : order.plan.feesMinor === 0 ? "Sin recargos" : `Recargos: ${money(order.plan.feesMinor)}`} · Plan de tu orden
                </div>
                <FinancingBreakdown plan={order.plan} />
                <Card className="gap-0 border-border/80 py-0 shadow-none">
                  <CardContent className="p-5 sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Tu calendario de pagos
                      </h3>
                      <Badge variant="secondary" className="font-normal">
                        {financing ? "Anticipo + " : ""}{installmentLabel}
                      </Badge>
                    </div>
                    <InstallmentTimeline plan={order.plan} />
                    <Separator className="my-5" />
                    <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {financing ? "Fechas previstas: se validarán al confirmar el anticipo. Al menos 7 días entre pagos y última cuota como máximo en la víspera del evento." : "Estas son las fechas guardadas para tu orden."} Los vencimientos se muestran en la hora del evento.
                    </p>
                  </CardContent>
                </Card>
                <CheckoutActions expiresAt={expiresAt}>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl"
                  aria-label={`Continuar con ${financing ? "anticipo y " : ""}${installmentLabel}`}
                  onClick={() => changeStep(1)}
                >
                  Continuar<span className="hidden sm:inline"> con {financing ? "anticipo y " : ""}{installmentLabel}</span> <ArrowRight className="size-4" />
                </Button>
                </CheckoutActions>
                <p className="text-center text-xs text-muted-foreground">
                  Revisa tu plan y continúa con el primer pago.
                </p>
              </div>
            )}

            {step === 1 && (
              <form
                onSubmit={form.handleSubmit(() => changeStep(2))}
                noValidate
                className="space-y-5"
              >
                <p className="text-sm leading-6 text-muted-foreground">
                  Estos datos identificarán al comprador y se guardarán en la orden al solicitar el QR de BCP.
                </p>
                {(["name", "email", "phone"] as const).map((field) => {
                  const labels = {
                    name: "Nombre y apellido",
                    email: "Correo electrónico",
                    phone: "Teléfono",
                  };
                  const placeholders = {
                    name: "Ej. Andrea Pérez",
                    email: "andrea@correo.com",
                    phone: "+591 71234567",
                  };
                  return (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>{labels[field]}</Label>
                      <Input
                        id={field}
                        type={
                          field === "email"
                            ? "email"
                            : field === "phone"
                              ? "tel"
                              : "text"
                        }
                        autoComplete={field === "phone" ? "tel" : field}
                        placeholder={placeholders[field]}
                        className="h-12 bg-card"
                        aria-invalid={!!form.formState.errors[field]}
                        aria-describedby={
                          form.formState.errors[field]
                            ? `${field}-error`
                            : undefined
                        }
                        {...form.register(field)}
                      />
                      {form.formState.errors[field] && (
                        <p
                          id={`${field}-error`}
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {form.formState.errors[field]?.message}
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Controller
                      control={form.control}
                      name="accepted"
                      render={({ field }) => (
                        <Checkbox
                          id="accepted"
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={(value) =>
                            field.onChange(value === true)
                          }
                          onBlur={field.onBlur}
                          ref={field.ref}
                          aria-invalid={!!form.formState.errors.accepted}
                          aria-describedby={
                            form.formState.errors.accepted
                              ? "accepted-error"
                              : undefined
                          }
                        />
                      )}
                    />
                    <Label
                      htmlFor="accepted"
                      className="block text-xs font-normal leading-5"
                    >
                      He revisado y acepto el anticipo, las cuotas, sus fechas previstas
                      y los intereses indicados. Entiendo que el pago se hará en BCP sandbox.
                    </Label>
                  </div>
                  {form.formState.errors.accepted && (
                    <p
                      id="accepted-error"
                      role="alert"
                      className="mt-2 text-xs text-destructive"
                    >
                      {form.formState.errors.accepted.message}
                    </p>
                  )}
                </div>
                <CheckoutActions expiresAt={expiresAt}>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-xl"
                  aria-label="Revisar primer pago"
                >
                  Revisar<span className="hidden sm:inline"> primer</span> pago <ArrowRight className="size-4" />
                </Button>
                </CheckoutActions>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => changeStep(0)}
                >
                  <ArrowLeft className="size-4" />
                  Volver al plan
                </Button>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Card className="gap-0 py-0 shadow-none">
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CreditCard className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {financing ? "Anticipo · 25% del precio original" : `Primer pago de ${installmentLabel}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.event.name}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <dl className="space-y-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="text-muted-foreground">Comprador</dt>
                        <dd className="break-all font-medium">
                          {form.getValues("name")}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <dt className="text-muted-foreground">Correo</dt>
                        <dd className="break-all">{form.getValues("email")}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">
                          {remainingCount} {remainingCount === 1 ? "cuota posterior" : "cuotas posteriores"}
                        </dt>
                        <dd>
                          {schedule.slice(1).map((payment) => money(payment.amountMinor)).join(" + ")}
                        </dd>
                      </div>
                    </dl>
                    <Separator />
                    <div className="flex items-end justify-between">
                      <span className="text-sm font-medium">
                        Importe del anticipo
                      </span>
                      <span className="text-3xl font-bold text-primary">
                        {money(schedule[0].amountMinor)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex gap-3 rounded-xl bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Al pagar solicitaremos a BCP el QR de tu anticipo en bolivianos.
                    El pago solo se registrará tras la confirmación bancaria. Estamos usando el ambiente sandbox.
                  </p>
                </div>
                <CheckoutActions expiresAt={expiresAt}>
                <Suspense
                  fallback={
                    <Button disabled className="h-12 w-full rounded-xl">
                      Preparando pago con QR…
                    </Button>
                  }
                >
                  <BcpQrPayment
                    amountMinor={schedule[0].amountMinor}
                    token={token}
                    buyer={{ name: form.getValues("name"), email: form.getValues("email"), phone: form.getValues("phone") }}
                    termsVersion={financingPlan?.snapshot.termsVersion}
                    expiresAt={expiresAt}
                    onConfirmed={confirmPayment}
                  />
                </Suspense>
                </CheckoutActions>
                <Button variant="ghost" onClick={() => changeStep(1)}>
                  <ArrowLeft className="size-4" />
                  Editar mis datos
                </Button>
              </div>
            )}
          </section>
        </div>
        <TicketSummary order={order} />
      </div>
    </main>
  );
}
