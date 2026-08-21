import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AllowedSource, SourceType } from '@/types';

/**
 * Đọc & thêm nguồn nội dung (playlist / kênh / video lẻ / link trực tiếp).
 *
 * `scope` quyết định lấy dữ liệu gì:
 * - 1 profile id thật (uuid) → nội dung riêng của bé đó CỘNG nội dung dùng chung
 *   (profile_id = NULL) — dùng ở Trang chủ.
 * - 'all' → TOÀN BỘ nội dung của cả nhà (không lọc theo bé) — dùng ở tab
 *   "Thêm nội dung" trong khu Bố mẹ, để phụ huynh thấy/sửa/xoá mọi thứ 1 chỗ.
 * - null → chưa sẵn sàng (chưa chọn hồ sơ), trả về danh sách rỗng.
 */
export function useAllowedSources(scope: string | 'all' | null) {
  const [sources, setSources] = useState<AllowedSource[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!scope) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from('allowed_sources').select('*').order('created_at', { ascending: false });
    if (scope !== 'all') {
      query = query.or(`profile_id.eq.${scope},profile_id.is.null`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[Ytube] Không tải được whitelist:', error.message);
      setLoading(false);
      return;
    }
    setSources(data ?? []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addSource = async (input: {
    /** null = dùng chung cho cả 2 bé. */
    profileId: string | null;
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

  const updateSource = async (
    id: string,
    input: { profileId: string | null; type: SourceType; title: string; url: string; thumbnail?: string | null }
  ) => {
    const { error } = await supabase
      .from('allowed_sources')
      .update({
        profile_id: input.profileId,
        type: input.type,
        title: input.title,
        url: input.url,
        thumbnail: input.thumbnail ?? null,
      })
      .eq('id', id);
    if (error) {
      console.error('[Ytube] Không sửa được nguồn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  return { sources, loading, addSource, updateSource, removeSource, refresh };
}
