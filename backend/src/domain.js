const MISSING = "اطلاعات ثبت نشده";
const text = value => value === undefined || value === null || value === "" ? MISSING : String(value);
const money = value => value === undefined || value === null || value === "" ? MISSING : `${Number(value).toLocaleString("en-US")} تومان`;
const weight = value => value === undefined || value === null || value === "" ? MISSING : `${Number(value).toLocaleString("en-US")} کیلوگرم`;

function linesForItems(items, mapper) {
  if (!Array.isArray(items) || items.length === 0) return [`- ${MISSING}`];
  return items.map(mapper);
}

export function validateReportInput(input) {
  const types = new Set(["RABBANI_ORDER_ALLOCATION", "TRANSACTION_FINANCIAL_STATUS", "DAILY_RECEIPT_PAYMENT"]);
  if (!input || !types.has(input.report_type)) return { ok: false, reason: "invalid_report_type" };
  if (!input.subject_ref || !input.recipient_binding_id) return { ok: false, reason: "missing_scope" };
  if (!Array.isArray(input.source_refs) || input.source_refs.length === 0) return { ok: false, reason: "missing_source_refs" };
  if (!input.payload || typeof input.payload !== "object") return { ok: false, reason: "missing_payload" };
  return { ok: true };
}

export function renderReport(input) {
  const p = input.payload;
  if (input.report_type === "RABBANI_ORDER_ALLOCATION") {
    return [
      "گزارش وضعیت سفارش آقای ربانی",
      `شماره سفارش: ${text(p.order_no)}`,
      `شماره قرارداد: ${text(p.contract_no)}`,
      `نوع کالا / سایز: ${text(p.product)}`,
      `تناژ کل سفارش: ${weight(p.total_weight_kg)}`,
      `شماره و تاریخ نامه: ${text(p.letter_ref)}`,
      "تخصیص و بارگیری پیمانکاران:",
      ...linesForItems(p.contractors, (x, i) => `${i + 1}. ${text(x.name)} — تخصیص: ${weight(x.allocated_kg)} — بارگیری: ${weight(x.loaded_kg)}`),
      `مجموع بارگیری‌شده: ${weight(p.total_loaded_kg)}`,
      `مانده سفارش: ${weight(p.remaining_kg)}`
    ].join("\n");
  }
  if (input.report_type === "TRANSACTION_FINANCIAL_STATUS") {
    return [
      "گزارش وضعیت مالی معامله",
      `شماره معامله: ${text(p.transaction_no)}`,
      `خریدار: ${text(p.buyer)}`,
      `فروشنده: ${text(p.seller)}`,
      `ارزش کل معامله: ${money(p.total_value)}`,
      `کل دریافت از خریدار: ${money(p.buyer_received_total)}`,
      `دریافت امروز: ${money(p.buyer_received_today)}`,
      `مانده دریافت از خریدار: ${money(p.buyer_remaining)}`,
      `کل پرداخت به فروشنده: ${money(p.seller_paid_total)}`,
      `پرداخت امروز: ${money(p.seller_paid_today)}`,
      `مانده پرداخت به فروشنده: ${money(p.seller_remaining)}`
    ].join("\n");
  }
  return [
    "گزارش روزانه دریافت و پرداخت",
    `تاریخ: ${text(p.date)}`,
    `شماره معامله: ${text(p.transaction_no)}`,
    `خریدار: ${text(p.buyer)}`,
    `فروشنده: ${text(p.seller)}`,
    "ریز فیش‌های امروز:",
    ...linesForItems(p.entries, (x, i) => `${i + 1}. ${text(x.kind)} — ${money(x.amount)} — شناسه: ${text(x.source_ref)}`),
    `جمع دریافت امروز: ${money(p.received_today)}`,
    `جمع پرداخت امروز: ${money(p.paid_today)}`,
    `جمع دریافت تا امروز: ${money(p.received_total)}`,
    `جمع پرداخت تا امروز: ${money(p.paid_total)}`,
    `مانده دریافت: ${money(p.buyer_remaining)}`,
    `مانده پرداخت: ${money(p.seller_remaining)}`
  ].join("\n");
}
