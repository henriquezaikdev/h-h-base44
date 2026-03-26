import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface SellerRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  department?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
}

export function useSellersData() {
  const { data: sellers = [], isLoading: loading } = useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching sellers:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  return { sellers, loading };
}
