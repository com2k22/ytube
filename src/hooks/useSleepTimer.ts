import { useCallback, useEffect, useRef, useState } from 'react';

/** Các lựa chọn hẹn giờ ngủ trong trình phát điện thoại (UI_SPEC.md mục 9) — cố ý TÁCH RIÊNG
    khỏi giới hạn giờ xem của bố mẹ (useTimeGate/useTempUnlock): đây chỉ là tiện ích cho bé tự
    đặt "nghe xong đoạn này thì tắt", không đụng gì tới hạn mức/khung giờ bố mẹ đã đặt — hết
    hẹn giờ ngủ thì chỉ tạm dừng video, KHÔNG tính là "hết giờ xem". */
export type SleepTimerOption = 'off' | 15 | 30 | 45 | 60 | 'end_of_video';

interface Options {
  /** Gọi khi hẹn giờ (15/30/45/60 phút) đến hạn — trình phát nên tạm dừng. */
  onExpire: () => void;
}

/**
 * useSleepTimer — bộ đếm hẹn giờ ngủ thuần phía trình duyệt (setTimeout), không ảnh hưởng gì
 * tới useTimeGate/useWatchCountdown/useWatchStretch (giới hạn giờ xem của bố mẹ) hay
 * useWatchSession (phiên xem cho Báo cáo tuần) — 3 hệ thống đó KHÔNG đổi gì khi dùng hẹn giờ
 * ngủ. Lựa chọn "Hết video" không đặt bộ đếm gì cả — nơi gọi (MobilePlayerHost) tự nhận biết
 * qua chính `option` để không tự phát video kế tiếp khi video hiện tại kết thúc.
 */
export function useSleepTimer({ onExpire }: Options) {
  const [option, setOption] = useState<SleepTimerOption>('off');
  /** Mốc thời gian (ms, Date.now()) hẹn giờ sẽ đến hạn — dùng để hiện "còn lại bao lâu". */
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setExpiresAt(null);
  }, []);

  const setSleepOption = useCallback(
    (next: SleepTimerOption) => {
      clear();
      setOption(next);
      if (typeof next === 'number') {
        setExpiresAt(Date.now() + next * 60_000);
        timerRef.current = setTimeout(() => {
          onExpireRef.current();
          setOption('off');
          setExpiresAt(null);
        }, next * 60_000);
      }
    },
    [clear]
  );

  useEffect(() => () => clear(), [clear]);

  return { option, expiresAt, setSleepOption };
}
