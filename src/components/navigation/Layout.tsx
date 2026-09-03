import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PinModal } from '@/components/parental/PinModal';
import { BlockScreen, type RequestState } from '@/components/parent-dashboard/BlockScreen';
import { BreakScreen } from '@/components/parent-dashboard/BreakScreen';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { useTimeGate } from '@/hooks/useTimeGate';
import { useTempUnlock } from '@/hooks/useTempUnlock';
import { useBreakGate } from '@/hooks/useWatchStretch';
import { useTimeRequests, DEFAULT_REQUEST_MINUTES } from '@/hooks/useTimeRequests';
import { useProfileContext } from '@/context/ProfileContext';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

// Lưu ý: cố tình KHÔNG khai báo 'continue' và 'topbar' ở đây — vùng không khai báo sẽ mặc
// định nằm trên đúng 1 hàng ngang (xem useTvNavigation), đúng ý muốn "Tiếp tục xem" tối đa
// 1 hàng, và thanh trên cùng (hồ sơ + đổi giao diện + Bố mẹ) cũng là 1 hàng ngang.
// 'side' = 1 cột: menu bên trái là 1 cột DỌC, nên phải đi bằng mũi tên lên/xuống mới đúng
// trực giác (bấm trái/phải sẽ nhảy sang vùng khác — xem useTvNavigation).
// 'playlist' / 'video' = 3 cột: lưới 3 thẻ/hàng ở TRANG CHI TIẾT (trang Kênh, trang danh
// sách video của playlist). Riêng các khối ở Trang chủ ('continue', 'playlistrec',
// 'videorec') cố ý KHÔNG khai báo ở đây — để mặc định là 1 hàng ngang cuộn được.
// 'pin' = 3 cột: bàn phím số của bảng nhập PIN xếp 4 hàng × 3 cột.
// 'block' / 'pinclose' = 1 cột: các nút xếp dọc trong lớp phủ khoá màn hình.
// 'profmenu' = 1 cột: danh sách chọn hồ sơ xổ xuống từ thanh trên cùng, xếp dọc.
// Các vùng trong KHU BỐ MẸ (tiền tố "p"): khai báo số cột để đi bằng phím mũi tên đúng
// với những gì mắt nhìn thấy trên màn hình.
//   ptime / ppin / psrc / pvid = 1 cột  → các ô xếp DỌC, đi bằng lên/xuống.
//   pdays = 7 cột                       → hàng 7 nút T2..CN.
//   pwin  = 3 cột                       → 1 khung giờ: giờ bắt đầu · giờ kết thúc · nút xoá.
//   pdraft = 3 cột                      → 1 video trong playlist nháp: ▲ · ▼ · xoá.
//   padded = 2 cột                      → 1 nội dung đã thêm: nút sửa · nút xoá.
// Các vùng không có tên ở đây (ptabs, pkids, psession, pkidpick, psubmit, pnewvid,
// preport, preportbtn) cố ý để mặc định = NẰM TRÊN 1 HÀNG NGANG, đúng như trên màn hình.
const SECTION_COLS = {
  side: 1,
  playlist: 3,
  video: 3,
  detailback: 1,
  pin: 3,
  block: 1,
  pinclose: 1,
  profmenu: 1,
  ptime: 1,
  pdays: 7,
  pwin: 3,
  ppin: 1,
  prequest: 1,
  psrc: 1,
  pvid: 1,
  pdraft: 3,
  padded: 2,
};

/**
 * Layout — khung sườn cố định (Sidebar + TopBar) bao quanh mọi trang, xử lý:
 * - Điều hướng D-pad toàn cục (useTvNavigation) trên cả sidebar lẫn nội dung trang.
 * - Cổng PIN phụ huynh (bấm 🔒 Bố mẹ ở cuối menu bên trái — xem Sidebar).
 * - Màn hình chặn (BlockScreen) — 2 trường hợp: CHƯA ĐẾN GIỜ xem, và ĐÃ HẾT thời gian
 *   của hôm nay. Không áp dụng khi đang ở trang /parent để phụ huynh luôn vào được.
 *   Bé không tự đóng được — bấm "VÂNG" chỉ là xác nhận đã đọc. Chỉ bố mẹ thoát được, và
 *   đều phải nhập mã PIN, theo 1 trong 2 đường:
 *     • "🔓 Cho xem ngay" → mở khoá TẠM, hết hiệu lực khi tắt app (xem useTempUnlock).
 *     • "🔒 Bố mẹ vào đây" → vào khu Bố mẹ để sửa hẳn cấu hình giờ.
 */
