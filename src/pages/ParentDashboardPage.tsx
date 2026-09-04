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

/** Icon + tên rút gọn cho từng tab — tách riêng icon/chữ (thay vì gộp 1 chuỗi như bản cũ)
    để CSS xếp lại được thành thanh dưới đáy trên điện thoại (icon trên, chữ nhỏ dưới,
    giống hệt menu Trang chủ/Bố mẹ ở Sidebar.tsx) mà không cần đổi HTML theo từng màn hình.
    Tên rút gọn dùng chung cho MỌI cỡ màn hình (không riêng điện thoại) — đã xem demo và
    được duyệt, ngắn gọn vẫn đủ rõ nghĩa trên máy tính/TV. */
const TABS: { value: Tab; icon: string; label: string }[] = [
  { value: 'time', icon: '⏰', label: 'Thời gian' },
  { value: 'content', icon: '➕', label: 'Nội dung' },
  { value: 'kids', icon: '👶', label: 'Hồ sơ bé' },
  { value: 'report', icon: '📊', label: 'Báo cáo' },
  { value: 'account', icon: '👤', label: 'Tài khoản' },
];

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
    // "parent-page" chỉ để CSS máy tính (theme.css, khối "KHU BỐ MẸ TRÊN MÁY TÍNH") nhắm
    // đúng trang này, không đụng tới các trang khác cũng dùng chung class "main".
    <main className="main parent-page">
      <button className="back-btn" data-region="detailback" tabIndex={0} onClick={() => navigate('/')}>
        ← Quay lại
      </button>
      <div className="greet" style={{ marginTop: 20 }}>
        👨‍👩‍👧 Khu vực Bố mẹ
      </div>

      {/* "parent-layout": trên điện thoại/TV vẫn xếp trên-xuống-dưới như cũ (CSS mặc định
          không đổi gì); trên máy tính CSS chuyển thành 2 cột — menu bên trái + nội dung bên
          phải (xem theme.css) — dễ thấy hết các mục cùng lúc, không phải cuộn ngang. */}
      <div className="parent-layout">
        <div className="parent-tabs">
          {TABS.map((t) => (
            <button
              key={t.value}
              className={`tab-btn ${tab === t.value ? 'active' : ''}`}
              data-region="ptabs"
              tabIndex={0}
              onClick={() => setTab(t.value)}
            >
              <span className="tab-btn-icon">{t.icon}</span>
              <span className="tab-btn-label">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="parent-main">
          {/* Lời xin thêm giờ của bé — cố ý đặt NGOÀI các tab và ở trên cùng: bé đang ngồi
              chờ trước TV, bố mẹ mở khu Bố mẹ ra là phải thấy ngay, không phải đi tìm đúng
              tab. Không có ai đang xin thì thẻ này tự ẩn hoàn toàn. */}
          <TimeRequestCard />

          {tab === 'time' && (
            // "parent-cols": trên máy tính chia 2 cột — cấu hình giờ giấc (form, bên trái)
            // và trạng thái đang xem/thông báo (bên phải). Thứ tự trong mã nguồn CỐ Ý giữ
            // y hệt bản cũ (trạng thái trước, form sau) để điện thoại/TV không đổi gì cả —
            // việc "form bên trái" trên máy tính chỉ là CSS "order", xem theme.css.
            <div className="parent-cols">
              <div className="col col-list">
                {/* Cấu hình giờ xem giờ dùng CHUNG cho cả 2 bé nên không còn nút chọn từng
                    bé ở đây nữa. Riêng thẻ "đang xem gì" bên dưới vẫn theo từng bé, vì mỗi
                    bé xem video khác nhau — vẫn cần biết bé nào đang xem để tắt từ xa. */}
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
              </div>

              <div className="col col-form">
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
            </div>
          )}

          {tab === 'content' && <AddSourceForm />}

          {tab === 'kids' && <ProfilesManagerCard />}

          {tab === 'report' && <WeeklyReportTab />}

          {tab === 'account' && (
            <div>
              {/* Tài khoản Google đang đăng nhập trên THIẾT BỊ NÀY (thay cho PIN cũ khi vào
                  khu Bố mẹ) — xem useFamilyAuth.ts. Đăng xuất ở đây thì lần sau vào khu Bố
                  mẹ trên thiết bị này phải đăng nhập lại. */}
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

              {/* "card-grid": trên máy tính, các thẻ dưới đây xếp thành lưới nhiều cột thay
                  vì chồng dài xuống dưới như trên điện thoại/TV (xem theme.css). */}
              <div className="card-grid">
                <DeviceManagerCard />
                <ContentDeviceManagerCard />
                <PairingCodeCard />
                <BackupExportCard />
                <div>
                  <div className="section-title" style={{ marginTop: 0 }}>
                    🔑 Đổi PIN (cho "Cho xem ngay" / "Bỏ qua giờ nghỉ")
                  </div>
                  <ChangePinCard />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewBlock && (
        <BlockScreen nextWindowStart={firstWindowStart} onOpenParentGate={() => setPreviewBlock(false)} isPreview />
      )}
    </main>
  );
}
