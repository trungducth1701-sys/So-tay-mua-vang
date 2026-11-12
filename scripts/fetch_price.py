#!/usr/bin/env python3
"""Lấy giá vàng SJC (TP.HCM) và ghi prices.json. Giá tính theo đồng/lượng."""
import json, sys, urllib.request, datetime, os

URL = "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx"
WANT = {"nhan": "Vàng nhẫn SJC 99,99% 1 chỉ, 2 chỉ, 5 chỉ", "mieng": "Vàng SJC 1L, 10L, 1KG"}
LABEL = {"nhan": "Nhẫn SJC 99,99%", "mieng": "Vàng miếng SJC"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prices.json")

def fetch():
    req = urllib.request.Request(URL, data=b"", method="POST", headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        "X-Requested-With": "XMLHttpRequest", "Referer": "https://sjc.com.vn/giavang/",
        "Accept": "application/json, text/javascript, */*; q=0.01", "Origin": "https://sjc.com.vn"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def fetch_backup():
    """Nguồn dự phòng vang.today (khi SJC chặn máy chủ GitHub). Giá đồng/lượng."""
    req = urllib.request.Request("https://www.vang.today/api/prices", headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read().decode("utf-8"))
    if not j.get("success"):
        raise RuntimeError("vang.today success=false")
    keys = {"nhan": "SJ9999", "mieng": "SJL1L10"}
    items = []
    for key, code in keys.items():
        row = j["prices"][code]
        if not row.get("buy") or not row.get("sell"):
            raise RuntimeError("thiếu giá " + code)
        items.append({"key": key, "label": LABEL[key], "buy": int(row["buy"]), "sell": int(row["sell"])})
    d = str(j.get("date", ""))
    try:
        y, m, dd = d.split("-"); d = dd + "/" + m + "/" + y
    except Exception:
        pass
    return str(j.get("time", "")) + " " + d, items

def main():
    try:
        as_of, items = from_sjc()
    except Exception as e:
        print("SJC lỗi:", e, "-> dùng nguồn dự phòng")
        as_of, items = fetch_backup()
    save(as_of, items)

def from_sjc():
    j = fetch()
    if not j.get("success"):
        raise RuntimeError("SJC trả về success=false")
    items = []
    for key, name in WANT.items():
        row = next((d for d in j["data"] if d.get("TypeName", "").strip() == name and "Hồ Chí Minh" in d.get("BranchName", "")), None)
        if not row or not row.get("BuyValue") or not row.get("SellValue"):
            raise RuntimeError("Không thấy dòng giá: " + name)
        items.append({"key": key, "label": LABEL[key], "buy": int(row["BuyValue"]), "sell": int(row["SellValue"])})
    return str(j.get("latestDate", "")).strip(), items

def save(as_of, items):
    new = {"asOf": as_of, "items": items}
    try:
        old = json.load(open(OUT, encoding="utf-8"))
        if old.get("asOf") == new["asOf"] and old.get("items") == new["items"]:
            print("Không đổi"); return
    except Exception:
        pass
    new["updatedAt"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(new, f, ensure_ascii=False, indent=1)
    print("Đã cập nhật", as_of)

main()
