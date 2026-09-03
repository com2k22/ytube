import { useEffect, useRef, useState } from 'react';
import { useTimeGate } from './useTimeGate';
import { useTempUnlock } from './useTempUnlock';
import { useProfileContext } from '@/context/ProfileContext';
import {
  COUNTDOWN_VISIBLE_SECONDS,
  VOICE_REMINDER_SECONDS,
  fallbackText,
  pickScenario,
  requestVoiceReminder,
  speakWithBrowser,
  stopBrowserSpeech,
} from '@/lib/voiceReminder';

/** 'warn' = còn 1–2 phút (vàng); 'critical' = còn dưới 1 phút (đỏ). */
export type CountdownLevel = 'warn' | 'critical';

export interface WatchCountdown {
  /** Số giây còn lại của hạn mức hôm nay. null = không giới hạn / chưa tính được. */
  secondsLeft: number | null;
  /** Có nên hiện đồng hồ đếm ngược lên màn hình không (chỉ khi còn ≤ 2 phút). */
  visible: boolean;
  level: CountdownLevel;
  /** Tỉ lệ 0→1 của vòng tròn tiến trình (1 = vừa chạm mốc 2 phút, 0 = hết giờ). */
  progress: number;
}

/**
 * useWatchCountdown — đếm ngược thời gian xem còn lại của HÔM NAY, và đến mốc còn 1 phút
 * thì phát 1 câu nhắc BẰNG GIỌNG NÓI.
 *
 * Cố ý CHỈ có tiếng, không hiện chữ câu nhắc lên màn hình: đang xem phim mà bị chèn một
 * dòng chữ to giữa hình thì rất khó chịu. Phần nhìn duy nhất là đồng hồ đếm ngược nhỏ ở
 * góc, còn lời nhắc thì bé nghe.
 *
 * Vì sao phải tự đếm từng giây thay vì đọc thẳng số từ máy chủ: số ở máy chủ
 * (useTimeGate → useDailyWatchUsage) chỉ làm tươi mỗi 30 giây và tính theo PHÚT chẵn, hiện
 * thẳng lên thì đồng hồ đứng im 30 giây rồi tụt một phát — nhìn rất kỳ. Ở đây lấy số của
 * máy chủ làm mốc rồi tự trừ dần mỗi giây cho mượt.
 *
 * Quy tắc đồng bộ lại (quan trọng, tránh đồng hồ nhảy giật):
 *  - Máy chủ nói CÒN ÍT HƠN số đang đếm → tin máy chủ ngay (thà nhắc sớm còn hơn nhắc muộn).
 *  - Máy chủ nói CÒN NHIỀU HƠN hẳn 2 phút → cũng tin (bố mẹ vừa nới giờ, hoặc sang ngày mới).
 *  - Còn lại → giữ nguyên số đang đếm, để đồng hồ chỉ đi xuống chứ không nhảy ngược lên.
 */
export function useWatchCountdown(): WatchCountdown {
  const { dailyLimitMinutes, usedMinutes, allowed } = useTimeGate();
  const { expiresAt } = useTempUnlock();
  const { activeProfile } = useProfileContext();

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  /** Số giây còn lại do CHÍNH MÁY NÀY đang đếm — tách khỏi state để bộ đếm không phải dựng lại mỗi giây. */
  const localRef = useRef<number | null>(null);
  /** Đã nhắc bằng giọng nói cho lượt này chưa — để không nhắc lặp lại mỗi giây. */
  const spokeRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Lấy mốc từ máy chủ ---
  useEffect(() => {
    // daily_minutes = 0 nghĩa là KHÔNG giới hạn tổng thời gian → không có gì để đếm ngược.
    if (!dailyLimitMinutes || dailyLimitMinutes <= 0) {
      localRef.current = null;
      setSecondsLeft(null);
      return;
    }
    const serverLeft = Math.max(0, (dailyLimitMinutes - usedMinutes) * 60);
    const local = localRef.current;
    if (local === null || serverLeft < local || serverLeft > local + 120) {
      localRef.current = serverLeft;
      setSecondsLeft(serverLeft);
    }
  }, [dailyLimitMinutes, usedMinutes]);

  // --- Tự trừ dần mỗi giây ---
  useEffect(() => {
    if (!dailyLimitMinutes || dailyLimitMinutes <= 0) return;
    const timer = setInterval(() => {
      if (localRef.current === null) return;
      localRef.current = Math.max(0, localRef.current - 1);
      setSecondsLeft(localRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [dailyLimitMinutes]);

  /**
   * Số giây còn lại của SUẤT BỐ MẸ CHO THÊM (bé xin thêm giờ và được duyệt), nếu đang có.
   * null = không có suất nào đang chạy.
   *
   * useTempUnlock tự vẽ lại mỗi giây khi suất này còn hiệu lực, nên đọc thẳng Date.now()
   * ở đây là đủ, không cần thêm bộ đếm riêng.
   */
  const grantSecondsLeft = expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

  /**
   * Con số THỰC SỰ đem ra đếm ngược. Suất bố mẹ cho thêm được ưu tiên: lúc đó hạn mức
   * ngày đã hết sạch (còn 0 giây), hiện số đó lên thì sai — cái sắp hết là suất được cho.
   */
  const effectiveLeft = grantSecondsLeft ?? secondsLeft;

  // --- Chạm mốc 1 phút: nhắc bằng giọng nói, đúng 1 lần ---
  useEffect(() => {
    const secondsLeft = effectiveLeft;
    if (secondsLeft === null) return;

    // Còn nhiều thời gian trở lại (sang ngày mới, hoặc bố mẹ vừa nới giờ) → dọn sạch để
    // lần sau còn nhắc tiếp được.
    if (secondsLeft > COUNTDOWN_VISIBLE_SECONDS) {
      spokeRef.current = false;
      return;
    }
    if (secondsLeft > VOICE_REMINDER_SECONDS || spokeRef.current) return;

    spokeRef.current = true;
    const name = activeProfile?.name ?? 'con';
    const scenario = pickScenario();

    requestVoiceReminder(name, scenario).then((reminder) => {
      // Không lấy được tiếng từ Google → nhờ giọng đọc sẵn của thiết bị đọc câu viết sẵn.
      if (!reminder.audioUrl) {
        speakWithBrowser(reminder.text || fallbackText(name, scenario));
        return;
      }
      const audio = new Audio(reminder.audioUrl);
      audioRef.current = audio;
      audio.play().catch(() => {
        // Trình duyệt chặn tự phát tiếng → thử nốt đường giọng đọc của thiết bị.
        speakWithBrowser(reminder.text || fallbackText(name, scenario));
      });
    });
  }, [effectiveLeft, activeProfile?.name]);

  // Rời trang phát thì tắt ngay câu đang đọc dở (cả 2 đường: file tiếng và giọng thiết bị).
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
      stopBrowserSpeech();
    },
    []
  );

  // Hiện đồng hồ khi: đang được phép xem bình thường và sắp hết hạn mức ngày, HOẶC đang
  // dùng suất bố mẹ cho thêm và suất đó sắp hết.
  const visible =
    effectiveLeft !== null &&
    effectiveLeft <= COUNTDOWN_VISIBLE_SECONDS &&
    (grantSecondsLeft !== null || allowed);

  return {
    secondsLeft: effectiveLeft,
    visible,
    level: effectiveLeft !== null && effectiveLeft <= VOICE_REMINDER_SECONDS ? 'critical' : 'warn',
    progress: effectiveLeft === null ? 0 : Math.max(0, Math.min(1, effectiveLeft / COUNTDOWN_VISIBLE_SECONDS)),
  };
}
