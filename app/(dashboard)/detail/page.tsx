import { MARKUP } from './markup';

// ไม่ให้ cache HTML ยาว (reverse proxy จะเสิร์ฟ HTML เก่าหลัง redeploy)
export const dynamic = 'force-dynamic';

// markup เป็น HTML ดิบ + script ES5 แยก (public/js/dashboard.js) ที่ไม่ขึ้นกับ bundle ของ React/Next
export default function DashboardPage() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
