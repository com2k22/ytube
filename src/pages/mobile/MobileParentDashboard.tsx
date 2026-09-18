import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ListPlus, Baby, User, Users, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useProfileContext } from '@/context/ProfileContext';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { SessionLiveCard } from '@/components/parent-dashboard/SessionLiveCard';
import { TimeRequestCard } from '@/components/parent-dashboard/TimeRequestCard';

interface MenuItem {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  path: string;
}

/** 4 khu vực chính, mỗi khu vực giờ là 1 TRANG RIÊNG (thay vì khối gập/mở trên cùng 1
    trang) — bấm vào mới mở, có nhiều chỗ hiển thị hơn, theo đúng yêu cầu của bố. Xem các
    trang MobileParentTimePage/ContentPage/KidsPage/AccountPage.tsx + route trong App.tsx. */
const MENU: MenuItem[] = [
  { icon: Clock, title: 'Thời gian xem', subtitle: 'Lịch xem và giới hạn thời gian', path: '/parent/time' },
  { icon: ListPlus, title: 'Quản lý nội dung', subtitle: 'Thêm kênh, playlist, video cho bé', path: '/parent/content' },
  { icon: Baby, title: 'Hồ sơ các bé', subtitle: 'Quản lý thông tin, báo cáo tuần', path: '/parent/kids' },
  { icon: User, title: 'Tài khoản & thiết bị', subtitle: 'Ghép TV, thiết bị, sao lưu, mã PIN', path: '/parent/account' },
];

/**
 * Khu vực Bố mẹ trên điện thoại — trang "mục lục" chính: hồ sơ đang chọn + trạng thái đang
 * xem/lời xin thêm giờ (cần thấy NGAY, không phải bấm vào đâu cả) ở trên cùng, rồi tới 4 mục
 * chính dạng danh sách — bấm vào mục nào mới mở TRANG RIÊNG của mục đó (xem
 * MobileParentTimePage.tsx và 3 trang còn lại), thay vì gập/mở ngay trên trang này — nhiều
 * chỗ hiển thị hơn, dễ dùng hơn trên màn hình nhỏ. TV/iPad/máy tính không đụng tới, vẫn dùng
 * ParentDashboardPage.tsx như cũ (xem nhánh rẽ isPhone ở đầu file đó).
 */
export function MobileParentDashboard() {
  const { profiles, activeProfile } = useProfileContext();
  const { signOut } = useFamilyAuth();
  const [configProfileId, setConfigProfileId] = useState(activeProfile?.id ?? profiles[0]?.id ?? '');
  const navigate = useNavigate();

  if (profiles.length === 0) return null;
  const configProfile = profiles.find((p) => p.id === configProfileId) ?? profiles[0];

  return (
    <main className="main mobile-parent">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate('/')}>
        ← Quay lại
      </button>
      <div className="greet parent-greet">
        <Users className="icon icon-lead" aria-hidden="true" /> Khu vực Bố mẹ
      </div>

      {/* Chọn bé đang xem trạng thái trực tiếp bên dưới — CHỈ dùng cho SessionLiveCard, các
          quy định giờ giấc dùng CHUNG cho mọi bé nên không cần chọn ở đây (xem
          MobileParentTimePage.tsx: TimeRuleGroupEditor không nhận profileId). */}
      {profiles.length > 1 && (
        <div className="mini-profiles" style={{ marginTop: 14 }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`mini-profile-btn ${configProfileId === p.id ? 'active' : ''}`}
              data-region="pkids"
              tabIndex={0}
              onClick={() => setConfigProfileId(p.id)}
            >
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* Lời xin thêm giờ + đang xem trực tiếp — cần thấy NGAY khi mở khu Bố mẹ, không bắt
          bố mẹ phải bấm vào đâu cả. Tự ẩn hoàn toàn khi không có gì để báo. */}
      <TimeRequestCard />
      <SessionLiveCard profileId={configProfile.id} profileLabel={configProfile.name} />

      <div className="mobile-parent-menu">
        {MENU.map((item) => (
          <button key={item.path} className="mobile-parent-menu-row" onClick={() => navigate(item.path)}>
            <span className="mobile-parent-menu-icon">
              <item.icon aria-hidden="true" />
            </span>
            <span className="mobile-parent-menu-text">
              <span className="mobile-parent-menu-title">{item.title}</span>
              <span className="mobile-parent-menu-subtitle">{item.subtitle}</span>
            </span>
            <ChevronRight className="mobile-parent-menu-chevron" aria-hidden="true" />
          </button>
        ))}
      </div>

      <button
        className="add-window-btn mobile-parent-signout"
        data-region="ptime"
        tabIndex={0}
        onClick={() => {
          signOut();
          navigate('/');
        }}
      >
        Đăng xuất khỏi thiết bị này
      </button>
    </main>
  );
}
