import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IMPORTANTE (GitHub Pages):
// O site fica publicado em https://<seu-usuario>.github.io/<nome-do-repositorio>/
// Por isso o "base" precisa ser exatamente "/<nome-do-repositorio>/" (com as barras).
// Se o seu repositório tiver outro nome, troque o valor abaixo.
export default defineConfig(({ mode }) => {
  checkSupabaseKey(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_KEY)
  return {
    base: '/planning-poker/',
    plugins: [react(), tailwindcss()],
  }
})

// Tudo que começa com VITE_ vai parar no JavaScript público do site. Uma chave secreta
// do Supabase ali dá acesso total ao banco para qualquer visitante, então o build falha.
function checkSupabaseKey(key) {
  if (!key) return
  let role = null
  if (key.startsWith('eyJ')) {
    try {
      role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role
    } catch {
      // não é um JWT válido: o Supabase vai recusar, mas não é perigoso
    }
  }
  if (key.startsWith('sb_secret_') || role === 'service_role') {
    throw new Error(
      'VITE_SUPABASE_KEY é uma chave SECRETA do Supabase e ficaria pública no site. ' +
        'Use a "publishable key" (sb_publishable_...) ou a "anon" (ver docs/SUPABASE.md).',
    )
  }
}
