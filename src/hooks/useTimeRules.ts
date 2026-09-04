import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';
import type { TimeRuleGroup } from '@/types';

/**
 * Đọc & chỉnh sửa các "nhóm ngày" quản lý thời gian xem.
 *
 * Từ bản này, cấu hình giờ xem là DÙNG CHUNG cho cả 2 bé — không còn chia riêng từng hồ
 * sơ nữa. Quy ước trong cơ sở dữ liệu: những dòng có profile_id để TRỐNG (null) là cấu
 * hình chung. Xem supabase/006_shared_time_rules.sql để chuyển dữ liệu cũ sang kiểu này.
 */
export function useTimeRules() {
  const [groups, setGroups] = useState<TimeRuleGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const familyId = getFamilyId();
    if (!familyId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('time_rule_groups')
      .select('*')
      .eq('family_id', familyId)
      .is('profile_id', null)
      .order('created_at');
    if (error) {
      console.error('[Ytube] Không tải được cấu hình giờ xem:', error.message);
      setLoading(false);
      return;
    }
    setGroups(data ?? []);
    setLoading(false);
  }, []);

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

  const addGroup = async () => {
    const { error } = await supabase.from('time_rule_groups').insert({
      profile_id: null,
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
