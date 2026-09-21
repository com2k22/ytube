/*
  /api/gdrive-file — chạy TRÊN MÁY CHỦ (Vercel Edge Function).

  Nhiệm vụ: lấy 1 file (video/audio/ảnh bìa) từ Google Drive để phát trong app, THAY MẶT app
  bằng 1 TÀI KHOẢN DỊCH VỤ (service account) đã đăng nhập thật với Google — thay vì trước đây
  trình duyệt của bé gọi THẲNG tới Google bằng 1 API key ẩn danh (không đăng nhập).

  VÌ SAO CẦN CÁI NÀY: gọi Google bằng API key ẩn danh, đặc biệt khi phát audio liên tục nhiều
  file (bấm "Phát tất cả" 1 playlist Google Drive) tạo ra nhiều lượt gọi dồn dập trong thời
  gian ngắn — Google dễ coi đó là "truy vấn tự động đáng ngờ" và tạm chặn CẢ mạng nhà (trang
  "We're sorry... automated queries"), làm mọi audio/video Google Drive đứng hình. Đổi sang
  gọi bằng tài khoản dịch vụ (được Google xác thực bằng khoá riêng, không còn "ẩn danh" nữa)
  thì không còn bị nghi ngờ kiểu đó — đây là cách Google chính thức khuyên dùng cho ứng dụng
  gọi API thay mặt máy chủ, không phải mẹo lách luật.

  App (DirectVideoPlayer.tsx) tự đổi link Google Drive cũ (gọi thẳng, có kèm API key) thành
  link trạm trung chuyển này lúc PHÁT — không cần xoá/thêm lại nội dung cũ nào cả, không cần
  sửa cơ sở dữ liệu. Bước "Dò thông tin"/quét thư mục lúc THÊM nội dung (chỉ bố mẹ dùng, ít
  lượt gọi hơn hẳn lúc bé nghe/xem) vẫn dùng API key như cũ, không đi qua trạm này.

  BIẾN MÔI TRƯỜNG CẦN KHAI TRÊN VERCEL (Settings > Environment Variables):
    GDRIVE_SERVICE_ACCOUNT_JSON — dán NGUYÊN VĂN (copy-paste y hệt, không sửa gì) nội dung
      file .json tải về lúc tạo "Service account" trên Google Cloud Console (IAM & Admin >
      Service Accounts > tạo mới > tab Keys > Add key > Create new key > JSON).
      TUYỆT ĐỐI không thêm tiền tố VITE_ cho biến này — thêm VITE_ là để lộ ra ngoài trình
      duyệt, ai cũng đọc được (giống lỗi tối kỵ ở VAPID_PRIVATE_KEY trong send-push.js).
*/

export const config = { runtime: 'edge' };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

/** Token sống được qua nhiều lượt gọi khi function còn "ấm" (Edge Function giữ lại biến
    module-level giữa các lượt gọi liên tiếp, gần nhau về thời gian) — đỡ phải xin token mới
    (1 lượt gọi mạng riêng tới Google) cho MỖI lần bé bấm phát 1 file. Mất đi (nguội) thì tự
    xin lại bình thường, không lỗi gì cả. */
let cachedToken = null;

function base64url(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  // Tránh viết regex "/\//g" (khớp dấu gạch chéo) — chuỗi "//" liền nhau trong đó dễ bị các
  // công cụ rà lỗi ngỡ nhầm là bắt đầu 1 dòng chú thích "//"; dùng split/join cho cùng kết
  // quả mà không có "//" nào xuất hiện trong mã nguồn.
  return btoa(str).replace(/\+/g, '-').split('/').join('_').replace(/=+$/, '');
}

function pemToBinary(pem) {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i += 1) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
}

/**
 * Tự ký 1 "JWT" (giấy uỷ quyền) bằng khoá riêng của tài khoản dịch vụ rồi đổi lấy access
 * token thật từ Google — đúng luồng OAuth2 "Server-to-Server" chính thức của Google
 * (developers.google.com/identity/protocols/oauth2/service-account), chỉ viết tay bằng
 * Web Crypto (crypto.subtle) có sẵn ở Edge Function thay vì cài thêm thư viện googleapis
 * nặng nề — Edge Function không hỗ trợ đầy đủ API kiểu Node như thư viện đó cần.
 */
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const raw = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Thiếu biến môi trường GDRIVE_SERVICE_ACCOUNT_JSON trên Vercel.');
  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error('GDRIVE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ — dán lại nguyên văn file .json tải từ Google Cloud.');
  }
  if (!account.client_email || !account.private_key) {
    throw new Error('GDRIVE_SERVICE_ACCOUNT_JSON thiếu client_email/private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const encHeader = base64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const encClaim = base64url(
    enc.encode(
      JSON.stringify({
        iss: account.client_email,
        scope: DRIVE_SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${encHeader}.${encClaim}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput));
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google từ chối xin access token (${tokenRes.status}): ${(await tokenRes.text()).slice(0, 300)}`);
  }
  const json = await tokenRes.json();
  cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.accessToken;
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const fileId = url.searchParams.get('id');
    // Chỉ nhận đúng dạng mã file Google Drive (chữ/số/-/_) — chặn sớm mọi giá trị lạ trước
    // khi ghép vào URL gọi Google, không phải để "diệt" gì cả, chỉ tránh lỗi vô nghĩa.
    if (!fileId || !/^[\w-]+$/.test(fileId)) {
      return new Response('Thiếu hoặc sai mã file (?id=...)', { status: 400 });
    }

    const accessToken = await getAccessToken();
    const upstreamHeaders = { Authorization: `Bearer ${accessToken}` };
    // Chuyển tiếp đúng "Range" (nếu trình duyệt xin 1 đoạn để tua tới/lui) sang cho Google —
    // thiếu bước này thì tua video sẽ luôn phải tải lại từ đầu, rất chậm/giật.
    const range = request.headers.get('range');
    if (range) upstreamHeaders.Range = range;

    const driveUrl =
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media';
    const upstream = await fetch(driveUrl, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      return new Response(`Google Drive từ chối (${upstream.status}): ${text.slice(0, 300)}`, {
        status: upstream.status,
      });
    }

    const headers = new Headers();
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');
    // private (không phải public/CDN chung) — nội dung whitelist riêng của từng gia đình,
    // chỉ nên cache trong đúng trình duyệt bé đang xem, không cache ở tầng chia sẻ nào khác.
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    return new Response('Lỗi trạm trung chuyển Google Drive: ' + (err && err.message ? err.message : String(err)), {
      status: 500,
    });
  }
}
