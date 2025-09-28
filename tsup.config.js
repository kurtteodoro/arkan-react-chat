import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.jsx'],
    format: ['cjs', 'esm'],
    dts: false,
    sourcemap: true,
    clean: true,
    css: true, // 👈 isso embute o CSS automaticamente
})
