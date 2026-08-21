import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AllowedSource, SourceType } from '@/types';

/** Đọc & thêm nguồn nội dung (playlist / kênh / video lẻ / link trực tiếp) cho 1 hồ sơ. */
export function useAllowedSources(profileId: string | null) {
  const [sources, setSources] = useState<AllowedSource[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('allowed_sources')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Ytube] Không tải được whitelist:', error.message);
      setLoading(false);
      return;
    }
    setSources(data ?? []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addSource = async (input: {
    profileId: string;
    type: SourceType;
    title: string;
    url: string;
    thumbnail?: string | null;
  }) => {
    const { error } = await supabase.from('allowed_sources').insert({
      profile_id: input.profileId,
      type: input.type,
      title: input.title,
      url: input.url,
      thumbnail: input.thumbnail ?? null,
    });
    if (error) {
      console.error('[Ytube] Không thêm được nguồn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  const removeSource = async (id: string) => {
    const { error } = await supabase.from('allowed_sources').delete().eq('id', id);
    if (error) {
      console.error('[Ytube] Không xoá được nguồn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  return { sources, loading, addSource, removeSource, refresh };
}
