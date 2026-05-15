import { toast } from "sonner";

interface UndoableOptions<T> {
  label: string;
  description?: string;
  commit: () => Promise<T> | T;
  onUndo?: () => void;
  onCommitSuccess?: (result: T) => void;
  onCommitError?: (err: unknown) => void;
  delayMs?: number;
}

/**
 * Show a toast with an Undo button. If the user clicks Undo within delayMs,
 * the commit is cancelled. Otherwise the commit fires.
 *
 * Use for any destructive action where a 5-10s grace period is acceptable.
 */
export function undoableAction<T>({
  label,
  description,
  commit,
  onUndo,
  onCommitSuccess,
  onCommitError,
  delayMs = 6000,
}: UndoableOptions<T>): { cancel: () => void } {
  let cancelled = false;
  const id = toast(label, {
    description,
    duration: delayMs,
    action: {
      label: "Undo",
      onClick: () => {
        cancelled = true;
        toast.dismiss(id);
        toast.message("Reverted");
        onUndo?.();
      },
    },
  });

  const timer = window.setTimeout(() => {
    if (cancelled) return;
    Promise.resolve()
      .then(commit)
      .then((res) => {
        onCommitSuccess?.(res);
      })
      .catch((err) => {
        onCommitError?.(err);
        toast.error(err instanceof Error ? err.message : "Action failed");
      });
  }, delayMs);

  return {
    cancel: () => {
      cancelled = true;
      window.clearTimeout(timer);
    },
  };
}
