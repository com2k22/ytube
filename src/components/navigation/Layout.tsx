import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PinModal } from '@/components/parental/PinModal';
import { BlockScreen } from '@/components/parent-dashboard/BlockScreen';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { useTimeGate } from '@/hooks/useTimeGate';
import { useProfileContext } from '@/context/ProfileContext';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

const SECTION_COLS = { continue: 3, playlist: 3, video: 3, detailback: 1 };

/**
 * Layout — khung sườn cố định (Sidebar + TopBar) bao quanh mọi trang, xử lý:
 * - Điều hướng D-pad toàn cục (useTvNavigation) trên cả sidebar lẫn nội dung trang.
 * - Cổng PIN phụ huynh (bấm 🔒 Bố mẹ ở TopBar).
 * - Màn hình chặn ngoài giờ xem (BlockScreen), chỉ áp dụng cho các trang xem của bé,
 *   KHÔNG áp dụng khi đang ở trang /parent để phụ huynh luôn vào được.
 */
export function Layout() {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile } = useProfileContext();

  const { resetFocus } = useTvNavigation(layoutRef, SECTION_COLS, {
    onEscape: () => {
      if (location.pathname !== '/') navigate(-1);
    },
  });

  useEffect(() => {
    resetFocus();
  }, [location.pathname, resetFocus]);

  const gate = useTimeGate(activeProfile?.id ?? null);

  // Mỗi khi bước vào lại khung giờ được phép xem, "reset" trạng thái đã xác nhận —
  // để lần chặn tiếp theo (ngoài giờ) sẽ hiện lại màn hình nhắc nhở.
  useEffect(() => {
    if (gate.allowed) setDismissed(false);
  }, [gate.allowed]);

  const isParentRoute = location.pathname.startsWith('/parent');
  const showBlockScreen = !isParentRoute && !gate.allowed && !pinOpen && !dismissed;

  return (
    <div className="layout" ref={layoutRef}>
      {!isSupabaseConfigured && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#e05a5a',
            color: '#fff',
            padding: '10px 16px',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          ⚠️ Chưa cấu hình Supabase: thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào
          Vercel &gt; Settings &gt; Environment Variables rồi deploy lại (xem README, Bước D).
        </div>
      )}
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar onOpenParentGate={() => setPinOpen(true)} />
        <Outlet />
      </div>

      <PinModal
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={() => {
          setPinOpen(false);
          navigate('/parent');
        }}
      />

      {showBlockScreen && (
        <BlockScreen nextWindowStart={gate.nextWindowStart} onAcknowledge={() => setDismissed(true)} />
      )}
    </div>
  );
}
