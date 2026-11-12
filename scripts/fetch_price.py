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

def main():
    j = fetch()
    if not j.get("success"):
        sys.exit("SJC trả về success=false")
    items = []
    for key, name in WANT.items():
        row = next((d for d in j["data"] if d.get("TypeName", "").strip() == name and "Hồ Chí Minh" in d.get("BranchName", "")), None)
        if not row or not row.get("BuyValue") or not row.get("SellValue"):
            sys.exit("Không thấy dòng giá: " + name)
        items.append({"key": key, "label": LABEL[key], "buy": int(row["BuyValue"]), "sell": int(row["SellValue"])})
    as_of = str(j.get("latestDate", "")).strip()
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
