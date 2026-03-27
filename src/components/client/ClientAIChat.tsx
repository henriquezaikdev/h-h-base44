import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ClientAIChatProps {
  clientId: string
  clientName: string
  companyId: string
}

const QUICK_ACTIONS = [
  { label: 'Produtos parados', prompt: 'Quais produtos este cliente parou de comprar? Liste com dias parado e sugestão de abordagem.' },
  { label: 'Oportunidades de recompra', prompt: 'Identifique oportunidades de recompra baseado no histórico e intervalo médio deste cliente.' },
  { label: 'Resumo do cliente', prompt: 'Faça um resumo executivo deste cliente em até 5 linhas para eu usar numa ligação agora.' },
  { label: 'Sugestão de abordagem', prompt: 'Me dê um roteiro de abordagem para ligar para este cliente hoje.' },
  { label: 'Gerar relatório', prompt: 'Monte uma análise completa: Diagnóstico, Itens de Atenção, Leitura Comercial, Sugestão de Abordagem e Próxima Ação.' },
]

export function ClientAIChat({ clientId, clientName, companyId }: ClientAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const callAssistant = async (msgs: Message[]) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistente-cliente`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ client_id: clientId, company_id: companyId, messages: msgs }),
      }
    )
    if (!res.ok) throw new Error('Erro ao chamar assistente')
    const data = await res.json()
    return data.resposta as string
  }

  const loadInitialAnalysis = async () => {
    setInitialLoading(true)
    try {
      const resposta = await callAssistant([])
      setMessages([{ role: 'assistant', content: resposta }])
    } catch {
      setMessages([{ role: 'assistant', content: 'Não foi possível carregar a análise. Tente novamente ou faça uma pergunta direta.' }])
    } finally {
      setInitialLoading(false)
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return
    const userMsg: Message = { role: 'user', content: content.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const resposta = await callAssistant(newMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: resposta }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar. Tente novamente.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const reset = () => { setMessages([]) }

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button onClick={() => setExpanded(prev => !prev)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Bot size={16} className="text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Assistente Comercial</p>
            <p className="text-xs text-gray-400">{clientName} · contexto ativo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!expanded && messages.length > 0 && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{messages.length} msg{messages.length > 1 ? 's' : ''}</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <>
          <div className="px-5 pb-3 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(action => (
                <button key={action.label} onClick={() => sendMessage(action.prompt)} disabled={loading || initialLoading}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40">
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 px-5 py-4 max-h-[480px] overflow-y-auto space-y-4">
            {initialLoading ? (
              <div className="flex items-center gap-3 py-6">
                <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0"><Bot size={14} className="text-indigo-600" /></div>
                <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" />Analisando cliente...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Bot size={22} className="text-[#3B5BDB]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Copiloto Comercial</p>
                  <p className="text-xs text-gray-400 mt-1">Análise completa de {clientName} em segundos</p>
                </div>
                <button
                  onClick={loadInitialAnalysis}
                  className="px-5 py-2 rounded-lg bg-[#3B5BDB] text-white text-sm font-medium hover:bg-[#3451c7] transition-colors"
                >
                  Analisar cliente
                </button>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5"><Bot size={14} className="text-indigo-600" /></div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-800 border border-gray-100'}`}>
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5"><User size={14} className="text-gray-500" /></div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0"><Bot size={14} className="text-indigo-600" /></div>
                <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={14} className="animate-spin" />Processando...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 px-4 py-3 flex items-end gap-3">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              disabled={loading || initialLoading} placeholder={`Pergunte sobre ${clientName}...`} rows={1}
              className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 disabled:opacity-50"
              style={{ maxHeight: '120px', overflowY: 'auto' }} />
            <div className="flex items-center gap-2">
              <button onClick={reset} disabled={loading || initialLoading} title="Reiniciar conversa"
                className="p-2.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                <RotateCcw size={15} />
              </button>
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading || initialLoading}
                className="p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40">
                <Send size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
