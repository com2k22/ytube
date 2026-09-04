import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { setFamilyId } from '@/lib/familyId';
import { PROFILE_EMOJI_PRESETS } from '@/constants';
import type { Session } from '@supabase/supabase-js';

interface Props {
  session: Session;
  /** Gọi khi đã xác định/tạo xong gia đình cho thiết bị này — Layout.tsx đóng màn hình này lại. */
  onBound: () => void;
}

/**
 * FamilyBindingScreen — bước 2 của "Thiết lập lần đầu" (bước 1 là đăng nhập Google, xem
 * GoogleSignInGate). Đã đăng nhập xong rồi thì kiểm tra: email này ĐÃ thuộc 1 gia đình có
 * sẵn chưa?
 *   - CÓ (vd nhà mình, gia đình đã tồn tại từ trước) → tự động nhận diện, LƯU LUÔN vào
 *     thiết bị này, không hỏi gì thêm.
 *   - CHƯA (gia đình khác, lần đầu dùng app) → hỏi tên gia đình, tạo mới + tự tạo sẵn 1 hồ
 *     sơ bé đầu tiên để app có cái hiện ra ngay, không bị trống trơn.
 */
export function FamilyBindingScreen({ session, onBound }: Props) {
  const [checking, setChecking] = useState(true);
  const [needsCreate, setNeedsCreate] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const email = session.user.email;
    if (!email) {
      setError('Không lấy được email từ tài khoản đã đăng nhập.');
      setChecking(false);
      return;
    }
    supabase
      .from('families')
      .select('id')
      .eq('owner_email', email)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          setError('Có lỗi khi kiểm tra gia đình — thử tải lại trang.');
          setChecking(false);
          return;
        }
        if (data) {
          // Gia đình đã có sẵn (vd nhà mình đăng nhập lại trên 1 thiết bị mới, hoặc TV cũ
          // đang cập nhật lên bản có "nhiều gia đình") — nhận diện luôn, không hỏi gì cả.
          setFamilyId(data.id);
          onBound();
          return;
        }
        setNeedsCreate(true);
        setChecking(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.email]);

  const createFamily = async () => {
    const email = session.user.email;
    const cleanName = familyName.trim();
    if (!email || !cleanName) {
      setError('Nhập tên gia đình trước đã nhé.');
      return;
    }
    setCreating(true);
    setError('');

    const { data: family, error: familyErr } = await supabase
      .from('families')
      .insert({ owner_email: email, name: cleanName })
      .select('id')
      .single();
    if (familyErr || !family) {
      setCreating(false);
      setError('Có lỗi khi tạo gia đình — thử lại nhé.');
      return;
    }

    // Tạo sẵn những thứ CẦN CÓ để app dùng được ngay, không trống trơn — family_id của mọi
    // dòng dưới đây tự điền qua default current_family_id() (đã đăng nhập đúng gia đình vừa
    // tạo). Lỗi ở bước nào cũng không chặn thiết lập — bố mẹ tự thêm lại trong khu Bố mẹ.
    //  1) 1 hồ sơ bé đầu tiên.
    await supabase.from('profiles').insert({ name: 'Bé 1', avatar: PROFILE_EMOJI_PRESETS[0] });
    //  2) 2 nhãn đặc biệt "Ưu tiên"/"Ẩn" (is_builtin) — không có thì Trang chủ mất tính
    //     năng ưu tiên/ẩn nội dung, và khu Bố mẹ > Quản lý nhãn cũng thiếu 2 nhãn mặc định
    //     mọi gia đình khác đều có (xem supabase/010_content_labels.sql, seed gốc).
    await supabase.from('content_labels').insert([
      { name: 'Ưu tiên', is_priority: true, is_hidden: false, is_builtin: true },
      { name: 'Ẩn', is_priority: false, is_hidden: true, is_builtin: true },
      { name: 'Học tập', is_priority: false, is_hidden: false, is_builtin: false },
      { name: 'Giải trí', is_priority: false, is_hidden: false, is_builtin: false },
      { name: 'Khác', is_priority: false, is_hidden: false, is_builtin: false },
    ]);
    //  3) 1 khung giờ xem mặc định — không có thì tab "Quản lý thời gian" trống trơn, và
    //     tuỳ cách useTimeGate.ts xử lý "chưa có khung giờ nào" có thể vô tình khoá bé xem
    //     luôn cả ngày. Đặt tạm 17h-18h các ngày trong tuần, bố mẹ chỉnh lại sau.
    await supabase.from('time_rule_groups').insert({
      profile_id: null,
      days: ['T2', 'T3', 'T4', 'T5', 'T6'],
      daily_minutes: 45,
      session_minutes: 15,
      windows: [{ start: '17:00', end: '18:00' }],
    });

    setCreating(false);
    setFamilyId(family.id);
    onBound();
  };

  return (
    <div className="overlay show" data-nav-scope>
      <div className="modal">
        <h3>👨‍👩‍👧 Thiết lập gia đình</h3>

        {checking ? (
          <p style={{ opacity: 0.75, margin: '10px 0' }}>Đang kiểm tra tài khoản...</p>
        ) : needsCreate ? (
          <>
            <p style={{ opacity: 0.75, margin: '10px 0 20px', lineHeight: 1.5 }}>
              Email này chưa thuộc gia đình nào trên app — đặt tên cho gia đình bạn để bắt
              đầu (sẽ tạo sẵn 1 hồ sơ bé, thêm/sửa/xoá sau đều được).
            </p>
            <div className="form-row">
              <label>Tên gia đình</label>
              <input
                type="text"
                data-region="pkidform"
                tabIndex={0}
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Vd: Gia đình Nam"
              />
            </div>
            <button
              className="submit-btn"
              style={{ width: '100%' }}
              data-region="pkidform"
              tabIndex={0}
              disabled={creating}
              onClick={createFamily}
            >
              {creating ? 'Đang tạo...' : '✅ Tạo gia đình & bắt đầu'}
            </button>
          </>
        ) : null}

        {error && <div className="hint bad-text" style={{ height: 'auto', margin: '10px 0 0' }}>✕ {error}</div>}
      </div>
    </div>
  );
}
