import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileContext } from '@/context/ProfileContext';
import { useTimeRules } from '@/hooks/useTimeRules';
import { SessionLiveCard } from '@/components/parent-dashboard/SessionLiveCard';
import { TimeRuleGroupEditor } from '@/components/parent-dashboard/TimeRuleGroupEditor';
import { BlockScreen } from '@/components/parent-dashboard/BlockScreen';
import { ChangePinCard } from '@/components/parent-dashboard/ChangePinCard';
import { AddSourceForm } from '@/components/parental/AddSourceForm';

type Tab = 'time' | 'content' | 'pin';

/** Trang "Bố mẹ" — quản lý thời gian xem từ xa + thêm nội dung whitelist. Yêu cầu PIN (xem PinModal). */
export function ParentDashboardPage() {
  const { profiles, activeProfile } = useProfileContext();
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
          className={`tab-btn ${tab === 'pin' ? 'active' : ''}`}
          data-region="ptabs"
          tabIndex={0}
          onClick={() => setTab('pin')}
        >
          🔑 Đổi PIN
        </button>
      </div>

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
                onClick={() => setConfigProfileId(p.id)}
              >
                {p.name}
              </div>
            ))}
          </div>

          <SessionLiveCard profileId={configProfile.id} profileLabel={configProfile.name} />
          <TimeRuleGroupEditor />

          <button className="add-window-btn" style={{ marginTop: 4 }} onClick={() => setPreviewBlock(true)}>
            🔔 Xem thử màn hình chặn
          </button>
        </div>
      )}

      {tab === 'content' && <AddSourceForm />}

      {tab === 'pin' && <ChangePinCard />}

      {previewBlock && (
        <BlockScreen nextWindowStart={firstWindowStart} onOpenParentGate={() => setPreviewBlock(false)} isPreview />
      )}
    </main>
  );
}
