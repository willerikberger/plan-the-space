'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/FileInput'
import { checkProjectExists } from '@/lib/storage/indexeddb'

interface StoragePanelProps {
  onSave: () => void
  onLoad: () => void
  onClear: () => void
  onExport: () => void
  onImport: (file: File) => void
  onToggleAutoSave: () => void
}

export function StoragePanel({
  onSave,
  onLoad,
  onClear,
  onExport,
  onImport,
}: StoragePanelProps) {
  const [storageStatus, setStorageStatus] = useState('No saved data')

  useEffect(() => {
    checkProjectExists().then((data) => {
      if (data?.savedAt) {
        const d = new Date(data.savedAt)
        setStorageStatus(`Last saved: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`)
      }
    })
  }, [])

  return (
    <div className="mb-6">
      <h2 className="text-xs uppercase tracking-wide text-[#e94560] mb-3 pb-2 border-b border-[#0f3460] font-semibold">
        Save / Load
      </h2>

      <div className="mb-3">
        <span className="text-xs text-[#27ae60] font-medium">Auto-save: On</span>
      </div>

      <div className="flex gap-2 mb-2">
        <Button variant="secondary" size="sm" onClick={onSave}>
          Save Now
        </Button>
        <Button variant="secondary" size="sm" onClick={onLoad}>
          Load
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-[#e74c3c]"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
      <p className="text-xs text-[#666] mb-4">{storageStatus}</p>

      <div className="border-t border-[#0f3460] pt-4">
        <label className="text-[#aaa] text-xs block mb-1.5">File Export/Import</label>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onExport}>
            Export JSON
          </Button>
          <div className="flex-1">
            <FileInput accept=".json" onChange={onImport} label="Import JSON" />
          </div>
        </div>
      </div>
    </div>
  )
}
