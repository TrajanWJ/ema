import { useCallback, useEffect, useState } from "react";

interface UseCommandPaletteOptions {
  /** Key to trigger. Default "k" (as in Cmd+K / Ctrl+K). Single char, lowercase. */
  readonly key?: string;
  /** Called when the palette is opened. */
  readonly onOpen?: () => void;
  /** Called when the palette is closed. */
  readonly onClose?: () => void;
}

interface UseCommandPaletteReturn {
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly close: () => void;
  readonly toggle: () => void;
}

/**
 * useCommandPalette — Cmd+K / Ctrl+K global hotkey manager. Escape closes.
 * The CommandBar component already encapsulates this, but apps that want a
 * custom palette UI can reuse the hook.
 */
export function useCommandPalette(
  options: UseCommandPaletteOptions = {},
): UseCommandPaletteReturn {
  const { key = "k", onOpen, onClose } = options;
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      else onClose?.();
      return next;
    });
  }, [onOpen, onClose]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, toggle, close, isOpen]);

  return { isOpen, open, close, toggle };
}
