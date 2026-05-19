import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'scripts/cache.ts',
    'scripts/env-check.ts',
    'scripts/search.ts',
    'scripts/fetch.ts',
    'scripts/analyze.ts',
    'scripts/review.ts',
    'scripts/report.ts',
    'scripts/pipeline.ts'
  ],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  dts: false
})
