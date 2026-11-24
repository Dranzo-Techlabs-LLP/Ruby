// Shared behaviour for the top bar's two drop-down menus:
// open/close, click outside, Escape, and arrow-key movement between items.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

export function useMenu() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback((focusButton = true) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }, [])

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])

  // Focus the checked item (or the first) when the menu opens.
  useEffect(() => {
    if (!open) return
    const list = items()
    const checked = list.find((el) => el.getAttribute('aria-checked') === 'true')
    ;(checked ?? list[0])?.focus()
  }, [open])

  // Close on a click or tap outside.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false)
    }
    document.addEventListener('pointerdown', onDown)
    // A click inside a frame never reaches this document; losing focus to it closes the menu.
    const onBlur = () => setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) close(false)
    })
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('blur', onBlur)
    }
  }, [open, close])

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') close(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus() }
  }

  return { open, setOpen, close, buttonRef, menuRef, onButtonKeyDown, onMenuKeyDown }
}
