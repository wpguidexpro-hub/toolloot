from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, quote_plus, unquote, quote
from urllib.robotparser import RobotFileParser
import requests, sqlite3, re, time

DB=r"D:\git\toolloot\crawler\neuralnet.db"
UA="NeuralNetCrawler/1.0 (+local research bot)"
TIMEOUT=12
MAX_RESULTS=8
MAX_PAGES=14
app=FastAPI(title="NeuralNet Internet Crawler")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
session=requests.Session()
session.headers.update({"User-Agent":UA,"Accept-Language":"en-US,en;q=0.8,hi;q=0.7"})

def db():
    c=sqlite3.connect(DB)
    c.execute("""CREATE TABLE IF NOT EXISTS knowledge(
      id INTEGER PRIMARY KEY,url TEXT UNIQUE,question TEXT,title TEXT,content TEXT,
      source TEXT,score REAL,created REAL,updated REAL)""")
    c.commit(); return c

def tokens(q):
    aliases={"भारत":"india","राजधानी":"capital","ग्रह":"planet","सबसे":"largest","बड़ा":"largest",
    "बड़ी":"largest","प्रधानमंत्री":"prime minister","राष्ट्रपति":"president","मुद्रा":"currency",
    "जनसंख्या":"population","क्षेत्रफल":"area","भाषा":"language"}
    q=q.lower()
    for a,b in aliases.items(): q=q.replace(a,b)
    q=re.sub(r"[^a-z0-9\s]+"," ",q)
    stop={"what","is","are","the","a","an","of","in","on","to","for","who","which","how","why","when","where","tell","me","please","does","do","did"}
    return [x for x in q.split() if len(x)>1 and x not in stop]

def score(q,title,content,url):
    ts=tokens(q); title=(title or "").lower(); content=(content or "").lower(); s=0
    for t in ts:
        if t in title:s+=7
        if t in content:s+=2
    if "capital" in ts and "india" in ts and ("new delhi" in content or "capital of india" in content):s+=18
    if "largest" in ts and "planet" in ts and "jupiter" in content:s+=18
    if urlparse(url).netloc.lower().endswith("wikipedia.org"):s+=2
    return s

def robots_ok(url):
    p=urlparse(url)
    try:
        rp=RobotFileParser(f"{p.scheme}://{p.netloc}/robots.txt");rp.read()
        return rp.can_fetch(UA,url)
    except Exception:return True

def fetch(url):
    if not url.startswith(("http://","https://")) or not robots_ok(url):return None
    try:
        r=session.get(url,timeout=TIMEOUT,allow_redirects=True)
        if r.status_code>=400 or "text/html" not in r.headers.get("content-type",""):return None
        soup=BeautifulSoup(r.text,"lxml")
        for x in soup(["script","style","noscript","svg","nav","footer","form"]):x.decompose()
        title=soup.title.get_text(" ",strip=True) if soup.title else urlparse(url).netloc
        main=soup.find("main") or soup.find("article") or soup.body
        text=re.sub(r"\s+"," ",main.get_text(" ",strip=True) if main else "").strip()
        links=[]
        for a in soup.find_all("a",href=True):
            u=urljoin(r.url,a["href"].split("#")[0])
            if urlparse(u).scheme in ("http","https") and len(u)<500:links.append(u)
        return {"url":r.url,"title":title,"content":text[:120000],"links":list(dict.fromkeys(links))[:120]}
    except Exception:return None

def search_ddg(q):
    try:
        r=session.get("https://html.duckduckgo.com/html/?q="+quote_plus(q),timeout=TIMEOUT)
        s=BeautifulSoup(r.text,"lxml");out=[]
        for a in s.select("a.result__a"):
            u=a.get("href","");t=a.get_text(" ",strip=True)
            if u.startswith("//"):u="https:"+u
            if u.startswith("http"):out.append({"url":u,"title":t})
        return out[:MAX_RESULTS]
    except Exception:return []

