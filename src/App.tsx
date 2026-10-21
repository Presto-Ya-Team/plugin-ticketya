import { ArrowUpRight, CircleHelp, Ticket, Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckoutPage } from "@/features/checkout/checkout-page";
import { checkoutPath } from "@/features/checkout/order-api";
const ConfirmationPage = lazy(() =>
  import("@/features/checkout/confirmation-page").then((module) => ({
    default: module.ConfirmationPage,
  })),
);
const BuyerPortal = lazy(() => import("@/features/buyer/buyer-portal").then(module => ({ default: module.BuyerPortal })));
const OperatorBackoffice = lazy(() => import("@/features/operators/operator-backoffice").then(module => ({ default: module.OperatorBackoffice })));

function Layout() {
  const { pathname, search } = useLocation();
  const token = new URLSearchParams(search).get("session");
  const paymentPath = token ? checkoutPath(token) : "/pago";
  const inPortal = pathname.startsWith("/mis-cuotas");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className={`min-h-screen ${pathname === "/pago" && token ? "pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-0" : ""}`}>
      <header className="border-b bg-card">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link
            to={inPortal ? "/mis-cuotas" : paymentPath}
            aria-label="Ticketya Cuotas, inicio"
            className="flex items-center gap-2.5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Ticket className="size-6 -rotate-12" />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              ticketya<span className="text-primary">.</span>
              <span className="ml-2 border-l pl-2 text-sm font-medium text-muted-foreground">
                cuotas
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button asChild variant={inPortal ? "secondary" : "ghost"} size="sm"><Link to="/mis-cuotas" target={inPortal ? undefined : "_blank"} rel="noopener noreferrer" aria-current={inPortal ? "page" : undefined}>Mis cuotas</Link></Button>
            <Badge
              variant="secondary"
              className="hidden gap-1.5 sm:inline-flex"
            >
              <Sparkles className="size-3" /> Pagos con BCP
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <CircleHelp className="size-4" />
                  <span className="hidden sm:inline">¿Necesitas ayuda?</span>
                  <span className="sr-only sm:hidden">Ayuda</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tu entrada, paso a paso</DialogTitle>
                  <DialogDescription>
                    Estamos diseñando una nueva forma de pagar tus eventos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 text-sm leading-6">
                  <div>
                    <h3 className="font-semibold">
                      ¿Cómo funcionan las cuotas?
                    </h3>
                    <p className="text-muted-foreground">
                      Mostramos las condiciones guardadas en tu orden. Los nuevos
                      planes tienen un anticipo del 25% del precio original y
                      cuotas financiadas con al menos 7 días entre pagos, hasta
                      la víspera del evento. El anticipo va aparte de las cuotas.
                      La tasa y la cantidad de cuotas se muestran en el plan de tu orden.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">¿Se cobrará algo?</h3>
                    <p className="text-muted-foreground">
                      El QR de BCP cobra el importe que se muestra en pantalla.
                      Los pagos se registran tras verificar la confirmación bancaria.
                      El QR de pago no es una entrada de acceso al evento.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">¿Qué pasa con mi entrada?</h3>
                    <p className="text-muted-foreground">
                      La reserva y la entrega se definirán con cada ticketera
                      durante la integración.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to={paymentPath} replace />} />
        <Route path="/pago" element={<CheckoutPage />} />
        <Route path="/mis-cuotas/:orderId?" element={<Suspense fallback={<p role="status" className="px-6 py-20 text-center">Cargando tus cuotas…</p>}><BuyerPortal /></Suspense>} />
        <Route
          path="/confirmacion"
          element={
            <Suspense
              fallback={
                <p role="status" className="px-6 py-20 text-center">
                  Cargando confirmación…
                </p>
              }
            >
              <ConfirmationPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <main className="mx-auto max-w-lg px-6 py-24 text-center">
              <h1 className="text-3xl font-bold">
                Esta página no está disponible
              </h1>
              <p className="my-5 text-muted-foreground">
                Vuelve al pago para continuar con tu compra.
              </p>
              <Button asChild>
                <Link to={paymentPath}>
                  Ir al pago <ArrowUpRight />
                </Link>
              </Button>
            </main>
          }
        />
      </Routes>
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:px-8">
        <p>© 2026 Ticketya Cuotas · Más experiencias, a tu ritmo.</p>
        <p>Pagos mediante QR BCP</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {import.meta.env.VITE_DEPLOYMENT_ENV === "preproduction" && <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">Preproducción · Entorno de validación</div>}
      <Routes>
        <Route path="/backoffice" element={<Navigate to="/backoffice/ticketeras" replace />} />
        <Route path="/backoffice/ticketeras" element={<Suspense fallback={<p role="status">Cargando administración…</p>}><OperatorBackoffice /></Suspense>} />
        <Route path="*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  );
}
