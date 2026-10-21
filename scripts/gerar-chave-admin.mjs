// Gera um novo par de chaves do painel de admin.
//
//   node scripts/gerar-chave-admin.mjs [url-do-site]
//
// - Grava as chaves PÚBLICAS em src/lib/adminKeys.js (podem ir para o git).
// - Imprime o LINK MÁGICO com as chaves PRIVADAS (não commite, não compartilhe).
// Rodar de novo invalida o link anterior (útil se ele vazar). Depois, faça commit e push.

import { webcrypto as crypto } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const siteUrl = (process.argv[2] || 'https://luis-costa-f.github.io/planning-poker/').replace(/\/?$/, '/')

const sign = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const enc = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])

const signJwk = await crypto.subtle.exportKey('jwk', sign.privateKey)
const encJwk = await crypto.subtle.exportKey('jwk', enc.privateKey)

const file = fileURLToPath(new URL('../src/lib/adminKeys.js', import.meta.url))
writeFileSync(
  file,
  `// Chaves PÚBLICAS do painel de admin (gerado por scripts/gerar-chave-admin.mjs).
// As chaves privadas ficam apenas no link mágico do dono do site.
export const ADMIN_SIGN_PUBLIC = { x: '${signJwk.x}', y: '${signJwk.y}' }
export const ADMIN_ENC_PUBLIC = { x: '${encJwk.x}', y: '${encJwk.y}' }
`,
)

console.log('Chaves públicas gravadas em src/lib/adminKeys.js\n')
console.log('LINK MÁGICO (guarde nos favoritos e não compartilhe):\n')
console.log(`${siteUrl}#admin=${signJwk.d}.${encJwk.d}\n`)
console.log('Para testar localmente: http://localhost:5173/planning-poker/#admin=' + `${signJwk.d}.${encJwk.d}`)
