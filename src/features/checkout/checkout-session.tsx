import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { LoaderCircle, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckoutError, fetchCheckoutSession, type CheckoutSession as Session } from "./order-api";

type State = { status: "loading" } | { status: "ready"; session: Session }
  | { status: "error"; error: CheckoutError };
type Content = (props: Session & { token: string }) => ReactNode;

export function CheckoutSession({ children }: { children: Content }) {
  const [params] = useSearchParams();
  const token = params.get("session");
  if (!token) return <SessionMessage title="Abre tu enlace de pago">
    Para ver tu entrada y sus cuotas, abre el enlace que te proporcionó tu ticketera.
  </SessionMessage>;
  return <SessionLoader key={token} token={token}>{children}</SessionLoader>;
}

function SessionLoader({ token, children }: { token: string; children: Content }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let active = true;
    let expiry: number | undefined;
    fetchCheckoutSession(token, controller.signal).then((session) => {
      if (!active) return;
      setState({ status: "ready", session });
      expiry = window.setTimeout(() => setState({ status: "error", error: new CheckoutError(
        "Este enlace de pago venció. Solicita uno nuevo a tu ticketera.",
      ) }), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    }).catch((error: unknown) => {
      if (!active) return;
      setState({ status: "error", error: error instanceof CheckoutError ? error
        : new CheckoutError("No pudimos conectar con el servidor. Comprueba tu conexión y vuelve a intentarlo.", true) });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); window.clearTimeout(expiry); };
  }, [token, attempt]);
  if (state.status === "loading") return <SessionMessage title="Cargando tu orden…" loading>
    Estamos consultando tu entrada y el calendario de tus cuotas.
  </SessionMessage>;
  if (state.status === "error") return <SessionMessage title="No pudimos abrir tu pago">
    <span role="alert">{state.error.message}</span>
    {state.error.retryable && <Button className="mt-6 w-full" onClick={() => {
      setState({ status: "loading" }); setAttempt((value) => value + 1);
    }}>Volver a intentar</Button>}
  </SessionMessage>;
  return children({ ...state.session, token });
}

function SessionMessage({ title, loading, children }: { title: string; loading?: boolean; children: ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-20">
    <Card><CardContent className="space-y-4 pt-6 text-center">
      {loading ? <LoaderCircle aria-hidden className="mx-auto size-9 animate-spin text-primary" />
        : <Ticket aria-hidden className="mx-auto size-9 text-primary" />}
      <h1 className="text-2xl font-bold" role={loading ? "status" : undefined}>{title}</h1>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </CardContent></Card>
  </main>;
}
