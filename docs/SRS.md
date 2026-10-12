# SRS - Web HR

## 1. Gioi thieu

Web HR la he thong ho tro bo phan nhan su quan ly thong tin nhan vien va cac du lieu to chuc co ban.

## 2. Yeu cau chuc nang

### Auth

- Nguoi dung co the dang nhap bang email va mat khau.
- He thong tra ve JWT sau khi dang nhap thanh cong.
- API nhan su yeu cau token hop le.
- Mot so thao tac yeu cau vai tro phu hop.

### Nhan su

- Xem danh sach nhan vien.
- Tim kiem theo ten, ma nhan vien hoac email.
- Loc theo trang thai lam viec.
- Them moi ho so nhan vien.
- Cap nhat ho so nhan vien.
- Xoa nhan vien theo quyen.

### Phong ban

- Xem danh sach phong ban.
- Gan nhan vien vao phong ban.

### Ca lam viec (HR-021, HR-029, HR-030, HR-031, HR-032, HR-033)

- Quan tri/HR tao, sua danh muc loai ca (ten, khung gio, thoi gian nghi).
- Quan tri/HR xep lich phan ca cho nhan vien theo ngay, xep hang loat theo tuan, sao chep lich
  tuan truoc sang tuan moi.
- He thong tu dong tu choi khi: nhan vien da co ca trong ngay do (trung ca), hoac tong gio lam
  trong tuan vuot gioi han cau hinh (`MAX_WEEKLY_WORK_HOURS`, mac dinh 48h).
- Nhan vien (tai khoan lien ket `employee_id`) tu dang ky ca con trong lich cho chinh minh, xem
  lich lam viec ca nhan.
- Nhan vien gui yeu cau doi ca cho mot lich phan ca cua minh; HR duyet hoac tu choi. Duyet thi
  cap nhat lai ca lam viec, ghi nhan vao nhat ky (audit log) — chua co he thong thong bao day
  (notification) rieng.

### Cham cong & nghi phep (HR-022, HR-023, HR-035, HR-036, HR-037)

- Nhan vien check-in/check-out; he thong tu xac dinh di tre (qua `LATE_THRESHOLD_MINUTES` phut so
  voi gio bat dau ca theo lich phan ca) hoac binh thuong.
- HR sua chua cham cong thu cong khi nhan vien quen check-in/check-out.
- He thong tinh gio lam them (OT) = gio lam thuc te tru gio chuan cua ca (hoac
  `DEFAULT_STANDARD_WORK_HOURS` neu khong co lich phan ca).
- Nhan vien gui don xin nghi phep (theo loai: nam, om, khong luong, khac); HR duyet hoac tu choi.
  Duyet thi danh dau `ON_LEAVE` cho cac ngay nghi tren bang cham cong (khong ghi de ngay da co
  cham cong that).
- Xem bang cong ca nhan va bang cong tong hop theo thang (so ngay cong, so ngay tre, so ngay
  vang, tong gio cong, gio OT).

### Bao cao thong ke (HR-010, HR-038, HR-040)

- Thong ke so nhan su dang lam viec theo tung phong ban.
- Thong ke gio cong/ngay cong/OT theo khoang thoi gian, loc theo nhan vien hoac phong ban.
- Xuat bao cao giơ cong ra file Excel (chua ho tro xuat PDF — xem gioi han trong `API.md`).

## 3. Yeu cau phi chuc nang

- Backend tra ve JSON theo REST API.
- Frontend responsive cho desktop va mobile.
- Du lieu quan trong duoc validate o backend.
- Mat khau duoc hash truoc khi luu database.
- Cau hinh moi truong nam trong file `.env`.

## 4. Rang buoc ky thuat

- Frontend: ReactJS.
- Backend: Node.js va Express.
- Database: PostgreSQL.
- CI/CD: GitHub Actions.
- Development: Visual Studio Code.
