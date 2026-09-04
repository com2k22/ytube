// Nhắc bé bằng GIỌNG NÓI khi sắp hết giờ xem.
//
// Vì sao phải đi vòng qua máy chủ (/api/voice-reminder) chứ không gọi thẳng Google từ
// trình duyệt: gọi thẳng thì KHOÁ API bị lộ trong mã nguồn trang web, ai xem cũng thấy và
// dùng chùa được. Đưa lên máy chủ thì khoá nằm ở biến môi trường trên Vercel, trình duyệt
// chỉ nhận về đúng câu chữ + đoạn tiếng đã đọc sẵn.
//
// Nguyên tắc quan trọng: MỌI lỗi ở đây đều phải "im lặng" với bé. Mạng chậm, hết hạn mức
// Google, khoá sai... đều KHÔNG được hiện lỗi, hiện chữ hay chặn màn hình. Nhắc nhở là
// việc của TIẾNG NÓI, màn hình chỉ có đúng đồng hồ đếm ngược.
//
// Khi không lấy được tiếng từ Google, còn một nước cuối: nhờ chính trình duyệt đọc câu
// viết sẵn (speakWithBrowser bên dưới). Giọng máy đọc sẽ máy móc hơn, nhưng vẫn còn nghe
// được — hơn là im bặt.

/**
 * Khung giờ "về nhà đi tắm rồi làm bài tập" — trong khung này câu nhắc sẽ nói về việc
 * tắm + bài tập; ngoài khung thì chỉ nhắc cho mắt nghỉ ngơi.
 *
 * Chỉ cần sửa 2 con số dưới đây là đổi được khung giờ, không phải sửa chỗ nào khác.
 */
export const HOMEWORK_WINDOW = { startHour: 16, endHour: 18 } as const;

/** Đồng hồ đếm ngược chỉ hiện lên khi thời gian còn lại từng này giây trở xuống (2 phút). */
export const COUNTDOWN_VISIBLE_SECONDS = 120;

/** Mốc phát câu nhắc bằng giọng nói: khi còn đúng 1 phút. */
export const VOICE_REMINDER_SECONDS = 60;

/** Chờ máy chủ tối đa từng này mili-giây; quá thì bỏ tiếng, chỉ hiện chữ. */
const REQUEST_TIMEOUT_MS = 6000;

export type ReminderScenario = 'homework' | 'rest';

/** Bây giờ là giờ "đi tắm + làm bài tập", hay chỉ là giờ nghỉ mắt bình thường? */
export function pickScenario(now: Date = new Date()): ReminderScenario {
  const hour = now.getHours();
  return hour >= HOMEWORK_WINDOW.startHour && hour < HOMEWORK_WINDOW.endHour ? 'homework' : 'rest';
}

/**
 * Câu nhắc DỰ PHÒNG, viết sẵn trong máy — dùng khi không gọi được máy chủ (mất mạng, lỗi
 * Google...). Nhờ có nó, tính năng không bao giờ "hỏng hẳn": xấu nhất là bé đọc chữ thay
 * vì nghe tiếng.
 */
export function fallbackText(profileName: string, scenario: ReminderScenario): string {
  const name = profileName || 'con';
  return scenario === 'homework'
    ? `${name} ơi, sắp hết giờ xem rồi. Con tắt tivi, đi tắm rồi làm bài tập về nhà nhé!`
    : `${name} ơi, hôm nay con xem nhiều rồi. Mình nghỉ một chút cho mắt đỡ mỏi nhé!`;
}

export interface VoiceReminder {
  /** Câu nhắc dạng chữ. Không hiện lên màn hình — chỉ dùng để đọc bằng giọng dự phòng. */
  text: string;
  /** Đường dẫn dữ liệu đoạn tiếng để thẻ <audio> phát. null = Google không trả được tiếng. */
  audioUrl: string | null;
}

/**
 * Nước cuối khi không lấy được tiếng từ Google: nhờ giọng đọc có sẵn của chính thiết bị.
 * Trả về true nếu đã đọc được.
 *
 * Lưu ý thật thà: không phải thiết bị nào cũng có sẵn giọng TIẾNG VIỆT — điện thoại và
 * máy tính thường có, TV webOS thì tuỳ đời máy. Không có thì hàm này lặng lẽ trả về false
 * và bé sẽ không nghe thấy gì (đúng ý: màn hình xem phim không hiện chữ báo).
 *
 * ⚠️ CỐ Ý TẮT HẲN đường này trên TV (data-tv). Lỗi thật đã gặp: một số TV webOS không đọc
 * tiếng Việt bằng giọng máy nội bộ như điện thoại/máy tính, mà lại chuyển thẳng yêu cầu
 * `speechSynthesis.speak()` sang DỊCH VỤ ĐỌC-TIẾNG-QUA-MẠNG của chính hệ điều hành TV (gắn
 * với tài khoản Google/LG của TV) — TV đó chưa đăng nhập tài khoản nên chính con TV (loa
 * hệ thống, không phải app) tự nói to "Chưa đăng nhập" thay vì câu nhắc của mình. Vì hàm
 * này chỉ là NƯỚC CUỐI (dự phòng khi cả 2 lớp trước — Google TTS máy chủ + audio — đều
 * hỏng), tắt hẳn trên TV còn hơn để TV la lên 1 câu chẳng liên quan làm bé hoảng. Điện
 * thoại/máy tính không gặp lỗi này nên vẫn giữ nguyên.
 */
export function speakWithBrowser(text: string): boolean {
  try {
    if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-tv')) return false;
    const synth = window.speechSynthesis;
    if (!synth) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

/** Tắt ngay giọng đọc của trình duyệt (dùng khi bé rời trang phát giữa chừng). */
export function stopBrowserSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* thiết bị không hỗ trợ — bỏ qua */
  }
}

/**
 * Xin máy chủ một câu nhắc (chữ + tiếng). Hàm này KHÔNG BAO GIỜ ném lỗi ra ngoài — hỏng
 * chỗ nào cũng trả về câu dự phòng, để bên gọi không phải xử lý lỗi.
 */
export async function requestVoiceReminder(
  profileName: string,
  scenario: ReminderScenario
): Promise<VoiceReminder> {
  const backup: VoiceReminder = { text: fallbackText(profileName, scenario), audioUrl: null };

  // AbortController = cái "công tắc huỷ": mạng nhà chậm mà chờ mãi thì bé đã hết giờ xem
  // từ đời nào, nên quá 6 giây là bỏ, dùng câu dự phòng.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch('/api/voice-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileName, scenario }),
      signal: controller.signal,
    });
    if (!res.ok) return backup;

    const data = (await res.json()) as { text?: string; audioContent?: string };
    const text = data.text && data.text.trim().length > 0 ? data.text.trim() : backup.text;
    // audioContent là đoạn MP3 đã mã hoá base64 — ghép thành "data:" là thẻ <audio> phát
    // được ngay, không cần tải thêm file nào từ máy chủ.
    const audioUrl = data.audioContent ? `data:audio/mp3;base64,${data.audioContent}` : null;
    return { text, audioUrl };
  } catch {
    // Mất mạng / quá giờ chờ / máy chủ trả về rác — im lặng dùng câu dự phòng.
    return backup;
  } finally {
    clearTimeout(timer);
  }
}
