# SRS - Web HR (ban cuoi)

Phien ban: 1.0 (31/10/2026). Tai lieu dac ta yeu cau phan mem cho he thong Web HR, cap nhat theo
pham vi da trien khai den Sprint 8. Chi tiet tung API: [API.md](API.md) va Swagger `/api/docs`
(ban xuat: [openapi.json](openapi.json)). Kien truc va ERD: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Gioi thieu

### 1.1 Muc dich

Web HR la he thong ho tro bo phan nhan su quan ly ho so nhan vien, co cau to chuc, hop dong, tuyen
dung, ca lam viec, cham cong, nghi phep va bao cao thong ke trong mot ung dung web noi bo.

### 1.2 Pham vi

- Trong pham vi: quan tri nhan su, tuyen dung (trang tuyen dung cong khai), ca lam viec, cham cong,
  nghi phep, thong bao trong ung dung, bao cao/xuat file, quan ly tai khoan, nhat ky thao tac,
  trien khai bang Docker Compose va CI/CD tren GitHub Actions.
- Ngoai pham vi: tinh luong, bao hiem, thong bao qua email/SMS/push, dang nhap mot lan (SSO),
  ung dung di dong rieng, ngay le/lich nghi le quoc gia.

### 1.3 Thuat ngu

| Thuat ngu | Y nghia |
| --- | --- |
| Ca (shift) | Mau khung gio lam viec: gio bat dau, gio ket thuc, so phut nghi giua ca |
| Lich phan ca (schedule) | Gan mot ca cho mot nhan vien vao mot ngay |
| Gio cong | Thoi gian lam thuc te trong ngay, da tru gio nghi giua ca |
| Gio chuan | Khung gio ca tru gio nghi (khong co lich: `DEFAULT_STANDARD_WORK_HOURS`) |
| OT | Phan gio cong vuot gio chuan |
| Tu-phuc-vu | Chuc nang nhan vien tu thao tac cho chinh minh (tai khoan lien ket ho so) |

## 2. Mo ta tong quan

### 2.1 Vai tro nguoi dung

| Vai tro | Mo ta | Quyen chinh |
| --- | --- | --- |
| `ADMIN` | Quan tri he thong | Toan quyen, quan ly tai khoan dang nhap (HR-007) |
| `HR_MANAGER` | Truong phong nhan su | Nhan su, hop dong, tuyen dung, phong ban/chuc vu, bao cao, duyet nghi phep va doi ca |
| `HR_STAFF` | Nhan vien nhan su | Van hanh hang ngay: ca lam viec, xep lich, cham cong, xem don nghi va yeu cau doi ca |
| `EMPLOYEE` | Nhan vien | Tu-phuc-vu: ho so cua toi, lich lam viec, cham cong, nghi phep, thong bao |
| Ung vien | Khach, khong dang nhap | Xem tin tuyen dung dang mo, nop ho so kem CV |

Tai khoan do Admin cap (khong tu dang ky, HR-025 da bo). Tai khoan `EMPLOYEE` phai lien ket mot ho
so nhan vien (`users.employee_id`) moi dung duoc chuc nang tu-phuc-vu.

### 2.2 Moi truong van hanh

- Trinh duyet hien dai (Chrome, Edge, Firefox, Safari ban moi), man hinh tu 360px (dien thoai) den desktop.
- May chu chay Docker + Docker Compose (3 service: `db` PostgreSQL 16, `backend` Node.js 22, `frontend` Nginx).

## 3. Yeu cau chuc nang

### 3.1 Xac thuc & tai khoan (HR-001, HR-007, HR-011, HR-026, HR-027, HR-028)

- FR-AUTH-01: Dang nhap bang email + mat khau, nhan access token (JWT) va refresh token; "ghi nho dang nhap".
- FR-AUTH-02: Lam moi phien bang refresh token; dang xuat xoa phien tren trinh duyet; tu dang xuat khi het han.
- FR-AUTH-03: Doi mat khau (can mat khau hien tai); doi xong cac phien cu het hieu luc.
- FR-AUTH-04: Gioi han so lan dang nhap / doi mat khau de chong do mat khau (tra `429`).
- FR-AUTH-05: Admin tao tai khoan (le hoac hang loat cho nhan vien chua co tai khoan), gan vai tro,
  lien ket ho so, khoa/mo khoa, dat lai mat khau. Tai khoan bi khoa khong dung duoc token da cap.
- FR-AUTH-06: Nguoi dung xem ho so cua minh; nhan vien tu sua so dien thoai va dia chi.

### 3.2 Nhan su, phong ban, chuc vu, hop dong (HR-002 → HR-006, HR-008, HR-009, HR-013 → HR-015)

