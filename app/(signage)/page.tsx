import { MARKUP } from './markup';

// ไม่ให้ cache HTML ยาว (reverse proxy จะเสิร์ฟ HTML เก่าหลัง redeploy)
export const dynamic = 'force-dynamic';

// markup เป็น HTML ดิบ + script ES5 แยก (public/js/signage.js) ที่ไม่ขึ้นกับ bundle ของ React/Next
// เพื่อให้จอ signage และเบราว์เซอร์ในแอปรุ่นเก่ายังทำงานได้แม้ bundle ของ Next โหลด/รันไม่ได้
export default function SignagePage() {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
