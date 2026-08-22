import { useState } from 'react';
import { useAllowedSources } from '@/hooks/useAllowedSources';
import { useToast } from '@/components/common/Toast';
import { isSafeHttpsUrl, sanitizeTitle } from '@/utils/urlValidator';
import { extractPlaylistId, extractVideoId, extractChannelRef } from '@/utils/youtubeParser';
import { fetchPlaylistInfo, fetchVideoInfo, fetchChannelInfo, resolveChannelHandle } from '@/lib/youtube';
import { PROFILE_IDS, PROFILE_EMOJI, SOURCE_TYPE_ICON } from '@/constants';
import type { AllowedSource, CustomPlaylistItem, SourceType } from '@/types';

const TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'youtube_playlist', label: 'Playlist YouTube' },
  { value: 'youtube_video', label: 'Link YouTube (video đơn lẻ)' },
  { value: 'youtube_channel', label: 'Kênh YouTube' },
  { value: 'direct_url', label: 'Link trực tiếp (mp4/m3u8)' },
  { value: 'custom_playlist', label: '🧩 Playlist tự tạo (ghép từ video đơn lẻ)' },
];

const TYPE_LABEL: Record<SourceType, string> = {
  youtube_playlist: 'Playlist',
  youtube_video: 'Video YouTube',
  youtube_channel: 'Kênh',
  direct_url: 'Link trực tiếp',
  custom_playlist: 'Playlist tự tạo',
};

const KIDS: { id: string; name: string }[] = [
  { id: PROFILE_IDS.MINA, name: 'Mina' },
  { id: PROFILE_IDS.COM, name: 'Cốm' },
];

