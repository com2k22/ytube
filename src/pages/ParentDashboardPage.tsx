import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useTimeRules } from '@/hooks/useTimeRules';
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
import { useFamilyAuth } from '@/hooks/useFamilyAuth';

type Tab = 'time' | 'content' | 'kids' | 'report' | 'account';

/** Trang "Bố mẹ" — quản lý thời gian xem từ xa + thêm nội dung whitelist. Vào được là nhờ
    đã đăng nhập đúng tài khoản Google gia đình trên thiết bị này (xem GoogleSignInGate,
    thay cho PIN cũ — PIN giờ chỉ còn dùng cho "Cho xem ngay"/"Bỏ qua giờ nghỉ", xem ChangePinCard). */
export function ParentDashboardPage() {
  const { profiles, activeProfile } = useProfileContext();
  const { session: familySession, signOut } = useFamilyAuth();
  const [tab, setTab] = useState<Tab>('time');
  const [configProfileId, setConfigProfileId] = useState(activeProfile?.id ?? profiles[0]?.id ?? '');
  const [previewBlock, setPreviewBlock] = useState(false);
  const { groups } = useTimeRules();
  const navigate = useNavigate();

  if (profiles.length === 0) return null;
  const configProfile = profiles.find((p) => p.id === configProfileId) ?? profiles[0];

  const firstWindowStart = groups.flatMap((g) => g.windows)[0]?.start ?? null;

  return (
    <main className="main">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate('/')}>
        ← Quay lại
      </button>
      <div className="greet" style={{ marginTop: 20 }}>
        👨‍👩‍👧 Khu vực Bố mẹ
      </div>

      <div className="parent-tabs">
        <button
          className={`tab-btn ${tab === 'time' ? 'active' : ''}`}
          data-region="ptabs"
          tabIndex={0}
          onClick={() => setTab('time')}
        >
          ⏰ Quản lý thời gian
        </button>
        <button
          className={`tab-btn ${tab === 'content' ? 'active' : ''}`}
          data-region="ptabs"
          tabIndex={0}
          onClick={() => setTab('content')}
        >
          ➕ Thêm nội dung
        </button>
        <button
          className={`tab-btn ${tab === 'kids' ? 'active' : ''}`}
          data-region="ptabs"
          tabIndex={0}
          onClick={() => setTab('kids')}
        >
          👶 Hồ sơ các bé
        </button>
        <button
          className={`tab-btn ${tab === 'report' ? 'active' : ''}`}
          data-region="ptabs"
          tabIndex={0}
          onClick={() => setTab('report')}
        >
          📊 Báo cáo tuần
        </button>
        <button
          className={`tab-btn ${tab === 'account' ? 'active' : ''}`}
          data-region="ptabs"
          tabIndex={0}
          onClick={() => setTab('account')}
        >
          👤 Tài khoản
        </button>
      </div>

      {/* Lời xin thêm giờ của bé — cố ý đặt NGOÀI các tab và ở trên cùng: bé đang ngồi chờ
          trước TV, bố mẹ mở khu Bố mẹ ra là phải thấy ngay, không phải đi tìm đúng tab.
          Không có ai đang xin thì thẻ này tự ẩn hoàn toàn. */}
      <TimeRequestCard />

      {tab === 'time' && (
        <div>
          {/* Cấu hình giờ xem giờ dùng CHUNG cho cả 2 bé nên không còn nút chọn từng bé ở
              đây nữa. Riêng thẻ "đang xem gì" bên dưới vẫn theo từng bé, vì mỗi bé xem
              video khác nhau — vẫn cần biết bé nào đang xem để tắt từ xa. */}
          <div className="mini-profiles">
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

          <SessionLiveCard profileId={configProfile.id} profileLabel={configProfile.name} />
          <PushSetupCard />
          <TimeRuleGroupEditor />

          <button
            className="add-window-btn"
            style={{ marginTop: 4 }}
            data-region="ptime"
            tabIndex={0}
            onClick={() => setPreviewBlock(true)}
          >
            🔔 Xem thử màn hình chặn
          </button>
        </div>
      )}

      {tab === 'content' && <AddSourceForm />}

      {tab === 'kids' && <ProfilesManagerCard />}

      {tab === 'report' && <WeeklyReportTab />}

      {tab === 'account' && (
        <div>
          {/* Tài khoản Google đang đăng nhập trên THIẾT BỊ NÀY (thay cho PIN cũ khi vào khu
              Bố mẹ) — xem useFamilyAuth.ts. Đăng xuất ở đây thì lần sau vào khu Bố mẹ trên
              thiết bị này phải đăng nhập lại. */}
          <div className="section-title" style={{ marginTop: 4 }}>
            👤 Tài khoản gia đình
          </div>
          <p style={{ opacity: 0.75, margin: '4px 0 14px' }}>
            Đang đăng nhập: {familySession?.user?.email ?? '(không rõ)'}
          </p>
          <button
            className="add-window-btn"
            style={{ marginBottom: 28 }}
            data-region="ptime"
            tabIndex={0}
            onClick={() => {
              signOut();
              navigate('/');
            }}
          >
            Đăng xuất khỏi thiết bị này
          </button>

          <DeviceManagerCard />
          <ContentDeviceManagerCard />
          <PairingCodeCard />
          <BackupExportCard />

          <div className="section-title" style={{ marginTop: 28 }}>
            🔑 Đổi PIN (cho "Cho xem ngay" / "Bỏ qua giờ nghỉ")
          </div>
          <ChangePinCard />
        </div>
      )}

      {previewBlock && (
        <BlockScreen nextWindowStart={firstWindowStart} onOpenParentGate={() => setPreviewBlock(false)} isPreview />
      )}
    </main>
  );
}
