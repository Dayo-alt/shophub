import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Simple plugin to allow import specifiers like "package@1.2.3" by stripping the version suffix
function stripImportVersions(): any {
  const versionPattern = /^(.*)@\d+\.\d+\.\d+(.*)?$/
  return {
    name: 'strip-import-versions',
    enforce: 'pre' as const,
    // Note: We deliberately avoid using `this.resolve` to keep types simple for TS.
    resolveId(id: string) {
      const m = id.match(versionPattern)
      if (m) {
        const cleaned = `${m[1]}${m[2] ?? ''}`
        return cleaned
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [stripImportVersions(), react()],
})
