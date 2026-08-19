import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

// "hace 3 horas", "hace 2 días"...
export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

// "19 ago 2026, 14:30"
export function fullDate(date: string): string {
  return format(new Date(date), "d MMM yyyy, HH:mm", { locale: es });
}

// Precio en céntimos -> "12,50 €" o "Gratis" o "" si es null.
export function formatPrice(cents: number | null): string {
  if (cents === null) return "";
  if (cents === 0) return "Gratis";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Iniciales para el avatar por defecto.
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
