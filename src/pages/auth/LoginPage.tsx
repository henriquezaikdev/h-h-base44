import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-8 py-10">

          {/* Logo */}
          <div className="mb-8 text-center">
            <span className="text-2xl font-semibold text-[#3B5BDB] tracking-tight select-none">
              H&amp;H Control
            </span>
            <p className="mt-1 text-sm text-[#6B7280]">Acesse sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* E-mail */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-[#374151]">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] outline-none transition focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20"
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-[#374151]">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] placeholder-[#9CA3AF] outline-none transition focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20"
              />
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#3B5BDB] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3451C7] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>

            {/* Erro */}
            {error && (
              <p className="text-center text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
