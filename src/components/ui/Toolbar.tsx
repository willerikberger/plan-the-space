'use client'

import { Undo2, Redo2 } from 'lucide-react'
import { usePlannerStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface ToolbarProps {
  onUndo?: () => void
  onRedo?: () => void
}

export function Toolbar({ onUndo, onRedo }: ToolbarProps) {
  const mode = usePlannerStore((s) => s.mode)
  const pixelsPerMeter = usePlannerStore((s) => s.pixelsPerMeter)
  const historyState = usePlannerStore((s) => s.historyState)

  const modeLabel = (() => {
    switch (mode) {
      case 'calibrating':
        return 'Calibrating'
      case 'drawing-line':
        return 'Drawing Line'
      case 'drawing-mask':
        return 'Drawing Mask'
      case 'cleanup':
        return 'Cleanup Mode'
      default:
        return pixelsPerMeter ? 'Ready' : 'No Scale Set'
    }
  })()

  const modeClass = cn(
    'px-3 py-1.5 rounded text-xs font-semibold',
    mode === 'calibrating' && 'bg-[#f39c12] animate-mode-pulse',
    mode === 'drawing-line' && 'bg-[#f39c12] animate-mode-pulse',
    mode === 'drawing-mask' && 'bg-[#9b59b6] animate-mode-pulse',
    mode === 'cleanup' && 'bg-[#9b59b6] animate-mode-pulse',
    mode === 'normal' && 'bg-[#e94560]',
  )

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-[#16213e] border-b border-[#0f3460]">
      <span className={modeClass}>{modeLabel}</span>
      <span className="text-sm text-[#888]">
        {pixelsPerMeter ? (
          <>
            Scale: <strong className="text-[#4ade80]">1m = {Math.round(pixelsPerMeter)}px</strong>
          </>
        ) : (
          'Scale: Not set'
        )}
      </span>

      {/* Undo / Redo */}
      <div className="flex items-center gap-1 ml-4">
        <button
          onClick={onUndo}
          disabled={!historyState.canUndo}
          className={cn(
            'p-1.5 rounded transition-colors',
            historyState.canUndo
              ? 'text-[#eee] hover:bg-[#0f3460] cursor-pointer'
              : 'text-[#444] cursor-not-allowed',
          )}
          title={historyState.canUndo ? `Undo (${historyState.undoCount} step${historyState.undoCount !== 1 ? 's' : ''})` : 'Nothing to undo'}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!historyState.canRedo}
          className={cn(
            'p-1.5 rounded transition-colors',
            historyState.canRedo
              ? 'text-[#eee] hover:bg-[#0f3460] cursor-pointer'
              : 'text-[#444] cursor-not-allowed',
          )}
          title={historyState.canRedo ? `Redo (${historyState.redoCount} step${historyState.redoCount !== 1 ? 's' : ''})` : 'Nothing to redo'}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <span className="flex-1" />
      <span className="text-sm text-[#888]">Scroll to zoom &bull; Drag canvas to pan</span>
    </div>
  )
}
