import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { PinModal } from '@/components/parental/PinModal';
import { GoogleSignInGate } from '@/components/parental/GoogleSignInGate';
import { FamilyBindingScreen } from '@/components/parental/FamilyBindingScreen';
import { BlockScreen, type RequestState } from '@/components/parent-dashboard/BlockScreen';
import { BreakScreen } from '@/components/parent-dashboard/BreakScreen';
import { useTvNavigation } from '@/hooks/useTvNavigation';
import { useTimeGate } from '@/hooks/useTimeGate';
import { useTempUnlock } from '@/hooks/useTempUnlock';
import { useBreakGate } from '@/hooks/useWatchStretch';
import { useTimeRequests, DEFAULT_REQUEST_MINUTES } from '@/hooks/useTimeRequests';
import { useFamilyAuth } from '@/hooks/useFamilyAuth';
import { useFamilyDevices } from '@/hooks/useFamilyDevices';
import { useFamilyContentDevices } from '@/hooks/useFamilyContentDevices';
import { useHomeBackground } from '@/hooks/useHomeBackground';
import { useProfileContext } from '@/context/ProfileContext';
import { notifyParentAboutRequest } from '@/lib/push';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getFamilyId } from '@/lib/familyId';
import { isPhoneScreen } from '@/lib/screenSize';

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
  ppush: 1,
  psrc: 1,
  pvid: 1,
  pdraft: 3,
  padded: 2,
  // 'plabel' = 1 cột: khối "Quản lý nhãn" — mỗi hàng nhãn có 1-3 nút/ô tuỳ trạng thái
  // (đổi tên/xoá, hoặc ô nhập + lưu + huỷ lúc đang sửa tên) nên KHÔNG cố định số cột được;
  // xếp dọc 1 cột cho chắc ăn, đi bằng lên/xuống. 'plabelpick' (chọn nhãn khi thêm nội dung)
  // cố ý KHÔNG khai ở đây — giống 'pkidpick', mặc định nằm trên 1 hàng ngang.
  plabel: 1,
  // 'pinemail' = 1 cột: khối "đăng nhập bằng mã gửi qua email" trong GoogleSignInGate (ô
  // email, nút gửi mã, ô nhập mã 6 số, nút xác nhận) — xếp dọc, đi bằng lên/xuống.
  pinemail: 1,
  // 'ppaircode' = 3 cột: bàn phím số "Ghép bằng mã từ điện thoại" trong GoogleSignInGate,
  // xếp giống hệt bàn phím PIN cũ (4 hàng × 3 cột — xem PinModal.tsx).
  ppaircode: 3,
  // 'pkidform' = 1 cột: form thêm/sửa hồ sơ bé (ô tên, nút lưu, nút huỷ) trong
  // ProfilesManagerCard — xếp dọc, đi bằng lên/xuống.
  pkidform: 1,
  // 'pkidemoji' = 6 cột: bộ emoji chọn sẵn khi thêm/sửa hồ sơ bé, xếp lưới ngang.
  pkidemoji: 6,
  // 'pdevice' = 1 cột: danh sách thiết bị đã đăng nhập (mỗi dòng 1 nút "đăng xuất").
  pdevice: 1,
  // 'pcontentdevice' = 1 cột: danh sách thiết bị đã ghép xem nội dung (mỗi dòng 1 nút
  // "ngắt ghép") — ContentDeviceManagerCard.tsx.
  pcontentdevice: 1,
  // 'pbackup' = 1 cột: nút "Xuất file sao lưu".
  pbackup: 1,
  // 'ppair' = 1 cột: nút "Tạo mã ghép" trong PairingCodeCard.
  ppair: 1,
  // 'pbg' = 3 cột: lưới chọn hình nền Trang chủ trong HomeBackgroundCard.tsx (mỗi ô 1 hình
  // nền + tên), xếp lưới ngang giống 'pkidemoji'.
  pbg: 3,
};

