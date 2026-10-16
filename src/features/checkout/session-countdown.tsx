import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SessionCountdown({ expiresAt, compact = false, className }: {
  expiresAt: string;
  compact?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  const remaining = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className={cn(
      "shrink-0 text-muted-foreground",
      compact ? "space-y-1" : "flex items-center gap-2 rounded-full border bg-card px-3 py-2",
      seconds <= 300 && "text-destructive",
      className,
    )}>
      <p className={cn("flex items-center gap-1.5", compact ? "text-[10px]" : "text-xs")}>
        <Clock3 aria-hidden className={compact ? "size-3" : "size-3.5"} />
        {compact ? "Tiempo restante" : "Tu enlace vence en"}
      </p>
      <span
        role="timer"
        aria-label="Tiempo restante del enlace de pago"
        aria-live="off"
        className={cn("block font-semibold tabular-nums", compact ? "text-xl leading-none" : "text-sm")}
      >
        {remaining}
      </span>
    </div>
  );
}
