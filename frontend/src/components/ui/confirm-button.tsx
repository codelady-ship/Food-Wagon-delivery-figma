import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Two-step confirm inside the page, used instead of window.confirm(): the admin also runs in a
 * sandboxed iframe without allow-modals, where browser dialogs are silently ignored.
 * First press: the button turns into "confirm / Cancel" for a few seconds. Escape or Cancel goes back.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Yes, delete",
  question,
  onConfirm,
  timeout = 6000,
  variant = "ghost",
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  /** Read by screen readers when the second step appears, e.g. "Delete WELCOME10?" */
  question: string;
  onConfirm: () => void | Promise<void>;
  timeout?: number;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const group = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  const armedAt = useRef(0);
  const refocus = useRef(false);

  const close = () => {
    refocus.current = Boolean(group.current?.contains(document.activeElement));
    setArmed(false);
  };

  useEffect(() => {
    if (!armed) {
      if (refocus.current) trigger.current?.focus();
      refocus.current = false;
      return;
    }
    armedAt.current = Date.now();
    yes.current?.focus();
    group.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); // inside a scrolling table: show both buttons
    const t = window.setTimeout(close, timeout);
    return () => window.clearTimeout(t);
  }, [armed, timeout]);

  if (!armed)
    return (
      <Button ref={trigger} variant={variant} size={size} className={className} disabled={busy} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );

  const confirm = async () => {
    if (Date.now() - armedAt.current < 350) return; // a double click or a held Enter key must not confirm
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <span ref={group} role="group" aria-label={question} className="inline-flex items-center justify-end gap-2 align-middle" onKeyDown={(e) => e.key === "Escape" && close()}>
      <span className="sr-only" role="status">
        {question} Confirm or cancel.
      </span>
      <Button ref={yes} variant="danger" size={size} className="min-w-11" disabled={busy} onClick={confirm}>
        {confirmLabel}
      </Button>
      <Button variant="outline" size={size} className="min-w-11" disabled={busy} onClick={close}>
        Cancel
      </Button>
    </span>
  );
}
