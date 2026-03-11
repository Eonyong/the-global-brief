#!/usr/bin/env node
/**
 * The Global Brief — Auto Post Generator
 *
 * Required env vars:
 *   CLAUDE_API_KEY   — Anthropic API key (get at console.anthropic.com)
 *   PEXELS_API_KEY   — Free Pexels API key (pexels.com/api)
 *
 * Optional:
 *   BLOG_BASE_URL    — Site base URL (default: https://the-global-brief-504d5.web.app)
 *   GA_MEASUREMENT_ID — Google Analytics ID
 *   CATEGORY         — Force "politics" | "economy" | "auto" (default: auto)
 *   CUSTOM_TOPIC     — Override topic text
 *   DRY_RUN          — Set to "1" to skip API calls and use sample data
 */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'posts.json');
const POSTS_DIR = path.join(ROOT, 'public', 'posts');

const BLOG_NAME = 'The Global Brief';
const ADS_CLIENT = 'ca-pub-3898675618700513';
const GTM_ID = 'GTM-TP2SWKBR';
const BLOG_BASE_URL = process.env.BLOG_BASE_URL || 'https://the-global-brief-504d5.web.app';
const GA_ID = process.env.GA_MEASUREMENT_ID || 'G-L3Z7HC2RGD';
const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';
const CATEGORY_INPUT = (process.env.CATEGORY || 'auto').toLowerCase();
const CUSTOM_TOPIC = process.env.CUSTOM_TOPIC || '';

// ── Topic pools ───────────────────────────────────────────────────────────────
const TOPICS = {
  politics: [
    { text: 'US Congress and White House policy battles shaping 2026', img: 'US Capitol Congress Washington policy' },
    { text: 'European Union geopolitical strategy and reform agenda 2026', img: 'European Union Brussels summit' },
    { text: 'NATO defense alliance evolution and European security', img: 'NATO summit military alliance defense' },
    { text: 'China-Taiwan cross-strait tensions and Indo-Pacific strategy', img: 'Taiwan Strait Asia Pacific geopolitics' },
    { text: 'Middle East peace process and regional power dynamics', img: 'Middle East diplomacy negotiations' },
    { text: 'United Nations peacekeeping and global governance crisis', img: 'United Nations assembly New York' },
    { text: 'Global democracy under pressure: election integrity trends 2026', img: 'election democracy voting' },
    { text: 'US-China technology decoupling and trade war escalation', img: 'US China flags trade technology war' },
    { text: 'Korean Peninsula: North Korea provocations and diplomacy', img: 'Korean Peninsula Seoul geopolitics' },
    { text: 'Russia-Ukraine conflict: ceasefire prospects and European security', img: 'Ukraine ceasefire diplomacy Europe' },
    { text: 'Southeast Asia ASEAN political realignment 2026', img: 'Southeast Asia ASEAN summit political' },
    { text: 'Latin America political polarization and economic reform', img: 'Latin America politics economy reform' },
    { text: 'Africa rising democracies and governance challenges', img: 'Africa democracy governance politics' },
    { text: 'India as a global power: diplomatic strategy and regional influence', img: 'India diplomacy global power' },
  ],
  economy: [
    { text: 'Federal Reserve interest rate policy and US inflation outlook 2026', img: 'Federal Reserve bank interest rates' },
    { text: 'Global stock markets: S&P 500 outlook and investor sentiment 2026', img: 'stock market Wall Street trading' },
    { text: 'Bitcoin and crypto regulation: what 2026 brings for digital assets', img: 'cryptocurrency bitcoin blockchain' },
    { text: 'AI economy: how artificial intelligence is transforming jobs globally', img: 'artificial intelligence economy jobs' },
    { text: 'Oil prices, OPEC+ strategy, and the global energy transition', img: 'oil energy OPEC petroleum market' },
    { text: 'Semiconductor supply chain: the chip war reshaping global tech', img: 'semiconductor chip manufacturing' },
    { text: 'Emerging markets in 2026: growth stories and economic risks', img: 'emerging market economy growth' },
    { text: 'South Korea economy 2026: KOSPI, exports, and Samsung outlook', img: 'South Korea Seoul economy finance' },
    { text: 'Trade wars and tariffs: WTO disputes and global commerce', img: 'global trade shipping container port' },
    { text: 'Big Tech earnings and Silicon Valley 2026: AI pivot results', img: 'Silicon Valley technology company AI' },
    { text: 'Global housing crisis: real estate affordability worldwide', img: 'real estate housing market city' },
    { text: 'Central bank digital currencies CBDC: the next financial revolution', img: 'digital currency central bank fintech' },
    { text: 'Climate finance and ESG investing: green economy opportunities', img: 'climate finance green investment ESG' },
    { text: 'Japan economic revival: BOJ policy shift and yen outlook 2026', img: 'Japan Tokyo economy finance' },
  ],
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── Pick topic ────────────────────────────────────────────────────────────────
function pickTopic() {
  let category;
  if (CATEGORY_INPUT === 'politics' || CATEGORY_INPUT === 'economy') {
    category = CATEGORY_INPUT;
  } else {
    // Morning run (UTC 00:00 = KST 09:00) → politics
    // Afternoon run (UTC 06:00 = KST 15:00) → economy
    category = new Date().getUTCHours() < 6 ? 'politics' : 'economy';
  }
  const pool = TOPICS[category];
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const slot = new Date().getUTCHours() < 6 ? 0 : 1;
  const idx = (day * 2 + slot) % pool.length;
  const topic = CUSTOM_TOPIC ? { text: CUSTOM_TOPIC, img: 'global news world politics economy' } : pool[idx];
  return { category, topic };
}

// ── JSON repair: fix unescaped double-quotes inside string values ─────────────
function repairJSON(str) {
  // State-machine scan: when inside a JSON string, any bare " that doesn't
  // look like a closing quote (i.e. next non-space char is NOT , } ] :)
  // gets escaped as \".
  let out = '';
  let inStr = false;
  let esc = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }

    if (ch === '"') {
      if (!inStr) {
        inStr = true;
        out += ch;
      } else {
        // Peek ahead past whitespace to see what follows
        let j = i + 1;
        while (j < str.length && /[ \t\r\n]/.test(str[j])) j++;
        const next = str[j];
        // A proper closing quote is followed by , } ] : or end-of-string
        if (next === ',' || next === '}' || next === ']' || next === ':' || j >= str.length) {
          inStr = false;
          out += ch;
        } else {
          // Unescaped quote inside a string value — escape it
          out += '\\"';
        }
      }
      continue;
    }

    out += ch;
  }
  return out;
}

