import { useState } from 'react';
import { useProfileContext } from '@/context/ProfileContext';
import { useToast } from '@/components/common/Toast';
import { supabase } from '@/lib/supabaseClient';
import { profileEmoji, PROFILE_EMOJI_PRESETS } from '@/constants';

const emptyForm = { name: '', avatar: PROFILE_EMOJI_PRESETS[0] };

/**
 * ProfilesManagerCard — tab "👶 Hồ sơ các bé" trong khu Bố mẹ. Thêm/sửa/xoá hồ sơ bé ngay
 * trong app — trước đây phải nhờ sửa code (2 bé Mina & Cốm gắn cứng), giờ tự làm được hết.
 *
 * Xoá 1 bé sẽ xoá LUÔN nội dung/lịch sử xem RIÊNG của bé đó (whitelist gán riêng, lịch sử
 * xem, yêu cầu xin thêm giờ...) — nội dung DÙNG CHUNG cho cả nhà thì không bị ảnh hưởng.
 * Cảnh báo rõ trong hộp thoại xác nhận trước khi xoá.
 */
export function ProfilesManagerCard() {
  const { profiles, activeProfile, switchProfile, refreshProfiles } = useProfileContext();
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (id: string, name: string, avatar: string | null) => {
    setEditingId(id);
    setForm({ name, avatar: avatar || PROFILE_EMOJI_PRESETS[0] });
  };

  const submit = async () => {
    const cleanName = form.name.trim();
    if (!cleanName) {
      showToast('Nhập tên bé trước đã nhé.');
      return;
    }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from('profiles')
        .update({ name: cleanName, avatar: form.avatar })
        .eq('id', editingId);
      setSaving(false);
      if (error) {
        showToast('Có lỗi khi lưu — thử lại nhé.');
        return;
      }
      showToast('💾 Đã lưu hồ sơ');
    } else {
      // family_id + theme_preference tự có giá trị mặc định từ cơ sở dữ liệu (xem
      // supabase/011_family_auth.sql + 001_schema.sql), không cần truyền ở đây.
      const { error } = await supabase.from('profiles').insert({ name: cleanName, avatar: form.avatar });
      setSaving(false);
      if (error) {
        showToast('Có lỗi khi thêm bé mới — thử lại nhé.');
        return;
      }
      showToast(`${form.avatar} Đã thêm hồ sơ "${cleanName}"`);
    }
    resetForm();
    await refreshProfiles();
  };

  const onDelete = async (id: string, name: string) => {
    if (profiles.length <= 1) {
      showToast('Cần giữ lại ít nhất 1 hồ sơ — không xoá được hồ sơ cuối cùng.');
      return;
    }
    const ok = window.confirm(
      `Xoá hồ sơ "${name}"? Nội dung/lịch sử xem RIÊNG của bé này sẽ bị xoá luôn (nội dung dùng chung cho cả nhà thì không sao). Không thể hoàn tác.`
    );
    if (!ok) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      showToast('Có lỗi khi xoá — thử lại nhé.');
      return;
    }
    if (editingId === id) resetForm();
    if (activeProfile?.id === id) {
      const remaining = profiles.find((p) => p.id !== id);
      if (remaining) switchProfile(remaining.id);
    }
    showToast(`🗑 Đã xoá hồ sơ "${name}"`);
    await refreshProfiles();
  };

  return (
    <div>
      <div className="settings-card">
        <h4>👶 Hồ sơ các bé</h4>
        <p style={{ opacity: 0.65, margin: '-6px 0 16px', fontSize: 12.5, lineHeight: 1.5 }}>
          Thêm/bớt/đổi tên hồ sơ bé — Trang chủ, whitelist và báo cáo tuần tự cập nhật theo.
        </p>

        {profiles.map((p) => (
          <div key={p.id} className="added-item" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 22, marginRight: 10 }}>{profileEmoji(p)}</span>
            <div style={{ flex: 1 }}>{p.name}</div>
            <button className="icon-btn" data-region="padded" tabIndex={0} title="Sửa" onClick={() => startEdit(p.id, p.name, p.avatar)}>
              ✏️
            </button>
            <button className="icon-btn" data-region="padded" tabIndex={0} title="Xoá" onClick={() => onDelete(p.id, p.name)}>
              🗑️
            </button>
          </div>
        ))}
      </div>

      <div className="settings-card" style={{ marginTop: 16 }}>
        <h4>{editingId ? '✏️ Sửa hồ sơ' : '➕ Thêm bé mới'}</h4>

        <div className="form-row">
          <label>Tên bé</label>
          <input
            type="text"
            data-region="pkidform"
            tabIndex={0}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Vd: Bo"
          />
        </div>

        <div className="form-row">
          <label>Emoji đại diện</label>
          <div className="day-pills">
            {PROFILE_EMOJI_PRESETS.map((e) => (
              <div
                key={e}
                className={`day-pill ${form.avatar === e ? 'on' : ''}`}
                data-region="pkidemoji"
                tabIndex={0}
                style={{ fontSize: 20 }}
                onClick={() => setForm((f) => ({ ...f, avatar: e }))}
              >
                {e}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="submit-btn" style={{ width: 'auto', padding: '12px 26px' }} data-region="pkidform" tabIndex={0} disabled={saving} onClick={submit}>
            {saving ? 'Đang lưu...' : editingId ? '💾 Lưu' : '➕ Thêm bé'}
          </button>
          {editingId && (
            <button className="add-window-btn" data-region="pkidform" tabIndex={0} onClick={resetForm}>
              Huỷ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
