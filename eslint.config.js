// eslint.config.js
import { defineConfig, globalIgnores } from 'eslint/config'
import cmyr from 'eslint-config-cmyr'

export default defineConfig([
    globalIgnores([
        'dist/**',
        'build/**',
        'coverage/**',
        'node_modules/**',
        'skills/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
    ]),
    cmyr,
])
