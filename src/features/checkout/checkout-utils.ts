import { z } from "zod";

export const money = (cents: number) =>
  new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
  })
    .formatToParts(cents / 100)
    .map((part) => (part.type === "currency" ? "Bs" : part.value))
    .join("");
export const shortDate = (date: string, timeZone = "America/La_Paz") =>
  new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(date));

export const eventDateTime = (date: string, timeZone = "America/La_Paz") =>
  new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));

export const buyerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre y apellido (al menos 3 caracteres).")
    .max(100, "Usa hasta 100 caracteres."),
  email: z
    .string()
    .trim()
    .pipe(z.email("Escribe un correo electrónico válido.")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/, "Escribe un teléfono válido.")
    .refine(
      (value) => value.replace(/\D/g, "").length >= 7,
      "Escribe un teléfono válido.",
    ),
  accepted: z
    .boolean()
    .refine(
      (value) => value,
      "Confirma que has revisado y aceptas las condiciones del plan.",
    ),
});
export type Buyer = z.infer<typeof buyerSchema>;
