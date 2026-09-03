/*
  /api/send-push — chạy TRÊN MÁY CHỦ (Vercel Serverless Function).

  Nhiệm vụ: bé bấm "con xin thêm giờ" ở TV → hàm này bắn thông báo tới mọi điện thoại đã
  bật nhận thông báo, kể cả khi app trên điện thoại đã đóng hẳn.

  VÌ SAO PHẢI Ở MÁY CHỦ: gửi thông báo đẩy cần KHOÁ RIÊNG VAPID để ký. Khoá đó mà để ở
  phía trình duyệt thì ai cũng lấy được và gửi thông báo giả danh app mình.

  ---------------------------------------------------------------------------------
  BA LỚP CHẶN, xếp từ yếu tới mạnh — cố ý không dựa vào mỗi lớp đầu:

  1. MÃ BÍ MẬT DÙNG CHUNG. Chặn được người/máy dò URL bừa trên mạng.
     ⚠️ Nói thẳng: mã này BUỘC phải nằm trong mã nguồn trang web (TV phải gửi kèm nó),
     nên ai mở "xem nguồn trang" của app là đọc được. Nó chặn kẻ dò bừa, KHÔNG chặn được
     người cố tình. Vì vậy mới cần 2 lớp dưới.

  2. PHẢI CÓ LỜI XIN THẬT. Hàm này không nhận nội dung thông báo từ bên gọi nữa — chỉ nhận
     MÃ SỐ của lời xin, rồi tự vào Supabase đọc xem lời xin đó có thật không, còn đang chờ
     không, vừa tạo trong 2 phút gần đây không. Tự soạn câu thông báo từ dữ liệu đọc được.
     Nghĩa là: không thể bịa ra thông báo "Mina xin thêm giờ" khi Mina không hề xin.

  3. MỖI LỜI XIN CHỈ BÁO 1 LẦN. Gửi xong thì đánh dấu notified_at vào đúng dòng đó (xem
     supabase/009_push_notified_flag.sql). Gọi lại lần nữa là bị bỏ qua — không ai spam
     điện thoại bằng cách gọi đi gọi lại một lời xin cũ.
  ---------------------------------------------------------------------------------

  BIẾN MÔI TRƯỜNG cần khai trên Vercel (Settings > Environment Variables):
    VAPID_PRIVATE_KEY        — khoá RIÊNG (tuyệt đối không chia sẻ, không có tiền tố VITE_)
    VITE_VAPID_PUBLIC_KEY    — khoá công khai (có VITE_ vì trình duyệt cũng cần đọc nó)
    VITE_PUSH_SHARED_SECRET  — mã bí mật dùng chung (lớp chặn số 1)
    VAPID_SUBJECT            — (tuỳ chọn) "mailto:email-của-bạn"

  Hai biến Supabase thì đã có sẵn từ trước, không phải khai thêm:
    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
*/

import webpush from 'web-push';

const DEFAULT_SUBJECT = 'mailto:ngocphongdo@gmail.com';

/** Lời xin cũ hơn từng này thì không báo nữa — bé chắc chắn đã bỏ đi làm việc khác rồi. */
const MAX_REQUEST_AGE_MS = 2 * 60_000;

/** So chuỗi kiểu "hằng thời gian" để không lộ dần mã bí mật qua thời gian phản hồi. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sbHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

/** Đọc lời xin theo mã số, kèm luôn tên bé (nhờ khoá ngoại profile_id sang bảng profiles). */
async function loadRequest(url, key, id) {
  const query =
    `${url}/rest/v1/time_requests` +
    `?id=eq.${encodeURIComponent(id)}` +
    `&select=id,status,requested_minutes,created_at,notified_at,profiles(name)`;
  const res = await fetch(query, { headers: sbHeaders(key) });
  if (!res.ok) {
    console.error('[Ytube] Không đọc được lời xin:', res.status, await res.text());
    return null;
  }
  const rows = await res.json();
  return rows[0] ?? null;
}

