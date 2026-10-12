import { useState } from 'react';

// Biểu đồ dùng chung cho Tổng quan / Báo cáo, vẽ bằng SVG thuần (không thêm thư viện).
// Quy ước: cột ≤ 24px, đầu cột bo 4px và vuông ở đường gốc, khe 2px giữa các đoạn chồng,
// lưới mảnh 1px, chữ dùng màu chữ (không dùng màu của dữ liệu), có tooltip khi rê chuột.

// Hình chữ nhật chỉ bo 2 góc trên (đầu cột), đáy vuông nằm trên đường gốc.
function topRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

// Bước chia trục tròn số (1, 2, 5 × 10^n) để nhãn trục dễ đọc.
function niceStep(max, ticks) {
  const raw = Math.max(max, 1) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const [step] = [1, 2, 5, 10].map((m) => m * power).filter((value) => value >= raw);
  return step;
}

function Tooltip({ tip }) {
  if (!tip) {
    return null;
  }

  return (
    <div className="chart-tooltip" style={{ left: `${tip.left}%`, top: tip.top }} role="status">
      <span className="chart-tooltip-title">{tip.title}</span>
      {tip.rows.map((row) => (
        <span className="chart-tooltip-row" key={row.label}>
          {row.color && <i style={{ background: row.color }} aria-hidden="true" />}
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </span>
      ))}
    </div>
  );
}

export function ChartLegend({ series }) {
  return (
    <ul className="chart-legend">
      {series.map((item) => (
        <li key={item.key}>
          <i style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// Biểu đồ cột chồng theo ngày. data: [{ label, values: { [seriesKey]: number } }].
export function StackedColumnChart({ data, series, unit = '', ariaLabel }) {
  const [tip, setTip] = useState(null);
  const width = 640;
  const height = 240;
  const padding = { top: 24, right: 12, bottom: 30, left: 36 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const totals = data.map((item) => series.reduce((sum, s) => sum + (item.values[s.key] || 0), 0));
  const step = niceStep(Math.max(...totals, 1), 4);
  const maxValue = step * Math.ceil(Math.max(...totals, 1) / step);
  const band = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(24, band * 0.6);
  const scale = (value) => (value / maxValue) * plotHeight;
  const ticks = Array.from({ length: Math.round(maxValue / step) + 1 }, (_, index) => index * step);

  return (
    <div className="chart-frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={ariaLabel} className="chart-svg">
        {ticks.map((tick) => {
          const y = padding.top + plotHeight - scale(tick);
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const x = padding.left + band * index + (band - barWidth) / 2;
          const segments = series.filter((s) => item.values[s.key] > 0);
          let cursor = padding.top + plotHeight;

          return (
            <g key={item.label}>
              {segments.map((s, segmentIndex) => {
                const h = scale(item.values[s.key]);
                const isTop = segmentIndex === segments.length - 1;
                // Khe 2px màu nền giữa các đoạn: đoạn trên cùng giữ trọn chiều cao, các đoạn dưới chừa 2px.
                const drawHeight = Math.max(isTop ? h : h - 2, 1);
                const y = cursor - h;
                cursor = y;
                return isTop ? (
                  <path key={s.key} d={topRoundedRect(x, y, barWidth, drawHeight, 4)} fill={s.color} />
                ) : (
                  <rect key={s.key} x={x} y={y + 2} width={barWidth} height={drawHeight} fill={s.color} />
                );
              })}
              {totals[index] > 0 && (
                <text x={x + barWidth / 2} y={cursor - 6} textAnchor="middle" className="chart-value-text">
                  {totals[index]}
                </text>
              )}
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="chart-axis-text">
                {item.label}
              </text>
              {/* Vùng rê chuột rộng cả dải, lớn hơn cột để dễ trúng. */}
              <rect
                x={padding.left + band * index}
                y={padding.top}
                width={band}
                height={plotHeight}
                className="chart-hit"
                tabIndex="0"
                aria-label={`${item.label}: ${series.map((s) => `${s.label} ${item.values[s.key] || 0}`).join(', ')}`}
                onPointerEnter={() =>
                  setTip({
                    left: ((padding.left + band * (index + 0.5)) / width) * 100,
                    top: 8,
                    title: item.label,
                    rows: series.map((s) => ({ label: s.label, value: `${item.values[s.key] || 0}${unit}`, color: s.color }))
                  })
                }
                onFocus={() =>
                  setTip({
                    left: ((padding.left + band * (index + 0.5)) / width) * 100,
                    top: 8,
                    title: item.label,
                    rows: series.map((s) => ({ label: s.label, value: `${item.values[s.key] || 0}${unit}`, color: s.color }))
                  })
                }
                onPointerLeave={() => setTip(null)}
                onBlur={() => setTip(null)}
              />
            </g>
          );
        })}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
          className="chart-baseline"
        />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// Biểu đồ thanh ngang một chuỗi số liệu. data: [{ key, label, value }].
export function HorizontalBarChart({ data, color, unit = '', ariaLabel }) {
  const [tip, setTip] = useState(null);
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="chart-frame">
      <ul className="hbar-chart" aria-label={ariaLabel}>
        {data.map((item, index) => (
          <li
            key={item.key}
            tabIndex="0"
            onPointerEnter={() =>
              setTip({ left: 50, top: index * 36, title: item.label, rows: [{ label: unit.trim() || 'Giá trị', value: item.value }] })
            }
            onFocus={() =>
              setTip({ left: 50, top: index * 36, title: item.label, rows: [{ label: unit.trim() || 'Giá trị', value: item.value }] })
            }
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            aria-label={`${item.label}: ${item.value}${unit}`}
          >
            <span className="hbar-label" title={item.label}>
              {item.label}
            </span>
            <span className="hbar-track">
              {item.value > 0 && (
                <span
                  className="hbar-fill"
                  style={{ width: `${(item.value / maxValue) * 100}%`, minWidth: 4, background: color }}
                />
              )}
            </span>
            <strong className="hbar-value">
              {item.value}
              {unit}
            </strong>
          </li>
        ))}
      </ul>
      <Tooltip tip={tip} />
    </div>
  );
}
