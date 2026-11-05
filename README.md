# Recipe Cost & Nutrition

PWA สำหรับ Android: คำนวณ kcal, โภชนาการ และต้นทุนต่อ serve ของสูตรอาหาร พร้อมรายการซื้อของเมื่อปรับขนาดสูตร
ข้อมูลเก็บใน Google Sheet ของผู้ใช้ (ผ่าน Apps Script) และ cache ไว้ในเครื่องเพื่อใช้ offline

## โครงสร้าง

| โฟลเดอร์ | เนื้อหา |
| --- | --- |
| `src/engine/` | Calculation engine (BR-01 – BR-13) เป็น pure function ไม่มี UI + unit tests |
| `src/data/` | IndexedDB (Dexie), outbox, sync กับ Google Sheet, mapping แถว Sheet ↔ model |
| `src/usda/` | ค้นหา USDA FoodData Central และชุดวัตถุดิบตั้งต้น |
| `src/ui/` | หน้าจอ S1–S8, i18n (ไทย/อังกฤษ), Light/Dark theme |
| `backend/Code.gs` | Google Apps Script (วางใน Sheet ตามคู่มือ) |
| `backend/test/` | Apps Script จำลองใน Node — ใช้ทั้งทดสอบ backend และทดสอบ sync ของแอปกับโค้ด backend จริง |
| `e2e/` | Playwright บนจอมือถือ 412×915 |

## คำสั่ง

```bash
npm ci
npm run dev                              # เปิด dev server
npm test                                 # unit + sync tests (Vitest)
node backend/test/run-backend-tests.cjs  # backend tests
npm run build && npx playwright test     # E2E (ต้องมี Chrome)
```

## Deploy ขึ้น GitHub Pages

1. สร้าง repo ใหม่บน GitHub แล้ว push โค้ดนี้ขึ้น branch `main`
2. GitHub repo → **Settings → Pages → Source: GitHub Actions**
3. ทุกครั้งที่ push ขึ้น `main` workflow จะรัน test แล้ว deploy ให้เอง
4. เปิด `https://<username>.github.io/<repo>/` ใน Chrome บน Android → เมนู ⋮ → **ติดตั้งแอป / Add to Home screen**

## ตั้งค่าในแอป

- **ตั้งค่า → เชื่อม Google Sheet**: ใส่ Web app URL + TOKEN จากคู่มือ แล้วกด "ทดสอบการเชื่อม"
- **ตั้งค่า → USDA API key**: สมัครฟรีที่ https://fdc.nal.usda.gov/api-key-signup/ ใช้กับปุ่ม "ค้นหา USDA" และ "นำเข้าชุดวัตถุดิบตั้งต้น"

ข้อมูลโภชนาการจาก USDA FoodData Central (public domain, CC0 1.0)
