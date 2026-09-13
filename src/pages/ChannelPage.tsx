import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSourceById } from '@/hooks/useSourceById';
import { extractChannelRef } from '@/utils/youtubeParser';
import { fetchChannelUploadsPlaylistId, fetchPlaylistItems, resolveChannelHandle } from '@/lib/youtube';
import { PlaylistVideosView } from './PlaylistVideosView';
import type { ResolvedVideo } from '@/types';

/**
 * Trang video của 1 kênh đã whitelist — CHỈ hiện video do CHÍNH kênh đó tự đăng tải (lấy
 * qua playlist "Uploads" đặc biệt của kênh trên YouTube, xem fetchChannelUploadsPlaylistId).
 *
 * TRƯỚC ĐÂY trang này liệt kê MỌI playlist do kênh tự tạo (fetchChannelPlaylists) rồi bắt bé
 * chọn playlist mới xem được video — nhưng playlist "tuyển tập" kiểu đó có thể bị kênh gộp
 * cả video của KÊNH KHÁC vào, khiến "tin 1 kênh" vô tình cho xem được nội dung ngoài ý muốn.
 * Đổi sang dùng playlist Uploads để đảm bảo đúng yêu cầu: tin 1 kênh thì chỉ xem được đúng
 * nội dung do kênh đó tự làm ra.
 */
export function ChannelPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const { source, loading: loadingSource } = useSourceById(sourceId ?? null);
  const [videos, setVideos] = useState<ResolvedVideo[]>([]);
  const [uploadsPlaylistId, setUploadsPlaylistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!source) return;

    const loadUploads = async (channelId: string) => {
      setLoading(true);
      setError(null);
      const uploadsId = await fetchChannelUploadsPlaylistId(channelId);
      if (!uploadsId) {
        setError('Không tải được video của kênh (thiếu VITE_YOUTUBE_API_KEY, hoặc link kênh không hợp lệ).');
        setLoading(false);
        return;
      }
      setUploadsPlaylistId(uploadsId);
      const items = await fetchPlaylistItems(uploadsId);
      if (items.length === 0) setError('Kênh này chưa có video công khai nào.');
      setVideos(
        items.map((it) => ({
          videoId: it.videoId,
          title: it.title,
          thumbnail: it.thumbnail,
          sourceType: 'youtube_channel' as const,
        }))
      );
      setLoading(false);
    };

    const { channelId, handle } = extractChannelRef(source.url);
    if (channelId) {
      loadUploads(channelId);
    } else if (handle) {
      // Link đã lưu vẫn ở dạng @handle (chưa từng dò qua nút "🔎 Dò tiêu đề") —
      // tự đổi sang channelId thật ngay khi mở trang, không cần sửa link thủ công.
      setLoading(true);
      resolveChannelHandle(handle).then((resolved) => {
        if (resolved) loadUploads(resolved.channelId);
        else {
          setError(
            `Không đổi được "${handle}" sang channelId — kiểm tra API key YouTube, hoặc mở lại link này trong tab Thêm nội dung và bấm "Dò tiêu đề".`
          );
          setLoading(false);
        }
      });
    } else {
      setError('Không nhận diện được channelId từ link đã lưu.');
      setLoading(false);
    }
  }, [source?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingSource || !source) return null;

  return (
    <PlaylistVideosView
      title={source.title}
      videos={videos}
      loading={loading}
      error={error}
      playlistId={uploadsPlaylistId}
      progressSourceId={source.id}
      onBack={() => navigate(-1)}
    />
  );
}
