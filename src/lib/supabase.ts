import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Debug — remover após confirmar que as variáveis estão carregando
console.log('[supabase] VITE_SUPABASE_URL:',      supabaseUrl      ? `${supabaseUrl.slice(0, 30)}…` : '❌ undefined')
console.log('[supabase] VITE_SUPABASE_ANON_KEY:',  supabaseAnonKey  ? `${supabaseAnonKey.slice(0, 20)}…` : '❌ undefined')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Variáveis de ambiente não carregadas.\n' +
    '→ Confirme que .env.local existe na raiz do projeto (mesmo nível que package.json)\n' +
    '→ Confirme que os nomes são VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY\n' +
    '→ Reinicie o dev server (npm run dev) após alterar o .env.local'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
})
