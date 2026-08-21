import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { TimeRuleGroup } from '@/types';

/** Đọc & chỉnh sửa các "nhóm ngày" quản lý thời gian xem cho 1 hồ sơ. */
export function useTimeRules(profileId: string | null) {
  const [groups, setGroups] = useState<TimeRuleGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('time_rule_groups')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at');
    if (error) {
      console.error('[Ytube] Không tải được cấu hình giờ xem:', error.message);
      setLoading(false);
      return;
    }
    setGroups(data ?? []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveGroup = async (group: TimeRuleGroup) => {
    const { id, ...rest } = group;
    const { error } = await supabase
      .from('time_rule_groups')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('[Ytube] Không lưu được nhóm ngày:', error.message);
    return !error;
  };

  const addGroup = async (profileIdArg: string) => {
    const { error } = await supabase.from('time_rule_groups').insert({
      profile_id: profileIdArg,
      days: [],
      daily_minutes: 60,
      session_minutes: 20,
      windows: [{ start: '08:00', end: '09:00' }],
    });
    if (error) console.error('[Ytube] Không thêm được nhóm ngày:', error.message);
    else await refresh();
    return !error;
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabase.from('time_rule_groups').delete().eq('id', id);
    if (error) console.error('[Ytube] Không xoá được nhóm ngày:', error.message);
    else await refresh();
    return !error;
  };

  return { groups, loading, refresh, saveGroup, addGroup, deleteGroup };
}
