import { useState } from 'react';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useToast } from '@/components/common/Toast';
import { isSafeHttpsUrl, sanitizeTitle } from '@/utils/urlValidator';
import { extractPlaylistId, extractVideoId, extractChannelRef } from '@/utils/youtubeParser';
import { fetchPlaylistInfo, fetchVideoInfo } from '@/lib/youtube';
import { PROFILE_IDS, PROFILE_EMOJI, SOURCE_TYPE_ICON } from '@/constants';
import type { AllowedSource, SourceType } from '@/types';

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

const KIDS: { id: string; name: string }[] = [
  { id: PROFILE_IDS.MINA, name: 'Mina' },
  { id: PROFILE_IDS.COM, name: 'Cốm' },
];

const emptyForm = { type: 'youtube_playlist' as SourceType, title: '', url: '', thumbnail: null as string | null };

/** Nhãn hiển thị cho biết 1 nội dung dành cho bé nào — null = dùng chung cho cả 2 bé. */
function profileBadge(profileId: string | null) {
  if (!profileId) return '🐻🦊 Cả 2 bé';
  const kid = KIDS.find((k) => k.id === profileId);
  return `${PROFILE_EMOJI[profileId] ?? ''} ${kid?.name ?? ''}`.trim();
}

/**
 * AddSourceForm — form "Thêm nội dung" + danh mục nội dung đã thêm (sửa/xoá được),
 * trình bày theo phong cách settings-card giống tab "Quản lý thời gian".
 */