/**
 * Layout — khung sườn cố định (Sidebar + TopBar) bao quanh mọi trang, xử lý:
 * - Điều hướng D-pad toàn cục (useTvNavigation) trên cả sidebar lẫn nội dung trang.
 * - Cổng đăng nhập Google cho khu Bố mẹ (bấm 🔒 Bố mẹ ở cuối menu bên trái — xem Sidebar).
 *   Đã đổi từ mã PIN sang đăng nhập Google (xem useFamilyAuth.ts + GoogleSignInGate.tsx +
 *   supabase/011_family_auth.sql) — đăng nhập 1 lần trên thiết bị nào thì thiết bị đó nhớ
 *   luôn, không phải nhập lại PIN mỗi lần vào khu Bố mẹ nữa.
 * - Màn hình chặn (BlockScreen) — 2 trường hợp: CHƯA ĐẾN GIỜ xem, và ĐÃ HẾT thời gian
 *   của hôm nay. Không áp dụng khi đang ở trang /parent để phụ huynh luôn vào được.
 *   Bé không tự đóng được — bấm "VÂNG" chỉ là xác nhận đã đọc. Chỉ bố mẹ thoát được, theo
 *   1 trong 2 đường:
 *     • "🔓 Cho xem ngay" → vẫn dùng mã PIN cũ (mở khoá TẠM, hết hiệu lực khi tắt app, xem
 *       useTempUnlock) — CHƯA đổi sang Google, việc này chỉ cần mở nhanh tại chỗ.
 *     • "🔒 Bố mẹ bấm vào đây" (chỉ có trên điện thoại) → vào khu Bố mẹ (đăng nhập Google)
 *       để sửa hẳn cấu hình giờ.
 * - Cổng vào chính trang /parent: bất kể vào bằng đường nào (bấm nút Bố mẹ, thông báo đẩy
 *   "Con xin thêm giờ" mở thẳng URL '/parent', gõ thẳng URL, bookmark, mở lại tab...), nếu
 *   thiết bị này CHƯA đăng nhập đúng tài khoản Google gia đình thì màn hình đăng nhập tự
 *   bật lên ngay, nội dung trang không hiện ra cho tới khi đăng nhập xong.
 */
