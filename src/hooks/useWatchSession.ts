import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { WatchSession } from '@/types';

/**
 * useWatchSession — theo dõi & điều khiển phiên xem hiện tại của 1 hồ sơ theo thời gian
 * thực (Supabase Realtime), để trang "Bố mẹ" mở trên iPad có thể thấy ngay TV đang phát
 * gì, và bấm "kết thúc phiên" hoặc "xem xong rồi tắt" để điều khiển từ xa.
 *
 * Phía TV: khi bắt đầu phát 1 video, gọi `startSession(...)`; định kỳ gọi `heartbeat(...)`
 * để cập nhật elapsed_seconds; và LẮNG NGHE is_active/end_after_current đổi thành true/false
 * do phụ huynh bấm ở xa để tự dừng phát tương ứng.
 */
export function useWatchSession(profileId: string | null) {
  const [session, setSession] = useState<WatchSession | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase
      .from('watch_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[Ytube] Không tải được phiên xem:', error.message);
      return;
    }
    setSession(data ?? null);
  }, [profileId]);

  useEffect(() => {
    refresh();
    if (!profileId) return;

    // Tên kênh phải KHÁC NHAU cho mỗi chỗ dùng (giống hệt lý do ở useTimeRequests.ts): hook
    // này giờ chạy ở 2 nơi CÙNG LÚC cho CÙNG 1 bé trên điện thoại — trình phát nổi
    // (MobilePlayerHost, sống xuyên suốt lúc chuyển trang) VÀ thẻ "Phiên xem hiện tại"
    // (SessionLiveCard) khi bố mẹ mở Khu vực Bố mẹ ngay trên chính điện thoại đang phát.
    // Đặt CHUNG 1 tên kênh (`watch_session_<id>`) thì Supabase coi là 1 kênh — gọi
    // `.subscribe()` lần 2 lên kênh đã tham gia rồi sẽ THẢY LỖI ĐỒNG BỘ (throw, không phải
    // reject promise) ngay trong useEffect, mà app này không có ErrorBoundary nào nên lỗi đó
    // sẽ gỡ bỏ TOÀN BỘ giao diện — đúng lỗi "vào Khu vực Bố mẹ lúc đang phát nhạc thì hiện
    // màn hình đen". Thêm hậu tố ngẫu nhiên là đủ: bộ lọc `filter: profile_id=eq.${profileId}`
    // bên dưới vẫn giữ nguyên, cả 2 nơi vẫn nhận đúng sự kiện đổi phiên xem của bé đó.
    const channelName = `watch_session_${profileId}_${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_sessions', filter: `profile_id=eq.${profileId}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, refresh]);

  const startSession = async (videoTitle: string, sourceId: string | null) => {
    if (!profileId) return;
    const { error } = await supabase.from('watch_sessions').insert({
      profile_id: profileId,
      video_title: videoTitle,
      source_id: sourceId,
      is_active: true,
      end_after_current: false,
      elapsed_seconds: 0,
    });
    if (error) console.error('[Ytube] Không tạo được phiên xem:', error.message);
  };

  const heartbeat = async (elapsedSeconds: number) => {
    if (!session) return;
    await supabase
      .from('watch_sessions')
      .update({ elapsed_seconds: elapsedSeconds, updated_at: new Date().toISOString() })
      .eq('id', session.id);
  };

  const stopNow = async (targetSession?: WatchSession | null) => {
    const target = targetSession ?? session;
    if (!target) return;
    await supabase
      .from('watch_sessions')
      .update({ is_active: false, end_after_current: false, updated_at: new Date().toISOString() })
      .eq('id', target.id);
  };

  const toggleStopAfterCurrent = async (targetSession?: WatchSession | null) => {
    const target = targetSession ?? session;
    if (!target) return;
    await supabase
      .from('watch_sessions')
      .update({ end_after_current: !target.end_after_current, updated_at: new Date().toISOString() })
      .eq('id', target.id);
  };

  return { session, refresh, startSession, heartbeat, stopNow, toggleStopAfterCurrent };
}
