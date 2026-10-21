import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IMPORTANTE (GitHub Pages):
// O site fica publicado em https://<seu-usuario>.github.io/<nome-do-repositorio>/
// Por isso o "base" precisa ser exatamente "/<nome-do-repositorio>/" (com as barras).
// Se o seu repositório tiver outro nome, troque o valor abaixo.
export default defineConfig({
  base: '/planning-poker/',
  plugins: [react(), tailwindcss()],
})
