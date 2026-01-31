'use client'

import { useEffect } from 'react'
import type { Canvas } from 'fabric'
import { usePlannerStore } from '@/lib/store'

export function useKeyboardShortcuts(
  fabricCanvasRef: React.RefObject<Canvas | null>,
  actions: {
    cancelCalibration: () => void
    cancelLineDrawing: () => void
    deleteSelected: () => void
    undo: () => Promise<void>
    redo: () => Promise<void>
  },
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return
      const target = e.target as HTMLElement

      // Skip when focused on input elements
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused) {
        e.preventDefault()
        actions.deleteSelected()
      }

      if (e.key === 'Escape') {
        const mode = usePlannerStore.getState().mode
        if (mode === 'calibrating') actions.cancelCalibration()
        if (mode === 'drawing-line') actions.cancelLineDrawing()
        if (mode === 'drawing-mask') {
          usePlannerStore.getState().setMode('cleanup')
          canvas.defaultCursor = 'default'
          canvas.selection = true
        }
        canvas.discardActiveObject()
        canvas.renderAll()
      }

      // Undo: Ctrl+Z / Cmd+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !isInputFocused) {
        e.preventDefault()
        actions.undo()
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
      if (
        ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && e.shiftKey && !isInputFocused) ||
        (e.key === 'y' && (e.metaKey || e.ctrlKey) && !isInputFocused)
      ) {
        e.preventDefault()
        actions.redo()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [fabricCanvasRef, actions])
}
