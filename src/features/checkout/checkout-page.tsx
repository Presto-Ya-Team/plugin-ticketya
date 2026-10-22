import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buyerSchema,
  type Buyer,
} from "./checkout-utils";
import { createPreviewOrder } from "./preview-order";
import { PlanSummary } from "./plan-summary";
import { CheckoutSession } from "./checkout-session";
import { PaymentPlan } from "./payment-plan";
import { CheckoutActions } from "./checkout-actions";
import { SessionCountdown } from "./session-countdown";
import { checkoutPayments, type TicketOrder } from "./order-api";
import { FinancingBreakdown } from "./financing-breakdown";
const BcpQrPayment = lazy(() =>
  import("./bcp-qr-payment").then((module) => ({
    default: module.BcpQrPayment,
  })),
);

export function CheckoutPage() {
  const [params] = useSearchParams();
  const [previewOrder] = useState(() => import.meta.env.DEV ? createPreviewOrder() : null);
  if (import.meta.env.DEV && params.get("preview") === "plan" && previewOrder) {
    return <CheckoutFlow order={previewOrder} token="local-preview" expiresAt={new Date(Date.parse(previewOrder.createdAt) + 3600000).toISOString()} preview />;
  }
  return <CheckoutSession>{({ order, token, expiresAt }) => <CheckoutFlow order={order} token={token} expiresAt={expiresAt} />}</CheckoutSession>;
}

function CheckoutFlow({ order, token, expiresAt, preview = false }: { order: TicketOrder; token: string; expiresAt: string; preview?: boolean }) {
  const count = order.plan.installmentCount;
  const financingPlan = order.plan.ruleVersion === "TICKET_FINANCING_V3" ? order.plan : null;
  const financing = financingPlan !== null;
  const steps = ["Tu plan de pago", "Tus datos", financing ? "Anticipo" : "Primer pago"];
  const [step, setStep] = useState(() => preview && new URLSearchParams(window.location.search).get("step") === "3" ? 2 : 0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const form = useForm<Buyer>({
    resolver: zodResolver(buyerSchema),
    defaultValues: preview ? { name: "Andrea Pérez", email: "demo@example.com", phone: "+591 71234567", accepted: true } : { name: "", email: "", phone: "", accepted: false },
  });
  const schedule = checkoutPayments(order.plan);
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
        {preview ? <span className="text-xs text-muted-foreground">Vista previa local · Orden de muestra</span> : <SessionCountdown expiresAt={expiresAt} className="hidden sm:flex" />}
      </div>
      <div className="payment-page-grid">
        <div className="min-w-0">
          <h1 className="plan-page-title">Tu plan de pagos con Presta Ya</h1>
          <p className="mt-2 text-sm text-muted-foreground">Revisa tus cuotas y continúa con el primer pago.</p>
          <ol
            className="my-8 grid grid-cols-3 gap-2"
            aria-label="Pasos del pago"
          >
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={index === step ? "step" : undefined}
                className={`flex items-center gap-2 border-b-2 pb-4 text-xs font-medium sm:text-sm ${index <= step ? "border-[#04BE89] text-foreground" : "border-border text-muted-foreground"}`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${index <= step ? "bg-[#04BE89] text-white" : "bg-muted"}`}
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
                    : financing ? "Pagar anticipo" : "Pagar primera cuota"}
              </h2>
              <span className="shrink-0 text-xs text-muted-foreground">
                Paso {step + 1} de 3
              </span>
            </div>
            {step === 0 && (
              <div className="space-y-6">
                <PaymentPlan order={order} />
                <details className="plan-conditions"><summary>Ver condiciones de financiación</summary><div className="pt-4"><FinancingBreakdown plan={order.plan} /><p className="mt-3 text-xs leading-5 text-muted-foreground">{financing ? "Fechas previstas: se validarán al confirmar el anticipo. Al menos 7 días entre pagos y última cuota como máximo en la víspera del evento." : "Estas son las fechas guardadas para tu orden."} Los vencimientos se muestran en la hora del evento.</p></div></details>
                <CheckoutActions expiresAt={expiresAt}>
                <Button
                  size="lg"
                  className="h-12 w-full rounded-xl bg-[#04BE89] font-bold text-white hover:bg-[#03aa7a]"
                  aria-label={`Continuar con ${financing ? "anticipo y " : ""}${installmentLabel}`}
                  onClick={() => changeStep(1)}
                >
                  Continuar<span className="hidden sm:inline"> con {financing ? "anticipo y " : ""}{installmentLabel}</span> <ArrowRight className="size-4" />
                </Button>
                </CheckoutActions>
              </div>
            )}

            {step === 1 && (
              <form
                onSubmit={form.handleSubmit(() => changeStep(2))}
                noValidate
                className="space-y-5"
              >
                <p className="text-sm leading-6 text-muted-foreground">
                  Estos datos identificarán al comprador y se guardarán en la orden.
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
                      y los intereses indicados.
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
                  className="h-12 w-full rounded-xl bg-[#04BE89] font-bold text-white hover:bg-[#03aa7a]"
                  aria-label="Siguiente"
                >
                  Siguiente <ArrowRight className="size-4" />
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
                <p className="text-sm leading-6 text-[#288976]">Escanea el código QR con tu app bancaria para pagar {financing ? "el anticipo" : "la primera cuota"} y activar tu plan de pagos con Presta Ya.</p>
                <Suspense
                  fallback={
                    <Button disabled className="h-12 w-full rounded-xl">
                      Preparando pago con QR…
                    </Button>
                  }
                >
                  <BcpQrPayment
                    preview={preview}
                    onCancel={() => changeStep(1)}
                    amountMinor={schedule[0].amountMinor}
                    token={token}
                    buyer={{ name: form.getValues("name"), email: form.getValues("email"), phone: form.getValues("phone") }}
                    termsVersion={financingPlan?.snapshot.termsVersion}
                    expiresAt={expiresAt}
                    onConfirmed={confirmPayment}
                  />
                </Suspense>
                <Button variant="ghost" onClick={() => changeStep(1)}>
                  <ArrowLeft className="size-4" />
                  Editar mis datos
                </Button>
              </div>
            )}
          </section>
        </div>
        <PlanSummary order={order} />
      </div>
    </main>
  );
}
