import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';
import type { TimeRequest } from '@/types';

/** Số phút bé xin mỗi lần bấm nút. */
export const DEFAULT_REQUEST_MINUTES = 15;
/**
 * Lời xin để lâu quá mà không ai trả lời thì coi như bỏ (bố mẹ bận, không nghe thấy).
 * Có mốc này để sáng hôm sau mở khu Bố mẹ ra không thấy một đống lời xin từ hôm qua.
 */
const REQUEST_EXPIRE_MINUTES = 30;

function isFresh(req: TimeRequest): boolean {
  const age = Date.now() - new Date(req.created_at).getTime();
  return age < REQUEST_EXPIRE_MINUTES * 60_000;
}

/**
 * useTimeRequests — kênh liên lạc 2 chiều giữa TV của bé và điện thoại bố mẹ, cho việc
 * "con xin thêm giờ".
 *
 * Dùng ở 2 nơi, mỗi nơi lấy một phần khác nhau:
 *  • Ở TV (màn hình chặn): gọi `createRequest()` để gửi lời xin, rồi theo dõi `myRequest`
 *    để biết bố mẹ đã trả lời chưa.
 *  • Ở khu Bố mẹ: đọc `pending` để hiện danh sách lời xin đang chờ, gọi `approve()` /
 *    `deny()` để trả lời.
 *
 * Cả 2 phía cùng lắng nghe Realtime của Supabase nên không bên nào phải bấm tải lại —
 * đúng cơ chế đã dùng cho thẻ "TV đang xem gì" (xem useWatchSession).
 */
export function useTimeRequests(profileId: string | null) {
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  /** Lời xin vừa gửi từ chính máy này — để màn hình chặn biết mà hiện "đang chờ...". */
  const [myRequestId, setMyRequestId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const familyId = getFamilyId();
    if (!familyId) {
      setLoading(false);
      return;
    }
    const since = new Date(Date.now() - REQUEST_EXPIRE_MINUTES * 60_000).toISOString();
    const { data, error } = await supabase
      .from('time_requests')
      .select('*')
      .eq('family_id', familyId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (error) {
      // Chưa chạy file SQL 007 thì bảng chưa tồn tại — không phải lỗi chết người, chỉ là
      // tính năng xin thêm giờ chưa dùng được. Ghi log rồi thôi, KHÔNG chặn màn hình.
      console.error('[Ytube] Không đọc được danh sách xin thêm giờ:', error.message);
      setLoading(false);
      return;
    }
    setRequests((data ?? []) as TimeRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Tên kênh phải KHÁC NHAU cho mỗi chỗ dùng: hook này chạy ở 2 nơi cùng lúc (khung sườn
    // của TV và thẻ duyệt trong khu Bố mẹ). Trùng tên thì Supabase coi là một kênh, một
    // trong hai bên sẽ không nhận được tin.
    const channelName = `time_requests_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_requests' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  /** Bé bấm xin. Trả về MÃ SỐ của lời xin vừa tạo, hoặc null nếu gửi hỏng. */
  const createRequest = useCallback(
    async (reason: string | null, minutes = DEFAULT_REQUEST_MINUTES) => {
      if (!profileId) return null;
      const familyId = getFamilyId();
      if (!familyId) return null;
      // Bé xin thêm giờ KHÔNG cần đăng nhập gì cả → phải TỰ truyền family_id (đọc từ thiết
      // bị này đã "thiết lập lần đầu"), không có auth session để DB tự điền như các bảng
      // khác — xem supabase/013_multi_family.sql.
      const { data, error } = await supabase
        .from('time_requests')
        .insert({ profile_id: profileId, family_id: familyId, requested_minutes: minutes, reason, status: 'pending' })
        .select()
        .single();
      if (error) {
        console.error('[Ytube] Không gửi được lời xin thêm giờ:', error.message);
        return null;
      }
      const id = (data as TimeRequest).id;
      setMyRequestId(id);
      await refresh();
      return id;
    },
    [profileId, refresh]
  );

  const resolve = useCallback(
    async (id: string, status: 'approved' | 'denied', grantedMinutes: number | null) => {
      const { error } = await supabase
        .from('time_requests')
        .update({ status, granted_minutes: grantedMinutes, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) console.error('[Ytube] Không trả lời được lời xin:', error.message);
      await refresh();
    },
    [refresh]
  );

  const approve = useCallback((id: string, minutes: number) => resolve(id, 'approved', minutes), [resolve]);
  const deny = useCallback((id: string) => resolve(id, 'denied', null), [resolve]);

  /** Các lời xin còn hạn, đang chờ bố mẹ trả lời (mới nhất trước). */
  const pending = requests.filter((r) => r.status === 'pending' && isFresh(r));

  /** Lời xin mà CHÍNH MÁY NÀY vừa gửi — dùng để hiện trạng thái cho bé xem. */
  const myRequest = myRequestId ? requests.find((r) => r.id === myRequestId) ?? null : null;

  /** Quên lời xin cũ đi (bé bấm xin lại từ đầu, hoặc đã dùng xong suất được cho). */
  const clearMyRequest = useCallback(() => setMyRequestId(null), []);

  return { requests, pending, myRequest, loading, createRequest, approve, deny, clearMyRequest };
}
