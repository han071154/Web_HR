# Ke Hoach Kiem Thu

## Pham vi

- Auth.
- API phong ban.
- API nhan vien.
- Giao dien login va dashboard nhan su.
- Lint va build CI.

## Test case uu tien

| ID | Noi dung | Ket qua mong doi |
| --- | --- | --- |
| TC-001 | Dang nhap dung email/mat khau | Tra ve token va thong tin user |
| TC-002 | Dang nhap sai mat khau | Tra ve loi 401 |
| TC-003 | Goi API employees khong co token | Tra ve loi 401 |
| TC-004 | Lay danh sach nhan vien | Tra ve mang nhan vien |
| TC-005 | Them nhan vien hop le | Tao record moi |
| TC-006 | Them nhan vien thieu email hop le | Tra ve loi validation |
| TC-007 | Cap nhat nhan vien | Du lieu duoc cap nhat |
| TC-008 | Xoa nhan vien bang user khong du quyen | Tra ve loi 403 |
| TC-009 | Loc nhan vien theo trang thai | Chi tra ve nhan vien phu hop |
| TC-010 | Build frontend | Build thanh cong |

## Kiem thu thu cong nhanh

1. Chay database va seed du lieu.
2. Dang nhap voi `admin@webhr.local` / `admin123`.
3. Them mot nhan vien moi.
4. Sua phong ban va luong co ban.
5. Loc theo trang thai.
6. Xoa nhan vien vua tao.
