import { initials } from '../format.js';

const COLORS = ['purple', 'blue', 'green', 'red'];

// Cùng một tên luôn ra cùng một màu, giống mockup (AN tím, TB xanh, LC xanh lá...).
function colorFor(name) {
  const sum = [...String(name || '')].reduce((total, char) => total + char.charCodeAt(0), 0);
  return COLORS[sum % COLORS.length];
}

// Ảnh đại diện: có ảnh thì hiện ảnh, chưa có thì hiện chữ cái đầu trên nền màu.
export default function Avatar({ name, src, size = '' }) {
  const className = `avatar ${size} avatar-${colorFor(name)}`.trim();

  if (src) {
    return <img className={className} src={src} alt="" />;
  }

  return (
    <div className={className} aria-hidden="true">
      {initials(name)}
    </div>
  );
}
