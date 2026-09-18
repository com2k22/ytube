import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, Baby, BarChart3 } from 'lucide-react';
import { ProfilesManagerCard } from '@/components/parent-dashboard/ProfilesManagerCard';
import { WeeklyReportTab } from '@/components/parent-dashboard/WeeklyReportTab';
import { useIsPhoneScreen } from '@/lib/screenSize';

/** Trang con "Hồ sơ các bé" trong Khu vực Bố mẹ trên điện thoại — gộp ProfilesManagerCard
    (thêm/sửa/xoá hồ sơ, avatar) và Báo cáo tuần (trước đây gộp chung 1 tab trên máy tính,
    giữ nguyên cách gộp đó) thành 1 trang riêng. */
export function MobileParentKidsPage() {
  const isPhone = useIsPhoneScreen();
  const navigate = useNavigate();
  if (!isPhone) return <Navigate to="/parent" replace />;
  return (
    <main className="main mobile-parent-sub">
      <button className="mobile-story-back" onClick={() => navigate('/parent')}>
        <ChevronLeft size={20} /> Khu vực Bố mẹ
      </button>
      <div className="greet parent-greet" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Baby className="icon icon-lead" aria-hidden="true" /> Hồ sơ các bé
      </div>

      <ProfilesManagerCard />

      <div className="section-title" style={{ marginTop: 28, display: 'flex', alignItems: 'center' }}>
        <BarChart3 className="icon icon-lead" aria-hidden="true" /> Báo cáo tuần
      </div>
      <WeeklyReportTab />
    </main>
  );
}
