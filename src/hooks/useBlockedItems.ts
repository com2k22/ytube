import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';
import type { BlockedItem, BlockedItemType } from '@/types';

/**
 * useBlockedItems — đọc & quản lý danh sách playlist/video YouTube bị phụ huynh CHỦ ĐỘNG
 * chặn thủ công (xem supabase/018_blocked_items.sql). Dùng khi 1 kênh đã whitelist có
 * playlist "lạc nguồn" (kênh tự gộp video của kênh khác vào) mà không muốn chặn hẳn cả
 * kênh — chỉ ẩn riêng đúng playlist/video đó ở mọi nơi hiển thị (xem ChannelPage.tsx,
 * PlaylistVideosView.tsx).
 *
 * ĐỌC mở cho mọi thiết bị (kể cả TV/điện thoại của bé chưa đăng nhập) để tự lọc được —
 * chỉ THÊM/XOÁ mới cần đã đăng nhập đúng gia đình (xem RLS trong file SQL).
 */
export function useBlockedItems() {
  const [items, setItems] = useState<BlockedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const familyId = getFamilyId();
    if (!familyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('blocked_items')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Ytube] Không tải được danh sách chặn:', error.message);
      setLoading(false);
      return;
    }
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Chặn thêm 1 playlist/video mới — trả về false nếu lỗi (VD: đã chặn đúng mục này rồi). */
  const addBlockedItem = async (input: { itemType: BlockedItemType; itemId: string; title?: string | null }) => {
    const { error } = await supabase.from('blocked_items').insert({
      item_type: input.itemType,
      item_id: input.itemId,
      title: input.title ?? null,
    });
    if (error) {
      console.error('[Ytube] Không thêm được vào danh sách chặn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  const removeBlockedItem = async (id: string) => {
    const { error } = await supabase.from('blocked_items').delete().eq('id', id);
    if (error) {
      console.error('[Ytube] Không bỏ chặn được:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  /** ID (playlistId hoặc videoId) đang bị chặn, đúng loại — dùng để lọc nhanh 1 danh sách hiển thị. */
  const blockedIdsOfType = (type: BlockedItemType): Set<string> =>
    new Set(items.filter((it) => it.item_type === type).map((it) => it.item_id));

  return { items, loading, addBlockedItem, removeBlockedItem, refresh, blockedIdsOfType };
}
