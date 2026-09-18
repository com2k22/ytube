import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, ListPlus } from 'lucide-react';
import { AddSourceForm } from '@/components/parental/AddSourceForm';
import { useIsPhoneScreen } from '@/lib/screenSize';

/** Trang con "Quản lý nội dung" trong Khu vực Bố mẹ trên điện thoại — dùng lại nguyên vẹn
    AddSourceForm (thêm kênh/playlist/video/link, gán nhãn, ưu tiên, ẩn...), không sửa bên
    trong, chỉ tách ra trang riêng để có nhiều chỗ hơn so với gập/mở trên cùng 1 trang. */
export function MobileParentContentPage() {
  const isPhone = useIsPhoneScreen();
  const navigate = useNavigate();
  if (!isPhone) return <Navigate to="/parent" replace />;
  return (
    <main className="main mobile-parent-sub">
      <button className="mobile-story-back" onClick={() => navigate('/parent')}>
        <ChevronLeft size={20} /> Khu vực Bố mẹ
      </button>
      <div className="greet parent-greet" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ListPlus className="icon icon-lead" aria-hidden="true" /> Quản lý nội dung
      </div>

      <AddSourceForm />
    </main>
  );
}
