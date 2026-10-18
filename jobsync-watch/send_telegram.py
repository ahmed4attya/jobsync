#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
send_telegram.py — سكربت إرسال إشعارات تليجرام لمشروع JobSync
الاستخدام:
  python send_telegram.py --text "نص الرسالة هنا"
  python send_telegram.py --summary --ksa 72 --remote 41 --report "reports/report_2026-10-18.html"
"""

import os
import sys
import argparse
import urllib.request
import urllib.parse
import urllib.error
import json

# Force UTF-8 on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def load_env():
    """قراءة متغيرات البيئة من ملف .env إذا لم تكن موجودة في النظام"""
    env_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        ".env",
    ]
    for p in env_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k not in os.environ:
                            os.environ[k] = v

def send_message(text: str) -> bool:
    load_env()
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if not token or not chat_id:
        print("[Telegram] تحذير: لم يتم تعيين TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID في .env — تم تخطي الإرسال بأمان.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read().decode("utf-8"))
            if res.get("ok"):
                print("[Telegram] ✅ تم إرسال الإشعار بنجاح إلى تليجرام.")
                return True
            else:
                print(f"[Telegram] ❌ فشل الإرسال: {res}")
                return False
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        print(f"[Telegram] ⚠️ خطأ من تليجرام ({e.code}): {err_msg}")
        return False
    except Exception as e:
        print(f"[Telegram] ⚠️ تعذر الاتصال بتليجرام: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="JobSync Telegram Dispatcher")
    parser.add_argument("--text", type=str, help="نص الرسالة المراد إرسالها")
    parser.add_argument("--summary", action="store_true", help="إرسال ملخص جولة الرصد الصباحي")
    parser.add_argument("--ksa", type=int, default=0, help="عدد وظائف السعودية الجديدة")
    parser.add_argument("--remote", type=int, default=0, help="عدد وظائف العمل عن بعد المؤهلة")
    parser.add_argument("--report", type=str, default="", help="مسار تقرير الرصد اليومي")

    args = parser.parse_args()

    if args.summary:
        msg = (
            f"🔔 <b>JobSync — ملخص جولة الرصد الصباحي</b>\n\n"
            f"🇸🇦 <b>وظائف السعودية الجديدة:</b> {args.ksa}\n"
            f"🌐 <b>وظائف العمل عن بُعد:</b> {args.remote}\n"
            f"📊 <b>حالة المصادر:</b> نشطة بنجاح\n"
        )
        if args.report:
            msg += f"\n📄 تم توليد تقرير اليوم: <code>{os.path.basename(args.report)}</code>"
        send_message(msg)
    elif args.text:
        send_message(args.text)
    else:
        # رسالة تجريبية افتراضية
        test_msg = "🚀 <b>JobSync Notification System</b>\n\nتم ربط وتفعيل إشعارات تليجرام بنجاح!"
        send_message(test_msg)

if __name__ == "__main__":
    main()
