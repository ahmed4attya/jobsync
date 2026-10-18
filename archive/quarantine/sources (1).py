#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sources.py — جالبات المصادر المدرجة في القائمة البيضاء فقط
كل مصدر هنا أُثبت حياً قبل إدراجه (دستور JobSync — قاعدة 7: لا نجاح قبل إثبات حي)
مبدأ التواصل: قراءة فقط، واجهات عامة رسمية، بلا تسجيل دخول، بلا تجاوز حواجز (لا UA مقنّع، لا cookies)
Source failed != file corrupted (قاعدة 8): كل جالبة ترجع (jobs, health_record)
"""
import json
import re
import socket
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

# درع ضد أي تعليق شبكي: مهلة قصوى عالمية + مهلة لكل طلب (لا انتظار لا نهائي مهما كانت الشبكة)
socket.setdefaulttimeout(20)

UA = {"User-Agent": "JobSync-Watch/1.0 (personal daily job report; read-only public data)"}


def _get(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _job(title, company, location, url, source, posted=""):
    return {
        "title": (title or "").strip(),
        "company": (company or "").strip() or source,
        "location": (location or "").strip(),
        "url": url,
        "source": source,
        "posted": (posted or "").strip(),
    }


# ---------------------------------------------------------------- Greenhouse
def fetch_greenhouse(board, max_jobs=60):
    src = f"greenhouse:{board}"
    data = json.loads(_get(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"))
    jobs = []
    for j in data.get("jobs", [])[: max_jobs * 3]:
        loc = (j.get("location") or {}).get("name", "")
        jobs.append(_job(j.get("title", ""), board, loc, j.get("absolute_url", ""), src,
                         j.get("updated_at", "")[:10]))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- Lever
def fetch_lever(company, max_jobs=60):
    src = f"lever:{company}"
    data = json.loads(_get(f"https://api.lever.co/v0/postings/{company}?mode=json"))
    jobs = []
    for j in data[: max_jobs * 3]:
        cats = j.get("categories") or {}
        jobs.append(_job(j.get("text", ""), company, cats.get("location", ""),
                         j.get("hostedUrl", ""), src))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- Ashby
def fetch_ashby(org, max_jobs=60):
    src = f"ashby:{org}"
    data = json.loads(_get(f"https://api.ashbyhq.com/posting-api/job-board/{org}"))
    jobs = []
    for j in data.get("jobs", [])[: max_jobs * 3]:
        loc = j.get("location") or j.get("secondaryLocation") or {}
        loc_name = loc.get("name", "") if isinstance(loc, dict) else str(loc)
        jobs.append(_job(j.get("title", ""), data.get("companyName", org), loc_name,
                         j.get("jobUrl", ""), src,
                         (j.get("publishedAt") or "")[:10]))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- SmartRecruiters
def fetch_smartrecruiters(company, max_jobs=60):
    # country=sa: هذا الوكيل متخصص بالسعودية — الواجهة تدعم فلترة الدولة رسمياً
    src = f"smartrecruiters:{company}"
    data = json.loads(_get(
        f"https://api.smartrecruiters.com/v1/companies/{company}/postings?limit=100&country=sa"))
    jobs = []
    for p in data.get("content", [])[: max_jobs * 3]:
        loc = p.get("location") or {}
        city = loc.get("city", "") or ""
        country = (loc.get("country") or "").upper()
        region = loc.get("region", "") or ""
        place = ", ".join(x for x in [city, region, country] if x)
        url = (f"https://jobs.smartrecruiters.com/{company}/{p.get('id', '')}"
               if p.get("id") else "")
        released = (p.get("releasedDate") or "")[:10]
        jobs.append(_job(p.get("name", ""), company, place, url, src, released))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- Wadhefa (وظائف.com)
_DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def fetch_wadhefa(max_jobs=40):
    src = "wadhefa.com"
    html = _get("https://www.wadhefa.com/", timeout=20)
    raw = re.findall(r'href="(https?://(?:www\.)?wadhefa\.com/details/job/(\d+)/)"[^>]*>([^<]{3,120})</a>', html)
    seen, jobs = set(), []
    for url, jid, title in raw:
        title = title.strip()
        if jid in seen or _DATE_RE.match(title) or len(title) < 5:
            continue
        seen.add(jid)
        jobs.append(_job(title, "", "المملكة العربية السعودية", url, src))
        if len(jobs) >= max_jobs:
            break
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- Remotive (remote)
def fetch_remotive(max_jobs=40):
    src = "remotive.com"
    data = json.loads(_get("https://remotive.com/api/remote-jobs?limit=100"))
    jobs = []
    for j in data.get("jobs", []):
        loc = j.get("candidate_required_location", "") or "Worldwide"
        jobs.append(_job(j.get("title", ""), j.get("company_name", ""), loc,
                         j.get("url", ""), src, (j.get("publication_date") or "")[:10]))
        if len(jobs) >= max_jobs * 2:
            break
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- Jobicy (remote)
def fetch_jobicy(max_jobs=40):
    src = "jobicy.com"
    data = json.loads(_get("https://jobicy.com/api/v2/remote-jobs?count=50"))
    jobs = []
    for j in data.get("jobs", []):
        jobs.append(_job(j.get("jobTitle", ""), j.get("companyName", ""),
                         j.get("jobGeo", "") or "Worldwide", j.get("url", ""), src,
                         (j.get("pubDate") or "")[:10]))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- WorkingNomads (remote)
def fetch_workingnomads(max_jobs=40):
    src = "workingnomads.com"
    data = json.loads(_get("https://www.workingnomads.com/api/exposed_jobs/"))
    jobs = []
    for j in data[: max_jobs * 2]:
        jobs.append(_job(j.get("title", ""), j.get("company_name", ""),
                         j.get("location", "") or "Worldwide", j.get("url", ""), src,
                         (j.get("pub_date") or "")[:10]))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- Himalayas (remote)
def fetch_himalayas(max_jobs=40):
    src = "himalayas.app"
    data = json.loads(_get("https://himalayas.app/jobs/api?limit=60"))
    jobs = []
    for j in data.get("jobs", []):
        locs = ", ".join((j.get("locations") or [])) or "Worldwide"
        posted = j.get("postedAt", "")
        posted = posted[:10] if isinstance(posted, str) else ""
        jobs.append(_job(j.get("title", ""), j.get("companyName") or j.get("company", ""), locs,
                         j.get("applicationLink") or j.get("jobUrl", ""), src, posted))
    return jobs, {"source": src, "found": len(jobs)}


# ---------------------------------------------------------------- dispatcher
def run_source(kind, name, max_jobs):
    """يستدعي الجالبة المناسبة ويلف أي فشل في سجل صحي بدل كسر التقرير"""
    try:
        if kind == "greenhouse":
            jobs, h = fetch_greenhouse(name, max_jobs)
        elif kind == "lever":
            jobs, h = fetch_lever(name, max_jobs)
        elif kind == "ashby":
            jobs, h = fetch_ashby(name, max_jobs)
        elif kind == "smartrecruiters":
            jobs, h = fetch_smartrecruiters(name, max_jobs)
        elif kind == "wadhefa":
            jobs, h = fetch_wadhefa(max_jobs)
        elif kind == "remotive":
            jobs, h = fetch_remotive(max_jobs)
        elif kind == "jobicy":
            jobs, h = fetch_jobicy(max_jobs)
        elif kind == "workingnomads":
            jobs, h = fetch_workingnomads(max_jobs)
        elif kind == "himalayas":
            jobs, h = fetch_himalayas(max_jobs)
        else:
            return [], {"source": f"{kind}:{name}", "status": "SKIP", "reason": "unknown kind"}
        h["status"] = "OK"
        return jobs, h
    except urllib.error.HTTPError as e:
        return [], {"source": f"{kind}:{name}", "status": "FAIL", "reason": f"HTTP {e.code}"}
    except Exception as e:
        return [], {"source": f"{kind}:{name}", "status": "FAIL", "reason": f"{type(e).__name__}: {e}"[:80]}
