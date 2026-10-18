#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
agent.py — وكيل الرصد الصباحي (JobSync-Watch v2.0-CV)
المهمة: بحث تلقائي يومي عن الوظائف داخل السعودية + تقرير عربي جاهز للمراجعة
الجديد في v2.0-CV: تقييم موزون مفهرس على السيرة الذاتية (profile في config.json)
  — مسميات مستهدفة ×25، مهارات ×8، أقدمية ×5، قرب منطقة عسير +10 —
  + شارات مطابقة ثلاثية + شارة «قريب من منطقتك» + بطاقة الملف المهني في التقرير.
الحدود الدستورية:
  - قراءة فقط من مصادر مدرجة في قائمة بيضاء أثبتت حياً (قاعدة 7)
  - لا تسجيل دخول، لا تجاوز حواجز، لا سكرابينغ للمواقع المحجوبة (لينكدإن/إنديد/جادرات/بيت: روابط يدوية فقط)
  - صفر submits — الوكيل يجهّز وينتظر إصبع المالك (المسار الأوسط D13)
  - فشل مصدر يُوثق في صحة المصادر ولا يفسد التقرير (قاعدة 8)
"""
import hashlib
import json
import os
import re
import sys
import urllib.parse
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
from sources import run_source  # noqa: E402
os.makedirs(os.path.join(BASE, "state"), exist_ok=True)
os.makedirs(os.path.join(BASE, "reports"), exist_ok=True)

# ---------------------------------------------------------------- الموقع الجغرافي السعودي
KSA_TOKENS = [
    "saudi", "ksa", "السعودية", "السعوديه", "المملكة",
    "riyadh", "الرياض", "jeddah", "جدة", "جده",
    "dammam", "الدمام", "khobar", "الخبر", "dhahran", "الظهران",
    "makkah", "mecca", "مكة", "madinah", "medina", "المدينة",
    "jubail", "الجبيل", "yanbu", "ينبع", "tabuk", "تبوك",
    "abha", "أبها", "ابها", "taif", "الطائف", "buraidah", "بريدة",
    "hail", "حائل", "najran", "نجران", "jazan", "جازان",
    "king abdullah economic city", "kaec", "thuwal", "ثول",
    "khamis", "mushait", "خميس", "عسير", "neom", "نيوم",
    "ahsa", "الأحساء", "الاحساء", "qatif", "القطيف", "sakaka", "سكاكا", "arar", "عرعر",
]
WORLDWIDE_TOKENS = ["worldwide", "anywhere", "global", "remote", "من أي مكان", "عن بعد"]


def is_ksa(location: str) -> bool:
    loc = (location or "").lower()
    return any(t in loc for t in KSA_TOKENS)


def is_worldwide_remote(location: str) -> bool:
    loc = (location or "").lower()
    return any(t in loc for t in WORLDWIDE_TOKENS) or (location or "").strip() == ""


def is_saudi_flagged(location: str) -> bool:
    return is_ksa(location) and any(t in (location or "").lower() for t in ["saudi", "ksa", "السعودية"])


# ---------------------------------------------------------------- الإعداد
def load_config():
    path = os.path.join(BASE, "config.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def collect_sources(cfg):
    """يحوّل config.sources إلى قائمة تنفيذ (kind, name)"""
    plan = []
    s = cfg.get("sources", {})
    for b in s.get("greenhouse", {}).get("boards", []):
        plan.append(("greenhouse", b))
    for c in s.get("lever", {}).get("companies", []):
        plan.append(("lever", c))
    for o in s.get("ashby", {}).get("orgs", []):
        plan.append(("ashby", o))
    for c in s.get("smartrecruiters", {}).get("companies", []):
        plan.append(("smartrecruiters", c))
    if s.get("wadhefa", {}).get("enabled", True):
        plan.append(("wadhefa", ""))
    if s.get("remotive", {}).get("enabled", True):
        plan.append(("remotive", ""))
    if s.get("jobicy", {}).get("enabled", True):
        plan.append(("jobicy", ""))
    if s.get("workingnomads", {}).get("enabled", True):
        plan.append(("workingnomads", ""))
    if s.get("himalayas", {}).get("enabled", True):
        plan.append(("himalayas", ""))
    return plan


# ---------------------------------------------------------------- النقاط والذاكرة
def score_job(job, cfg):
    """v2.0-CV: تقييم موزون على ملف السيرة الذاتية. بلا profile يرجع للطريقة القديمة."""
    profile = cfg.get("profile") or {}
    title = (job["title"] or "").lower()
    loc = (job["location"] or "").lower()
    hay = f"{title} {job['company']} {loc}".lower()
    if not profile.get("primary_titles"):
        return min(sum(1 for k in cfg.get("keywords", []) if k.lower() in hay), 5)
    sc = 0
    hits = 0
    for kw in profile["primary_titles"]:
        if kw.lower() in title:
            sc += 25
            hits += 1
            if hits >= 2:
                break
    hits = 0
    for kw in profile.get("seniority_words", []):
        if kw.lower() in title:
            sc += 5
            hits += 1
            if hits >= 2:
                break
    hits = 0
    for kw in profile.get("skills", []):
        if kw.lower() in hay:
            sc += 8
            hits += 1
            if hits >= 3:
                break
    for city in profile.get("home_cities", []):
        if city.lower() in loc:
            sc += 10
            break
    return sc


def score_badge(sc):
    if sc >= 45:
        return '<span class="badge bx">مطابقة ممتازة</span> '
    if sc >= 25:
        return '<span class="badge bs">مطابقة قوية</span> '
    if sc >= 12:
        return '<span class="badge bm">مطابقة متوسطة</span> '
    return ""


def home_badge(job, cfg):
    loc = (job.get("location") or "").lower()
    for city in (cfg.get("profile") or {}).get("home_cities", []):
        if city.lower() in loc:
            return '<span class="badge bh">قريب من منطقتك</span> '
    return ""


def load_seen():
    p = os.path.join(BASE, "state", "seen.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_seen(seen, today, keep_days=60):
    # تقليم: نحتفظ بالسجلات الأحدث أولاً حتى سقف سخي يمنع تضخم الملف
    os.makedirs(os.path.join(BASE, "state"), exist_ok=True)
    items = sorted(seen.items(), key=lambda kv: kv[1], reverse=True)
    pruned = dict(items[: keep_days * 500])
    p = os.path.join(BASE, "state", "seen.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(pruned, f, ensure_ascii=False, indent=1)


def jhash(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- بناء التقرير
def esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def job_row(j, badge_new=False, cfg=None):
    new = '<span class="badge new">جديدة اليوم</span> ' if badge_new else ""
    match = score_badge(j.get("score", 0))
    home = home_badge(j, cfg or {}) if cfg else ""
    return f"""<tr>
      <td class="t">{new}{match}{home}<a href="{esc(j['url'])}" target="_blank" rel="noopener">{esc(j['title'])}</a></td>
      <td>{esc(j['company'])}</td>
      <td>{esc(j['location'])}</td>
      <td><span class="src">{esc(j['source'])}</span></td>
      <td class="date">{esc(j['posted'])}</td>
    </tr>"""


def table(jobs, badge_set=None, cfg=None):
    if not jobs:
        return '<p class="empty">لا توجد وظائف في هذا القسم اليوم.</p>'
    badge_set = badge_set or set()
    head = """<table>
      <thead><tr><th>الوظيفة</th><th>الجهة</th><th>الموقع</th><th>المصدر</th><th>التاريخ</th></tr></thead>
      <tbody>"""
    rows = "\n".join(job_row(j, j["url"] in badge_set, cfg) for j in jobs)
    return head + rows + "</tbody></table>"


def manual_links(cfg):
    """v2.0-CV: روابط بحث يدوي تُبنى من مسميات السيرة المستهدفة بدل كلمات عامة."""
    searches = (cfg.get("profile") or {}).get("manual_searches") \
        or [" ".join(cfg.get("keywords", [])[:2]) or "jobs"]
    links = []
    for term in searches[:3]:
        q = urllib.parse.quote(term)
        slug = urllib.parse.quote(term.strip().lower().replace(" ", "-"))
        links.append((f"لينكدإن — «{esc(term)}» داخل السعودية (فتح يدوي فقط — الشروط تمنع الأتمتة)",
                      f"https://www.linkedin.com/jobs/search/?keywords={q}&location=Saudi%20Arabia&f_TPR=r86400"))
        links.append((f"بيت.كوم — «{esc(term)}» داخل السعودية (فتح يدوي)",
                      f"https://www.bayt.com/ar/saudi-arabia/jobs/{slug}-jobs/"))
    links += [
        ("جادرات — منصة وزارة الموارد البشرية الرسمية (فتح يدوي)", "https://jadarat.sa/"),
        ("مهنتي — وظائف السعودية (فتح يدوي)", "https://www.mihnati.com/"),
        ("وظائف.com — البحث المتقدم (فتح يدوي)", "https://www.wadhefa.com/search_jobs/"),
    ]
    lis = "\n".join(f'<li><a href="{u}" target="_blank" rel="noopener">{t}</a></li>' for t, u in links)
    return f'<ul class="manual">{lis}</ul>'


def profile_card(cfg):
    """v2.0-CV: بطاقة الملف المهني أعلى التقرير — من السيرة الذاتية."""
    p = cfg.get("profile") or {}
    if not p:
        return ""
    chips = " ".join(f'<span class="chip">{esc(s)}</span>' for s in p.get("top_skills", [])[:10])
    mail = f'<a href="mailto:{esc(p["email"])}">{esc(p["email"])}</a>' if p.get("email") else ""
    li = f' · <a href="{esc(p["linkedin"])}" target="_blank" rel="noopener">لينكدإن</a>' if p.get("linkedin") else ""
    return f"""  <div class="pcard">
    <div class="pname">{esc(p.get("name_ar", ""))} <span class="pen">{esc(p.get("name_en", ""))}</span></div>
    <div class="phead">{esc(p.get("headline_ar", ""))}</div>
    <div class="pmeta">{esc(p.get("city_ar", ""))} · خبرة +{esc(str(p.get("experience_years", "")))} سنوات · {mail}{li}</div>
    <div class="pchips">{chips}</div>
  </div>"""


def health_table(health):
    icon = {"OK": "✅", "FAIL": "⚠️", "SKIP": "⏭"}
    rows = []
    for h in health:
        st = h.get("status", "?")
        note = esc(h.get("reason", f"تم جلب {h.get('found', 0)} وظيفة"))
        rows.append(f"<tr><td>{esc(h.get('source', '?'))}</td>"
                    f"<td>{icon.get(st, '?')} {st}</td><td>{note}</td></tr>")
    return ("<table><thead><tr><th>المصدر</th><th>الحالة</th><th>ملاحظة</th></tr></thead>"
            "<tbody>" + "\n".join(rows) + "</tbody></table>")


def build_report(cfg, ksa_jobs, remote_jobs, health, new_urls, today):
    now = datetime.now().strftime("%H:%M")
    p = cfg.get("profile") or {}
    for j in ksa_jobs + remote_jobs:
        j["score"] = score_job(j, cfg)

    # فرز مستقر على مرحلتين: الأحدث أولاً ثم درجة التطابق تنازلياً
    ksa_jobs.sort(key=lambda j: j["posted"] or "", reverse=True)
    ksa_sorted = sorted(ksa_jobs, key=lambda j: -j["score"])[: cfg.get("max_report_rows", 150)]
    remote_sorted = sorted(remote_jobs, key=lambda j: -j["score"])[: cfg.get("max_remote_rows", 60)]

    n_new_ksa = sum(1 for j in ksa_sorted if j["url"] in new_urls)
    n_new_remote = sum(1 for j in remote_sorted if j["url"] in new_urls)
    n_strong_ksa = sum(1 for j in ksa_sorted if j.get("score", 0) >= 25)
    ok_src = sum(1 for h in health if h.get("status") == "OK")

    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>تقرير الوظائف — {today}</title>
<style>
  :root {{ --bg:#0f1420; --card:#171e2e; --line:#253049; --tx:#e8edf7; --dim:#9aa7bd; --acc:#4da3ff; --gold:#ffc861; --green:#4ade80; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--tx); font-family:"Segoe UI","Noto Sans Arabic",Tahoma,sans-serif; line-height:1.7; }}
  .wrap {{ max-width:1080px; margin:0 auto; padding:28px 20px 60px; }}
  h1 {{ font-size:26px; margin:0 0 4px; }}
  .sub {{ color:var(--dim); font-size:14px; margin-bottom:22px; }}
  .kpis {{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:26px; }}
  .kpi {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 20px; min-width:150px; }}
  .kpi .n {{ font-size:26px; font-weight:700; color:var(--acc); }}
  .kpi.g .n {{ color:var(--green); }}
  .kpi.y .n {{ color:var(--gold); }}
  .kpi .l {{ color:var(--dim); font-size:12.5px; }}
  h2 {{ font-size:19px; margin:34px 0 10px; border-right:4px solid var(--acc); padding-right:10px; }}
  h2 .c {{ color:var(--dim); font-weight:400; font-size:14px; }}
  table {{ width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }}
  th {{ background:#1c2537; color:var(--dim); font-size:12.5px; text-align:right; padding:10px 12px; }}
  td {{ padding:10px 12px; border-top:1px solid var(--line); font-size:14px; vertical-align:top; }}
  td.t a {{ color:var(--tx); text-decoration:none; font-weight:600; }}
  td.t a:hover {{ color:var(--acc); }}
  td.date, .sub, th {{ color:var(--dim); }}
  .src {{ background:#20304d; color:#8ec2ff; border-radius:8px; padding:2px 8px; font-size:12px; white-space:nowrap; }}
  .badge {{ border-radius:8px; padding:2px 8px; font-size:11.5px; font-weight:700; }}
  .badge.new {{ background:#123d29; color:var(--green); }}
  .badge.bx {{ background:#4a2c00; color:#ffb347; }}
  .badge.bs {{ background:#413012; color:var(--gold); }}
  .badge.bm {{ background:#1e2a45; color:#9fc1ff; }}
  .badge.bh {{ background:#0f3d3e; color:#6ee7d7; }}
  .pcard {{ background:linear-gradient(135deg,#182238,#141b2c); border:1px solid #33415e; border-radius:16px; padding:18px 22px; margin-bottom:24px; }}
  .pname {{ font-size:20px; font-weight:800; color:var(--tx); }}
  .pname .pen {{ color:var(--dim); font-size:13px; font-weight:400; margin-right:8px; direction:ltr; unicode-bidi:embed; }}
  .phead {{ color:var(--acc); font-size:14px; margin-top:4px; }}
  .pmeta {{ color:var(--dim); font-size:13px; margin-top:6px; }}
  .pmeta a {{ color:#b7d3ff; text-decoration:none; direction:ltr; unicode-bidi:embed; }}
  .pchips {{ margin-top:12px; }}
  .chip {{ display:inline-block; background:#20304d; color:#8ec2ff; border-radius:20px; padding:3px 12px; font-size:12px; margin:3px 0 3px 6px; }}
  .empty {{ color:var(--dim); background:var(--card); border:1px dashed var(--line); padding:14px; border-radius:12px; }}
  .manual {{ list-style:none; padding:0; }}
  .manual li {{ background:var(--card); border:1px solid var(--line); border-radius:10px; margin-bottom:8px; padding:10px 14px; }}
  .manual a {{ color:#b7d3ff; text-decoration:none; }}
  .foot {{ margin-top:40px; color:var(--dim); font-size:12.5px; border-top:1px solid var(--line); padding-top:14px; }}
  .note {{ background:#1a2233; border:1px solid var(--line); border-radius:12px; padding:12px 16px; color:var(--dim); font-size:13.5px; margin:14px 0; }}
</style>
</head>
<body><div class="wrap">
  <h1>تقرير الوظائف الصباحي — {esc(p.get("name_ar", "المملكة العربية السعودية"))}</h1>
  <div class="sub">صُنع تلقائياً بواسطة JobSync-Watch v2.0-CV · {today} الساعة {now} · المصادر الحية: {ok_src}/{len(health)} · قراءة فقط من واجهات عامة مسموحة</div>

  {profile_card(cfg)}

  <div class="kpis">
    <div class="kpi g"><div class="n">{n_new_ksa}</div><div class="l">جديدة اليوم داخل السعودية</div></div>
    <div class="kpi"><div class="n">{len(ksa_sorted)}</div><div class="l">وظائف داخل السعودية الآن</div></div>
    <div class="kpi y"><div class="n">{n_strong_ksa}</div><div class="l">مطابقة قوية+ لسيرتك داخل السعودية</div></div>
    <div class="kpi y"><div class="n">{n_new_remote}</div><div class="l">جديدة — عن بُعد من السعودية</div></div>
    <div class="kpi"><div class="n">{len(remote_sorted)}</div><div class="l">إجمالي عن بُعد المؤهل</div></div>
  </div>

  <div class="note">صفر تقديم تلقائي: كل شيء هنا جاهز للمراجعة، والتقديم بيدك أنت (المسار الأوسط). لينكدإن وإنديد وجادرات تمنع الأتمتة بشروطها — تجدها في قسم «مراجعة يدوية» بروابط جاهزة.</div>

  <h2>أولاً: وظائف داخل السعودية <span class="c">— ({len(ksa_sorted)}) وظيفة · مرتبة بحسب تطابق سيرتك الذاتية ({esc(", ".join(p.get("top_skills", [])[:4]))}…) · أولوية لمنطقتك (عسير)</span></h2>
  {table(ksa_sorted, new_urls, cfg)}

  <h2>ثانياً: عن بُعد — مؤهل من داخل المملكة <span class="c">— ({len(remote_sorted)}) وظيفة Worldwide/Remote · مرتبة بتطابق سيرتك</span></h2>
  {table(remote_sorted, new_urls, cfg)}

  <h2>ثالثاً: روابط مراجعة يدوية <span class="c">— الوكيل لا يلمسها آلياً (شرط الشروط والأحكام)</span></h2>
  {manual_links(cfg)}

  <h2>رابعاً: صحة المصادر <span class="c">— إثبات حي لهذا التقرير</span></h2>
  {health_table(health)}

  <div class="foot">
    JobSync-Watch v2.0-CV · مفهرس على السيرة الذاتية · قائمة بيضاء فقط (قاعدة 7: لا نجاح قبل إثبات حي) · فشل مصدر موثق بشفافية ولا يفسد التقرير (قاعدة 8)
    · لا أسرار داخل الملفات (قاعدة 5) · هذا التقرير أداة رصد: القرار والتقديم قرارك وإصبعك.
  </div>
</div></body></html>"""


