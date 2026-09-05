import { useState } from 'react';
import { Save, Download } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/common/Toast';
import { getFamilyId } from '@/lib/familyId';

/**
 * BackupExportCard — "Sao lưu cấu hình" trong khu Bố mẹ (tab Tài khoản). Xuất TOÀN BỘ
 * cấu hình (hồ sơ các bé, whitelist nội dung, nhãn, giờ giấc) ra 1 file JSON tải về máy,
 * phòng khi đổi TV hoặc cài lại app cần đối chiếu/nhập tay lại cho nhanh.
 *
 * CHƯA làm chiều ngược lại (nhập file vào lại app) — hiện tại chỉ xuất ra để lưu giữ/đối
 * chiếu thủ công. Nên làm ở điện thoại/máy tính (trình duyệt tải file dễ hơn TV).
 */
export function BackupExportCard() {
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();

  const onExport = async () => {
    const familyId = getFamilyId();
    if (!familyId) {
      showToast('Chưa xác định được gia đình trên thiết bị này — thử tải lại trang.');
      return;
    }
    setExporting(true);
    try {
      // Lọc theo family_id — bảng gốc mở đọc công khai (using true) cho MỌI gia đình đang
      // dùng chung app (xem supabase/013_multi_family.sql), không lọc thì file sao lưu sẽ
      // lẫn cả dữ liệu của gia đình khác vào.
      const [profiles, sources, labels, timeRules] = await Promise.all([
        supabase.from('profiles').select('*').eq('family_id', familyId),
        supabase.from('allowed_sources').select('*').eq('family_id', familyId),
        supabase.from('content_labels').select('*').eq('family_id', familyId),
        supabase.from('time_rule_groups').select('*').eq('family_id', familyId),
      ]);
      const firstError = profiles.error || sources.error || labels.error || timeRules.error;
      if (firstError) {
        showToast('Có lỗi khi lấy dữ liệu — thử lại nhé.');
        return;
      }

      const backup = {
        app: 'ytube',
        backup_version: 1,
        exported_at: new Date().toISOString(),
        profiles: profiles.data ?? [],
        allowed_sources: sources.data ?? [],
        content_labels: labels.data ?? [],
        time_rule_groups: timeRules.data ?? [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ytube-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Đã tải file sao lưu về máy');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="settings-card" style={{ marginTop: 20 }}>
      <h4><Save className="icon icon-lead" aria-hidden="true" /> Sao lưu cấu hình</h4>
      <p style={{ opacity: 0.65, margin: '-6px 0 16px', fontSize: 12.5 }}>Tải file cấu hình về máy.</p>
      <button
        className="add-window-btn"
        data-region="pbackup"
        tabIndex={0}
        disabled={exporting}
        onClick={onExport}
      >
        {exporting ? (
          'Đang chuẩn bị...'
        ) : (
          <>
            <Download className="icon icon-lead" aria-hidden="true" /> Xuất file sao lưu
          </>
        )}
      </button>
    </div>
  );
}
