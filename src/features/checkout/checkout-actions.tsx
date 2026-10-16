import type { ReactNode } from "react";
import { SessionCountdown } from "./session-countdown";

export function CheckoutActions({ expiresAt, children }: {
  expiresAt: string;
  children: ReactNode;
}) {
  return (
    <div
      data-checkout-actions
      className="fixed inset-x-0 bottom-0 z-40 m-0! flex items-center gap-4 border-t bg-card/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:contents"
    >
      <SessionCountdown expiresAt={expiresAt} compact className="sm:hidden" />
      <div className="min-w-0 flex-1 sm:contents">{children}</div>
    </div>
  );
}