- FR-EMP-01: Danh sach nhan vien co tim kiem (ten, ma, email; khong phan biet dau), loc trang thai/phong ban, phan trang.
- FR-EMP-02: Them/sua/vo hieu hoa/xoa ho so (xoa theo quyen); anh dai dien; lich su thay doi.
- FR-EMP-03: Import/Export danh sach nhan vien bang Excel.
- FR-ORG-01: Quan ly phong ban va danh muc chuc vu; khong xoa duoc phong ban con nhan vien (`409`).
- FR-CON-01: Quan ly hop dong lao dong; moi nhan vien toi da mot hop dong dang hieu luc; nhac hop dong sap het han.

### 3.3 Tuyen dung (HR-016 → HR-020)

- FR-REC-01: Trang tuyen dung cong khai: danh sach tin dang mo, tim kiem, loc, chi tiet tin.
- FR-REC-02: Ung vien nop ho so kem CV PDF; moi email mot ho so dang xu ly cho moi tin.
- FR-REC-03: HR tao/sua/dong/mo lai tin; xem ho so, tai CV, doi trang thai (dang xet, phong van, trung tuyen, loai).
- FR-REC-04: Chuyen ung vien trung tuyen thanh nhan vien kem hop dong dau tien.

### 3.4 Ca lam viec (HR-021, HR-029 → HR-034)

- FR-SHIFT-01: Quan tri/HR tao, sua danh muc ca (ten, khung gio, thoi gian nghi; gio nghi phai ngan hon ca).
- FR-SHIFT-02: Xep lich theo ngay, xep hang loat theo tuan, keo-tha tren luoi lich, sao chep lich tuan truoc.
- FR-SHIFT-03: Tu choi khi trung ca trong ngay hoac tong gio/tuan vuot `MAX_WEEKLY_WORK_HOURS` (mac dinh 48h).
- FR-SHIFT-04: Nhan vien xem lich ca nhan, tu dang ky ca con trong.
- FR-SHIFT-05: Nhan vien gui yeu cau doi ca; moi lich chi mot yeu cau dang cho duyet. Nhan vien xem lai
  cac yeu cau da gui va trang thai (cho duyet / da duyet / tu choi).
- FR-SHIFT-06: HR duyet hoac tu choi; duyet thi cap nhat ca moi (kiem tra lai gioi han gio/tuan).
- FR-SHIFT-07 (HR-034): Khi yeu cau doi ca duoc duyet/tu choi, nhan vien nhan **thong bao trong ung dung**
  (xem 3.6).

### 3.5 Cham cong & nghi phep (HR-022, HR-023, HR-035 → HR-037)

- FR-ATT-01: Nhan vien check-in/check-out mot lan moi ngay theo mui gio cong ty (`APP_TIMEZONE`).
- FR-ATT-02 (tinh cong theo ca): voi ngay co lich phan ca, he thong tu ghi
  - **di tre**: check-in tre hon gio bat dau ca qua `LATE_THRESHOLD_MINUTES` → trang thai `LATE`, luu so phut tre;
  - **ve som**: check-out som hon gio ket thuc ca qua `EARLY_LEAVE_THRESHOLD_MINUTES` → luu so phut ve som;
  - **vang**: ca da xep cua ngay da qua ma khong cham cong → `ABSENT` (tu dong moi gio khi
    `AUTO_MARK_ABSENT=true`, hoac HR chay cho mot ngay cu the). Ngay nghi phep da duyet khong bi ghi vang.
- FR-ATT-03: HR sua cham cong thu cong (quen check-in/out, doi trang thai); so phut tre/ve som duoc tinh lai.
- FR-ATT-04: Gio cong moi ngay = gio ra − gio vao − gio nghi giua ca (cua ca, khong co lich thi
  `DEFAULT_BREAK_MINUTES`; chi tru khi co mat qua nua khung gio ca). Gio chuan = khung gio ca − gio nghi
  (khong co lich: `DEFAULT_STANDARD_WORK_HOURS`). OT = gio cong vuot gio chuan.
- FR-ATT-05: Bang cong ca nhan va bang cong tong hop theo thang: so ngay cong, so ngay tre, so lan ve som,
  so ngay vang, tong gio cong, gio OT.
- FR-LEAVE-01: Nhan vien gui don nghi (nam, om, khong luong, khac), duoc chon ngay da qua (nghi om bao sau).
- FR-LEAVE-02: So ngay nghi = thu 2 → thu 6, cong thu 7/chu nhat ma nhan vien co lich ca; khoang ngay
  khong co ngay lam viec nao bi tu choi.
