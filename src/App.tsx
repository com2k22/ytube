import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/navigation/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage';
import { ChannelPage } from '@/pages/ChannelPage';
import { ChannelPlaylistPage } from '@/pages/ChannelPlaylistPage';
import { PlayerPage } from '@/pages/PlayerPage';
import { ParentDashboardPage } from '@/pages/ParentDashboardPage';
import { MobileDiscoverPage } from '@/pages/mobile/MobileDiscoverPage';
import { MobileDownloadsPage } from '@/pages/mobile/MobileDownloadsPage';
import { MobileParentTimePage } from '@/pages/mobile/MobileParentTimePage';
import { MobileParentContentPage } from '@/pages/mobile/MobileParentContentPage';
import { MobileParentKidsPage } from '@/pages/mobile/MobileParentKidsPage';
import { MobileParentAccountPage } from '@/pages/mobile/MobileParentAccountPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/playlist/:sourceId" element={<PlaylistDetailPage />} />
        <Route path="/channel/:sourceId" element={<ChannelPage />} />
        <Route path="/channel/:sourceId/playlist/:playlistId" element={<ChannelPlaylistPage />} />
        <Route path="/player" element={<PlayerPage />} />
        {/* 2 tab còn lại của thanh menu điện thoại (MobileBottomNav) — chỉ điện thoại thật
            mới có đường dẫn tới đây (TV/iPad/máy tính không đổi gì). */}
        <Route path="/discover" element={<MobileDiscoverPage />} />
        <Route path="/downloads" element={<MobileDownloadsPage />} />
        <Route path="/parent" element={<ParentDashboardPage />} />
        {/* 4 trang con của Khu vực Bố mẹ trên điện thoại — mỗi mục giờ là 1 trang riêng
            thay vì khối gập/mở, xem MobileParentDashboard.tsx. Vẫn nằm trong "/parent/*"
            nên được bảo vệ bởi đăng nhập Google y hệt /parent (Layout.tsx so khớp theo tiền
            tố đường link, không cần khai báo gì thêm). Mỗi trang tự kiểm tra lại: không
            phải điện thoại thật thì tự quay về /parent, phòng trường hợp gõ thẳng URL trên
            máy tính/TV/iPad (những nơi này vẫn dùng đúng 1 trang /parent như cũ). */}
        <Route path="/parent/time" element={<MobileParentTimePage />} />
        <Route path="/parent/content" element={<MobileParentContentPage />} />
        <Route path="/parent/kids" element={<MobileParentKidsPage />} />
        <Route path="/parent/account" element={<MobileParentAccountPage />} />
        {/* Phòng hờ thêm 1 lớp an toàn: nếu vì lý do gì đó path không khớp route nào
            ở trên (vd URL lạ, dấu "/" thừa...), thay vì im lặng không hiện gì (màn
            hình trắng không dấu vết), điều hướng thẳng về trang chủ. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
