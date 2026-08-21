import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/navigation/Layout';
import { HomePage } from '@/pages/HomePage';
import { PlaylistDetailPage } from '@/pages/PlaylistDetailPage';
import { ChannelPage } from '@/pages/ChannelPage';
import { ChannelPlaylistPage } from '@/pages/ChannelPlaylistPage';
import { PlayerPage } from '@/pages/PlayerPage';
import { ParentDashboardPage } from '@/pages/ParentDashboardPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/playlist/:sourceId" element={<PlaylistDetailPage />} />
        <Route path="/channel/:sourceId" element={<ChannelPage />} />
        <Route path="/channel/:sourceId/playlist/:playlistId" element={<ChannelPlaylistPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/parent" element={<ParentDashboardPage />} />
        {/* Phòng hờ thêm 1 lớp an toàn: nếu vì lý do gì đó path không khớp route nào
            ở trên (vd URL lạ, dấu "/" thừa...), thay vì im lặng không hiện gì (màn
            hình trắng không dấu vết), điều hướng thẳng về trang chủ. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
