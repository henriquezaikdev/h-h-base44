import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Camera, Image as ImageIcon, X, Loader2, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Status {
  id: string;
  autor_id: string;
  texto: string | null;
  imagem_url: string | null;
  created_at: string;
  expires_at: string;
}

interface UserWithStatus {
  id: string;
  name: string;
  avatar_url: string | null;
  statuses: Status[];
  hasActive: boolean;
  level: number;
  xp_total: number;
}

export function ProfileStoriesBar() {
  const { seller } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewUser, setViewUser] = useState<UserWithStatus | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newText, setNewText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const fetchStatuses = useCallback(async () => {
    const now = new Date().toISOString();

    const [statusRes, sellersRes] = await Promise.all([
      supabase.from('hh_mural_status').select('*').gte('expires_at', now).order('created_at', { ascending: false }),
      supabase.from('sellers').select('id, name, avatar_url, level, xp_total').eq('status', 'ATIVO').order('name'),
    ]);

    const statuses = statusRes.data || [];
    const allSellers = sellersRes.data || [];

    const grouped: Record<string, Status[]> = {};
    statuses.forEach((s: Status) => {
      if (!grouped[s.autor_id]) grouped[s.autor_id] = [];
      grouped[s.autor_id].push(s);
    });

    const result: UserWithStatus[] = [];

    if (seller) {
      const sellerData = allSellers.find((s: { id: string }) => s.id === seller.id);
      result.push({
        id: seller.id,
        name: seller.name,
        avatar_url: seller.avatar_url || null,
        statuses: grouped[seller.id] || [],
        hasActive: !!(grouped[seller.id]?.length),
        level: sellerData?.level || 1,
        xp_total: sellerData?.xp_total || 0,
      });
    }

    const withStatus: UserWithStatus[] = [];
    const withoutStatus: UserWithStatus[] = [];

    allSellers.forEach((s: { id: string; name: string; avatar_url: string | null; level: number; xp_total: number }) => {
      if (s.id === seller?.id) return;
      const userStatuses = grouped[s.id] || [];
      const entry: UserWithStatus = {
        id: s.id,
        name: s.name,
        avatar_url: s.avatar_url || null,
        statuses: userStatuses,
        hasActive: userStatuses.length > 0,
        level: s.level || 1,
        xp_total: s.xp_total || 0,
      };
      if (userStatuses.length > 0) withStatus.push(entry);
      else withoutStatus.push(entry);
    });

    result.push(...withStatus, ...withoutStatus);
    setUsers(result);
    setLoading(false);
  }, [seller]);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  useEffect(() => {
    const channel = supabase
      .channel('profile-stories-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hh_mural_status' }, () => { fetchStatuses(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStatuses]);

  const handleCreateStatus = async () => {
    if (!seller?.id || (!newText.trim() && !imageFile)) return;
    setPosting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const path = `status/${seller.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('mural').upload(path, imageFile, { contentType: imageFile.type });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('mural').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from('hh_mural_status').insert({
        autor_id: seller.id,
        texto: newText.trim() || null,
        imagem_url: imageUrl,
      });
      if (error) throw error;
      setNewText(''); setImageFile(null); setImagePreview(null); setShowCreate(false);
      toast.success('Status publicado!');
      fetchStatuses();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao publicar status');
    } finally { setPosting(false); }
  };

  const handleImageSelect = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Maximo 5MB.'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleBubbleClick = (user: UserWithStatus) => {
    if (user.id === seller?.id && !user.hasActive) {
      setShowCreate(true);
    } else if (user.hasActive) {
      setViewUser(user);
      setViewIndex(0);
    } else {
      navigate(`/perfil-vendedor/${user.id}`);
    }
  };

  const handleGoToProfile = (userId: string) => {
    setViewUser(null);
    navigate(`/perfil-vendedor/${userId}`);
  };

  if (loading) {
    return (
      <div className="flex gap-3 py-2 px-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-full bg-muted/40 animate-pulse" />
            <div className="w-10 h-2 bg-muted/30 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ScrollArea className="w-full">
        <div className="flex gap-3 py-1.5 px-0.5">
          {users.map((user) => {
            const isSelf = user.id === seller?.id;
            return (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <button
                    className="flex flex-col items-center gap-1 shrink-0 group outline-none"
                    onClick={() => handleBubbleClick(user)}
                  >
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-full p-[2.5px] transition-all duration-300 ${
                        user.hasActive
                          ? 'bg-gradient-to-br from-primary via-primary/70 to-accent shadow-sm shadow-primary/15'
                          : 'bg-border/60 group-hover:bg-border'
                      }`}>
                        <Avatar className="w-full h-full border-[2.5px] border-background">
                          <AvatarImage src={user.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-muted text-muted-foreground text-[11px] font-semibold">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      {isSelf && !user.hasActive && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background shadow-sm">
                          <Plus className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground max-w-14 truncate font-medium leading-tight">
                      {isSelf ? 'Voce' : user.name.split(' ')[0]}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-muted-foreground">Nivel {user.level} - {user.xp_total.toLocaleString('pt-BR')} XP</p>
                  {user.hasActive && <p className="text-primary">Status ativo</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />

        {/* View Status Dialog */}
        <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
          <DialogContent className="max-w-sm p-0 overflow-hidden bg-gray-950 border-0 rounded-2xl">
            <DialogTitle className="sr-only">Status de {viewUser?.name}</DialogTitle>
            {viewUser && viewUser.statuses[viewIndex] && (
              <div className="relative min-h-[450px] flex flex-col">
                {/* Progress bars */}
                <div className="flex gap-1 p-3 pb-0">
                  {viewUser.statuses.map((_, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        i <= viewIndex ? 'w-full bg-white' : 'w-0'
                      }`} />
                    </div>
                  ))}
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9 ring-2 ring-white/20">
                    <AvatarImage src={viewUser.avatar_url || undefined} />
                    <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">
                      {getInitials(viewUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{viewUser.name}</p>
                    <p className="text-white/40 text-[10px] flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(viewUser.statuses[viewIndex].created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:text-white hover:bg-white/10 rounded-full text-[10px] gap-1"
                    onClick={() => handleGoToProfile(viewUser.id)}
                  >
                    <ExternalLink className="h-3 w-3" /> Perfil
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setViewUser(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-center p-6">
                  {viewUser.statuses[viewIndex].imagem_url && (
                    <img
                      src={viewUser.statuses[viewIndex].imagem_url!}
                      alt="Status"
                      className="max-w-full max-h-[300px] rounded-xl object-contain"
                    />
                  )}
                  {viewUser.statuses[viewIndex].texto && (
                    <p className="text-white text-center text-xl font-medium px-4 leading-relaxed">
                      {viewUser.statuses[viewIndex].texto}
                    </p>
                  )}
                </div>

                {/* Navigation areas */}
                <div className="absolute inset-0 top-24 flex">
                  <button className="w-1/2 h-full" onClick={() => {
                    if (viewIndex > 0) setViewIndex(viewIndex - 1);
                    else setViewUser(null);
                  }} />
                  <button className="w-1/2 h-full" onClick={() => {
                    if (viewIndex < viewUser.statuses.length - 1) setViewIndex(viewIndex + 1);
                    else setViewUser(null);
                  }} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Status Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogTitle className="text-base font-semibold">Criar Status</DialogTitle>
            <div className="space-y-4">
              <Textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="O que esta acontecendo? (expira em 24h)"
                className="resize-none min-h-[80px] rounded-xl"
                maxLength={500}
              />
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-40 rounded-xl object-cover" />
                  <Button variant="destructive" size="icon" className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files?.[0] || null)} />
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files?.[0] || null)} />
                  <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="rounded-xl text-xs gap-1.5 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" /> Imagem
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => cameraRef.current?.click()} className="rounded-xl text-xs gap-1.5 text-muted-foreground md:hidden">
                    <Camera className="h-4 w-4" /> Camera
                  </Button>
                </div>
                <Button size="sm" onClick={handleCreateStatus} disabled={posting || (!newText.trim() && !imageFile)}
                  className="rounded-xl text-xs px-4">
                  {posting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Publicar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Seu status expira automaticamente em 24 horas
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </ScrollArea>
    </TooltipProvider>
  );
}
