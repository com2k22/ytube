import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';
import type { Profile } from '@/types';

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile | null;
  loading: boolean;
  switchProfile: (profileId: string) => void;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const ACTIVE_PROFILE_STORAGE_KEY = 'ytube.activeProfileId';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const refreshProfiles = async () => {
    setLoading(true);
    // Chỉ lấy hồ sơ của ĐÚNG gia đình mà thiết bị này đã "thiết lập lần đầu" (xem
    // src/lib/familyId.ts + supabase/013_multi_family.sql) — nhiều gia đình khác nhau cùng
    // dùng chung app thì không được thấy hồ sơ của nhau. Chưa thiết lập (familyId rỗng, vd
    // đang ở màn "Thiết lập lần đầu") thì trả về danh sách rỗng, không gọi Supabase.
    const familyId = getFamilyId();
    if (!familyId) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at');
    if (error) {
      console.error('[Ytube] Không tải được danh sách hồ sơ:', error.message);
      setLoading(false);
      return;
    }
    setProfiles(data ?? []);
    if (!activeProfileId && data && data.length > 0) {
      setActiveProfileId(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileId);
  };

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, loading, switchProfile, refreshProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfileContext phải được dùng bên trong <ProfileProvider>');
  return ctx;
}
