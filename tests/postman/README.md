# Postman API tests

Bo kiem thu API Web HR (WBS 3.5.1, 3.5.2, 3.5.3): 40 request, 70 kiem tra tu dong.

## Chay test

1. Chuan bi du lieu:

```bash
npm run db:setup
npm run db:test-users
```

2. Chay backend: `npm run dev`
3. Trong Postman: **Import** 2 file `WebHR.postman_collection.json` va `WebHR-local.postman_environment.json`.
4. Chon environment **WebHR-local** (goc tren ben phai).
5. Chuot phai collection **Web HR API Tests** -> **Run** -> bo chon "Stop run if an error occurs" -> **Start run**.

Chay theo dung thu tu: cac request sau dung token va id luu tu request truoc. Request cuoi (CLEANUP) xoa du lieu test.

## Tai khoan test

| Email | Vai tro |
| --- | --- |
| admin@webhr.local | ADMIN (seed mac dinh) |
| hrstaff@webhr.local | HR_STAFF |
| inactive@webhr.local | HR_STAFF, bi khoa |

Mat khau nam trong file environment.