export function Layout() {
  const layoutRef = useRef<HTMLDivElement>(null);
  /**
   * Mở bảng PIN để làm gì. null = đang đóng. (Chỉ còn 2 lý do — "vào khu Bố mẹ" đã chuyển
   * sang đăng nhập Google, xem GoogleSignInGate bên dưới, không còn dùng PIN nữa.)
   *  'unlock'    → cho bé xem ngay (bỏ qua giới hạn giờ, tới khi tắt app)
   *  'skipbreak' → cho xem tiếp ngay, không phải chờ hết giờ nghỉ giải lao
   */
  const [pinPurpose, setPinPurpose] = useState<'unlock' | 'skipbreak' | null>(null);
  const { session: familySession, loading: authLoading } = useFamilyAuth();
  // "Thiết lập lần đầu" — thiết bị này đã từng xác định GIA ĐÌNH NÀO chưa (xem
  // src/lib/familyId.ts). Từ khi app cho nhiều gia đình khác nhau cùng dùng chung
  // (supabase/013_multi_family.sql), MỌI thiết bị (kể cả TV) phải qua bước này ĐÚNG 1 LẦN
  // trước khi vào được app — sau đó ghi nhớ vĩnh viễn, bé xem tiếp không cần đăng nhập gì.
  const [familyId, setFamilyIdState] = useState(getFamilyId());
  const needsFamilySetup = !authLoading && !familyId;
  // Ghi nhận thiết bị này vào family_devices khi vừa đăng nhập xong, và tự đăng xuất ngay
  // nếu phụ huynh "đăng xuất từ xa" thiết bị này từ 1 thiết bị khác (xem
  // useFamilyDevices.ts + tab "Tài khoản" > "Thiết bị đã đăng nhập"). Đặt ở đây (Layout,
  // mount đúng 1 lần cho toàn app) để hoạt động trên MỌI trang, không riêng gì /parent.
  useFamilyDevices(familySession);
  // Ghi nhận thiết bị này vào family_content_devices khi có familyId — CHẠY TRÊN MỌI THIẾT
  // BỊ, kể cả TV ghép bằng mã chưa từng đăng nhập gì (xem GoogleSignInGate.tsx phần "Ghép
  // bằng mã" + supabase/015_content_devices.sql). Khác với useFamilyDevices ở trên (chỉ
  // chạy khi có phiên đăng nhập) — đây là bảng riêng theo dõi "xem được nội dung hay không",
  // không phải "đăng nhập Khu Bố mẹ hay không". Bị "Ngắt ghép" từ xa → tự xoá familyId khỏi
  // máy (clearFamilyId bên trong hook) → cập nhật lại state ở đây để Layout tự bật lại màn
  // "Thiết lập lần đầu" ngay, không xem được nội dung nữa.
  useFamilyContentDevices(familyId, () => setFamilyIdState(null));
  const navigate = useNavigate();
  const location = useLocation();

  const { resetFocus } = useTvNavigation(layoutRef, SECTION_COLS, {
    onEscape: () => {
      if (location.pathname !== '/') navigate(-1);
    },
  });

  // Hình nền Trang chủ theo mùa/dịp lễ (xem useHomeBackground.ts) — CỐ Ý chỉ áp dụng đúng
  // lúc đang ở Trang chủ ("/"), KHÔNG áp dụng khi đang phát video hay đang ở khu Bố mẹ, để
  // không ảnh hưởng mắt bé lúc xem phim và không đụng tới layout khu Bố mẹ đã tinh chỉnh
  // riêng (xem theme.css phần "HÌNH NỀN TRANG CHỦ THEO MÙA/DỊP LỄ").
  const { backgroundId: homeBackgroundId } = useHomeBackground();
  const homeBgTheme = location.pathname === '/' ? homeBackgroundId : null;

  const gate = useTimeGate();
  const { unlocked, grant } = useTempUnlock();
  const { onBreak, secondsLeft: breakSecondsLeft, endBreak } = useBreakGate();
  const { activeProfile, refreshProfiles } = useProfileContext();
  const { myRequest, createRequest, clearMyRequest } = useTimeRequests(activeProfile?.id ?? null);

  const pinOpen = pinPurpose !== null;
  const isParentRoute = location.pathname.startsWith('/parent');
  // Đã đăng nhập đúng tài khoản Google gia đình trên THIẾT BỊ NÀY chưa (thay cho PIN cũ) —
  // xem useFamilyAuth.ts. authLoading = còn đang tra phiên đăng nhập đã lưu trước đó, coi
  // như "chưa vào được" trong lúc chờ, để tránh nhấp nháy hiện màn đăng nhập rồi biến mất.
  const parentGateOk = !authLoading && !!familySession;
  const showGoogleGate = !needsFamilySetup && isParentRoute && !parentGateOk;
  // unlocked = bố mẹ đã cho xem ngay (nhập PIN tại chỗ, hoặc duyệt lời xin từ xa) → bỏ
  // qua mọi giới hạn giờ cho tới khi hết suất. "needsFamilySetup" luôn ưu tiên cao nhất —
  // chưa xác định được gia đình thì chưa có gì để tính giờ giấc cả, khỏi hiện chồng lớp.
  const showBlockScreen = !needsFamilySetup && !isParentRoute && !gate.allowed && !unlocked && !pinOpen;
  // Màn hình nghỉ giải lao nhường chỗ cho màn hình hết giờ: hết giờ hẳn thì nghỉ hay không
  // cũng chẳng còn ý nghĩa, hiện 2 lớp phủ chồng nhau chỉ tổ rối.
  const showBreakScreen = !needsFamilySetup && !isParentRoute && !showBlockScreen && onBreak && !pinOpen;

  /*
    Tới giờ nghỉ giải lao mà bé đang ở trang phát → RỜI HẲN về trang chủ.

    Vì sao phải rời trang chứ không chỉ phủ lớp thông báo lên: lúc xem toàn màn hình,
    video che kín mọi thứ — lớp phủ vẽ ra cũng không ai thấy, mà tiếng thì vẫn chạy tiếp.
    Rời trang thì trình phát bị gỡ bỏ hẳn: hình tắt, tiếng tắt, tự thoát toàn màn hình.
    Chỗ đang xem dở vẫn được nhớ (khối "Tiếp tục xem" ở trang chủ).

    Cố ý đặt ở ĐÂY chứ không phải trong PlayerPage: Layout vốn đã phải theo dõi giờ nghỉ
    để bật màn hình nghỉ rồi. Để cả 2 nơi cùng theo dõi thì thành 2 bộ đếm chạy song song
    mỗi giây, ngay trên trang nặng nhất (đang phát video) và trên cái máy yếu nhất (TV).
  */
  useEffect(() => {
    if (onBreak && location.pathname === '/player') navigate('/');
  }, [onBreak, location.pathname, navigate]);

  /*
    Trên ĐIỆN THOẠI THẬT: khoá thẳng vào Khu vực Bố mẹ, không cho vào Trang chủ/xem video
    nữa — giao diện xem video (lưới thẻ, trình phát...) chưa tối ưu cho màn hình điện thoại,
    và trên thực tế bé chỉ xem trên TV, điện thoại chỉ để bố mẹ quản lý từ xa. iPad KHÔNG bị
    ảnh hưởng (isPhoneScreen() chỉ đúng ở bề ngang ≤700px, mọi iPad đều rộng hơn — xem
    src/lib/screenSize.ts). Không áp dụng lúc còn "Thiết lập lần đầu": lớp phủ đó đã tự khoá
    kín mọi trang rồi, đợi thiết lập xong (needsFamilySetup=false) thì mới cần điều hướng.

    Lắng nghe cả sự kiện resize (không chỉ chạy 1 lần lúc mount) — phòng khi trình duyệt bị
    thu nhỏ ngang qua mốc điện thoại trong lúc đang mở (hiếm nhưng vẫn nên xử lý đúng).
  */
  useEffect(() => {
    const enforcePhoneParentOnly = () => {
      if (needsFamilySetup) return;
      if (isPhoneScreen() && !location.pathname.startsWith('/parent')) {
        navigate('/parent', { replace: true });
      }
    };
    enforcePhoneParentOnly();
    window.addEventListener('resize', enforcePhoneParentOnly);
    return () => window.removeEventListener('resize', enforcePhoneParentOnly);
  }, [location.pathname, needsFamilySetup, navigate]);

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
  // PIN, màn hình đăng nhập Google, màn hình Chưa đến giờ xem). Lớp phủ mở ra thì ô chọn
  // phải nhảy vào bên trong nó; đóng lại thì quay về nội dung chính.
  useEffect(() => {
    resetFocus();
  }, [location.pathname, pinOpen, showGoogleGate, showBlockScreen, showBreakScreen, needsFamilySetup, resetFocus]);

  return (
    <div className="layout" ref={layoutRef} data-bg-theme={homeBgTheme ?? undefined}>
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
      <Sidebar onOpenParentGate={() => navigate('/parent')} />
      {/* class "content-col" để CSS chế độ TV chỉnh được cột nội dung này (cần khai báo
          min-width: 0 thì các hàng thẻ mới cuộn ngang được bên trong, thay vì đẩy phình
          cả trang ra ngang) */}
      <div className="content-col" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        {/* Đang ở /parent mà CHƯA đăng nhập Google thì không vẽ trang ra — tránh vào thẳng
            URL (vd bấm thông báo đẩy) mà thấy được nội dung khu Bố mẹ trong khoảnh khắc
            trước khi màn đăng nhập kịp bật lên. Màn đăng nhập (bên dưới) tự mở vì showGoogleGate.
            Tương tự với "Thiết lập lần đầu" (needsFamilySetup) — áp dụng cho MỌI trang chứ
            không riêng /parent, vì chưa biết gia đình nào thì chưa có gì để hiện cả. */}
        {needsFamilySetup || (isParentRoute && !parentGateOk) ? null : <Outlet />}
      </div>

      <PinModal
        open={pinOpen}
        onClose={() => setPinPurpose(null)}
        onSuccess={() => {
          // Cùng 1 bảng PIN, nhưng nhập đúng rồi thì làm gì lại tuỳ nút nào vừa mở nó ra.
          // (Chỉ còn 2 lý do — "vào khu Bố mẹ" đã chuyển sang đăng nhập Google, xem dưới.)
          if (pinPurpose === 'unlock') grant();
          else if (pinPurpose === 'skipbreak') endBreak();
          setPinPurpose(null);
        }}
      />

      {/* "Thiết lập lần đầu" — thiết bị này CHƯA từng xác định thuộc gia đình nào. Bắt buộc
          (dismissable=false), áp dụng cho MỌI trang chứ không riêng /parent. Xem chú thích
          đầu file + supabase/013_multi_family.sql. 2 bước:
            1) Chưa đăng nhập → GoogleSignInGate (đăng nhập Google, hoặc mã qua email).
            2) Đã đăng nhập → FamilyBindingScreen (nhận diện/tạo gia đình, lưu vào thiết bị). */}
      {needsFamilySetup && !familySession && (
        <GoogleSignInGate
          dismissable={false}
          onClose={() => {}}
          allowPairing
          onPaired={() => {
            setFamilyIdState(getFamilyId());
            // Giống hệt lý do refreshProfiles() ở onBound bên dưới: ProfileProvider đã tải
            // 1 lần lúc app khởi động, lúc đó familyId còn rỗng — tải lại đúng lúc vừa ghép
            // xong để Trang chủ hiện hồ sơ ngay.
            refreshProfiles();
          }}
        />
      )}
      {needsFamilySetup && familySession && (
        <FamilyBindingScreen
          session={familySession}
          onBound={() => {
            setFamilyIdState(getFamilyId());
            // ProfileProvider (main.tsx) đã tải 1 lần lúc app khởi động, LÚC ĐÓ familyId
            // còn rỗng (chưa thiết lập xong) nên chưa lấy được hồ sơ nào — tải lại đúng lúc
            // vừa xác định xong gia đình, để Trang chủ hiện hồ sơ ngay, không cần tải lại
            // trang thủ công.
            refreshProfiles();
          }}
        />
      )}

      {showGoogleGate && (
        <GoogleSignInGate
          onClose={() => {
            // Đóng màn đăng nhập mà chưa đăng nhập xong → không đứng lại đó với trang
            // trắng, đưa về Trang chủ cho gọn (giống hệt PinModal cũ).
            navigate('/');
          }}
        />
      )}

      {showBlockScreen && (
        <BlockScreen
          mode={gate.reason === 'daily_limit' ? 'daily_limit' : 'outside_window'}
          nextWindowStart={gate.nextWindowStart}
          usedMinutes={gate.usedMinutes}
          dailyLimitMinutes={gate.dailyLimitMinutes}
          onOpenParentGate={() => navigate('/parent')}
          onUnlockRequest={() => setPinPurpose('unlock')}
          onAskForMore={async () => {
            const requestId = await createRequest(gate.reason);
            // Gửi lời xin xong mới bắn thông báo. Thứ tự này quan trọng: lời xin nằm trong
            // Supabase là phần KHÔNG ĐƯỢC HỎNG (bố mẹ mở khu Bố mẹ ra là thấy); thông báo
            // đẩy chỉ là để nhanh hơn, hỏng cũng không mất gì.
            if (requestId) notifyParentAboutRequest(requestId);
          }}
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
