import type { SerializedProject } from '@/lib/types'
import { validateProjectData, migrateProject } from '@/components/canvas/utils/serialization'

export function downloadProjectAsJson(data: SerializedProject): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `outdoor-planner-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export function importProjectFromFile(file: File): Promise<SerializedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!validateProjectData(data)) {
          reject(new Error('Invalid project file format'))
          return
        }
        resolve(migrateProject(data as SerializedProject))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse JSON'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
