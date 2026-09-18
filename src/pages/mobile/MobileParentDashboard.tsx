import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ListPlus, Baby, BarChart3, User, Users, BellRing } from 'lucide-react';
import { useProfileContext } from '@/context/ProfileContext';
import { useTimeRules } from '@/hooks/useTimeRules';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { SessionLiveCard } from '@/components/parent-dashboard/SessionLiveCard';
import { TimeRuleGroupEditor } from '@/components/parent-dashboard/TimeRuleGroupEditor';
import { BlockScreen } from '@/components/parent-dashboard/BlockScreen';
import { ChangePinCard } from '@/components/parent-dashboard/ChangePinCard';
import { AddSourceForm } from '@/components/parental/AddSourceForm';
import { WeeklyReportTab } from '@/components/parent-dashboard/WeeklyReportTab';
import { TimeRequestCard } from '@/components/parent-dashboard/TimeRequestCard';
import { PushSetupCard } from '@/components/parent-dashboard/PushSetupCard';
import { ProfilesManagerCard } from '@/components/parent-dashboard/ProfilesManagerCard';
import { DeviceManagerCard } from '@/components/parent-dashboard/DeviceManagerCard';
import { ContentDeviceManagerCard } from '@/components/parent-dashboard/ContentDeviceManagerCard';
import { BackupExportCard } from '@/components/parent-dashboard/BackupExportCard';
import { PairingCodeCard } from '@/components/parent-dashboard/PairingCodeCard';
import { HomeBackgroundCard } from '@/components/parent-dashboard/HomeBackgroundCard';
import { MobileAccordionSection } from '@/components/mobile/MobileAccordionSection';

/**
 * Khu vực Bố mẹ trên điện thoại — gộp 4 tab cũ (Thời gian xem / Nội dung / Hồ sơ bé / Tài
 * khoản) thành 1 trang cuộn dọc duy nhất, chia thành các khối gập/mở, đúng thứ tự
 * UI_SPEC.md mục 3: Hồ sơ đang chọn → Lời xin thêm giờ (nếu có) → Đang xem trực tiếp (nếu
 * có) → Thời gian xem → Quản lý nội dung → Hồ sơ các bé + Báo cáo tuần → Tài khoản & thiết
 * bị → Đăng xuất.
 *
 * TẤT CẢ các thẻ con bên trong (TimeRuleGroupEditor, AddSourceForm, ProfilesManagerCard...)
 * được dùng lại NGUYÊN VẸN, không sửa bên trong — chỉ đổi cách sắp xếp/hiển thị bên ngoài.
 * TV/iPad/máy tính không đụng tới, vẫn dùng ParentDashboardPage.tsx như cũ (xem nhánh rẽ
 * isPhone ở đầu file đó).
 */
export function MobileParentDashboard() {
  const { profiles, activeProfile } = useProfileContext();
  const { session: familySession, signOut } = useFamilyAuth();
  const [configProfileId, setConfigProfileId] = useState(activeProfile?.id ?? profiles[0]?.id ?? '');
  const [previewBlock, setPreviewBlock] = useState(false);
  const { groups } = useTimeRules();
  const navigate = useNavigate();

  if (profiles.length === 0) return null;
  const configProfile = profiles.find((p) => p.id === configProfileId) ?? profiles[0];
  const firstWindowStart = groups.flatMap((g) => g.windows)[0]?.start ?? null;

  return (
    <main className="main mobile-parent">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate('/')}>
        ← Quay lại
      </button>
      <div className="greet parent-greet">
        <Users className="icon icon-lead" aria-hidden="true" /> Khu vực Bố mẹ
      </div>

      {/* Chọn bé đang cấu hình — dùng chung cho khối "Đang xem trực tiếp" và "Thời gian
          xem" bên dưới, đặt ngay từ đầu trang để thấy trước khi mở bất kỳ khối nào. */}
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

      {/* Lời xin thêm giờ của bé — như bản máy tính/TV, đặt ngoài mọi khối gập/mở, tự ẩn
          hoàn toàn khi không có ai đang xin. */}
      <TimeRequestCard />

      <SessionLiveCard profileId={configProfile.id} profileLabel={configProfile.name} />

      <MobileAccordionSection icon={Clock} title="Thời gian xem" defaultOpen>
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
      </MobileAccordionSection>

      <MobileAccordionSection icon={ListPlus} title="Quản lý nội dung">
        <AddSourceForm />
      </MobileAccordionSection>

      <MobileAccordionSection icon={Baby} title="Hồ sơ các bé">
        <ProfilesManagerCard />

        <div className="section-title" style={{ marginTop: 28, display: 'flex', alignItems: 'center' }}>
          <BarChart3 className="icon icon-lead" aria-hidden="true" /> Báo cáo tuần
        </div>
        <WeeklyReportTab />
      </MobileAccordionSection>

      <MobileAccordionSection icon={User} title="Tài khoản & thiết bị">
        {/* Tài khoản Google đang đăng nhập trên THIẾT BỊ NÀY (xem useFamilyAuth.ts). */}
        <div className="section-title" style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
          <User className="icon icon-lead" aria-hidden="true" /> Tài khoản gia đình
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
      </MobileAccordionSection>

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

      {previewBlock && (
        <BlockScreen nextWindowStart={firstWindowStart} onOpenParentGate={() => setPreviewBlock(false)} isPreview />
      )}
    </main>
  );
}
