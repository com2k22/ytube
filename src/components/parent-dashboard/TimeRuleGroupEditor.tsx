import { useEffect, useState } from 'react';
import { useTimeRules } from '@/hooks/useTimeRules';
import { useToast } from '@/components/common/Toast';
import type { DayCode, TimeRuleGroup, TimeWindow } from '@/types';

const DAY_ORDER: DayCode[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * TimeRuleGroupEditor — cấu hình giờ xem theo từng "nhóm ngày" độc lập: mỗi nhóm tự
 * chọn các ngày trong tuần, với khung giờ / tổng thời gian mỗi ngày / thời gian mỗi
 * lượt xem riêng (ví dụ ngày đi học khác cuối tuần).
 *
 * Cấu hình này DÙNG CHUNG cho cả 2 bé — không còn chọn từng hồ sơ như trước nữa.
 */
export function TimeRuleGroupEditor() {
  const { groups, addGroup, deleteGroup, saveGroup } = useTimeRules();
  const [draft, setDraft] = useState<TimeRuleGroup[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    setDraft(groups);
  }, [groups]);

  const updateGroup = (index: number, patch: Partial<TimeRuleGroup>) => {
    setDraft((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const toggleDay = (index: number, day: DayCode) => {
    setDraft((prev) =>
      prev.map((g, i) => (i === index ? { ...g, days: g.days.includes(day) ? g.days.filter((d) => d !== day) : [...g.days, day] } : g))
    );
  };

  const updateWindow = (gIndex: number, wIndex: number, field: keyof TimeWindow, value: string) => {
    setDraft((prev) =>
      prev.map((g, i) => {
        if (i !== gIndex) return g;
        const windows = g.windows.map((w, wi) => (wi === wIndex ? { ...w, [field]: value } : w));
        return { ...g, windows };
      })
    );
  };

  const addWindow = (gIndex: number) => {
    setDraft((prev) =>
      prev.map((g, i) => (i === gIndex ? { ...g, windows: [...g.windows, { start: '08:00', end: '09:00' }] } : g))
    );
  };

  const removeWindow = (gIndex: number, wIndex: number) => {
    setDraft((prev) =>
      prev.map((g, i) => (i === gIndex ? { ...g, windows: g.windows.filter((_, wi) => wi !== wIndex) } : g))
    );
  };

  const saveAll = async () => {
    await Promise.all(draft.map((g) => saveGroup(g)));
    showToast('💾 Đã lưu cài đặt giờ xem (áp dụng cho cả 2 bé)');
  };

  return (
    <>
      <div className="section-title" style={{ fontSize: 17, marginTop: 6 }}>
        📅 Cấu hình theo nhóm ngày
      </div>
      <p style={{ fontSize: 12.5, opacity: 0.6, margin: '-8px 0 16px', maxWidth: 560 }}>
        Cài đặt này áp dụng CHUNG cho cả Mina và Cốm. Mỗi nhóm chọn các ngày riêng, với khung giờ, tổng thời
        gian/ngày và thời gian mỗi lượt xem riêng — ví dụ ngày đi học khác cuối tuần.
      </p>

      {draft.map((g, gi) => (
        <div className="settings-card" key={g.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ margin: 0 }}>📅 Nhóm ngày {gi + 1}</h4>
            {draft.length > 1 && (
              <button className="icon-btn" title="Xoá nhóm ngày" onClick={() => deleteGroup(g.id)}>
                🗑
              </button>
            )}
          </div>

          <div className="day-pills">
            {DAY_ORDER.map((d) => (
              <div key={d} className={`day-pill ${g.days.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(gi, d)}>
                {d}
              </div>
            ))}
          </div>

          <div className="settings-row" style={{ marginTop: 16 }}>
            <label>Tổng thời gian xem/ngày</label>
            <input
              type="number"
              min={0}
              step={5}
              value={g.daily_minutes}
              onChange={(e) => updateGroup(gi, { daily_minutes: +e.target.value })}
            />
            <span>phút/ngày</span>
          </div>
          <div className="settings-row">
            <label>Thời gian mỗi lượt xem</label>
            <input
              type="number"
              min={0}
              step={5}
              value={g.session_minutes}
              onChange={(e) => updateGroup(gi, { session_minutes: +e.target.value })}
            />
            <span>phút/lượt</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.8, display: 'block', marginBottom: 8 }}>
              Khung giờ được xem
            </label>
            {g.windows.length === 0 && (
              <div style={{ fontSize: 13, opacity: 0.6 }}>Chưa có khung giờ — bé được xem bất kỳ lúc nào trong các ngày này.</div>
            )}
            {g.windows.map((w, wi) => (
              <div className="window-row" key={wi}>
                <input type="time" value={w.start} onChange={(e) => updateWindow(gi, wi, 'start', e.target.value)} />
                <span className="arrow-sep">→</span>
                <input type="time" value={w.end} onChange={(e) => updateWindow(gi, wi, 'end', e.target.value)} />
                <button className="icon-btn" title="Xoá khung giờ" onClick={() => removeWindow(gi, wi)}>
                  🗑
                </button>
              </div>
            ))}
            <button className="add-window-btn" onClick={() => addWindow(gi)}>
              + Thêm khung giờ
            </button>
          </div>
        </div>
      ))}

      <button className="add-window-btn" style={{ marginBottom: 24 }} onClick={() => addGroup()}>
        + Thêm nhóm ngày
      </button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="submit-btn" style={{ width: 'auto', padding: '12px 26px' }} onClick={saveAll}>
          💾 Lưu cài đặt
        </button>
      </div>
    </>
  );
}
