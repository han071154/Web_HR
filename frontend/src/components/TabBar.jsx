// Thanh tab dùng chung cho các mục có nhiều màn con (Ca làm việc, Chấm công...).
// tabs: [{ id, label, count? }] — count để trống thì không hiện số.
export default function TabBar({ label, tabs, value, onChange }) {
  return (
    <div className="tab-bar" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          key={tab.id}
          aria-selected={value === tab.id}
          className={value === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count-pill">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