export function Layout() {
  const layoutRef = useRef<HTMLDivElement>(null);
  /**
   * Mở bảng PIN để làm gì. null = đang đóng.
   *  'parent'    → vào khu Bố mẹ
   *  'unlock'    → cho bé xem ngay (bỏ qua giới hạn giờ, tới khi tắt app)
   *  'skipbreak' → cho xem tiếp ngay, không phải chờ hết giờ nghỉ giải lao
   */
  const [pinPurpose, setPinPurpose] = useState<'parent' | 'unlock' | 'skipbreak' | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { resetFocus } = useTvNavigation(layoutRef, SECTION_COLS, {
    onEscape: () => {
      if (location.pathname !== '/') navigate(-1);
    },
  });

  const gate = useTimeGate();
  const { unlocked, grant } = useTempUnlock();
  const { onBreak, secondsLeft: breakSecondsLeft, endBreak } = useBreakGate();
  const { activeProfile } = useProfileContext();
  const { myRequest, createRequest, clearMyRequest } = useTimeRequests(activeProfile?.id ?? null);

  const pinOpen = pinPurpose !== null;
  const isParentRoute = location.pathname.startsWith('/parent');
  // unlocked = bố mẹ đã cho xem ngay (nhập PIN tại chỗ, hoặc duyệt lời xin từ xa) → bỏ
  // qua mọi giới hạn giờ cho tới khi hết suất.
  const showBlockScreen = !isParentRoute && !gate.allowed && !unlocked && !pinOpen;
  // Màn hình nghỉ giải lao nhường chỗ cho màn hình hết giờ: hết giờ hẳn thì nghỉ hay không
  // cũng chẳng còn ý nghĩa, hiện 2 lớp phủ chồng nhau chỉ tổ rối.
  const showBreakScreen = !isParentRoute && !showBlockScreen && onBreak && !pinOpen;

  // Bố mẹ vừa duyệt lời xin từ điện thoại → TV tự mở khoá đúng số phút được cho.
  // useRef để chỉ ăn 1 lần cho mỗi lời xin, không mở lại mỗi lần vẽ lại màn hình.
  const grantedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!myRequest || myRequest.status !== 'approved') return;
    if (grantedRef.current === myRequest.id) return;
    grantedRef.current = myRequest.id;
    grant(myRequest.granted_minutes ?? DEFAULT_REQUEST_MINUTES);
    clearMyRequest();
  }, [myRequest, grant, clearMyRequest]);

  const requestState: RequestState =
    myRequest?.status === 'pending' ? 'pending' : myRequest?.status === 'denied' ? 'denied' : 'idle';

  // Đặt lại ô đang chọn mỗi khi: đổi trang, HOẶC mở/đóng 1 lớp phủ khoá màn hình (bảng
  // PIN, màn hình Chưa đến giờ xem). Lớp phủ mở ra thì ô chọn phải nhảy vào bên trong nó;
  // đóng lại thì quay về nội dung chính.
  useEffect(() => {
    resetFocus();
  }, [location.pathname, pinOpen, showBlockScreen, showBreakScreen, resetFocus]);

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
      <Sidebar onOpenParentGate={() => setPinPurpose('parent')} />
      {/* class "content-col" để CSS chế độ TV chỉnh được cột nội dung này (cần khai báo
          min-width: 0 thì các hàng thẻ mới cuộn ngang được bên trong, thay vì đẩy phình
          cả trang ra ngang) */}
      <div className="content-col" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <Outlet />
      </div>

      <PinModal
        open={pinOpen}
        onClose={() => setPinPurpose(null)}
        onSuccess={() => {
          // Cùng 1 bảng PIN, nhưng nhập đúng rồi thì làm gì lại tuỳ nút nào vừa mở nó ra.
          if (pinPurpose === 'unlock') grant();
          else if (pinPurpose === 'skipbreak') endBreak();
          else navigate('/parent');
          setPinPurpose(null);
        }}
      />

      {showBlockScreen && (
        <BlockScreen
          mode={gate.reason === 'daily_limit' ? 'daily_limit' : 'outside_window'}
          nextWindowStart={gate.nextWindowStart}
          usedMinutes={gate.usedMinutes}
          dailyLimitMinutes={gate.dailyLimitMinutes}
          onOpenParentGate={() => setPinPurpose('parent')}
          onUnlockRequest={() => setPinPurpose('unlock')}
          onAskForMore={() => createRequest(gate.reason)}
          requestState={requestState}
          requestMinutes={DEFAULT_REQUEST_MINUTES}
        />
      )}

      {showBreakScreen && (
        <BreakScreen secondsLeft={breakSecondsLeft} onSkipRequest={() => setPinPurpose('skipbreak')} />
      )}
    </div>
  );
}
