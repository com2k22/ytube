import { useState } from 'react';
import { useProfileContext } from '@/context/ProfileContext';
import { useWeeklyReport, type ReportDay } from '@/hooks/useWeeklyReport';
import { PROFILE_CHART_COLOR, PROFILE_EMOJI, SOURCE_TYPE_ICON } from '@/constants';

/**
 * Làm tròn LÊN mốc cao nhất của trục dọc cho "chẵn đẹp" (10 / 15 / 30 / 60 phút...).
 * Nếu lấy thẳng số phút cao nhất làm đỉnh thì cột cao nhất lúc nào cũng chạm trần, nhìn
 * như ngày nào cũng "kịch khung".
 */
function niceCeil(value: number): number {
  if (value <= 0) return 30;
  const steps = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
  for (const s of steps) if (value <= s) return s;
  return Math.ceil(value / 60) * 60;
}

/** Nhãn dưới cột — chỉ "T2".."CN" vì trục ngang đã cố định, không cần thêm ngày cho rối. */
function dayLabel(day: ReportDay) {
  return day.dayCode;
}

/** "T2 (18/8)" — dùng trong bảng số liệu, nơi cần biết chính xác là ngày nào. */
function dayLabelFull(day: ReportDay, month: number) {
  return `${day.dayCode} (${day.dayOfMonth}/${month})`;
}

/**
 * WeeklyReportTab — tab "📊 Báo cáo tuần" trong khu Bố mẹ.
 *
 * Gồm 3 phần: 2 thẻ tổng số phút cả tuần, 1 biểu đồ cột 7 ngày (mỗi ngày 2 cột cạnh nhau),
 * và danh sách nội dung xem nhiều nhất của từng bé.
 *
 * Vì sao tự vẽ biểu đồ bằng div thay vì cài thư viện: chỉ có 14 cột, tự vẽ tốn vài chục
 * dòng CSS, trong khi thêm 1 thư viện biểu đồ là thêm vài trăm KB phải tải về — trên TV
 * mạng yếu thì rất đáng kể.
 *
 * Về màu: 2 màu cố định theo từng bé (xem PROFILE_CHART_COLOR), và LUÔN kèm chú giải +
 * icon + bảng số liệu xem được — người phân biệt màu kém vẫn đọc được hết thông tin.
 */