export function AddSourceForm() {
  const { sources, loading, addSource, updateSource, removeSource } = useAllowedSources('all');
  const { showToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedKids, setSelectedKids] = useState<string[]>([PROFILE_IDS.MINA]);
  const [urlHint, setUrlHint] = useState<{ text: string; ok: boolean } | null>(null);
  const [resolving, setResolving] = useState(false);

  const isEditing = editingId !== null;

  const toggleKid = (id: string) => {
    setSelectedKids((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  };

  const onUrlChange = (value: string) => {
    setForm((f) => ({ ...f, url: value }));
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
    if (!isSafeHttpsUrl(form.url)) return;
    setResolving(true);
    try {
      if (form.type === 'youtube_video') {
        const id = extractVideoId(form.url);
        const info = id ? await fetchVideoInfo(id) : null;
        if (info) setForm((f) => ({ ...f, title: info.title, thumbnail: info.thumbnail }));
        else showToast('Không dò được tiêu đề — kiểm tra lại link hoặc API key YouTube trong .env');
      } else if (form.type === 'youtube_playlist') {
        const id = extractPlaylistId(form.url);
        const info = id ? await fetchPlaylistInfo(id) : null;
        if (info) setForm((f) => ({ ...f, title: info.title, thumbnail: info.thumbnail }));
        else showToast('Không dò được playlist — kiểm tra lại link hoặc API key YouTube trong .env');
      } else if (form.type === 'youtube_channel') {
        const { channelId, handle } = extractChannelRef(form.url);
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

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedKids([PROFILE_IDS.MINA]);
    setUrlHint(null);
  };

  const startEdit = (s: AllowedSource) => {
    setEditingId(s.id);
    setForm({ type: s.type, title: s.title, url: s.url, thumbnail: s.thumbnail });
    setSelectedKids(s.profile_id ? [s.profile_id] : [PROFILE_IDS.MINA, PROFILE_IDS.COM]);
    setUrlHint(null);
  };

  const onDelete = async (s: AllowedSource) => {
    if (!window.confirm(`Xoá "${s.title}" khỏi danh sách?`)) return;
    const ok = await removeSource(s.id);
    if (ok) {
      showToast('🗑 Đã xoá khỏi danh sách');
      if (editingId === s.id) resetForm();
    } else showToast('Có lỗi khi xoá — thử lại nhé.');
  };

  const submit = async () => {
    const cleanTitle = sanitizeTitle(form.title);
    if (!cleanTitle || !isSafeHttpsUrl(form.url)) {
      setUrlHint({ text: '✕ Vui lòng nhập tiêu đề và link https hợp lệ', ok: false });
      return;
    }
    if (selectedKids.length === 0) {
      showToast('Chọn ít nhất 1 bé (hoặc cả 2) cho nội dung này.');
      return;
    }
    // Chọn cả 2 bé → lưu profile_id = null (dùng chung); chỉ chọn 1 bé → lưu id bé đó.
    const profileId = selectedKids.length === KIDS.length ? null : selectedKids[0];
    const payload = { profileId, type: form.type, title: cleanTitle, url: form.url, thumbnail: form.thumbnail };

    const ok = isEditing ? await updateSource(editingId as string, payload) : await addSource(payload);
    if (ok) {
      showToast(isEditing ? `💾 Đã lưu thay đổi — ${cleanTitle}` : `📌 Đã thêm ${TYPE_LABEL[form.type]} — ${cleanTitle}`);
      resetForm();
    } else {
      showToast('Có lỗi khi lưu — thử lại nhé.');
    }
  };

  return (
    <>
      <div className="settings-card" style={{ maxWidth: 480 }}>
        <h4>{isEditing ? '✏️ Sửa nội dung' : '➕ Thêm nội dung mới'}</h4>
        <p style={{ fontSize: 12.5, opacity: 0.65, margin: '-8px 0 16px' }}>
          Chỉ nội dung trong danh sách này bé mới xem được.
        </p>

        <div className="form-row">
          <label>Loại nguồn</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SourceType }))}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Đường link</label>
          <input value={form.url} onChange={(e) => onUrlChange(e.target.value)} placeholder="https://..." />
          {urlHint && <div className={`hint ${urlHint.ok ? 'ok-text' : 'bad-text'}`}>{urlHint.text}</div>}
          {(form.type === 'youtube_playlist' || form.type === 'youtube_video' || form.type === 'youtube_channel') && (
            <button
              type="button"
              className="add-window-btn"
              style={{ marginTop: 8 }}
              disabled={resolving || !isSafeHttpsUrl(form.url)}
              onClick={autoFill}
            >
              {resolving ? 'Đang dò...' : '🔎 Dò tiêu đề từ YouTube'}
            </button>
          )}
        </div>

        <div className="form-row">
          <label>Tiêu đề hiển thị</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="VD: Nhạc thiếu nhi vui nhộn"
          />
        </div>

        <div className="form-row">
          <label>Dành cho bé</label>
          <div className="day-pills">
            {KIDS.map((k) => (
              <div key={k.id} className={`day-pill ${selectedKids.includes(k.id) ? 'on' : ''}`} onClick={() => toggleKid(k.id)}>
                {PROFILE_EMOJI[k.id]} {k.name}
              </div>
            ))}
          </div>
          <div className="hint" style={{ opacity: 0.6, height: 'auto', marginTop: 6 }}>
            Chọn cả 2 nếu nội dung phù hợp với cả hai bé.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="submit-btn" onClick={submit}>
            {isEditing ? '💾 Lưu thay đổi' : 'Thêm vào danh sách'}
          </button>
          {isEditing && (
            <button className="add-window-btn" onClick={resetForm} style={{ flexShrink: 0 }}>
              Huỷ
            </button>
          )}
        </div>
      </div>

      <div className="settings-card" style={{ maxWidth: 640 }}>
        <h4>📋 Nội dung đã thêm ({sources.length})</h4>
        {loading && <p style={{ fontSize: 13, opacity: 0.6 }}>Đang tải...</p>}
        {!loading && sources.length === 0 && (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Chưa có nội dung nào — thêm ở form phía trên nhé.</p>
        )}
        <div className="added-list">
          {sources.map((s) => (
            <div className="added-item" key={s.id} style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <span>{SOURCE_TYPE_ICON[s.type] ?? '📄'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {TYPE_LABEL[s.type]} · {profileBadge(s.profile_id)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="icon-btn" title="Sửa" onClick={() => startEdit(s)}>
                  ✏️
                </button>
                <button className="icon-btn" title="Xoá" onClick={() => onDelete(s)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
