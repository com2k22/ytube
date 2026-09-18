import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, BellRing } from 'lucide-react';
import { useTimeRules } from '@/hooks/useTimeRules';
import { TimeRuleGroupEditor } from '@/components/parent-dashboard/TimeRuleGroupEditor';
import { BlockScreen } from '@/components/parent-dashboard/BlockScreen';
import { useIsPhoneScreen } from '@/lib/screenSize';

/**
 * Trang con "Thời gian xem" trong Khu vực Bố mẹ trên điện thoại — tách riêng thành 1 trang
 * đầy đủ (thay vì khối gập/mở trên cùng 1 trang) để có nhiều chỗ hiển thị hơn, theo đúng
 * yêu cầu mới của bố. Dùng lại NGUYÊN VẸN TimeRuleGroupEditor/BlockScreen — không sửa bên
 * trong. `/parent/time` vẫn nằm trong `/parent/*` nên được bảo vệ bởi đăng nhập Google y hệt
 * (xem isParentRoute trong Layout.tsx — so khớp theo tiền tố đường link).
 */
export function MobileParentTimePage() {
  const isPhone = useIsPhoneScreen();
  const navigate = useNavigate();
  const { groups } = useTimeRules();
  const [previewBlock, setPreviewBlock] = useState(false);
  const firstWindowStart = groups.flatMap((g) => g.windows)[0]?.start ?? null;

  // Trang con này chỉ dành cho điện thoại thật — máy tính/TV/iPad gõ thẳng URL này thì tự
  // quay về /parent (vẫn dùng đúng 1 trang 4-tab như cũ, không đổi gì).
  if (!isPhone) return <Navigate to="/parent" replace />;

  return (
    <main className="main mobile-parent-sub">
      <button className="mobile-story-back" onClick={() => navigate('/parent')}>
        <ChevronLeft size={20} /> Khu vực Bố mẹ
      </button>
      <div className="greet parent-greet" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock className="icon icon-lead" aria-hidden="true" /> Thời gian xem
      </div>

      <TimeRuleGroupEditor />

      <button
        className="add-window-btn"
        style={{ marginTop: 4 }}
        data-region="ptime"
        tabIndex={0}
        onClick={() => setPreviewBlock(true)}
      >
        <BellRing className="icon icon-lead" aria-hidden="true" />
        Xem thử màn hình chặn
      </button>

      {previewBlock && (
        <BlockScreen nextWindowStart={firstWindowStart} onOpenParentGate={() => setPreviewBlock(false)} isPreview />
      )}
    </main>
  );
}
