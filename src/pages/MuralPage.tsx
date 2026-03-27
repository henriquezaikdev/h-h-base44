import { useState, useRef, useEffect } from 'react'
import { Newspaper, Plus, MessageCircle, Send, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useSupabaseQuery } from '../hooks/useSupabaseQuery'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string
  author_id: string
  content: string
  image_url: string | null
  is_story: boolean | null
  expires_at: string | null
  created_at: string
}

interface Comment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
}

interface Reaction {
  id: string
  post_id: string
  seller_id: string
  emoji: string
}

interface SellerInfo {
  id: string
  name: string
  role: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👏']

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'agora'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `há ${days} dias`
  return `há ${Math.floor(days / 30)} meses`
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    owner: 'Gestor',
    admin: 'Administrativo',
    seller: 'Vendedor',
    logistics: 'Logística',
    manager: 'Gerente',
  }
  return map[role] ?? role
}

function groupReactions(
  reactions: Reaction[],
  postId: string,
  currentSellerId: string
): { emoji: string; count: number; hasReacted: boolean }[] {
  const postReactions = reactions.filter(r => r.post_id === postId)
  const grouped: Record<string, Reaction[]> = {}
  for (const r of postReactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = []
    grouped[r.emoji].push(r)
  }
  return Object.entries(grouped).map(([emoji, list]) => ({
    emoji,
    count: list.length,
    hasReacted: list.some(r => r.seller_id === currentSellerId),
  }))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MuralPage() {
  const { seller } = useAuth()

  // ── Modal: Nova publicação ─────────────────────────────────────────────────
  const [newPostOpen, setNewPostOpen]     = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [isStory, setIsStory]             = useState(false)
  const [submitting, setSubmitting]       = useState(false)

  // ── Story viewer ───────────────────────────────────────────────────────────
  const [storyModal, setStoryModal] = useState<Post | null>(null)

  // ── Comments state ─────────────────────────────────────────────────────────
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentInputs, setCommentInputs]       = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<string | null>(null)

  // ── Reaction picker ────────────────────────────────────────────────────────
  const [pickerPostId, setPickerPostId] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Fechar picker ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerPostId(null)
      }
    }
    if (pickerPostId) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerPostId])

  // Fechar modais com Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNewPostOpen(false)
        setStoryModal(null)
        setPickerPostId(null)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: posts, loading: postsLoading, refetch: refetchPosts } =
    useSupabaseQuery<Post[]>(
      ({ company_id }) =>
        supabase
          .from('mural_posts')
          .select('id, author_id, content, image_url, is_story, expires_at, created_at')
          .eq('company_id', company_id)
          .or('is_story.is.null,is_story.eq.false')
          .order('created_at', { ascending: false }),
      []
    )

  const { data: stories } =
    useSupabaseQuery<Post[]>(
      ({ company_id }) =>
        supabase
          .from('mural_posts')
          .select('id, author_id, content, image_url, is_story, expires_at, created_at')
          .eq('company_id', company_id)
          .eq('is_story', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      []
    )

  const { data: reactions, refetch: refetchReactions } =
    useSupabaseQuery<Reaction[]>(
      ({ company_id }) =>
        supabase
          .from('mural_reactions')
          .select('id, post_id, seller_id, emoji')
          .eq('company_id', company_id),
      []
    )

  const { data: comments, refetch: refetchComments } =
    useSupabaseQuery<Comment[]>(
      ({ company_id }) =>
        supabase
          .from('mural_comments')
          .select('id, post_id, author_id, content, created_at')
          .eq('company_id', company_id)
          .order('created_at', { ascending: true }),
      []
    )

  const { data: sellers } =
    useSupabaseQuery<SellerInfo[]>(
      ({ company_id }) =>
        supabase
          .from('sellers')
          .select('id, name, role')
          .eq('company_id', company_id)
          .eq('active', true),
      []
    )

  // ── Derived maps ───────────────────────────────────────────────────────────

  const sellerMap = new Map((sellers ?? []).map(s => [s.id, s]))

  const commentsByPost = (comments ?? []).reduce<Record<string, Comment[]>>((acc, c) => {
    if (!acc[c.post_id]) acc[c.post_id] = []
    acc[c.post_id].push(c)
    return acc
  }, {})

  // ── Actions ────────────────────────────────────────────────────────────────

  async function submitPost() {
    if (!newPostContent.trim() || !seller) return
    setSubmitting(true)
    const now = new Date()
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('mural_posts').insert({
      company_id: seller.company_id,
      author_id: seller.id,
      content: newPostContent.trim(),
      post_type: 'post',
      is_story: isStory,
      expires_at: isStory ? expires : null,
    })
    setNewPostContent('')
    setIsStory(false)
    setNewPostOpen(false)
    setSubmitting(false)
    refetchPosts()
  }

  async function toggleReaction(postId: string, emoji: string) {
    if (!seller) return
    const existing = (reactions ?? []).find(
      r => r.post_id === postId && r.seller_id === seller.id && r.emoji === emoji
    )
    if (existing) {
      await supabase.from('mural_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('mural_reactions').insert({
        company_id: seller.company_id,
        post_id: postId,
        seller_id: seller.id,
        emoji,
      })
    }
    refetchReactions()
    setPickerPostId(null)
  }

  async function submitComment(postId: string) {
    const text = commentInputs[postId]?.trim()
    if (!text || !seller) return
    setSubmittingComment(postId)
    await supabase.from('mural_comments').insert({
      company_id: seller.company_id,
      post_id: postId,
      author_id: seller.id,
      content: text,
    })
    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    setSubmittingComment(null)
    refetchComments()
  }

  function toggleComments(postId: string) {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper size={18} className="text-[#3B5BDB]" />
            <h1 className="text-xl font-semibold text-gray-900">Mural</h1>
          </div>
          <button
            onClick={() => setNewPostOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3B5BDB] text-white text-sm font-medium hover:bg-[#3451c7] transition-colors"
          >
            <Plus size={15} />
            Nova publicação
          </button>
        </div>

        {/* ── Stories ── */}
        {stories && stories.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Stories
            </p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {stories.map(story => {
                const author = sellerMap.get(story.author_id)
                const name = author?.name ?? 'Desconhecido'
                return (
                  <button
                    key={story.id}
                    onClick={() => setStoryModal(story)}
                    className="flex flex-col items-center gap-1.5 min-w-[56px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#EEF2FF] border-2 border-[#3B5BDB] flex items-center justify-center text-sm font-semibold text-[#3B5BDB]">
                      {initials(name)}
                    </div>
                    <span className="text-[10px] text-gray-600 truncate w-12 text-center">
                      {name.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Feed ── */}
        {postsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center">
            <Newspaper size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Nenhuma publicação ainda</p>
            <p className="text-xs text-gray-300 mt-1">Seja o primeiro a publicar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => {
              const author = sellerMap.get(post.author_id)
              const name = author?.name ?? 'Desconhecido'
              const role = author?.role ?? ''
              const postReactions = groupReactions(
                reactions ?? [],
                post.id,
                seller?.id ?? ''
              )
              const postComments = commentsByPost[post.id] ?? []
              const isExpanded = expandedComments.has(post.id)
              const isPicker = pickerPostId === post.id

              return (
                <div key={post.id} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
                  {/* Author */}
                  <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF2FF] flex items-center justify-center text-xs font-semibold text-[#3B5BDB] shrink-0">
                      {initials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-[11px] text-gray-400">
                        {roleLabel(role)} · {timeAgo(post.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>

                  {/* Image */}
                  {post.image_url && (
                    <div className="px-5 pb-4">
                      <img
                        src={post.image_url}
                        alt=""
                        className="w-full rounded-lg object-cover"
                        style={{ maxHeight: 300 }}
                      />
                    </div>
                  )}

                  {/* Reactions + Comments count */}
                  <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-t border-[#F9FAFB] pt-3">
                    {/* Existing reactions */}
                    {postReactions.map(({ emoji, count, hasReacted }) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          hasReacted
                            ? 'bg-[#EEF2FF] border-[#3B5BDB] text-[#3B5BDB]'
                            : 'bg-gray-50 border-[#E5E7EB] text-gray-600 hover:border-[#3B5BDB] hover:text-[#3B5BDB]'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="tabular-nums">{count}</span>
                      </button>
                    ))}

                    {/* Add reaction picker */}
                    <div className="relative" ref={isPicker ? pickerRef : undefined}>
                      <button
                        onClick={() => setPickerPostId(isPicker ? null : post.id)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 border border-[#E5E7EB] hover:border-[#3B5BDB] hover:text-[#3B5BDB] transition-colors text-sm"
                        aria-label="Adicionar reação"
                      >
                        +
                      </button>
                      {isPicker && (
                        <div className="absolute bottom-9 left-0 z-10 bg-white border border-[#E5E7EB] rounded-xl p-2 flex gap-1 shadow-sm">
                          {REACTION_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(post.id, emoji)}
                              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF2FF] transition-colors text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Comment toggle */}
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#3B5BDB] transition-colors"
                    >
                      <MessageCircle size={13} />
                      {postComments.length > 0
                        ? `${postComments.length} comentário${postComments.length > 1 ? 's' : ''}`
                        : 'Comentar'}
                    </button>
                  </div>

                  {/* Comments section (expandable) */}
                  {isExpanded && (
                    <div className="border-t border-[#F3F4F6] bg-[#FAFAF9] px-5 py-4 space-y-3">
                      {/* Comment list */}
                      {postComments.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">
                          Nenhum comentário ainda
                        </p>
                      ) : (
                        postComments.map(comment => {
                          const cAuthor = sellerMap.get(comment.author_id)
                          const cName = cAuthor?.name ?? 'Desconhecido'
                          return (
                            <div key={comment.id} className="flex gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[10px] font-semibold text-[#3B5BDB] shrink-0 mt-0.5">
                                {initials(cName)}
                              </div>
                              <div className="flex-1 bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 min-w-0">
                                <div className="flex items-baseline gap-1.5 mb-0.5">
                                  <span className="text-xs font-medium text-gray-800">{cName}</span>
                                  <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
                                </div>
                                <p className="text-xs text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {/* Comment input */}
                      <div className="flex gap-2 pt-1">
                        <div className="w-7 h-7 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[10px] font-semibold text-[#3B5BDB] shrink-0 mt-0.5">
                          {seller ? initials(seller.name) : '?'}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={commentInputs[post.id] ?? ''}
                            onChange={e =>
                              setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                submitComment(post.id)
                              }
                            }}
                            placeholder="Escrever comentário..."
                            disabled={submittingComment === post.id}
                            className="flex-1 text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 placeholder-gray-400 disabled:opacity-50"
                          />
                          <button
                            onClick={() => submitComment(post.id)}
                            disabled={!commentInputs[post.id]?.trim() || submittingComment === post.id}
                            className="p-2 rounded-lg bg-[#3B5BDB] text-white hover:bg-[#3451c7] disabled:opacity-40 transition-colors"
                            aria-label="Enviar comentário"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Nova publicação ── */}
      {newPostOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setNewPostOpen(false) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-sm overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
              <h2 className="text-base font-semibold text-gray-900">Nova publicação</h2>
              <button
                onClick={() => setNewPostOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder="O que você quer compartilhar com a equipe?"
                rows={5}
                className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-3 outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 placeholder-gray-400 resize-none"
              />

              {/* Story toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-[#FAFAF9] rounded-xl border border-[#E5E7EB]">
                <div>
                  <p className="text-sm font-medium text-gray-700">Publicar como Story</p>
                  <p className="text-xs text-gray-400">Expira em 24 horas</p>
                </div>
                <button
                  onClick={() => setIsStory(prev => !prev)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${isStory ? 'bg-[#3B5BDB]' : 'bg-gray-200'}`}
                  role="switch"
                  aria-checked={isStory}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isStory ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-5">
              <button
                onClick={submitPost}
                disabled={!newPostContent.trim() || submitting}
                className="w-full py-2.5 rounded-xl bg-[#3B5BDB] text-white text-sm font-medium hover:bg-[#3451c7] disabled:opacity-40 transition-colors"
              >
                {submitting ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Story ── */}
      {storyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setStoryModal(null) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center text-xs font-semibold text-[#3B5BDB] shrink-0">
                  {initials(sellerMap.get(storyModal.author_id)?.name ?? '?')}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {sellerMap.get(storyModal.author_id)?.name ?? 'Desconhecido'}
                  </p>
                  <p className="text-[11px] text-gray-400">Story · {timeAgo(storyModal.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setStoryModal(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Fechar story"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-6">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {storyModal.content}
              </p>
              {storyModal.image_url && (
                <img
                  src={storyModal.image_url}
                  alt=""
                  className="mt-4 w-full rounded-xl object-cover"
                  style={{ maxHeight: 280 }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
