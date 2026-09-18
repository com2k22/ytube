import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PlayerEngineParams } from '@/hooks/usePlayerEngine';

interface MobilePlaybackContextValue {
  /** null = trình phát nổi đang đóng (chưa phát gì / bé đã bấm đóng). */
  nowPlaying: PlayerEngineParams | null;
  /** Bắt đầu phát 1 video MỚI trong trình phát nổi. Các trang điện thoại (Trang chủ, chi
      tiết playlist, Khám phá...) gọi hàm này rồi mới điều hướng sang `/player` — nhờ vậy
      MobilePlayerHost đã có sẵn dữ liệu để vẽ TOÀN MÀN HÌNH ngay khi trang /player mở ra,
      không phải chờ round-trip nào. */
  playVideo: (params: PlayerEngineParams) => void;
  /** Đổi sang video khác TRONG PHIÊN ĐANG PHÁT (chuyển bài kế/trước, chọn bài trong danh
      sách chờ của mini player) — không điều hướng trang, trình phát tự vẽ lại theo state mới
      (xem usePlayerEngine.goToVideo, dùng chung với TV/desktop). */
  updateNowPlaying: (params: PlayerEngineParams) => void;
  /** Dừng hẳn + đóng trình phát nổi — bé bấm nút đóng ở mini player, hoặc phiên xem bị bố mẹ
      kết thúc từ xa (xem usePlayerEngine — onExit). */
  closePlayer: () => void;
}

const MobilePlaybackContext = createContext<MobilePlaybackContextValue | undefined>(undefined);

/**
 * MobilePlaybackProvider — giữ "đang phát video nào" ở NGOÀI router (mount trong Layout.tsx,
 * bao quanh `<Outlet/>`), để chuyển trang trên điện thoại không làm tắt video đang phát —
 * xem MobilePlayerHost (nơi thật sự vẽ trình phát) + kiến trúc "1 trình phát duy nhất" trong
 * plan nâng cấp giao diện điện thoại. Trên TV/iPad/máy tính, provider này vẫn bọc quanh app
 * (đặt chung 1 chỗ cho gọn) nhưng vô hại — PlayerPage (TV/desktop) không đọc/ghi context này,
 * chỉ điện thoại mới dùng (xem `useIsPhoneScreen()` ở nơi gọi `playVideo`).
 */
export function MobilePlaybackProvider({ children }: { children: ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<PlayerEngineParams | null>(null);

  const playVideo = useCallback((params: PlayerEngineParams) => setNowPlaying(params), []);
  const updateNowPlaying = useCallback((params: PlayerEngineParams) => setNowPlaying(params), []);
  const closePlayer = useCallback(() => setNowPlaying(null), []);

  const value = useMemo<MobilePlaybackContextValue>(
    () => ({ nowPlaying, playVideo, updateNowPlaying, closePlayer }),
    [nowPlaying, playVideo, updateNowPlaying, closePlayer]
  );

  return <MobilePlaybackContext.Provider value={value}>{children}</MobilePlaybackContext.Provider>;
}

export function useMobilePlayback(): MobilePlaybackContextValue {
  const ctx = useContext(MobilePlaybackContext);
  if (!ctx) throw new Error('useMobilePlayback phải được gọi bên trong MobilePlaybackProvider');
  return ctx;
}
