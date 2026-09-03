import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { ThemeName } from '@/types';

/**
 * ĐÃ BỎ tuỳ chọn đổi giao diện: app giờ LUÔN dùng "Dark TV" — giống nền tối của app
 * YouTube trên TV. Trước đây còn theme "Chibi Cute" (hồng, đổi qua nút 🎨 ở Sidebar); nút
 * đó đã bị gỡ khỏi Sidebar.tsx.
 *
 * Cố tình KHÔNG đọc `activeProfile.theme_preference` nữa (dù cột đó vẫn còn trong bảng
 * profiles của Supabase, không cần xoá) — nếu vẫn đọc thì hồ sơ nào lỡ lưu 'chibi_cute' từ
 * trước khi gỡ nút sẽ mở lên vẫn thấy giao diện hồng, coi như gỡ nút mà không dứt điểm.
 * Ép cứng về 'dark_tv' ngay ở đây mới chắc chắn 100% hồ sơ nào cũng chỉ thấy Dark TV.
 */
const FIXED_THEME: ThemeName = 'dark_tv';

interface ThemeContextValue {
  theme: ThemeName;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return <ThemeContext.Provider value={{ theme: FIXED_THEME }}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext phải được dùng bên trong <ThemeProvider>');
  return ctx;
}