# ---------------------------------------------------------------- التشغيل
def main():
    cfg = load_config()
    today = datetime.now().strftime("%Y-%m-%d")
    seen = load_seen()
    new_urls = set()

    ksa_jobs, remote_jobs, health = [], [], []
    include_remote = cfg.get("include_remote_worldwide", True)
    max_src = cfg.get("max_jobs_per_source", 40)

    for kind, name in collect_sources(cfg):
        jobs, h = run_source(kind, name, max_src)
        health.append(h)
        for j in jobs:
            url = j["url"]
            if not url or not j["title"]:
                continue
            hid = jhash(url)
            if hid not in seen:
                seen[hid] = today
                new_urls.add(url)
            if kind in ("wadhefa",) or is_ksa(j["location"]):
                ksa_jobs.append(j)
            elif include_remote and is_worldwide_remote(j["location"]):
                remote_jobs.append(j)
        print(f"  [{h.get('status', '?')}] {h.get('source', kind)} → {'KSA:' + str(sum(1 for j in jobs if is_ksa(j['location']))) if jobs else ''} fetched={len(jobs)}")

    # de-dup inside one run
    def dedup(lst):
        out, s = [], set()
        for j in lst:
            if j["url"] in s:
                continue
            s.add(j["url"])
            out.append(j)
        return out

    ksa_jobs, remote_jobs = dedup(ksa_jobs), dedup(remote_jobs)

    report_html = build_report(cfg, ksa_jobs, remote_jobs, health, new_urls, today)
    os.makedirs(os.path.join(BASE, "reports"), exist_ok=True)
    rpath = os.path.join(BASE, "reports", f"report_{today}.html")
    with open(rpath, "w", encoding="utf-8") as f:
        f.write(report_html)

    # لقطة بيانات للدمج المستقبلي مع محرك JobSync (قائمة المراجعة داخل /apply)
    snap = {"generated_at": datetime.now().isoformat(),
            "version": "2.0-CV",
            "candidate": (cfg.get("profile") or {}).get("name_en", ""),
            "ksa": ksa_jobs, "remote": remote_jobs, "health": health}
    with open(os.path.join(BASE, "state", "last_run.json"), "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)

    save_seen(seen, today)

    print("\n=== JobSync-Watch v2.0-CV RUN SUMMARY ===")
    print(f"KSA jobs:        {len(ksa_jobs)}  (new today: {n_ksa_new(ksa_jobs, new_urls)})")
    print(f"KSA strong+ (score>=25): {sum(1 for j in ksa_jobs if j.get('score', 0) >= 25)}  | near-region: {sum(1 for j in ksa_jobs if home_badge(j, cfg))}")
    print(f"Remote eligible: {len(remote_jobs)}")
    print(f"Sources OK:      {sum(1 for h in health if h.get('status') == 'OK')}/{len(health)}")
    print(f"Report:          {rpath}")


def n_ksa_new(jobs, new_urls):
    return sum(1 for j in jobs if j["url"] in new_urls)


if __name__ == "__main__":
    main()
