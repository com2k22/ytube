import { useState } from 'react';
import { useProfileContext } from '@/context/ProfileContext';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useToast } from '@/components/common/Toast';
import { isSafeHttpsUrl, sanitizeTitle } from '@/utils/urlValidator';
import { extractPlaylistId, extractVideoId, extractChannelRef } from '@/utils/youtubeParser';
import { fetchPlaylistInfo, fetchVideoInfo } from '@/lib/youtube';
import type { SourceType } from '@/types';

const TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'youtube_playlist', label: 'Playlist YouTube' },
  { value: 'youtube_video', label: 'Link YouTube (video đơn lẻ)' },
  { value: 'youtube_channel', label: 'Kênh YouTube' },
  { value: 'direct_url', label: 'Link trực tiếp (mp4/m3u8)' },
];

const TYPE_LABEL: Record<SourceType, string> = {
  youtube_playlist: 'Playlist',
  youtube_video: 'Video YouTube',
  youtube_channel: 'Kênh',
  direct_url: 'Link trực tiếp',
};

interface Props {
  defaultProfileId: string;
}

/** Form "Thêm nguồn nội dung" — dùng ở trang Bố mẹ, tab Thêm nội dung. */
export function AddSourceForm({ defaultProfileId }: Props) {
  const { profiles } = useProfileContext();
  const [type, setType] = useState<SourceType>('youtube_playlist');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [forProfile, setForProfile] = useState(defaultProfileId);
  const [urlHint, setUrlHint] = useState<{ text: string; ok: boolean } | null>(null);
  const [resolving, setResolving] = useState(false);
  const { addSource } = useAllowedSources(forProfile);
  const { showToast } = useToast();

  const onUrlChange = (value: string) => {
    setUrl(value);
    if (!value.trim()) {
      setUrlHint(null);
      return;
    }
    setUrlHint(
      isSafeHttpsUrl(value) ? { text: '✓ Link hợp lệ (https)', ok: true } : { text: '✕ Cần bắt đầu bằng https://', ok: false }
    );
  };

  /** Thử tự dò tiêu đề thật từ YouTube Data API (cần VITE_YOUTUBE_API_KEY). */
  const autoFill = async () => {
    if (!isSafeHttpsUrl(url)) return;
    setResolving(true);
    try {
      if (type === 'youtube_video') {
        const id = extractVideoId(url);
        const info = id ? await fetchVideoInfo(id) : null;
        if (info) {
          setTitle(info.title);
          setThumbnail(info.thumbnail);
        } else showToast('Không dò được tiêu đề — kiểm tra lại link hoặc API key YouTube trong .env');
      } else if (type === 'youtube_playlist') {
        const id = extractPlaylistId(url);
        const info = id ? await fetchPlaylistInfo(id) : null;
        if (info) {
          setTitle(info.title);
          setThumbnail(info.thumbnail);
        } else showToast('Không dò được playlist — kiểm tra lại link hoặc API key YouTube trong .env');
      } else if (type === 'youtube_channel') {
        const { channelId, handle } = extractChannelRef(url);
        if (!channelId && handle) {
          showToast('Link dạng @handle cần đổi sang channelId thật thủ công (xem README) trước khi dò tự động.');
        } else if (!channelId) {
          showToast('Không nhận diện được link kênh.');
        }
      }
    } finally {
      setResolving(false);
    }
  };

  const submit = async () => {
    const cleanTitle = sanitizeTitle(title);
    if (!cleanTitle || !isSafeHttpsUrl(url)) {
      setUrlHint({ text: '✕ Vui lòng nhập tiêu đề và link https hợp lệ', ok: false });
      return;
    }
    const ok = await addSource({ profileId: forProfile, type, title: cleanTitle, url, thumbnail });
    if (ok) {
      const profileLabel = profiles.find((p) => p.id === forProfile)?.name ?? forProfile;
      showToast(`📌 Đã thêm ${TYPE_LABEL[type]} — ${cleanTitle} (cho ${profileLabel})`);
      setTitle('');
      setUrl('');
      setThumbnail(null);
      setUrlHint(null);
    } else {
      showToast('Có lỗi khi lưu — thử lại nhé.');
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <p className="sub" style={{ textAlign: 'left', opacity: 0.65, fontSize: 12.5, marginBottom: 16 }}>
        Chỉ nội dung trong danh sách này bé mới xem được
      </p>

      <div className="form-row">
        <label>Loại nguồn</label>
        <select value={type} onChange={(e) => setType(e.target.value as SourceType)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Đường link</label>
        <input value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://..." />
        {urlHint && <div className={`hint ${urlHint.ok ? 'ok-text' : 'bad-text'}`}>{urlHint.text}</div>}
        {(type === 'youtube_playlist' || type === 'youtube_video' || type === 'youtube_channel') && (
          <button
            type="button"
            className="add-window-btn"
            style={{ marginTop: 8 }}
            disabled={resolving || !isSafeHttpsUrl(url)}
            onClick={autoFill}
          >
            {resolving ? 'Đang dò...' : '🔎 Dò tiêu đề từ YouTube'}
          </button>
        )}
      </div>

      <div className="form-row">
        <label>Tiêu đề hiển thị</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Nhạc thiếu nhi vui nhộn" />
      </div>

      <div className="form-row">
        <label>Dành cho bé</label>
        <select value={forProfile} onChange={(e) => setForProfile(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <button className="submit-btn" onClick={submit}>
        Thêm vào danh sách
      </button>
    </div>
  );
}