/** URL giả dùng làm chỗ trống cho playlist tự tạo — loại này không có 1 link duy nhất, ghép từ nhiều video. */
const CUSTOM_PLAYLIST_URL = 'internal://custom-playlist';

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

  // Riêng cho loại "Playlist tự tạo": ghép nhiều video đơn lẻ lại thành 1 danh sách.
  const [draftItems, setDraftItems] = useState<CustomPlaylistItem[]>([]);
  const [draftVideoUrl, setDraftVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);

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
        if (handle) {
          // Link dạng @tenkenh — tự đổi sang channelId thật (UC...) qua YouTube API,
          // rồi lưu lại đường link đã đổi để lần sau không cần dò lại nữa.
          const resolved = await resolveChannelHandle(handle);
          if (resolved) {
            setForm((f) => ({
              ...f,
              title: resolved.title,
              thumbnail: resolved.thumbnail,
              url: `https://www.youtube.com/channel/${resolved.channelId}`,
            }));
            showToast('✓ Đã đổi @handle sang channelId thật, tự lưu link mới.');
          } else {
            showToast('Không đổi được @handle này — kiểm tra lại link hoặc API key YouTube trong .env.');
          }
        } else if (channelId) {
          const info = await fetchChannelInfo(channelId);
          if (info) setForm((f) => ({ ...f, title: info.title, thumbnail: info.thumbnail }));
          else showToast('Không dò được thông tin kênh — kiểm tra lại link hoặc API key YouTube.');
        } else {
          showToast('Không nhận diện được link kênh.');
        }
      }
    } finally {
      setResolving(false);
    }
  };

  /** Thêm 1 video (dán link YouTube) vào danh sách nháp của playlist tự tạo. */
  const addDraftVideo = async () => {
    const id = extractVideoId(draftVideoUrl);
    if (!draftVideoUrl.trim() || !id) {
      showToast('Dán 1 link video YouTube hợp lệ (VD: https://youtu.be/...) rồi thêm nhé.');
      return;
    }
    if (draftItems.some((it) => it.videoId === id)) {
      showToast('Video này đã có trong playlist rồi.');
      setDraftVideoUrl('');
      return;
    }
    setAddingVideo(true);
    try {
      const info = await fetchVideoInfo(id);
      setDraftItems((prev) => [...prev, { videoId: id, title: info?.title ?? `Video ${prev.length + 1}`, thumbnail: info?.thumbnail ?? null }]);
      setDraftVideoUrl('');
      if (!info) showToast('Đã thêm video (chưa dò được tiêu đề thật — kiểm tra API key YouTube nếu cần).');
    } finally {
      setAddingVideo(false);
    }
  };

  const removeDraftVideo = (videoId: string) => {
    setDraftItems((prev) => prev.filter((it) => it.videoId !== videoId));
  };

  /** Video đơn lẻ đã có sẵn trong whitelist — cho phép chọn nhanh vào playlist tự tạo, khỏi dán lại link. */
  const existingVideos = sources.filter((s) => s.type === 'youtube_video' && extractVideoId(s.url));

  const addExistingVideo = (s: AllowedSource) => {
    const id = extractVideoId(s.url);
    if (!id) return;
    if (draftItems.some((it) => it.videoId === id)) {
      showToast('Video này đã có trong playlist rồi.');
      return;
    }
    setDraftItems((prev) => [...prev, { videoId: id, title: s.title, thumbnail: s.thumbnail }]);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedKids([PROFILE_IDS.MINA]);
    setUrlHint(null);
    setDraftItems([]);
    setDraftVideoUrl('');
  };

  const startEdit = (s: AllowedSource) => {
    setEditingId(s.id);
    setForm({ type: s.type, title: s.title, url: s.url, thumbnail: s.thumbnail });
    setSelectedKids(s.profile_id ? [s.profile_id] : [PROFILE_IDS.MINA, PROFILE_IDS.COM]);
    setUrlHint(null);
    setDraftItems(s.type === 'custom_playlist' ? s.items : []);
    setDraftVideoUrl('');
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
    const isCustom = form.type === 'custom_playlist';

    if (!cleanTitle || (!isCustom && !isSafeHttpsUrl(form.url))) {
      setUrlHint({ text: '✕ Vui lòng nhập tiêu đề và link https hợp lệ', ok: false });
      return;
    }
    if (isCustom && draftItems.length === 0) {
      showToast('Ghép ít nhất 1 video vào playlist trước khi lưu nhé.');
      return;
    }
    if (selectedKids.length === 0) {
      showToast('Chọn ít nhất 1 bé (hoặc cả 2) cho nội dung này.');
      return;
    }
    // Chọn cả 2 bé → lưu profile_id = null (dùng chung); chỉ chọn 1 bé → lưu id bé đó.
    const profileId = selectedKids.length === KIDS.length ? null : selectedKids[0];
    const payload = {
      profileId,
      type: form.type,
      title: cleanTitle,
      url: isCustom ? CUSTOM_PLAYLIST_URL : form.url,
      thumbnail: isCustom ? form.thumbnail ?? draftItems[0]?.thumbnail ?? null : form.thumbnail,
      items: isCustom ? draftItems : [],
    };

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

        {form.type !== 'custom_playlist' && (
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
        )}

        <div className="form-row">
          <label>{form.type === 'custom_playlist' ? 'Tên playlist' : 'Tiêu đề hiển thị'}</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={form.type === 'custom_playlist' ? 'VD: Playlist yêu thích của Cốm' : 'VD: Nhạc thiếu nhi vui nhộn'}
          />
        </div>

        {form.type === 'custom_playlist' && (
          <div className="form-row">
            <label>Ghép video vào playlist</label>

            {existingVideos.length > 0 && (
              <>
                <div className="hint" style={{ opacity: 0.6, height: 'auto', margin: '0 0 6px' }}>
                  Chọn nhanh từ video đơn lẻ đã có sẵn trong danh sách:
                </div>
                <div className="added-list" style={{ marginBottom: 14 }}>
                  {existingVideos.map((v) => {
                    const id = extractVideoId(v.url);
                    const already = draftItems.some((it) => it.videoId === id);
                    return (
                      <div className="added-item" key={v.id} style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                          <span>🎬</span>
                          {/* class "ellip" thay cho maxWidth cứng: trên điện thoại CSS tự
                              rút ngắn lại cho vừa màn hình (xem @media trong theme.css) */}
                          <span className="ellip">{v.title}</span>
                        </div>
                        <button
                          className="icon-btn"
                          title={already ? 'Đã có trong playlist' : 'Thêm vào playlist'}
                          disabled={already}
                          onClick={() => addExistingVideo(v)}
                        >
                          {already ? '✓' : '➕'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="hint" style={{ opacity: 0.6, height: 'auto', margin: '0 0 6px' }}>
                  Hoặc dán link video YouTube mới:
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={draftVideoUrl}
                onChange={(e) => setDraftVideoUrl(e.target.value)}
                placeholder="Dán link YouTube video đơn lẻ..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="add-window-btn"
                style={{ flexShrink: 0 }}
                disabled={addingVideo || !draftVideoUrl.trim()}
                onClick={addDraftVideo}
              >
                {addingVideo ? 'Đang thêm...' : '➕ Thêm'}
              </button>
            </div>
            <div className="hint" style={{ opacity: 0.6, height: 'auto', margin: '6px 0 10px' }}>
              Thêm từng video 1 — playlist sẽ phát theo đúng thứ tự đã ghép.
            </div>
            {draftItems.length === 0 && (
              <p style={{ fontSize: 12.5, opacity: 0.55 }}>Chưa ghép video nào.</p>
            )}
            <div className="added-list">
              {draftItems.map((it, i) => (
                <div className="added-item" key={it.videoId} style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                    <span style={{ opacity: 0.6, fontSize: 12 }}>{i + 1}.</span>
                    <span className="ellip" style={{ fontWeight: 700 }}>
                      {it.title}
                    </span>
                  </div>
                  <button className="icon-btn" title="Bỏ video này" onClick={() => removeDraftVideo(it.videoId)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <div className="ellip" style={{ fontWeight: 700 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {TYPE_LABEL[s.type]}
                    {s.type === 'custom_playlist' ? ` (${s.items.length} video)` : ''} · {profileBadge(s.profile_id)}
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
