import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, User } from 'lucide-react';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { useIsPhoneScreen } from '@/lib/screenSize';
import { PairingCodeCard } from '@/components/parent-dashboard/PairingCodeCard';
import { DeviceManagerCard } from '@/components/parent-dashboard/DeviceManagerCard';
import { ContentDeviceManagerCard } from '@/components/parent-dashboard/ContentDeviceManagerCard';
import { PushSetupCard } from '@/components/parent-dashboard/PushSetupCard';
import { HomeBackgroundCard } from '@/components/parent-dashboard/HomeBackgroundCard';
import { BackupExportCard } from '@/components/parent-dashboard/BackupExportCard';
import { ChangePinCard } from '@/components/parent-dashboard/ChangePinCard';

/** Trang con "Tài khoản & thiết bị" trong Khu vực Bố mẹ trên điện thoại — gộp mọi thẻ tài
    khoản/thiết bị hiện có (ghép TV, thiết bị đăng nhập, thiết bị xem nội dung, thông báo,
    hình nền, sao lưu, đổi PIN) thành 1 trang riêng, dùng lại nguyên vẹn từng thẻ. */
export function MobileParentAccountPage() {
  const isPhone = useIsPhoneScreen();
  const navigate = useNavigate();
  const { session: familySession } = useFamilyAuth();

  if (!isPhone) return <Navigate to="/parent" replace />;

  return (
    <main className="main mobile-parent-sub">
      <button className="mobile-story-back" onClick={() => navigate('/parent')}>
        <ChevronLeft size={20} /> Khu vực Bố mẹ
      </button>
      <div className="greet parent-greet" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <User className="icon icon-lead" aria-hidden="true" /> Tài khoản & thiết bị
      </div>
      <p style={{ opacity: 0.75, margin: '4px 0 14px' }}>{familySession?.user?.email ?? '(không rõ)'}</p>

      <div className="card-grid">
        <PairingCodeCard />
        <DeviceManagerCard />
        <ContentDeviceManagerCard />
        <PushSetupCard />
        <HomeBackgroundCard />
        <BackupExportCard />
        <ChangePinCard />
      </div>
    </main>
  );
}
