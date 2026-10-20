import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const api = (import.meta.env.VITE_TICKET_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3131" : "")).replace(/\/$/, "");
const identity = z.object({ subject: z.string(), roles: z.array(z.enum(["application:operations", "application:admin"])),
  target: z.object({ product: z.literal("plugin-ticketya"), applicationId: z.uuid(), tenantId: z.uuid(), environment: z.enum(["development", "staging", "production"]) }) });
const sessionSchema = z.object({ identity, csrfToken: z.string().min(32) });
const ticketera = z.object({ id: z.uuid(), name: z.string(), clientId: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]) });
const listSchema = z.object({ items: z.array(ticketera) });
const createdSchema = z.object({ ticketera, credential: z.object({ clientId: z.string(), secret: z.string() }) });
type Session = z.infer<typeof sessionSchema>;
type Ticketera = z.infer<typeof ticketera>;
class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function request<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  if (!api) throw new ApiError("El acceso de operadores todavía no está configurado.", 503);
  const response = await fetch(api + "/api/v1/operators" + path, { ...options, credentials: "include", cache: "no-store",
    referrerPolicy: "no-referrer", signal: options.signal ?? AbortSignal.timeout(15000) });
  const value: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(value);
    throw new ApiError(error.success ? error.data.error.message : "No se pudo confirmar la operación.", response.status);
  }
  return schema.parse(value);
}

export function OperatorBackoffice() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Ticketera[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [credential, setCredential] = useState<z.infer<typeof createdSchema>["credential"] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const current = await request("/session", sessionSchema, { signal: controller.signal });
        const list = await request("/ticketeras", listSchema, { signal: controller.signal });
        setSession(current); setItems(list.items);
      } catch (cause) {
        if (!controller.signal.aborted && !(cause instanceof ApiError && cause.status === 401)) setError(cause instanceof Error ? cause.message : "Acceso no disponible.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setError(""); setCredential(null);
    try {
      const result = await request("/ticketeras", createdSchema, { method: "POST", headers: {
        "content-type": "application/json", "x-csrf-token": session.csrfToken }, body: JSON.stringify({ name: name.trim() }) });
      setItems(current => [result.ticketera, ...current]); setName(""); setCredential(result.credential);
    } catch (cause) { setError((cause instanceof Error ? cause.message : "No se pudo confirmar la operación.") + " Revisa el listado antes de reintentar."); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (!session) return; setBusy(true); setError("");
    try {
      await request("/session", z.null(), { method: "DELETE", headers: { "x-csrf-token": session.csrfToken } });
      setSession(null); setItems([]); setCredential(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cerrar el acceso."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5"><div>
      <p className="text-sm font-medium text-primary">Plugin TicketYa</p><h1 className="text-3xl font-bold">Administración de tiqueteras</h1>
    </div>{session && <Button variant="outline" disabled={busy} onClick={() => void logout()}>Salir de TicketYa</Button>}</header>
    {loading ? <p role="status">Comprobando tu acceso…</p> : !session ? <section className="space-y-5 rounded-xl border bg-card p-7">
      <h2 className="text-xl font-semibold">Ingresa con tu cuenta autorizada</h2>
      <p>Usa tu contraseña y autenticador personal. Este acceso requiere un permiso de Plugin TicketYa.</p>
      <Button disabled={!api} onClick={() => window.location.assign(api + "/api/v1/operators/login")}>Ingresar</Button>
    </section> : <>
      <p className="text-sm text-muted-foreground">{session.identity.roles.includes("application:admin") ? "Administración y operaciones" : "Operaciones"} · {session.identity.target.environment}</p>
      {session.identity.roles.includes("application:admin") && <form onSubmit={event => void create(event)} className="space-y-4 rounded-xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Registrar tiquetera</h2><div className="space-y-2"><Label htmlFor="ticketera-name">Nombre</Label>
          <Input id="ticketera-name" required minLength={3} maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></div>
        <Button disabled={busy}>{busy ? "Guardando…" : "Registrar"}</Button>
      </form>}
      {credential && <section className="space-y-3 rounded-xl border border-primary bg-card p-6"><h2 className="font-semibold">Credencial creada</h2>
        <p>Se muestra una sola vez. Guárdala únicamente en el servidor de la tiquetera.</p>
        <pre className="overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-4 text-sm">{JSON.stringify(credential, null, 2)}</pre>
        <Button variant="outline" onClick={() => setCredential(null)}>Ocultar credencial</Button>
      </section>}
      <section className="space-y-4"><h2 className="text-xl font-semibold">Tiqueteras registradas</h2>
        {items.length ? <div className="overflow-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="p-4">Nombre</th><th className="p-4">Cliente</th><th className="p-4">Estado</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.id} className="border-t"><td className="p-4">{item.name}</td><td className="p-4 font-mono">{item.clientId}</td><td className="p-4">{item.status}</td></tr>)}</tbody></table></div> : <p>Todavía no hay tiqueteras registradas.</p>}
      </section>
    </>}
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{error}</p>}
  </main>;
}
