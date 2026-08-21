import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useProfileContext } from './ProfileContext';
import type { ThemeName } from '@/types';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfileContext();
  const [theme, setThemeState] = useState<ThemeName>('dark_tv');

  // Mỗi khi đổi hồ sơ, nạp theme đã lưu riêng cho hồ sơ đó.
  useEffect(() => {
    if (activeProfile) setThemeState(activeProfile.theme_preference);
  }, [activeProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'chibi_cute' ? 'chibi' : 'dark');
  }, [theme]);

  const setTheme = async (t: ThemeName) => {
    setThemeState(t);
    if (activeProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: t, updated_at: new Date().toISOString() })
        .eq('id', activeProfile.id);
      if (error) console.error('[Ytube] Không lưu được theme cho hồ sơ:', error.message);
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark_tv' ? 'chibi_cute' : 'dark_tv');

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext phải được dùng bên trong <ThemeProvider>');
  return ctx;
}
