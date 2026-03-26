import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface CoinTransaction {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  reason: string;
  note: string | null;
  created_at: string;
  from_seller?: { name: string };
}

export interface Medal {
  id: string;
  code: string;
  name: string;
  tier: 'BRONZE' | 'PRATA' | 'OURO';
  description: string;
}

export interface UserMedal {
  id: string;
  medal_id: string;
  earned_at: string;
  context_json: any;
  medal?: Medal;
}

export function useCoinsAndMedals(targetSellerId?: string) {
  const { seller } = useAuth();
  const sellerId = targetSellerId || seller?.id;

  const [balance, setBalance] = useState(0);
  const [coins7d, setCoins7d] = useState(0);
  const [coins30d, setCoins30d] = useState(0);
  const [medals, setMedals] = useState<(UserMedal & { medal: Medal })[]>([]);
  const [recentCoins, setRecentCoins] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [coinsGivenToday, setCoinsGivenToday] = useState(0);

  const fetchData = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      // Balance
      const { data: balData } = await supabase
        .from('user_coin_balance')
        .select('balance')
        .eq('user_id', sellerId)
        .maybeSingle();
      setBalance(balData?.balance || 0);

      // Coins received 7d/30d
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

      const { count: c7 } = await supabase
        .from('coin_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', sellerId)
        .gte('created_at', d7);
      setCoins7d(c7 || 0);

      const { count: c30 } = await supabase
        .from('coin_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', sellerId)
        .gte('created_at', d30);
      setCoins30d(c30 || 0);

      // Recent coins received (last 10)
      const { data: recentData } = await supabase
        .from('coin_transactions')
        .select('id, from_user_id, to_user_id, amount, reason, note, created_at')
        .eq('to_user_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentCoins(recentData || []);

      // User medals
      const { data: medalData } = await supabase
        .from('user_medals')
        .select('id, medal_id, earned_at, context_json, medals(id, code, name, tier, description)')
        .eq('user_id', sellerId)
        .order('earned_at', { ascending: false });

      const formatted = (medalData || []).map((um: any) => ({
        ...um,
        medal: um.medals,
      }));
      setMedals(formatted);

      // Coins given today by current user (for limit tracking)
      if (seller?.id) {
        const today = new Date().toISOString().split('T')[0];
        const { count: givenToday } = await supabase
          .from('coin_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('from_user_id', seller.id)
          .eq('day_key', today);
        setCoinsGivenToday(givenToday || 0);
      }
    } catch (err) {
      console.error('Error fetching coins/medals:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerId, seller?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    balance,
    coins7d,
    coins30d,
    medals,
    recentCoins,
    loading,
    coinsGivenToday,
    refetch: fetchData,
  };
}