- FR-LEAVE-03: HR duyet/tu choi. Duyet thi ghi `ON_LEAVE` cho cac ngay nghi; ngay da bi ghi Vang (chua
  cham cong) chuyen thanh Nghi phep; ngay co cham cong that giu nguyen. Nhan vien nhan thong bao ket qua.

### 3.6 Thong bao trong ung dung (HR-034)

- FR-NOTI-01: He thong tao thong bao cho tai khoan lien ket voi nhan vien khi yeu cau doi ca / don nghi
  phep duoc duyet hoac tu choi (noi dung tieng Viet: ngay, ca moi / loai nghi).
- FR-NOTI-02: Bieu tuong chuong tren thanh tieu de hien so thong bao chua doc, danh sach 20 thong bao
  moi nhat; bam vao thong bao thi danh dau da doc va mo trang lien quan; "danh dau da doc het".
- FR-NOTI-03: Moi nguoi chi xem/danh dau thong bao cua chinh minh. Giao dien tu tai lai moi phut
  (khong co day thoi gian thuc).

### 3.7 Bao cao thong ke (HR-010, HR-038 → HR-040)

- FR-REP-01: Trang Tong quan: so nhan su theo trang thai, cham cong 7 ngay gan nhat, don cho duyet,
  tong gio cong/OT trong thang (so lieu tong hop san o backend).
- FR-REP-02: So nhan su dang lam theo phong ban.
- FR-REP-03: Bao cao gio cong theo khoang thoi gian, loc nhan vien/phong ban.
- FR-REP-04: Xuat bao cao gio cong ra **Excel (.xlsx)** hoac **PDF** (A4 ngang, du dau tieng Viet,
  dong tong cong, so trang, thoi diem xuat).

### 3.8 Nhat ky thao tac (HR-041)

- FR-AUD-01: Ghi `audit_logs` cho cac thao tac nghiep vu quan trong (ai, luc nao, lam gi, thay doi gi):
  nhan su, ho so ung vien, lich ca, doi ca, cham cong, nghi phep, tai khoan.

## 4. Yeu cau phi chuc nang

| Ma | Nhom | Yeu cau |
| --- | --- | --- |
| NFR-01 | Bao mat | Mat khau bcrypt; JWT co han; phan quyen theo vai tro o moi API; validate du lieu bang zod; Helmet; CORS gioi han; rate limit dang nhap; CV ung vien khong public; loi 500 khong lo chi tiet. Ra soat OWASP Top 10: [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) |
| NFR-02 | Hieu nang | Danh sach lon co phan trang; trang Tong quan tra so lieu tong hop san (vai tram byte); chi muc CSDL cho cac truy van theo nhan vien/ngay |
| NFR-03 | Kha dung | Health check `/api/health` kiem tra ca CSDL (503 khi mat ket noi); container tu khoi dong lai (`restart: unless-stopped`); mat CSDL tam thoi khong lam sap backend; dung em khi nhan SIGTERM |
| NFR-04 | Giam sat | Log JSON mot dong/su kien kem ma request (`X-Request-Id`), muc log cau hinh duoc; log container xoay vong 5 × 10 MB; tuy chon ghi file log theo ngay |
| NFR-05 | Sao luu & phuc hoi | Script sao luu CSDL; tu sao luu truoc moi lan deploy; tu rollback ma nguon khi deploy loi |
| NFR-06 | Giao dien | Responsive desktop/tablet/mobile; thong bao loi bang tieng Viet |
| NFR-07 | Chat luong | Lint + unit test (Vitest) + smoke test + bo Postman chay tu dong tren CI moi lan push |
| NFR-08 | Tai lieu | OpenAPI/Swagger day du toan bo API, kiem tra tu dong khop voi route |
| NFR-09 | Cau hinh | Moi cau hinh nam trong bien moi truong (`.env`), khong commit bi mat |

## 5. Rang buoc ky thuat

- Frontend: ReactJS + Vite. Backend: Node.js 22 + Express 5. Database: PostgreSQL 16.
- Trien khai: Docker Compose; CI/CD: GitHub Actions (build → test → Docker image → deploy staging).
- Moi truong phat trien: Visual Studio Code.

## 6. Tieu chi nghiem thu

- Moi user story trong [BACKLOG.md](BACKLOG.md) o trang thai Done (tru cac muc ghi ro "Bo").
- Pipeline CI xanh tren nhanh ban giao (lint, unit test, build, Docker image, smoke test, Postman).
- Trien khai staging bang `scripts/deploy.sh` thanh cong, ca 3 container healthy, smoke test + Postman dat.
- Tai lieu ban giao: SRS, ARCHITECTURE (kien truc + ERD), API.md + Swagger, DEPLOYMENT, README, SECURITY_CHECKLIST, TEST_PLAN.