export function WeeklyReportTab() {
  const { profiles } = useProfileContext();
  const { report, loading, error, refresh } = useWeeklyReport();
  const [showTable, setShowTable] = useState(false);
  /** Cột đang rê chuột vào — để hiện bong bóng số phút. */
  const [hover, setHover] = useState<{ dateKey: string; profileId: string } | null>(null);

  if (loading) return <div className="settings-card">Đang tổng hợp báo cáo 7 ngày...</div>;
  if (error) {
    return (
      <div className="settings-card">
        <p style={{ margin: '0 0 12px' }}>{error}</p>
        <button className="add-window-btn" data-region="preport" tabIndex={0} onClick={refresh}>
          🔄 Thử lại
        </button>
      </div>
    );
  }

  const axisMax = niceCeil(report.maxDayMinutes);
  /** Tháng của tuần đang xem — lấy từ cột Thứ 2 để ghi "18/8" trong bảng. */
  const monthNumber = new Date().getMonth() + 1;
  const hasAnyData = report.maxDayMinutes > 0;

  return (
    <div>
      {/* ---- Tổng số phút cả tuần của mỗi bé ---- */}
      <div className="wr-totals">
        {profiles.map((p) => (
          <div key={p.id} className="settings-card wr-total-card">
            <div className="wr-total-head">
              <span className="wr-total-emoji">{PROFILE_EMOJI[p.id] ?? '🙂'}</span>
              <span className="wr-total-name">{p.name}</span>
            </div>
            <div className="wr-total-value" style={{ color: PROFILE_CHART_COLOR[p.id] ?? 'var(--focus-color)' }}>
              {report.totalByProfile[p.id] ?? 0}
              <span className="wr-total-unit"> phút</span>
            </div>
            <div className="wr-total-sub">tổng cộng trong tuần này (T2 → CN)</div>
          </div>
        ))}
      </div>

      {/* ---- Biểu đồ cột 7 ngày ---- */}
      <div className="settings-card wr-chart-card">
        <h4>📈 Thời gian xem trong tuần (T2 → CN)</h4>

        <div className="wr-legend">
          {profiles.map((p) => (
            <span key={p.id} className="wr-legend-item">
              <span className="wr-legend-dot" style={{ background: PROFILE_CHART_COLOR[p.id] ?? 'var(--focus-color)' }} />
              {PROFILE_EMOJI[p.id] ?? '🙂'} {p.name}
            </span>
          ))}
          <span className="wr-legend-unit">đơn vị: phút</span>
        </div>

        {hasAnyData ? (
          <div className="wr-chart">
            {/* Vạch kẻ ngang mờ + số mốc, để ước lượng được chiều cao cột mà không cần rê chuột */}
            <div className="wr-grid">
              {[1, 0.5, 0].map((r) => (
                <div key={r} className="wr-grid-line" style={{ bottom: `${r * 100}%` }}>
                  <span className="wr-grid-label">{Math.round(axisMax * r)}</span>
                </div>
              ))}
            </div>

            <div className="wr-days">
              {report.days.map((day) => (
                <div key={day.dateKey} className={`wr-day ${day.isFuture ? 'is-future' : ''}`}>
                  <div className="wr-bars">
                    {profiles.map((p) => {
                      const minutes = day.minutesByProfile[p.id] ?? 0;
                      const isHover = hover?.dateKey === day.dateKey && hover?.profileId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`wr-bar ${isHover ? 'is-hover' : ''}`}
                          // Cột 0 phút vẫn để lại 1 vạch mỏng, để nhìn ra "hôm đó có cột
                          // nhưng bằng 0" chứ không phải "thiếu dữ liệu".
                          style={{
                            height: minutes > 0 ? `${(minutes / axisMax) * 100}%` : '2px',
                            background: PROFILE_CHART_COLOR[p.id] ?? 'var(--focus-color)',
                          }}
                          title={`${p.name} · ${dayLabel(day)} · ${minutes} phút`}
                          data-region="preport"
                          tabIndex={0}
                          onFocus={() => setHover({ dateKey: day.dateKey, profileId: p.id })}
                          onBlur={() => setHover(null)}
                          onMouseEnter={() => setHover({ dateKey: day.dateKey, profileId: p.id })}
                          onMouseLeave={() => setHover(null)}
                        />
                      );
                    })}

                    {/* Viết "hover &&" chứ không phải "hover?." — có thế TypeScript mới chắc
                        chắn hover khác null ở mấy dòng bên trong. */}
                    {hover && hover.dateKey === day.dateKey && (
                      <div className="wr-tip">
                        {profiles.find((p) => p.id === hover.profileId)?.name}:{' '}
                        <b>{day.minutesByProfile[hover.profileId] ?? 0} phút</b>
                      </div>
                    )}
                  </div>
                  <div className={`wr-day-label ${day.isToday ? 'is-today' : ''}`}>{dayLabel(day)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="wr-empty">Tuần này chưa có dữ liệu xem nào được ghi lại.</p>
        )}

        <button
          className="add-window-btn wr-table-toggle"
          data-region="preportbtn"
          tabIndex={0}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? '▲ Ẩn bảng số liệu' : '▼ Xem bảng số liệu'}
        </button>

        {/* Bảng chữ — dành cho người khó phân biệt màu, và để đọc con số chính xác mà
            không phải rê chuột lên từng cột (trên TV thì không có chuột). */}
        {showTable && (
          <div className="wr-table-wrap">
            <table className="wr-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  {profiles.map((p) => (
                    <th key={p.id}>
                      {PROFILE_EMOJI[p.id] ?? '🙂'} {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.days.map((day) => (
                  <tr key={day.dateKey} className={day.isToday ? 'is-today' : ''}>
                    <td>{dayLabelFull(day, monthNumber)}</td>
                    {profiles.map((p) => (
                      <td key={p.id}>{day.minutesByProfile[p.id] ?? 0}</td>
                    ))}
                  </tr>
                ))}
                <tr className="wr-table-total">
                  <td>Tổng</td>
                  {profiles.map((p) => (
                    <td key={p.id}>{report.totalByProfile[p.id] ?? 0}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Nội dung xem nhiều nhất, mỗi bé 1 cột ---- */}
      <div className="wr-tops">
        {profiles.map((p) => {
          const items = report.topByProfile[p.id] ?? [];
          return (
            <div key={p.id} className="settings-card wr-top-card">
              <h4>
                {PROFILE_EMOJI[p.id] ?? '🙂'} {p.name} xem nhiều nhất
              </h4>
              {items.length === 0 ? (
                <p className="wr-empty">Tuần này chưa có nội dung nào.</p>
              ) : (
                items.map((item, i) => (
                  <div key={item.key} className="added-item wr-top-item">
                    <span className="wr-top-rank">{i + 1}</span>
                    <span>{item.sourceType ? SOURCE_TYPE_ICON[item.sourceType] ?? '🎬' : '🎬'}</span>
                    <span className="wr-top-title">{item.title}</span>
                    <span className="wr-top-minutes">{item.minutes} phút</span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
