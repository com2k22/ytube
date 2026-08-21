import { createClient } from '@supabase/supabase-js';

// Không bao giờ hardcode key thật vào đây — luôn đọc từ biến môi trường (.env),
// xem hướng dẫn trong .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Không throw cứng để app vẫn build được khi thiếu .env lúc dev ban đầu,
  // nhưng cảnh báo rõ ràng ở console để bạn biết cần điền .env.
  // eslint-disable-next-line no-console
  console.warn(
    '[Ytube] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env — ' +
      'sao chép .env.example thành .env rồi điền giá trị thật (xem Bước 1).'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  realtime: {
    params: { eventsPerSecond: 5 },
  },
});
