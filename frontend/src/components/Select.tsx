import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown on the trigger when no option is selected (value === ""). Also added
   *  as a selectable "clear" row at the top of the menu when provided. */
  placeholder?: string;
  size?: "sm" | "md";
  variant?: "default" | "gold";
  /** Stretch to fill the parent (form fields). Otherwise sizes to content. */
  fullWidth?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Width tweaks merged onto the trigger (minWidth / maxWidth / width). */
  style?: CSSProperties;
}

/**
 * Fully styled dropdown that replaces the native <select>. Unlike a native
 * control, the open option list is real DOM we can theme — so it matches the
 * platform's gold/dark design and stays consistent across browsers and OSes.
 *
 * The menu renders in a portal with fixed positioning so it is never clipped by
 * an ancestor's `overflow: hidden` (common in KPI cards/headers).
 */
export default function Select({
  value, options, onChange, placeholder, size = "sm", variant = "default",
  fullWidth = false, disabled = false, id, ariaLabel, style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // keyboard-highlighted row
  const [rect, setRect] = useState<DOMRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  // The full list of selectable rows, including the placeholder "clear" row.
  const rows: SelectOption[] = placeholder !== undefined
    ? [{ value: "", label: placeholder }, ...options]
    : options;

  const selected = options.find(o => o.value === value);
  const triggerLabel = selected ? selected.label : (placeholder ?? "");
  const isPlaceholder = !selected;

  const reposition = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  const openMenu = () => {
    if (disabled) return;
    reposition();
    setActive(Math.max(0, rows.findIndex(r => r.value === value)));
    setOpen(true);
  };
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const pick = (v: string) => { onChange(v); close(true); };

  // Keep the menu glued to the trigger while open (scroll / resize).
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Scroll the active row into view as it changes.
  useEffect(() => {
    if (!open || active < 0) return;
    const el = menuRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const moveActive = (dir: 1 | -1) => {
    setActive(prev => {
      let i = prev;
      for (let step = 0; step < rows.length; step++) {
        i = (i + dir + rows.length) % rows.length;
        if (!rows[i].disabled) return i;
      }
      return prev;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); moveActive(1); break;
      case "ArrowUp":   e.preventDefault(); moveActive(-1); break;
      case "Home":      e.preventDefault(); setActive(rows.findIndex(r => !r.disabled)); break;
      case "End":       e.preventDefault(); setActive(rows.length - 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (active >= 0 && !rows[active].disabled) pick(rows[active].value);
        break;
      case "Escape":    e.preventDefault(); close(true); break;
      case "Tab":       setOpen(false); break;
    }
  };

  // Flip above the trigger if there isn't room below.
  const MENU_MAX = 280;
  const flipUp = rect ? window.innerHeight - rect.bottom < MENU_MAX + 16 && rect.top > window.innerHeight - rect.bottom : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`ui-select${variant === "gold" ? " ui-select--gold" : ""}${isPlaceholder ? " is-placeholder" : ""}`}
        data-size={size}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        style={{ width: fullWidth ? "100%" : undefined, ...style }}
      >
        <span className="ui-select-label">{triggerLabel}</span>
        <svg className={`ui-select-chevron${open ? " open" : ""}`} viewBox="0 0 24 24" width="14" height="14"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && rect && createPortal(
        <ul
          ref={menuRef}
          id={listboxId}
          role="listbox"
          className="ui-select-menu"
          style={{
            position: "fixed",
            left: rect.left,
            minWidth: rect.width,
            maxWidth: Math.max(rect.width, 360),
            ...(flipUp
              ? { bottom: window.innerHeight - rect.top + 6, maxHeight: rect.top - 16 }
              : { top: rect.bottom + 6, maxHeight: window.innerHeight - rect.bottom - 16 }),
          }}
        >
          {rows.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value || `__ph_${i}`}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                className={`ui-select-option${isSel ? " is-selected" : ""}${i === active ? " is-active" : ""}${o.disabled ? " is-disabled" : ""}${o.value === "" && placeholder !== undefined ? " is-placeholder-row" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); if (!o.disabled) pick(o.value); }}
              >
                <span className="ui-select-option-label">{o.label}</span>
                {isSel && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
