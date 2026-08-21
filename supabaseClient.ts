import { createClient } from '@supabase/supabase-js';

// Không bao giờ hardcode key thật vào đây — luôn đọc từ biến môi trường (.env),
// xem hướng dẫn trong .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Không throw cứng để app vẫn build được khi thiếu .env lúc dev ban đầu,
  // nhưng cảnh báo rõ ràng ở console để bạn biết cần điền .env.
  // eslint-disable-next-line no-console
  console.warn(
    '[Ytube] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY — ' +
      'sao chép .env.example thành .env rồi điền giá trị thật (dev), hoặc khai báo ' +
      '3 biến môi trường này trong Vercel > Settings > Environment Variables rồi ' +
      'redeploy (bản triển khai thật). Nếu thiếu, createClient() bên dưới sẽ ném lỗi ' +
      'và làm cả app trắng/đen màn hình ngay từ đầu — vì vậy dùng tạm 1 URL giả hợp lệ ' +
      'để app còn hiện được màn hình, thay vì crash im lặng.'
  );
}

// Lưu ý: createClient() sẽ THROW ngay lập tức (crash toàn bộ app, màn hình trắng/đen)
// nếu supabaseUrl là chuỗi rỗng hoặc không phải URL hợp lệ — nên khi thiếu cấu hình,
// dùng tạm 1 URL giả có định dạng hợp lệ để app vẫn render được (các lệnh gọi Supabase
// thật sự lúc đó sẽ lỗi mạng và được các hook xử lý/log riêng, thay vì crash cả trang).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  }
);
