// ตรรกะบริสุทธิ์ของหน้า /v2 (ย้ายจาก v2/index.html เดิม ค่าเหมือนเดิมทุกตัว)

export type Tier = {
  max: number;
  light: string;
  color: string;
  text: string;
  outdoor: string;
  mask: string;
  window: string;
  face: string;
};

export type PollutantType = 'pm25' | 'o3' | 'co' | 'no2' | 'so2';
export type PollutantStatus = { text: string; color: string; pct: number };

export var TIERS: Tier[] = [
    {
        max: 25, light: "#08a672", color: "#10b981", text: "คุณภาพดีมาก",
        outdoor: "ทำได้เต็มที่", mask: "ไม่ต้องใส่", window: "เปิดรับลมได้",
        face: '<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="#10b981"/><circle cx="28" cy="32" r="5" fill="#fff"/><circle cx="52" cy="32" r="5" fill="#fff"/><path d="M26 48 Q40 64 54 48" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'
    },
    {
        max: 50, light: "#14a44d", color: "#34d399", text: "คุณภาพดี",
        outdoor: "ทำได้ปกติ", mask: "ไม่ต้องใส่", window: "เปิดถ่ายเทได้",
        face: '<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="#34d399"/><circle cx="28" cy="32" r="5" fill="#0f172a"/><circle cx="52" cy="32" r="5" fill="#0f172a"/><path d="M28 48 Q40 60 52 48" stroke="#0f172a" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'
    },
    {
        max: 100, light: "#e58a00", color: "#fbbf24", text: "ปานกลาง",
        outdoor: "ทำได้ปกติ", mask: "กลุ่มเสี่ยงควรมี", window: "เปิดได้พอควร",
        face: '<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="#fbbf24"/><circle cx="28" cy="32" r="5" fill="#0f172a"/><circle cx="52" cy="32" r="5" fill="#0f172a"/><line x1="30" y1="52" x2="50" y2="52" stroke="#0f172a" stroke-width="5" stroke-linecap="round"/></svg>'
    },
    {
        max: 150, light: "#ea580c", color: "#f97316", text: "เริ่มมีผลกระทบ",
        outdoor: "ควรลดเวลา", mask: "ควรสวมหน้ากาก", window: "ควรปิดหน้าต่าง",
        face: '<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="#f97316"/><circle cx="28" cy="34" r="5" fill="#fff"/><circle cx="52" cy="34" r="5" fill="#fff"/><path d="M28 54 Q40 44 52 54" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'
    },
    {
        max: 200, light: "#dc2626", color: "#ef4444", text: "มีผลต่อสุขภาพ",
        outdoor: "งดกิจกรรมกลางแจ้ง", mask: "ต้องใส่ N95", window: "ปิดมิดชิด",
        face: '<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="#ef4444"/><path d="M22 30 L34 38 M34 30 L22 38" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M46 30 L58 38 M58 30 L46 38" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M26 56 Q40 46 54 56" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'
    },
    {
        max: 500, light: "#7c3aed", color: "#8b5cf6", text: "อันตรายมาก",
        outdoor: "ห้ามออกนอกอาคาร", mask: "ต้องใส่ N95", window: "เปิดเครื่องฟอก",
        face: '<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="38" fill="#8b5cf6"/><circle cx="28" cy="34" r="6" fill="#fff"/><circle cx="52" cy="34" r="6" fill="#fff"/><rect x="24" y="48" width="32" height="12" rx="4" fill="#fff"/></svg>'
    }
];

// สีข้อความที่เข้มกว่าสำหรับธีมสว่าง
export var LIGHT_TEXT: Record<string, string> = { '#10b981': '#047857', '#34d399': '#059669', '#fbbf24': '#d97706', '#f97316': '#ea580c', '#ef4444': '#dc2626', '#8b5cf6': '#7c3aed', '#64748b': '#475569' };

export function getTier(val: number | null): Tier {
    if (val === null || isNaN(val)) return TIERS[0];
    for (var i = 0; i < TIERS.length; i++) {
        if (val <= TIERS[i].max) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
}

export function getPollutantStatus(type: PollutantType, raw: unknown): PollutantStatus {
    if (raw === null || raw === '-' || isNaN(Number(raw))) return { text: "-", color: "#64748b", pct: 0 };
    var val = Number(raw);
    if (type === 'pm25') {
        if (val <= 15) return { text: "ดีมาก", color: "#10b981", pct: (val / 15) * 20 };
        if (val <= 25) return { text: "ดี", color: "#34d399", pct: 20 + ((val - 15) / 10) * 20 };
        if (val <= 37.5) return { text: "ปานกลาง", color: "#fbbf24", pct: 40 + ((val - 25) / 12.5) * 20 };
        if (val <= 75) return { text: "เริ่มมีผล", color: "#f97316", pct: 60 + ((val - 37.5) / 37.5) * 20 };
        return { text: "อันตราย", color: "#ef4444", pct: 90 };
    }
    if (type === 'o3') {
        if (val <= 50) return { text: "ปลอดภัย", color: "#10b981", pct: (val / 50) * 35 };
        if (val <= 70) return { text: "ปานกลาง", color: "#fbbf24", pct: 55 };
        return { text: "ระคายเคือง", color: "#f97316", pct: 85 };
    }
    if (type === 'co') {
        if (val <= 4.4) return { text: "ปลอดภัย", color: "#10b981", pct: (val / 4.4) * 35 };
        if (val <= 9.0) return { text: "ปกติ", color: "#34d399", pct: 55 };
        return { text: "ควรระวัง", color: "#f97316", pct: 85 };
    }
    if (type === 'no2') {
        if (val <= 53) return { text: "ปลอดภัย", color: "#10b981", pct: (val / 53) * 35 };
        if (val <= 100) return { text: "ปานกลาง", color: "#fbbf24", pct: 60 };
        return { text: "เริ่มมีผล", color: "#f97316", pct: 85 };
    }
    if (type === 'so2') {
        if (val <= 35) return { text: "ปลอดภัย", color: "#10b981", pct: (val / 35) * 40 };
        if (val <= 75) return { text: "ปานกลาง", color: "#fbbf24", pct: 65 };
        return { text: "เริ่มมีผล", color: "#f97316", pct: 85 };
    }
    return { text: "ปกติ", color: "#10b981", pct: 20 };
}

export function getCompass(raw: unknown): { name: string; deg: number } {
    if (raw === null || raw === '-' || isNaN(Number(raw))) return { name: "นิ่ง", deg: 0 };
    var deg = Number(raw);
    var names = ["ทิศเหนือ (N)", "ต.อ.เหนือ (NE)", "ทิศตะวันออก (E)", "ต.อ.ใต้ (SE)", "ทิศใต้ (S)", "ต.ต.ใต้ (SW)", "ทิศตะวันตก (W)", "ต.ต.เหนือ (NW)"];
    return { name: names[Math.round(deg / 45) % 8], deg: deg };
}
