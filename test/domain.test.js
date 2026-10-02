import test from "node:test";
import assert from "node:assert/strict";
import { renderReport, validateReportInput } from "../backend/src/domain.js";

test("report contract requires scope and source traceability", () => {
  assert.equal(validateReportInput({ report_type: "TRANSACTION_FINANCIAL_STATUS" }).ok, false);
  assert.equal(validateReportInput({
    report_type: "TRANSACTION_FINANCIAL_STATUS", subject_ref: "1040",
    recipient_binding_id: "b1", source_refs: ["transactions:1040"], payload: {}
  }).ok, true);
});

test("financial report is transaction-scoped and does not invent missing fields", () => {
  const output = renderReport({ report_type: "TRANSACTION_FINANCIAL_STATUS", payload: {
    transaction_no: "1040", buyer: "خریدار نمونه", seller: "فروشنده نمونه",
    total_value: 1000, buyer_received_total: 400, buyer_remaining: 600,
    seller_paid_total: 300, seller_remaining: 700
  }});
  assert.match(output, /شماره معامله: 1040/);
  assert.match(output, /مانده دریافت از خریدار: 600 تومان/);
  assert.match(output, /دریافت امروز: اطلاعات ثبت نشده/);
});

test("Rabbani report keeps contractor allocations separate", () => {
  const output = renderReport({ report_type: "RABBANI_ORDER_ALLOCATION", payload: {
    order_no: "15114011", total_weight_kg: 75000,
    contractors: [{ name: "الف", allocated_kg: 40000, loaded_kg: 24000 }, { name: "ب", allocated_kg: 35000, loaded_kg: 20000 }],
    total_loaded_kg: 44000, remaining_kg: 31000
  }});
  assert.match(output, /الف — تخصیص: 40,000 کیلوگرم/);
  assert.match(output, /ب — تخصیص: 35,000 کیلوگرم/);
  assert.match(output, /مانده سفارش: 31,000 کیلوگرم/);
});

test("daily report lists every receipt/payment and totals", () => {
  const output = renderReport({ report_type: "DAILY_RECEIPT_PAYMENT", payload: {
    date: "1405/07/08", transaction_no: "1037",
    entries: [{ kind: "دریافت", amount: 70000000, source_ref: "404" }, { kind: "دریافت", amount: 81000000, source_ref: "405" }],
    received_today: 151000000
  }});
  assert.match(output, /70,000,000 تومان/);
  assert.match(output, /81,000,000 تومان/);
  assert.match(output, /جمع دریافت امروز: 151,000,000 تومان/);
});
