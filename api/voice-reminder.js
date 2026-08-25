/*
  /api/voice-reminder — hàm chạy TRÊN MÁY CHỦ (Vercel Serverless Function).

  Nhiệm vụ: nhận tên bé + hoàn cảnh, nhờ Google AI soạn 1 câu nhắc tự nhiên, rồi nhờ
  Google Cloud Text-to-Speech đọc câu đó ra tiếng, trả cả chữ lẫn tiếng về cho app.

  VÌ SAO PHẢI CÓ FILE NÀY (thay vì gọi thẳng Google từ trình duyệt):
  khoá API mà đặt ở phía trình duyệt là AI CŨNG XEM ĐƯỢC (bấm F12 là thấy), người lạ lấy
  dùng chùa thì mình trả tiền. Đặt ở đây thì khoá nằm trong biến môi trường của Vercel,
  không bao giờ gửi xuống trình duyệt.

  BIẾN MÔI TRƯỜNG cần khai trên Vercel (Settings > Environment Variables) — CỐ Ý KHÔNG có
  tiền tố VITE_, vì mọi biến có VITE_ đều bị Vite nhét thẳng vào mã nguồn trang web:
    GOOGLE_AI_API_KEY   — khoá Google AI Studio (soạn câu)
    GOOGLE_TTS_API_KEY  — khoá Google Cloud Text-to-Speech (đọc thành tiếng)
    GOOGLE_AI_MODEL     — (tuỳ chọn) tên model, mặc định gemini-2.5-flash. Google thỉnh
                          thoảng đổi tên model; nếu có lỗi 404 thì chỉ cần sửa biến này
                          trên Vercel, KHÔNG phải sửa code.
    GOOGLE_TTS_VOICE    — (tuỳ chọn) giọng đọc, mặc định vi-VN-Wavenet-A (giọng nữ miền Bắc)

  Thiếu khoá hoặc Google lỗi → trả về câu viết sẵn, KHÔNG trả lỗi, để app vẫn nhắc được
  bằng chữ. Đây là chủ ý: thà không có tiếng còn hơn hiện bảng lỗi cho bé xem.
*/

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_VOICE = 'vi-VN-Wavenet-A';

/** Câu viết sẵn — giống hệt bản dự phòng phía app (src/lib/voiceReminder.ts). */
function fallbackText(profileName, scenario) {
  const name = profileName || 'con';
  return scenario === 'homework'
    ? `${name} ơi, sắp hết giờ xem rồi. Con tắt tivi, đi tắm rồi làm bài tập về nhà nhé!`
    : `${name} ơi, hôm nay con xem nhiều rồi. Mình nghỉ một chút cho mắt đỡ mỏi nhé!`;
}

/** Nhờ Google AI soạn câu nhắc. Hỏng thì trả null để bên gọi dùng câu viết sẵn. */
async function composeSentence(profileName, scenario) {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;

  const model = process.env.GOOGLE_AI_MODEL || DEFAULT_MODEL;
  const situation =
    scenario === 'homework'
      ? 'Bé đã hết giờ xem tivi, bây giờ là giờ đi tắm rồi ngồi vào bàn làm bài tập về nhà.'
      : 'Bé đã xem tivi khá nhiều, nên nghỉ một chút cho mắt đỡ mỏi và đi chơi/vận động.';

  const prompt = [
    `Con tên là ${profileName || 'bé'}, khoảng 6 tuổi.`,
    situation,
    'Hãy viết ĐÚNG MỘT câu tiếng Việt để bố mẹ nhắc bé, xưng "con" với bé.',
    'Yêu cầu: ấm áp, vui vẻ, dịu dàng, không doạ nạt, không ra lệnh cộc lốc.',
    'Dài tối đa 25 từ. Có gọi tên bé. Chỉ trả về đúng câu đó, không thêm giải thích, không dùng dấu ngoặc kép.',
  ].join(' ');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1, maxOutputTokens: 200 },
        }),
      }
    );
    if (!res.ok) {
      console.error('[Ytube] Google AI trả lỗi:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p) => p?.text ?? '').join('').trim() : '';
    if (!text) return null;
    // Cắt bỏ dấu ngoặc kép nếu model vẫn lỡ bọc câu lại, và chỉ lấy 1 dòng.
    return text.replace(/^["'“”]+|["'“”]+$/g, '').split('\n')[0].trim();
  } catch (err) {
    console.error('[Ytube] Không gọi được Google AI:', err);
    return null;
  }
}

/** Nhờ Google Cloud TTS đọc câu ra tiếng. Trả về chuỗi base64 MP3, hỏng thì null. */
async function synthesizeSpeech(text) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) return null;

  const voiceName = process.env.GOOGLE_TTS_VOICE || DEFAULT_VOICE;
  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          // languageCode lấy 5 ký tự đầu của tên giọng ("vi-VN-Wavenet-A" -> "vi-VN") để
          // đổi giọng bằng biến môi trường là chạy được ngay, không phải sửa code.
          voice: { languageCode: voiceName.slice(0, 5), name: voiceName },
          // Đọc chậm hơn bình thường một chút cho bé nghe kịp.
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, pitch: 1 },
        }),
      }
    );
    if (!res.ok) {
      console.error('[Ytube] Google TTS trả lỗi:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.audioContent ?? null;
  } catch (err) {
    console.error('[Ytube] Không gọi được Google TTS:', err);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Chỉ nhận POST' });
    return;
  }

  // Vercel tự đọc sẵn body JSON, nhưng phòng trường hợp nhận về dạng chuỗi thì tự phân tích.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const profileName = String(body?.profileName ?? '').slice(0, 40);
  const scenario = body?.scenario === 'homework' ? 'homework' : 'rest';

  const composed = await composeSentence(profileName, scenario);
  const text = composed || fallbackText(profileName, scenario);
  const audioContent = await synthesizeSpeech(text);

  // Câu nhắc phụ thuộc tên bé + hoàn cảnh nên không cache lâu; cho phép cache ngắn ở CDN
  // để bấm lại liên tục không tốn thêm tiền gọi Google.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  res.status(200).json({ text, audioContent });
}
