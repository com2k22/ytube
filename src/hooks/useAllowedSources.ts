import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';
import type { AllowedSource, CustomPlaylistItem, SourceType } from '@/types';

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
    const familyId = getFamilyId();
    if (!familyId) {
      // Chưa "thiết lập lần đầu" (xem src/lib/familyId.ts) → chưa biết lấy của gia đình
      // nào, trả về rỗng thay vì lỡ lấy lẫn của gia đình khác.
      setSources([]);
      setLoading(false);
      return;
    }
    let query = supabase
      .from('allowed_sources')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });
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
    /** Chỉ cần khi type = 'custom_playlist'. */
    items?: CustomPlaylistItem[];
    /** id các nhãn đã gán (xem useContentLabels.ts) — bỏ trống = chưa gán nhãn nào. */
    labelIds?: string[];
  }) => {
    const { error } = await supabase.from('allowed_sources').insert({
      profile_id: input.profileId,
      type: input.type,
      title: input.title,
      url: input.url,
      thumbnail: input.thumbnail ?? null,
      items: input.items ?? [],
      label_ids: input.labelIds ?? [],
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
    input: {
      profileId: string | null;
      type: SourceType;
      title: string;
      url: string;
      thumbnail?: string | null;
      /** Chỉ cần khi type = 'custom_playlist'. */
      items?: CustomPlaylistItem[];
      /** id các nhãn đã gán (xem useContentLabels.ts) — bỏ trống = xoá hết nhãn đang gán. */
      labelIds?: string[];
    }
  ) => {
    const { error } = await supabase
      .from('allowed_sources')
      .update({
        profile_id: input.profileId,
        type: input.type,
        title: input.title,
        url: input.url,
        thumbnail: input.thumbnail ?? null,
        items: input.items ?? [],
        label_ids: input.labelIds ?? [],
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
