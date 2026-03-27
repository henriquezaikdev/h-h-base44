import { useNavigate } from 'react-router-dom'
import { Newspaper } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery'

interface Post {
  id: string
  author_id: string
  content: string
  created_at: string
}

interface SellerInfo {
  id: string
  name: string
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'agora'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dias`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

export function MuralWidget() {
  const navigate = useNavigate()

  const { data: posts, loading } = useSupabaseQuery<Post[]>(
    ({ company_id }) =>
      supabase
        .from('mural_posts')
        .select('id, author_id, content, created_at')
        .eq('company_id', company_id)
        .or('is_story.is.null,is_story.eq.false')
        .order('created_at', { ascending: false })
        .limit(3),
    []
  )

  const { data: sellers } = useSupabaseQuery<SellerInfo[]>(
    ({ company_id }) =>
      supabase
        .from('sellers')
        .select('id, name')
        .eq('company_id', company_id)
        .eq('active', true),
    []
  )

  const sellerMap = new Map((sellers ?? []).map(s => [s.id, s.name]))

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Mural
          </span>
        </div>
        <button
          onClick={() => navigate('/mural')}
          className="text-xs text-[#3B5BDB] hover:underline"
        >
          Ver tudo
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && (!posts || posts.length === 0) && (
        <p className="text-sm text-gray-400 text-center py-4">
          Nenhuma publicação ainda
        </p>
      )}

      {/* Posts */}
      {!loading && posts && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map(post => {
            const authorName = sellerMap.get(post.author_id) ?? 'Desconhecido'
            const excerpt = post.content.length > 80
              ? post.content.slice(0, 80) + '…'
              : post.content
            return (
              <div key={post.id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[10px] font-semibold text-[#3B5BDB] shrink-0">
                  {initials(authorName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-800 truncate">
                      {authorName}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{excerpt}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
