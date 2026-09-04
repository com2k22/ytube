import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ContentLabel } from '@/types';

/**
 * useContentLabels — đọc & quản lý danh sách NHÃN dùng để gán cho video/playlist đã thêm
 * (xem supabase/010_content_labels.sql). Nhãn dùng chung cho cả nhà, không tách theo bé.
 *
 * 2 nhãn có sẵn (is_builtin = true) — "Ưu tiên"/"Ẩn" — không cho xoá và không cho đổi cờ
 * is_priority/is_hidden (hành vi đặc biệt phải giữ cố định), chỉ cho đổi TÊN nếu muốn.
 */
export function useContentLabels() {
  const [labels, setLabels] = useState<ContentLabel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('content_labels')
      .select('*')
      .order('is_builtin', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[Ytube] Không tải được danh sách nhãn:', error.message);
      setLoading(false);
      return;
    }
    setLabels(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Thêm 1 nhãn tự đặt tên mới (không phải nhãn đặc biệt). */
  const addLabel = async (name: string) => {
    const clean = name.trim();
    if (!clean) return false;
    const { error } = await supabase.from('content_labels').insert({ name: clean });
    if (error) {
      console.error('[Ytube] Không thêm được nhãn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  /** Đổi tên 1 nhãn — cho phép cả với 2 nhãn đặc biệt (chỉ tên đổi được, hành vi giữ nguyên). */
  const renameLabel = async (id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return false;
    const { error } = await supabase.from('content_labels').update({ name: clean }).eq('id', id);
    if (error) {
      console.error('[Ytube] Không đổi được tên nhãn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  /** Xoá 1 nhãn tự đặt — KHÔNG cho xoá nhãn đặc biệt (is_builtin), chặn ngay từ đây. */
  const removeLabel = async (label: ContentLabel) => {
    if (label.is_builtin) return false;
    const { error } = await supabase.from('content_labels').delete().eq('id', label.id);
    if (error) {
      console.error('[Ytube] Không xoá được nhãn:', error.message);
      return false;
    }
    await refresh();
    return true;
  };

  return { labels, loading, addLabel, renameLabel, removeLabel, refresh };
}