// ── Safely extract and parse JSON from Claude's raw response ─────────────────
function safeParseJSON(raw, stopReason) {
  // 1. Strip markdown code fences if present
  let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // 2. Extract the outermost { ... } block
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end > start) s = s.slice(start, end + 1);

  // 3. First attempt: direct parse
  try { return JSON.parse(s); } catch (e1) {
    console.warn(`Direct JSON.parse failed (${e1.message}), attempting repair…`);
    // Show context around the error position for debugging
    const pos = parseInt((e1.message.match(/position (\d+)/) || [])[1], 10);
    if (!isNaN(pos)) {
      console.error('  Context around error:', JSON.stringify(s.slice(Math.max(0, pos - 60), pos + 60)));
    }

    // 4. Attempt repair: escape bare double-quotes inside string values
    const repaired = repairJSON(s);
    try { return JSON.parse(repaired); } catch (e2) {
      // 5. Last resort: log and throw
      console.error('stop_reason:', stopReason);
      console.error('Raw response (first 600 chars):', raw.slice(0, 600));
      throw new Error(`JSON parse failed after repair attempt: ${e2.message}`);
    }
  }
}

// ── Generate article via Claude ───────────────────────────────────────────────
async function generateArticle(category, topicText) {
  if (DRY_RUN) { console.log('[DRY RUN] Skipping Claude API'); return makeSample(category, topicText); }
  if (!CLAUDE_KEY) throw new Error('CLAUDE_API_KEY not set. Use DRY_RUN=1 to test.');

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
  });

  const prompt = `You are an award-winning international journalist writing for "The Global Brief," a bilingual English/Korean news analysis blog read by global professionals and Korean audiences.

Write a comprehensive, deeply researched analytical article about: "${topicText}"
Today's date: ${today}
Category: ${category}

REQUIREMENTS:
- English: 1,200–1,500 words total across all sections (authoritative, nuanced, data-driven)
- Korean: Full natural translation (not machine-like), 한국 독자에게 맞는 문체
- Use <p> HTML tags for all paragraphs (do NOT use markdown)
- Include specific statistics, expert names, dates, country names
- Make it timely, not generic — reference current 2025-2026 geopolitical context
- Writing style: The Economist + Foreign Affairs combined

CRITICAL JSON RULES — MUST FOLLOW TO AVOID PARSE ERRORS:
1. Return ONLY a single valid JSON object. No markdown fences, no text before or after.
2. NEVER use double-quote characters (") inside any JSON string value.
   - For possessives and contractions: use apostrophe (') — e.g. America's, don't
   - For speech/quotations inside text: use single quotes (') — e.g. 'We have no choice'
   - For HTML attributes: OMIT attributes entirely — write plain <p>, <strong>, <em>, <b> with NO class= or style= attributes
3. NEVER put literal newlines inside a JSON string value — keep each string on one line.
4. Escape any backslash as \\\\ if you must include one.

Return ONLY valid JSON matching this exact structure:
{
  "title": "Strong present-tense English headline, 60-85 chars",
  "subtitle": "One-sentence analytical deck adding crucial context, 90-130 chars",
  "category": "${category}",
  "slug": "hyphenated-slug-3-to-6-words",
  "readingTime": 9,
  "metaDescription": "SEO meta, 140-160 chars, says what readers will learn",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "keyTakeaways": [
    "Specific finding with a concrete number or fact",
    "Second key finding with specific detail",
    "Third key finding, analyst or expert perspective",
    "Fourth forward-looking implication"
  ],
  "tableOfContents": [
    {"id":"background","title":"Background"},
    {"id":"current-situation","title":"Current Situation"},
    {"id":"key-players","title":"Key Players & Interests"},
    {"id":"global-impact","title":"Global Impact"},
    {"id":"outlook","title":"Outlook & Analysis"}
  ],
  "en": {
    "introduction": "<p>Hook paragraph 100-130 words.</p><p>Context paragraph 80-100 words.</p>",
    "sections": [
      {
        "id": "background",
        "title": "Background",
        "content": "<p>First paragraph 80-100 words.</p><p>Second paragraph 80-100 words.</p><p>Third paragraph 70-90 words.</p>",
        "pullQuote": "A striking statistic or expert perspective from this section, 20-40 words, no double-quotes"
      },
      {
        "id": "current-situation",
        "title": "Current Situation",
        "content": "<p>What is happening RIGHT NOW with specific details 80-100 words.</p><p>Recent developments and data 80-100 words.</p><p>Latest news and reactions 70-90 words.</p>",
        "pullQuote": "Key data point that defines the current moment, no double-quotes"
      },
      {
        "id": "key-players",
        "title": "Key Players & Interests",
        "content": "<p>Primary actor 1: who they are, what they want, why it matters 80-100 words.</p><p>Primary actor 2 and opposing interests 80-100 words.</p><p>Third-party stakeholders and their roles 70-90 words.</p>"
      },
      {
        "id": "global-impact",
        "title": "Global Impact",
        "content": "<p>Economic/financial implications with specific numbers 80-100 words.</p><p>Geopolitical ripple effects across regions 80-100 words.</p><p>Impact on ordinary citizens and markets 70-90 words.</p>",
        "pullQuote": "The most striking impact statistic or projection, no double-quotes"
      },
      {
        "id": "outlook",
        "title": "Outlook & Analysis",
        "content": "<p>Most likely scenario with expert consensus 80-100 words.</p><p>Wild card scenarios and risk factors 80-100 words.</p><p>Strategic implications for the next 12 months 70-90 words.</p>",
        "pullQuote": "A forward-looking insight that makes readers think, no double-quotes"
      }
    ],
    "conclusion": "<p>Synthesize the 2-3 most important threads 80-100 words.</p><p>Closing thought-provoking statement 60-80 words.</p>"
  },
  "ko": {
    "title": "한국어 헤드라인 (60-85자, 자연스러운 번역)",
    "subtitle": "한국어 부제목 (90-130자)",
    "introduction": "<p>첫 번째 문단 100-130 단어.</p><p>두 번째 문단 80-100 단어.</p>",
    "sections": [
      {"id":"background","title":"배경","content":"<p>첫 번째 문단.</p><p>두 번째 문단.</p><p>세 번째 문단.</p>"},
      {"id":"current-situation","title":"현재 상황","content":"<p>첫 번째 문단.</p><p>두 번째 문단.</p><p>세 번째 문단.</p>"},
      {"id":"key-players","title":"주요 행위자와 이해관계","content":"<p>첫 번째 문단.</p><p>두 번째 문단.</p><p>세 번째 문단.</p>"},
      {"id":"global-impact","title":"글로벌 영향","content":"<p>첫 번째 문단.</p><p>두 번째 문단.</p><p>세 번째 문단.</p>"},
      {"id":"outlook","title":"전망 및 분석","content":"<p>첫 번째 문단.</p><p>두 번째 문단.</p><p>세 번째 문단.</p>"}
    ],
    "conclusion": "<p>첫 번째 결론 문단.</p><p>마지막 인상적인 마무리 문장.</p>"
  },
  "imageQuery": "2-4 word English Pexels search query"
}`;

  const resp = await httpsRequest({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
  }, {
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  if (resp.status !== 200) {
    throw new Error(`Claude API ${resp.status}: ${JSON.stringify(resp.data).slice(0, 300)}`);
  }

  // stop_reason 확인 — 'max_tokens'이면 응답이 잘린 것
  const stopReason = resp.data.stop_reason;
  if (stopReason === 'max_tokens') {
    throw new Error('Response truncated by max_tokens limit. Increase max_tokens or shorten the prompt.');
  }

  const raw = resp.data.content[0].text.trim();
  return safeParseJSON(raw, stopReason);
}

// ── Fetch image from Pexels ───────────────────────────────────────────────────
async function fetchImage(query) {
  const fallback = {
    url: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photographer: 'Fauxels',
    photographerUrl: 'https://www.pexels.com/@fauxels',
    alt: query,
  };

  if (DRY_RUN || !PEXELS_KEY) return fallback;

  try {
    const resp = await httpsRequest({
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape&size=large`,
      method: 'GET',
      headers: { Authorization: PEXELS_KEY },
    });

    if (resp.status === 200 && resp.data.photos?.length) {
      const pick = resp.data.photos[Math.floor(Math.random() * Math.min(5, resp.data.photos.length))];
      return {
        url: pick.src.large2x || pick.src.large,
        photographer: pick.photographer,
        photographerUrl: pick.photographer_url,
        alt: pick.alt || query,
      };
    }
  } catch (e) {
    console.warn('Pexels error:', e.message);
  }
  return fallback;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── Build article HTML ────────────────────────────────────────────────────────
function buildArticleHtml(article, image, slug, category, dateStr, isoDate) {
  const catLabel = category === 'politics' ? 'Politics' : 'Economy';
  const postUrl = `${BLOG_BASE_URL}/posts/${category}/${slug}.html`;

  const tocHtml = (article.tableOfContents || [])
    .map((t) => `<a href="#${esc(t.id)}" class="toc-link">${esc(t.title)}</a>`)
    .join('\n');

  const enSections = (article.en.sections || []).map((s, i) => {
    const pullQ = s.pullQuote
      ? `<blockquote class="pull-quote"><p>${esc(s.pullQuote)}</p></blockquote>`
      : '';
    const midAd = i === 1
      ? `<div class="ad-unit"><p class="ad-label">Advertisement</p>
<ins class="adsbygoogle" style="display:block;text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="${ADS_CLIENT}" data-ad-slot=""></ins>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
      : '';
    return `<section id="${esc(s.id)}" class="article-section">
<h2 class="section-title">${esc(s.title)}</h2>
${s.content}
${pullQ}
${midAd}
</section>`;
  }).join('\n');

  const koSections = (article.ko.sections || []).map((s) =>
    `<section class="article-section">
<h2 class="section-title">${esc(s.title)}</h2>
${s.content}
</section>`
  ).join('\n');

  const takeawaysHtml = (article.keyTakeaways || [])
    .map((t) => `<li>${esc(t)}</li>`)
    .join('\n');

  const tagsHtml = (article.tags || [])
    .map((t) => `<a href="/economy.html" class="tag">#${esc(t)}</a>`)
    .join(' ');

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.metaDescription,
    image: image.url,
    datePublished: isoDate,
    dateModified: isoDate,
    author: { '@type': 'Organization', name: BLOG_NAME },
    publisher: {
      '@type': 'Organization',
      name: BLOG_NAME,
      logo: { '@type': 'ImageObject', url: `${BLOG_BASE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    articleSection: catLabel,
    keywords: (article.tags || []).join(', '),
    inLanguage: 'en',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(article.title)} | ${BLOG_NAME}</title>
<meta name="description" content="${esc(article.metaDescription)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="author" content="${BLOG_NAME} Editorial">
<meta name="keywords" content="${esc((article.tags || []).join(', '))}">
<link rel="canonical" href="${postUrl}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(article.title)}">
<meta property="og:description" content="${esc(article.metaDescription)}">
<meta property="og:url" content="${postUrl}">
<meta property="og:site_name" content="${BLOG_NAME}">
<meta property="og:image" content="${esc(image.url)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="ko_KR">
<meta property="article:published_time" content="${isoDate}">
<meta property="article:section" content="${catLabel}">
${(article.tags || []).map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(article.title)}">
<meta name="twitter:description" content="${esc(article.metaDescription)}">
<meta name="twitter:image" content="${esc(image.url)}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
<script type="application/ld+json">${schema}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--red:#c0392b;--red-lt:#e74c3c;--navy:#0f1722;--navy2:#1a2535;--text:#18181b;--text2:#3f3f46;--muted:#71717a;--bg:#f4f5f7;--card:#fff;--border:#e4e4e7;--serif:'Merriweather',Georgia,serif;--sans:'Inter',-apple-system,sans-serif;--ko:'Noto Sans KR',sans-serif;--mw:740px;}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.7}
/* Progress */
#progress{position:fixed;top:0;left:0;width:0;height:3px;background:var(--red);z-index:9999;transition:width .1s linear}
/* Header */
.site-header{background:var(--navy);position:sticky;top:0;z-index:200;box-shadow:0 2px 16px rgba(0,0,0,.45)}
.hdr-inner{max-width:1200px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-weight:800;font-size:1.2rem;color:#fff;text-decoration:none;letter-spacing:-.4px;white-space:nowrap}
.logo em{color:var(--red-lt);font-style:normal}
.main-nav{display:flex;gap:2px}
.main-nav a{color:rgba(255,255,255,.72);text-decoration:none;font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.6px;padding:7px 12px;border-radius:5px;transition:all .18s}
.main-nav a:hover{color:#fff;background:rgba(255,255,255,.1)}
.nav-cta{background:var(--red)!important;color:#fff!important}
.nav-cta:hover{background:var(--red-lt)!important}
/* Hero */
.hero{position:relative;height:500px;overflow:hidden;background:#111}
.hero img{width:100%;height:100%;object-fit:cover;opacity:.6;transition:opacity .4s}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.15) 55%,transparent 100%);display:flex;align-items:flex-end}
.hero-content{width:100%;max-width:var(--mw);margin:0 auto;padding:0 20px 36px}
.cat-badge{display:inline-block;background:var(--red);color:#fff;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;padding:4px 11px;border-radius:3px;margin-bottom:14px}
.hero-title{font-family:var(--serif);font-size:clamp(1.55rem,3.8vw,2.55rem);font-weight:900;color:#fff;line-height:1.22;margin-bottom:13px}
.hero-sub{font-size:clamp(.95rem,2vw,1.08rem);color:rgba(255,255,255,.82);line-height:1.55;max-width:580px;margin-bottom:18px}
.article-meta{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:.8rem;color:rgba(255,255,255,.65)}
.meta-sep{color:rgba(255,255,255,.35)}
.reading-time{display:flex;align-items:center;gap:3px}
.lang-btn{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:5px 14px;border-radius:20px;cursor:pointer;font-size:.78rem;font-family:var(--sans);transition:all .2s;backdrop-filter:blur(6px)}
.lang-btn:hover{background:rgba(255,255,255,.28)}
.img-credit{max-width:var(--mw);margin:5px auto 0;padding:0 20px;font-size:.7rem;color:var(--muted)}
.img-credit a{color:var(--muted);text-decoration:underline}
/* Layout */
.page-wrap{max-width:1160px;margin:0 auto;padding:0 20px;display:grid;grid-template-columns:1fr 260px;gap:44px;align-items:start}
.article-main{padding:32px 0 20px}
/* TOC sidebar */
.toc-sidebar{position:sticky;top:78px;margin-top:32px}
.toc-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.toc-head{font-size:.73rem;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin-bottom:12px}
.toc-link{display:block;font-size:.83rem;color:var(--text2);text-decoration:none;padding:5px 8px;border-radius:5px;border-left:2px solid transparent;margin-bottom:1px;transition:all .18s}
.toc-link:hover,.toc-link.active{color:var(--red);border-left-color:var(--red);background:rgba(192,57,43,.05)}
.ad-side{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:18px;text-align:center}
/* Key takeaways */
.takeaways{background:linear-gradient(135deg,#fff9f9 0%,#fffbfb 100%);border:1px solid rgba(192,57,43,.18);border-left:4px solid var(--red);border-radius:8px;padding:22px 26px;margin-bottom:30px}
.takeaways-head{font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--red);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.takeaways ul{list-style:none;display:flex;flex-direction:column;gap:10px}
.takeaways li{font-size:.92rem;color:var(--text2);padding-left:22px;position:relative;line-height:1.55}
.takeaways li::before{content:'→';position:absolute;left:0;color:var(--red);font-weight:700}
/* Ad units */
.ad-unit{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin:30px 0;text-align:center}
.ad-label{font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
/* Lang tabs */
.lang-tabs{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:26px;width:fit-content}
.lang-tab{background:none;border:none;border-right:1px solid var(--border);padding:9px 20px;font-size:.85rem;font-weight:600;cursor:pointer;font-family:var(--sans);color:var(--muted);transition:all .18s}
.lang-tab:last-child{border-right:none}
.lang-tab.active{background:var(--navy);color:#fff}
/* Article content */
.article-section{margin-bottom:8px;scroll-margin-top:70px}
.section-title{font-family:var(--serif);font-size:1.4rem;font-weight:700;color:var(--text);margin:32px 0 14px;padding-top:8px;border-top:1px solid var(--border)}
.section-title:first-child{border-top:none;margin-top:0}
#content-en .article-section p,
#content-en .intro-body p,
#content-en .conclusion-body p{font-family:var(--serif);font-size:1.04rem;color:var(--text2);line-height:1.88;margin-bottom:18px}
.intro-body{margin-bottom:8px}
.conclusion-title{font-family:var(--serif);font-size:1.4rem;font-weight:700;color:var(--text);margin:32px 0 14px;padding-top:8px;border-top:1px solid var(--border)}
/* Pull quote */
.pull-quote{border-left:4px solid var(--red);margin:26px 0;padding:16px 22px;background:linear-gradient(to right,rgba(192,57,43,.05),transparent);border-radius:0 6px 6px 0}
.pull-quote p{font-family:var(--serif);font-size:1.18rem;font-style:italic;color:var(--navy2);line-height:1.6;margin:0}
/* Tags */
.tags-wrap{margin-top:28px;padding-top:22px;border-top:1px solid var(--border)}
.tags-label{font-size:.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
.tag{display:inline-block;background:#f1f1f3;color:var(--text2);font-size:.76rem;padding:4px 11px;border-radius:20px;text-decoration:none;margin:2px;transition:all .18s}
.tag:hover{background:var(--red);color:#fff}
/* Korean section */
#content-ko{display:none}
.ko-hero{margin-bottom:22px;padding-bottom:18px;border-bottom:2px solid var(--border)}
.ko-hero h2{font-family:var(--ko);font-size:1.6rem;font-weight:800;color:var(--text);margin-bottom:8px;line-height:1.35}
.ko-hero p{font-size:.95rem;color:var(--muted)}
#content-ko .article-section p,
#content-ko .intro-body p,
#content-ko .conclusion-body p{font-family:var(--ko);font-size:1rem;color:var(--text2);line-height:1.92;margin-bottom:17px}
#content-ko .section-title{font-family:var(--ko);font-size:1.3rem}
/* Scroll to top */
#scroll-top{position:fixed;bottom:24px;right:24px;width:46px;height:46px;background:var(--navy);color:#fff;border:none;border-radius:50%;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28);opacity:0;transform:translateY(10px);transition:all .28s;z-index:150}
#scroll-top.show{opacity:1;transform:translateY(0)}
/* Related */
.related-sec{background:var(--card);border-top:1px solid var(--border);padding:44px 20px;margin-top:32px}
.related-inner{max-width:1160px;margin:0 auto}
.section-head{font-size:1.05rem;font-weight:700;color:var(--text);margin-bottom:22px;display:flex;align-items:center;gap:12px}
.section-head::after{content:'';flex:1;height:1px;background:var(--border)}
.related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
.rel-card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;text-decoration:none;color:inherit;transition:all .2s;box-shadow:0 1px 4px rgba(0,0,0,.04)}
.rel-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.1)}
.rel-img{height:158px;width:100%;object-fit:cover;background:#e0e0e0;display:block}
.rel-body{padding:14px}
.rel-cat{font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--red);letter-spacing:.5px;margin-bottom:5px}
.rel-title{font-size:.9rem;font-weight:700;line-height:1.4;color:var(--text);margin-bottom:5px}
.rel-date{font-size:.73rem;color:var(--muted)}
/* Footer */
.site-footer{background:var(--navy);color:rgba(255,255,255,.55);padding:40px 20px}
.footer-inner{max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:18px}
.footer-logo{font-size:1.05rem;font-weight:800;color:#fff;text-decoration:none}
.footer-logo em{color:var(--red-lt);font-style:normal}
.footer-nav{display:flex;flex-wrap:wrap;gap:14px}
.footer-nav a{color:rgba(255,255,255,.55);text-decoration:none;font-size:.8rem;transition:color .2s}
.footer-nav a:hover{color:#fff}
.footer-copy{max-width:1200px;margin:18px auto 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);font-size:.72rem;color:rgba(255,255,255,.3);text-align:center}
/* Responsive */
@media(max-width:920px){.page-wrap{grid-template-columns:1fr}.toc-sidebar{display:none}}
@media(max-width:600px){
  .hero{height:360px}.hero-title{font-size:1.38rem}.hero-sub{font-size:.9rem}
  .main-nav{display:none}.hdr-inner{padding:0 16px}
  .section-title{font-size:1.2rem}
  #content-en .article-section p{font-size:.97rem}
}
</style>
</head>
<body>
<!-- GTM noscript -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

<!-- Reading progress -->
<div id="progress"></div>

<!-- Header -->
<header class="site-header">
  <div class="hdr-inner">
    <a href="/" class="logo">The <em>Global</em> Brief</a>
    <nav class="main-nav">
      <a href="/politics.html">Politics</a>
      <a href="/economy.html">Economy</a>
      <a href="/about.html">About</a>
      <a href="/" class="nav-cta">Latest</a>
    </nav>
  </div>
</header>

<!-- Hero -->
<div class="hero">
  <img src="${esc(image.url)}" alt="${esc(image.alt || article.title)}" loading="eager">
  <div class="hero-overlay">
    <div class="hero-content">
      <span class="cat-badge">${catLabel}</span>
      <h1 class="hero-title">${esc(article.title)}</h1>
      <p class="hero-sub">${esc(article.subtitle)}</p>
      <div class="article-meta">
        <time datetime="${isoDate}">${dateStr}</time>
        <span class="meta-sep">·</span>
        <span class="reading-time">⏱ ${article.readingTime || 9} min read</span>
        <span class="meta-sep">·</span>
        <button class="lang-btn" id="hero-lang-btn" onclick="toggleLang()">🇰🇷 한국어로 보기</button>
      </div>
    </div>
  </div>
</div>
<p class="img-credit">Photo: <a href="${esc(image.photographerUrl)}" target="_blank" rel="noopener">${esc(image.photographer)}</a> via Pexels</p>

<!-- Main -->
<div class="page-wrap">
  <main class="article-main">
    <!-- Key Takeaways -->
    <div class="takeaways">
      <div class="takeaways-head">🔑 Key Takeaways</div>
      <ul>${takeawaysHtml}</ul>
    </div>

    <!-- Top ad -->
    <div class="ad-unit">
      <p class="ad-label">Advertisement</p>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    </div>

    <!-- Language tabs -->
    <div class="lang-tabs">
      <button class="lang-tab active" id="tab-en" onclick="setLang('en')">🇺🇸 English</button>
      <button class="lang-tab" id="tab-ko" onclick="setLang('ko')">🇰🇷 한국어</button>
    </div>

    <!-- English content -->
    <div id="content-en">
      <div class="intro-body">${article.en.introduction}</div>
      ${enSections}
      <div class="article-section">
        <h2 class="conclusion-title">Conclusion</h2>
        <div class="conclusion-body">${article.en.conclusion}</div>
      </div>
    </div>

    <!-- Korean content -->
    <div id="content-ko">
      <div class="ko-hero">
        <h2>${esc(article.ko.title)}</h2>
        <p>${esc(article.ko.subtitle || '')}</p>
      </div>
      <div class="intro-body">${article.ko.introduction}</div>
      ${koSections}
      <div class="article-section">
        <div class="conclusion-body">${article.ko.conclusion}</div>
      </div>
    </div>

    <!-- Bottom ad -->
    <div class="ad-unit">
      <p class="ad-label">Advertisement</p>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    </div>

    <!-- Tags -->
    <div class="tags-wrap">
      <div class="tags-label">Topics</div>
      <div>${tagsHtml}</div>
    </div>
  </main>

  <!-- TOC sidebar -->
  <aside class="toc-sidebar">
    <div class="toc-card">
      <div class="toc-head">Contents</div>
      ${tocHtml}
    </div>
    <div class="ad-side">
      <p class="ad-label">Advertisement</p>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="" data-ad-format="auto"></ins>
      <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    </div>
  </aside>
</div>

<!-- Related articles -->
<section class="related-sec">
  <div class="related-inner">
    <div class="section-head">More to Read</div>
    <div class="related-grid" id="related-grid"></div>
  </div>
</section>

<!-- Footer -->
<footer class="site-footer">
  <div class="footer-inner">
    <a href="/" class="footer-logo">The <em>Global</em> Brief</a>
    <nav class="footer-nav">
      <a href="/politics.html">Politics</a>
      <a href="/economy.html">Economy</a>
      <a href="/about.html">About</a>
      <a href="/privacy-policy.html">Privacy</a>
    </nav>
  </div>
  <div class="footer-copy">© ${new Date().getFullYear()} ${BLOG_NAME} · Independent global journalism ·
    <a href="/privacy-policy.html" style="color:rgba(255,255,255,.3)">Privacy Policy</a>
  </div>
</footer>

<button id="scroll-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Back to top">↑</button>

<script>
// Reading progress
(function(){
  var bar=document.getElementById('progress');
  var btn=document.getElementById('scroll-top');
  window.addEventListener('scroll',function(){
    var doc=document.documentElement;
    var s=doc.scrollTop||document.body.scrollTop;
    var t=doc.scrollHeight-doc.clientHeight;
    bar.style.width=(t>0?Math.min(100,s/t*100):0)+'%';
    s>400?btn.classList.add('show'):btn.classList.remove('show');
    highlightToc();
  },{passive:true});
})();

// TOC highlight
function highlightToc(){
  var links=document.querySelectorAll('.toc-link');
  var sections=document.querySelectorAll('.article-section[id]');
  var cur='';
  sections.forEach(function(s){if(s.getBoundingClientRect().top<=100)cur=s.id;});
  links.forEach(function(l){
    l.classList.remove('active');
    if(l.getAttribute('href')==='#'+cur)l.classList.add('active');
  });
}

// Language switch
var currentLang='en';
function setLang(lang){
  currentLang=lang;
  var en=document.getElementById('content-en');
  var ko=document.getElementById('content-ko');
  var tabEn=document.getElementById('tab-en');
  var tabKo=document.getElementById('tab-ko');
  var heroBtn=document.getElementById('hero-lang-btn');
  if(lang==='ko'){
    en.style.display='none';ko.style.display='block';
    tabEn.classList.remove('active');tabKo.classList.add('active');
    if(heroBtn){heroBtn.textContent='🇺🇸 Read in English';heroBtn.dataset.lang='ko';}
  } else {
    en.style.display='block';ko.style.display='none';
    tabEn.classList.add('active');tabKo.classList.remove('active');
    if(heroBtn){heroBtn.textContent='🇰🇷 한국어로 보기';heroBtn.dataset.lang='en';}
  }
}
function toggleLang(){setLang(currentLang==='en'?'ko':'en');}

// Related articles
(async function(){
  try{
    var r=await fetch('/data/posts.json');
    var posts=await r.json();
    var cur='${slug}';
    var rel=posts.filter(function(p){return p.slug!==cur;}).slice(0,3);
    var grid=document.getElementById('related-grid');
    if(!grid||!rel.length)return;
    grid.innerHTML=rel.map(function(p){
      return '<a href="'+p.url+'" class="rel-card">'+
        '<img class="rel-img" src="'+(p.imageUrl||'')+'" alt="'+p.title+'" loading="lazy" onerror="this.style.background=\'#ddd\';this.removeAttribute(\'src\')">'+
        '<div class="rel-body">'+
        '<div class="rel-cat">'+p.category+'</div>'+
        '<div class="rel-title">'+p.title+'</div>'+
        '<div class="rel-date">'+p.dateStr+'</div>'+
        '</div></a>';
    }).join('');
  }catch(e){}
})();
</script>
</body>
</html>`;
}

// ── Sample data (dry run) ─────────────────────────────────────────────────────
function makeSample(category, topicText) {
  return {
    title: `[TEST] ${topicText.slice(0, 60)}: Analysis & Outlook`,
    subtitle: 'A test article to verify the blog automation pipeline is working correctly',
    category,
    slug: 'pipeline-test',
    readingTime: 9,
    metaDescription: 'Test article for The Global Brief blog automation system. Real content is generated with Claude API.',
    tags: ['test', 'dry-run', category, 'automation', 'global'],
    keyTakeaways: [
      'This is a DRY RUN — the Claude API was NOT called.',
      'Set CLAUDE_API_KEY and PEXELS_API_KEY to generate real articles.',
      'The automation pipeline is functioning correctly end-to-end.',
      'GitHub Actions will run this script at 9 AM and 3 PM KST daily.',
    ],
    tableOfContents: [
      { id: 'background', title: 'Background' },
      { id: 'current-situation', title: 'Current Situation' },
      { id: 'key-players', title: 'Key Players & Interests' },
      { id: 'global-impact', title: 'Global Impact' },
      { id: 'outlook', title: 'Outlook & Analysis' },
    ],
    en: {
      introduction: '<p>This is a <strong>dry run test</strong> of The Global Brief automated content pipeline. No external API calls were made during this run — it validates that the file generation, HTML templating, and deployment workflow are all functioning.</p><p>Once you configure your <code>CLAUDE_API_KEY</code> and <code>PEXELS_API_KEY</code> environment variables in GitHub Secrets, the system will automatically generate high-quality bilingual articles twice daily.</p>',
      sections: [
        { id: 'background', title: 'Background', content: '<p>The Global Brief is built on a fully automated static site generation pipeline. Articles are generated using Claude AI, images sourced from Pexels, and the site deployed to Firebase Hosting — all triggered by GitHub Actions on a twice-daily schedule.</p><p>The system is designed to produce Economist-quality analytical journalism at scale, covering global politics and economics for both English-speaking and Korean audiences.</p><p>This test post validates every step of that pipeline without making actual API calls, ensuring the system is ready for production.</p>', pullQuote: 'The Global Brief: automated, bilingual, globally-minded journalism.' },
        { id: 'current-situation', title: 'Current Situation', content: '<p>The pipeline is configured and ready for production deployment. This dry run test successfully generates a complete HTML article file, updates the posts manifest (data/posts.json), and prepares for the build-pages.js homepage update.</p><p>In production, each article will contain 1,200–1,500 words of analytical content in English plus a full Korean translation, sourced images from Pexels, and comprehensive SEO metadata.</p><p>The GitHub Actions workflow will run automatically at UTC 00:00 (9 AM KST) and UTC 06:00 (3 PM KST) every day.</p>' },
        { id: 'key-players', title: 'Key Players & Interests', content: '<p>The system integrates three key services: Anthropic Claude API for intelligent content generation, Pexels for high-quality stock photography, and Firebase Hosting for fast global CDN delivery.</p><p>GitHub Actions orchestrates the entire workflow — from content generation to deployment — with no manual intervention required after initial setup.</p><p>Google Analytics and AdSense are pre-integrated for traffic monitoring and monetization from the first article.</p>' },
        { id: 'global-impact', title: 'Global Impact', content: '<p>By publishing twice daily in both English and Korean, The Global Brief targets both global English-speaking audiences and the Korean-language market simultaneously.</p><p>The bilingual approach increases total addressable readership while the analytical depth (vs. news aggregation) drives higher session duration — a key factor for AdSense revenue optimization.</p><p>Firebase Hosting provides sub-100ms response times globally, ensuring fast load speeds that reduce bounce rates.</p>' },
        { id: 'outlook', title: 'Outlook & Analysis', content: '<p>Once the Claude API key is configured, the system will begin generating real articles. Each post will cover a different topic from the pre-configured topic rotation covering 14 politics topics and 14 economy topics.</p><p>Topics rotate based on day of year and publish time, ensuring variety while covering the full spectrum of global affairs that matter to readers.</p><p>Future enhancements could include newsletter integration, social media auto-posting, and reader comment moderation.</p>' },
      ],
      conclusion: '<p>The Global Brief automation pipeline is fully operational. With API keys configured, this system will run completely autonomously — generating, publishing, and deploying 730 articles per year with zero manual effort.</p><p>Configure your GitHub Secrets and the first real article will be published at the next scheduled run time.</p>',
    },
    ko: {
      title: '[테스트] 블로그 자동화 파이프라인 검증 포스트',
      subtitle: 'Claude API와 Pexels API 없이 실행하는 드라이런 테스트',
      introduction: '<p>이것은 The Global Brief 자동화 콘텐츠 파이프라인의 <strong>드라이런 테스트</strong>입니다. 이 실행에서는 외부 API 호출이 없었으며, 파일 생성, HTML 템플릿, 배포 워크플로우가 모두 정상적으로 작동하는지 검증합니다.</p><p><code>CLAUDE_API_KEY</code>와 <code>PEXELS_API_KEY</code>를 GitHub Secrets에 설정하면, 매일 두 번 자동으로 고품질 이중 언어 기사가 생성됩니다.</p>',
      sections: [
        { id: 'background', title: '배경', content: '<p>The Global Brief는 완전 자동화된 정적 사이트 생성 파이프라인으로 구축되었습니다. 기사는 Claude AI로 생성되고, 이미지는 Pexels에서 가져오며, 사이트는 Firebase Hosting에 배포됩니다.</p><p>이 시스템은 영어권과 한국어권 독자 모두를 위한 이코노미스트급 분석 저널리즘을 자동으로 생산하도록 설계되었습니다.</p><p>이 테스트 포스트는 실제 API 호출 없이 파이프라인 전체를 검증합니다.</p>' },
        { id: 'current-situation', title: '현재 상황', content: '<p>파이프라인은 프로덕션 배포를 위해 구성 및 준비되었습니다. 이 드라이런 테스트는 완전한 HTML 기사 파일을 성공적으로 생성하고, posts 매니페스트를 업데이트하며, 홈페이지 업데이트를 준비합니다.</p><p>프로덕션에서는 각 기사에 1,200-1,500 단어의 영어 분석 콘텐츠와 완전한 한국어 번역, Pexels 이미지, SEO 메타데이터가 포함됩니다.</p><p>GitHub Actions 워크플로우는 매일 UTC 00:00 (KST 09:00)과 UTC 06:00 (KST 15:00)에 자동으로 실행됩니다.</p>' },
        { id: 'key-players', title: '주요 행위자와 이해관계', content: '<p>시스템은 세 가지 핵심 서비스를 통합합니다: 지능형 콘텐츠 생성을 위한 Anthropic Claude API, 고품질 스톡 사진을 위한 Pexels, 그리고 빠른 글로벌 CDN 제공을 위한 Firebase Hosting입니다.</p><p>GitHub Actions가 콘텐츠 생성부터 배포까지 전체 워크플로우를 조율합니다.</p><p>Google Analytics와 AdSense가 첫 번째 기사부터 트래픽 모니터링과 수익화를 위해 미리 통합되어 있습니다.</p>' },
        { id: 'global-impact', title: '글로벌 영향', content: '<p>하루 두 번 영어와 한국어로 게시함으로써, The Global Brief는 글로벌 영어권 독자와 한국어 시장을 동시에 타겟으로 합니다.</p><p>이중 언어 접근 방식은 총 잠재 독자 수를 늘리고, 뉴스 집계보다 분석 깊이가 높아 세션 시간이 길어집니다.</p><p>Firebase Hosting은 전 세계적으로 100ms 미만의 응답 시간을 제공하여 이탈률을 줄입니다.</p>' },
        { id: 'outlook', title: '전망 및 분석', content: '<p>Claude API 키가 구성되면 시스템이 실제 기사 생성을 시작합니다. 각 포스트는 정치 14개, 경제 14개 토픽 로테이션에서 다른 주제를 다룹니다.</p><p>토픽은 연중 날짜와 게시 시간에 따라 순환되어 전 세계 주요 이슈를 폭넓게 다룹니다.</p><p>향후 뉴스레터 통합, 소셜 미디어 자동 포스팅, 독자 댓글 관리 등으로 확장 가능합니다.</p>' },
      ],
      conclusion: '<p>The Global Brief 자동화 파이프라인이 완전히 작동합니다. API 키가 구성되면, 이 시스템은 연간 730개의 기사를 완전 자율적으로 생성, 게시, 배포합니다.</p><p>GitHub Secrets를 구성하면 다음 예약 실행 시간에 첫 번째 실제 기사가 게시됩니다.</p>',
    },
    imageQuery: 'global journalism news media',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌐  The Global Brief — Post Generator');
  console.log('═'.repeat(44));
  if (DRY_RUN) console.log('⚠️  DRY RUN — no API calls');

  // Ensure dirs
  fs.mkdirSync(path.join(POSTS_DIR, 'politics'), { recursive: true });
  fs.mkdirSync(path.join(POSTS_DIR, 'economy'), { recursive: true });
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

  // Pick topic
  const { category, topic } = pickTopic();
  console.log(`📁  Category : ${category}`);
  console.log(`📝  Topic    : ${topic.text}`);

  // Generate article
  console.log('🤖  Generating article...');
  const article = await generateArticle(category, topic.text);
  console.log(`✅  Title    : "${article.title}"`);

  // Fetch image
  console.log('🖼   Fetching image...');
  const image = await fetchImage(article.imageQuery || topic.img);
  console.log(`✅  Image    : ${String(image.url).slice(0, 55)}...`);

  // Dates
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
  });
  const isoDate = now.toISOString();
  const datePart = now.toISOString().split('T')[0];
  const slug = `${(article.slug || 'article').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-${datePart}`;

  // Build HTML
  console.log('🏗   Building HTML...');
  const html = buildArticleHtml(article, image, slug, category, dateStr, isoDate);
  const outPath = path.join(POSTS_DIR, category, `${slug}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`✅  Saved    : public/posts/${category}/${slug}.html`);

  // Update posts.json
  let posts = [];
  if (fs.existsSync(DATA_FILE)) {
    try { posts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  }
  posts = [
    {
      slug,
      title: article.title,
      subtitle: article.subtitle,
      category,
      dateStr,
      isoDate,
      url: `/posts/${category}/${slug}.html`,
      imageUrl: image.url,
      tags: article.tags || [],
      readingTime: article.readingTime || 9,
      metaDescription: article.metaDescription,
    },
    ...posts.filter((p) => p.slug !== slug),
  ].slice(0, 300);
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
  console.log(`✅  Manifest : data/posts.json (${posts.length} posts)`);

  console.log('\n🎉  Done!');
  console.log(`   → ${BLOG_BASE_URL}/posts/${category}/${slug}.html\n`);
}

main().catch((e) => {
  console.error('\n❌  Fatal error:', e.message);
  process.exit(1);
});
