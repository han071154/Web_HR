import starLogo from '../assets/star-logo.png';

export const COMPANY_NAME = 'Star Corporation';

// Logo công ty (biểu tượng + chữ STAR / CORPORATION), dùng chung cho sidebar, đăng nhập và trang tuyển dụng.
// Thẻ bọc ngoài (div/a .brand-row) do nơi gọi tự đặt.
export default function BrandLogo({ small = false }) {
  return (
    <>
      <img className={small ? 'brand-logo small' : 'brand-logo'} src={starLogo} alt="" aria-hidden="true" />
      <span className="brand-text">
        <span className="brand-name">STAR</span>
        <span className="brand-tagline">Corporation</span>
      </span>
    </>
  );
}
