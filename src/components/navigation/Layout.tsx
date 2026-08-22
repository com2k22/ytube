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

// Lưu ý: cố tình KHÔNG khai báo 'continue' và 'topbar' ở đây — vùng không khai báo sẽ mặc
// định nằm trên đúng 1 hàng ngang (xem useTvNavigation), đúng ý muốn "Tiếp tục xem" tối đa
// 1 hàng, và thanh trên cùng (hồ sơ + đổi giao diện + Bố mẹ) cũng là 1 hàng ngang.
// 'side' = 1 cột: menu bên trái là 1 cột DỌC, nên phải đi bằng mũi tên lên/xuống mới đúng
// trực giác (bấm trái/phải sẽ nhảy sang vùng khác — xem useTvNavigation).
// 'pin' = 3 cột: bàn phím số của bảng nhập PIN xếp 4 hàng × 3 cột.
// 'block' / 'pinclose' = 1 cột: các nút xếp dọc trong lớp phủ khoá màn hình.
const SECTION_COLS = { side: 1, playlist: 3, video: 3, detailback: 1, pin: 3, block: 1, pinclose: 1 };

/**
 * Layout — khung sườn cố định (Sidebar + TopBar) bao quanh mọi trang, xử lý:
 * - Điều hướng D-pad toàn cục (useTvNavigation) trên cả sidebar lẫn nội dung trang.
 * - Cổng PIN phụ huynh (bấm 🔒 Bố mẹ ở cuối menu bên trái — xem Sidebar).
 * - Màn hình chặn ngoài giờ xem (BlockScreen), chỉ áp dụng cho các trang xem của bé,
 *   KHÔNG áp dụng khi đang ở trang /parent để phụ huynh luôn vào được.
 *   Màn hình chặn LUÔN hiển thị suốt thời gian ngoài khung giờ được phép — bấm "VÂNG"
 *   chỉ là xác nhận đã đọc, KHÔNG mở khoá xem nội dung. Cách duy nhất để thoát màn hình
 *   chặn là phụ huynh nhập đúng mã PIN (qua nút "🔒 Bố mẹ" ngay trên màn hình chặn).
 */
export function Layout() {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile } = useProfileContext();

  const { resetFocus } = useTvNavigation(layoutRef, SECTION_COLS, {
    onEscape: () => {
      if (location.pathname !== '/') navigate(-1);
    },
  });

  const gate = useTimeGate(activeProfile?.id ?? null);

  const isParentRoute = location.pathname.startsWith('/parent');
  const showBlockScreen = !isParentRoute && !gate.allowed && !pinOpen;

  // Đặt lại ô đang chọn mỗi khi: đổi trang, HOẶC mở/đóng 1 lớp phủ khoá màn hình (bảng
  // PIN, màn hình Chưa đến giờ xem). Lớp phủ mở ra thì ô chọn phải nhảy vào bên trong nó;
  // đóng lại thì quay về nội dung chính.
  useEffect(() => {
    resetFocus();
  }, [location.pathname, pinOpen, showBlockScreen, resetFocus]);

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
      <Sidebar onOpenParentGate={() => setPinOpen(true)} />
      {/* class "content-col" để CSS chế độ TV chỉnh được cột nội dung này (cần khai báo
          min-width: 0 thì các hàng thẻ mới cuộn ngang được bên trong, thay vì đẩy phình
          cả trang ra ngang) */}
      <div className="content-col" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
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
        <BlockScreen nextWindowStart={gate.nextWindowStart} onOpenParentGate={() => setPinOpen(true)} />
      )}
    </div>
  );
}
