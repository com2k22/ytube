import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AllowedSource } from '@/types';

/** Lấy 1 nguồn whitelist theo id — dùng ở trang chi tiết playlist / trang phát video. */
export function useSourceById(sourceId: string | null) {
  const [source, setSource] = useState<AllowedSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sourceId) {
      setSource(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('allowed_sources')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[Ytube] Không tải được nguồn:', error.message);
        setSource(data ?? null);
        setLoading(false);
      });
  }, [sourceId]);

  return { source, loading };
}