/** Đánh dấu đã báo rồi. Trả về true nếu CHÍNH LẦN GỌI NÀY là lần đánh dấu được. */
async function claimRequest(url, key, id) {
  // Điều kiện notified_at=is.null nằm ngay trong câu lệnh cập nhật: 2 lần gọi cùng lúc thì
  // chỉ đúng 1 lần đổi được dòng, lần kia nhận về rỗng. Kiểm tra rồi mới ghi (2 bước) sẽ
  // hở đúng khe đó và bắn 2 thông báo.
  const res = await fetch(
    `${url}/rest/v1/time_requests?id=eq.${encodeURIComponent(id)}&notified_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...sbHeaders(key), Prefer: 'return=representation' },
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    console.error('[Ytube] Không đánh dấu được lời xin:', res.status, await res.text());
    return false;
  }
  const rows = await res.json();
  return rows.length > 0;
}

/** Lấy danh sách điện thoại đã bật thông báo. */
async function loadSubscriptions(url, key) {
  const res = await fetch(`${url}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`, {
    headers: sbHeaders(key),
  });
  if (!res.ok) {
    console.error('[Ytube] Không đọc được danh sách thiết bị:', res.status, await res.text());
    return [];
  }
  return res.json();
}

/**
 * Xoá địa chỉ đã chết.
 *
 * Vì sao phải làm: điện thoại gỡ app / xoá icon / tắt thông báo thì địa chỉ đó hỏng vĩnh
 * viễn, Apple-Google trả về mã 404 hoặc 410. Không dọn thì mỗi lần gửi lại tốn thời gian
 * gọi vào một địa chỉ chẳng còn ai, và bảng cứ phình ra mãi.
 */
async function deleteSubscription(url, key, endpoint) {
  await fetch(`${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: sbHeaders(key),
  }).catch(() => {
    /* dọn dẹp thôi, hỏng cũng không sao */
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ nhận POST' });
    return;
  }

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const secret = process.env.VITE_PUSH_SHARED_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!publicKey || !privateKey || !supabaseUrl || !supabaseKey) {
    // Thiếu cấu hình thì báo "đã nhận, không gửi được" chứ KHÔNG báo lỗi đỏ: phía TV chỉ
    // gọi cho có, lời xin đã nằm trong Supabase rồi, bố mẹ mở khu Bố mẹ ra vẫn thấy.
    console.error('[Ytube] Thiếu biến môi trường cho thông báo đẩy.');
    res.status(200).json({ sent: 0, skipped: 'missing_env' });
    return;
  }

  // --- Lớp chặn 1: mã bí mật ---
  // Chưa khai mã thì KHÓA HẲN, không phải "cho qua cho tiện": để mở toang thì đúng cái
  // tình huống mình vừa muốn vá lại xảy ra y nguyên mà không ai biết.
  if (!secret) {
    console.error('[Ytube] Chưa khai VITE_PUSH_SHARED_SECRET — từ chối gửi thông báo.');
    res.status(503).json({ error: 'Chưa cấu hình mã bí mật' });
    return;
  }
  if (!safeEqual(req.headers['x-ytube-secret'], secret)) {
    res.status(401).json({ error: 'Sai mã bí mật' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const requestId = String(body?.requestId ?? '');
  if (!requestId) {
    res.status(400).json({ error: 'Thiếu requestId' });
    return;
  }

  // --- Lớp chặn 2: phải là lời xin THẬT, còn đang chờ, và vừa mới tạo ---
  const request = await loadRequest(supabaseUrl, supabaseKey, requestId);
  if (!request) {
    res.status(404).json({ error: 'Không có lời xin này' });
    return;
  }
  if (request.status !== 'pending') {
    res.status(200).json({ sent: 0, skipped: 'not_pending' });
    return;
  }
  if (Date.now() - new Date(request.created_at).getTime() > MAX_REQUEST_AGE_MS) {
    res.status(200).json({ sent: 0, skipped: 'too_old' });
    return;
  }

  // --- Lớp chặn 3: mỗi lời xin chỉ báo đúng 1 lần ---
  const claimed = await claimRequest(supabaseUrl, supabaseKey, requestId);
  if (!claimed) {
    res.status(200).json({ sent: 0, skipped: 'already_notified' });
    return;
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || DEFAULT_SUBJECT, publicKey, privateKey);

  // Nội dung soạn TỪ DỮ LIỆU TRONG SUPABASE, không lấy chữ nào từ bên gọi — nhờ vậy không
  // ai bịa được một thông báo sai sự thật.
  const childName = request.profiles?.name || 'Bé';
  const minutes = request.requested_minutes || 15;
  const payload = JSON.stringify({
    title: `🙋 ${childName} xin thêm ${minutes} phút`,
    body: 'Bấm vào đây để duyệt hoặc từ chối.',
    // tag cố định: nhiều lời xin liên tiếp thì gộp làm 1 thông báo, không xếp chồng một
    // dọc dài trên màn hình khoá.
    tag: 'xin-them-gio',
    url: '/parent',
  });

  const subscriptions = await loadSubscriptions(supabaseUrl, supabaseKey);
  let sent = 0;

  // Gửi song song cho nhanh — bố mẹ đang ngồi chờ, mà mỗi máy gửi tuần tự thì cộng dồn lâu.
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 600 } // giữ tối đa 10 phút: quá lâu rồi thì lời xin cũng hết ý nghĩa
        );
        sent += 1;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) await deleteSubscription(supabaseUrl, supabaseKey, sub.endpoint);
        else console.error('[Ytube] Gửi thông báo hỏng:', status, err?.body || err);
      }
    })
  );

  res.status(200).json({ sent, total: subscriptions.length });
}
