import { supabase } from './supabaseClient';

/**
 * Thông báo đẩy lên điện thoại bố mẹ.
 *
 * Cách hoạt động, nói cho dễ hình dung:
 *  1. Điện thoại bấm "Bật thông báo" → trình duyệt xin quyền → nếu đồng ý, nó sinh ra một
 *     "địa chỉ nhận thư" riêng của MÁY ĐÓ (gọi là subscription).
 *  2. Địa chỉ đó được lưu vào bảng push_subscriptions trên Supabase.
 *  3. Khi bé bấm xin thêm giờ, TV gọi /api/send-push; máy chủ lấy các địa chỉ đã lưu rồi
 *     gửi thông báo tới đúng những máy đó — kể cả khi app đã đóng hẳn.
 *
 * Khoá công khai VAPID để ở đây là ĐÚNG chuẩn, không phải sơ suất: nó sinh ra để lộ ra
 * ngoài. Khoá RIÊNG mới là thứ phải giấu, và nó nằm trên Vercel (xem api/send-push.js).
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/**
 * Chuyển khoá dạng chữ (base64url) sang dạng byte mà trình duyệt đòi hỏi.
 *
 * Cố ý trả về ArrayBuffer chứ KHÔNG phải Uint8Array. Lý do rất cụ thể: từ TypeScript 5.7,
 * Uint8Array được khai báo kèm tham số kiểu (Uint8Array<ArrayBufferLike>), mà chỗ nhận nó
 * — applicationServerKey — chỉ chấp nhận vùng nhớ KHÔNG chia sẻ. Trả Uint8Array thẳng thì
 * lúc build sẽ đứt với lỗi khó hiểu "SharedArrayBuffer is not assignable to ArrayBuffer".
 * ArrayBuffer thì bản TypeScript nào cũng nhận, nên viết thế này là an toàn về lâu dài.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

/** Máy này có đủ khả năng nhận thông báo đẩy không. */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * App đang chạy ở chế độ "đã cài ra màn hình chính" chưa.
 *
 * Quan trọng với iPhone: Apple CHỈ cho nhận thông báo khi app được mở từ icon ngoài màn
 * hình chính. Mở đúng trang đó trong tab Safari thì bấm bao nhiêu lần cũng không xin được
 * quyền — nên phải nhận ra tình huống này để báo cho bố mẹ biết đường xử lý, thay vì để
 * họ bấm hoài không hiểu vì sao im lìm.
 */
export function isStandalone(): boolean {
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Đã cấp quyền chưa: 'granted' | 'denied' | 'default' | 'unsupported' */
export function permissionState(): string {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // register() gọi lại nhiều lần vẫn an toàn — trình duyệt tự nhận ra đã đăng ký rồi.
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('[Ytube] Không đăng ký được service worker:', err);
    return null;
  }
}

export interface EnableResult {
  ok: boolean;
  /** Câu giải thích để hiện thẳng lên màn hình cho bố mẹ đọc. */
  message: string;
}

/** Bật thông báo cho CHÍNH máy đang bấm. Phải gọi từ 1 cú chạm thật của người dùng. */
export async function enablePush(label: string): Promise<EnableResult> {
  if (!pushSupported()) {
    return { ok: false, message: 'Máy này không hỗ trợ thông báo đẩy.' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      ok: false,
      message: 'Chưa khai VITE_VAPID_PUBLIC_KEY trên Vercel — xem hướng dẫn trong .env.example.',
    };
  }
  if (isIos() && !isStandalone()) {
    return {
      ok: false,
      message:
        'Trên iPhone/iPad phải mở app từ icon ngoài màn hình chính mới bật được thông báo. ' +
        'Hãy đóng Safari, mở app bằng icon Ytube rồi bấm lại nút này.',
    };
  }

  // Hộp thoại xin quyền BẮT BUỘC phải bật lên từ một cú chạm của người dùng — đó là lý do
  // hàm này chỉ được gọi trong onClick của nút, không bao giờ gọi tự động lúc mở trang.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      message:
        permission === 'denied'
          ? 'Máy đang CHẶN thông báo của app. Vào Cài đặt của trình duyệt/điện thoại để bật lại cho trang này.'
          : 'Chưa cấp quyền thông báo.',
    };
  }

  const registration = await getRegistration();
  if (!registration) return { ok: false, message: 'Không khởi động được phần chạy ngầm của app.' };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        // Bắt buộc phải true: trình duyệt chỉ cho đăng ký nếu cam kết mọi thông báo gửi
        // xuống đều HIỆN RA cho người dùng thấy (không được dùng để chạy ngầm lén lút).
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      console.error('[Ytube] Không đăng ký nhận thông báo được:', err);
      return { ok: false, message: 'Không đăng ký nhận thông báo được. Thử lại sau nhé.' };
    }
  }

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, message: 'Dữ liệu đăng ký bị thiếu, thử lại nhé.' };
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      label,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('[Ytube] Không lưu được đăng ký thông báo:', error.message);
    return { ok: false, message: 'Không lưu được đăng ký. Đã chạy file SQL 008 chưa?' };
  }

  return { ok: true, message: 'Đã bật thông báo cho máy này.' };
}

/** Tắt thông báo trên chính máy đang bấm (không ảnh hưởng máy khác). */
export async function disablePush(): Promise<EnableResult> {
  const registration = await getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { ok: true, message: 'Máy này vốn chưa bật thông báo.' };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return { ok: true, message: 'Đã tắt thông báo trên máy này.' };
}

/** Máy đang dùng đã đăng ký nhận thông báo chưa. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const registration = await getRegistration();
  return !!(await registration?.pushManager.getSubscription());
}

/**
 * Báo cho điện thoại bố mẹ biết bé vừa xin thêm giờ.
 *
 * Chỉ gửi đi MÃ SỐ của lời xin, không gửi nội dung thông báo. Máy chủ tự vào Supabase đọc
 * lời xin đó rồi mới soạn câu chữ — nhờ vậy không ai bịa được thông báo sai sự thật (xem
 * phần "ba lớp chặn" ở đầu file api/send-push.js).
 *
 * Về mã bí mật: nó BUỘC phải nằm trong mã nguồn trang web thì TV mới gửi kèm được, nên ai
 * mở "xem nguồn trang" là đọc được. Nó chặn máy dò URL bừa trên mạng, KHÔNG chặn được
 * người cố tình — phần chặn thật nằm ở 2 lớp còn lại phía máy chủ.
 *
 * Cố ý KHÔNG BAO GIỜ ném lỗi ra ngoài: gửi thông báo hỏng thì cũng không được phép làm
 * hỏng việc chính (lời xin đã nằm trong Supabase rồi, bố mẹ mở khu Bố mẹ ra vẫn thấy).
 */
export async function notifyParentAboutRequest(requestId: string): Promise<void> {
  const secret = import.meta.env.VITE_PUSH_SHARED_SECRET as string | undefined;
  if (!secret) {
    console.error('[Ytube] Chưa khai VITE_PUSH_SHARED_SECRET — bỏ qua thông báo đẩy.');
    return;
  }
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ytube-Secret': secret },
      body: JSON.stringify({ requestId }),
    });
  } catch (err) {
    console.error('[Ytube] Không gửi được thông báo đẩy:', err);
  }
}