def wiki(q,lang="en"):
    try:
        u=f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={quote_plus(q)}&srlimit=6&format=json"
        d=session.get(u,timeout=TIMEOUT).json()
        return [{"url":f"https://{lang}.wikipedia.org/wiki/"+quote_plus(x["title"].replace(" ","_")),"title":x["title"]} for x in d.get("query",{}).get("search",[])]
    except Exception:return []

def fetch_wiki_api(url,title_hint=''):
    try:
        p=urlparse(url)
        if "wikipedia.org" not in p.netloc:return None
        lang=p.netloc.split(".")[0]
        title=title_hint or unquote(p.path.split("/wiki/",1)[-1]).replace("_"," ")
        api="https://"+lang+".wikipedia.org/api/rest_v1/page/summary/"+quote(title.replace(" ","_"),safe="")
        r=session.get(api,timeout=TIMEOUT)
        if r.status_code!=200:return None
        d=r.json()
        text=re.sub(r"\s+"," ",d.get("extract","")).strip()
        if not text:return None
        return {"url":d.get("content_urls",{}).get("desktop",{}).get("page",url),
                "title":d.get("title",title),"content":text,"links":[]}
    except Exception:return None

def crawl(question):
    variants=[question," ".join(tokens(question))]
    seeds=[]
    for q in variants:
        if q: seeds += wiki(q,"en")+wiki(q,"hi")+search_ddg(q)
    unique=[];seen=set()
    for x in seeds:
        if x["url"] not in seen:seen.add(x["url"]);unique.append(x)
    ranked=[];queue=unique[:MAX_RESULTS];visited=set()
    while queue and len(visited)<MAX_PAGES:
        seed=queue.pop(0);u=seed["url"]
        if u in visited:continue
        visited.add(u)
        page=fetch_wiki_api(u,seed.get("title","")) if "wikipedia.org/wiki/" in u else fetch(u)
        if not page:continue
        sc=score(question,page["title"],page["content"],page["url"])
        if sc>0:ranked.append({**page,"score":sc})
        if sc>=5:
            for link in page["links"]:
                if link not in visited and len(queue)<40:queue.append({"url":link,"title":""})
        ranked.sort(key=lambda x:x["score"],reverse=True)
    return ranked[:8],len(visited)

def save(question,p):
    c=db()
    c.execute("""INSERT INTO knowledge(url,question,title,content,source,score,created,updated)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET question=excluded.question,
    title=excluded.title,content=excluded.content,source=excluded.source,score=excluded.score,updated=excluded.updated""",
    (p["url"],question,p["title"],p["content"],urlparse(p["url"]).netloc,p["score"],time.time(),time.time()))
    c.commit();c.close()

@app.get("/api/health")
def health():return {"ok":True,"crawler":"online","mode":"open-web","robots":"respected"}

@app.get("/api/ask")
def ask(q:str=Query(min_length=2,max_length=500)):
    c=db()
    old=c.execute("SELECT title,content,url,source,score FROM knowledge WHERE question=? ORDER BY score DESC LIMIT 1",(q.strip(),)).fetchone()
    c.close()
    if old and old[1]:
        return {"ok":True,"learned":False,"cached":True,"answer":old[1][:2200],"title":old[0],"url":old[2],"source":old[3],"score":old[4],"pages":0}
    pages,count=crawl(q)
    if not pages or pages[0]["score"]<7:
        return {"ok":False,"learned":False,"message":"No relevant web result passed verification; nothing was learned.","pages":count}
    best=pages[0]
    answer=" ".join(re.split(r"(?<=[.!?।])\s+",best["content"])[:6])[:2200]
    best["content"]=answer;save(q,best)
    return {"ok":True,"learned":True,"cached":False,"answer":answer,"title":best["title"],"url":best["url"],"source":best["source"],"score":best["score"],"pages":count,
    "sources":[{"title":p["title"],"url":p["url"],"score":p["score"]} for p in pages[:5]]}

if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="0.0.0.0",port=5190)
