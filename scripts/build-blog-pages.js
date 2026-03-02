#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const POSTS_DIR = path.join(PUBLIC_DIR, "posts");

const BASE_URL =
  process.env.BLOG_BASE_URL || "https://bloghosting-b5700.web.app";
const SITE_NAME = "시그널 앤 스토리";
const ADS_CLIENT = "ca-pub-3898675618700513";
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || "G-L3Z7HC2RGD";
const GA_STATS_ENDPOINT = process.env.GA_STATS_ENDPOINT || "";
const CATEGORY = {
  MAJOR: "major",
  ECONOMY: "economy",
};

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderGaTagSnippet() {
  if (!GA_MEASUREMENT_ID) return "";
  return `    <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(GA_MEASUREMENT_ID)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag("js", new Date());
      gtag("config", "${escapeHtml(GA_MEASUREMENT_ID)}");
    </script>`;
}

function renderThemeStyleTag() {
  return `    <style id="blog-theme-style">
      html{color-scheme:dark}
      html[data-theme="light"]{color-scheme:light}
      html[data-theme="dark"]{color-scheme:dark}
      body{transition:background-color .22s ease,color .22s ease}
      html[data-theme="light"]{
        --bg:#f5f7fb;
        --bg-soft:#edf2f8;
        --surface:#ffffff;
        --surface-soft:#f8fafc;
        --card:#ffffff;
        --chip:#e7edf5;
        --text:#101828;
        --muted:#475467;
        --line:#d1dae6;
        --primary:#1d4ed8;
        --accent:#2563eb
      }
      html[data-theme="dark"]{
        --bg:#0b0f14;
        --bg-soft:#0f1520;
        --surface:#121824;
        --surface-soft:#0f1622;
        --card:#121824;
        --chip:#1a2436;
        --text:#e8eef6;
        --muted:#aab6c5;
        --line:#263246;
        --primary:#6aa6ff;
        --accent:#9ac1ff
      }
      html[data-theme="light"] body{
        background:
          radial-gradient(circle at 12% 6%, rgba(37,99,235,.12), rgba(37,99,235,0) 35%),
          linear-gradient(180deg, var(--bg-soft), var(--bg)) !important
      }
      html[data-theme="light"] .site-header,
      html[data-theme="light"] .header,
      html[data-theme="light"] header{
        background:rgba(255,255,255,.9) !important
      }
      html[data-theme="light"] .post-nav{background:rgba(248,250,252,.95) !important}
      html[data-theme="light"] .nav-link{background:#eef3fb}
      html[data-theme="light"] .nav-link.active{color:#fff;background:var(--primary);border-color:var(--primary)}
      html[data-theme="light"] .why{background:#eef3fb !important;border-color:#b8c8e4 !important}
      .theme-toggle-fab{
        position:fixed;
        right:16px;
        bottom:16px;
        z-index:9999;
        border:1px solid var(--line);
        background:var(--surface);
        color:var(--text);
        padding:.5rem .75rem;
        border-radius:999px;
        font-size:.82rem;
        font-weight:700;
        cursor:pointer;
        box-shadow:0 8px 20px rgba(0,0,0,.2)
      }
      .theme-toggle-fab:hover{filter:brightness(1.04)}
      .theme-toggle-fab:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
    </style>`;
}

function renderThemeInitScript() {
  return `    <script id="blog-theme-init">
      (function () {
        var key = "blog-theme";
        var root = document.documentElement;
        var stored = "";
        try { stored = localStorage.getItem(key) || ""; } catch (e) {}
        var theme = (stored === "light" || stored === "dark")
          ? stored
          : ((window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
        root.setAttribute("data-theme", theme);
      })();
    </script>`;
}

function renderThemeToggleScript() {
  return `    <script id="blog-theme-toggle-script">
      (function () {
        var key = "blog-theme";
        var root = document.documentElement;

        function getTheme() {
          var current = root.getAttribute("data-theme");
          if (current === "light" || current === "dark") return current;
          return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
        }

        function setTheme(theme) {
          root.setAttribute("data-theme", theme);
          try { localStorage.setItem(key, theme); } catch (e) {}
          updateButton();
        }

        function updateButton() {
          var btn = document.querySelector("[data-theme-toggle]");
          if (!btn) return;
          var current = getTheme();
          btn.textContent = current === "dark" ? "라이트 모드" : "다크 모드";
          btn.setAttribute("aria-label", "테마 전환");
        }

        function ensureButton() {
          var btn = document.querySelector("[data-theme-toggle]");
          if (btn) return btn;
          btn = document.createElement("button");
          btn.type = "button";
          btn.className = "theme-toggle-fab";
          btn.setAttribute("data-theme-toggle", "1");
          document.body.appendChild(btn);
          return btn;
        }

        document.addEventListener("DOMContentLoaded", function () {
          var btn = ensureButton();
          updateButton();
          btn.addEventListener("click", function () {
            var next = getTheme() === "dark" ? "light" : "dark";
            setTheme(next);
          });
        });
      })();
    </script>`;
}

function pickFirstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }
  return "";
}

function toIsoDate(raw, fallback) {
  if (!raw) return fallback;
  const normalized = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return fallback;
}

function formatKoDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${y}년 ${m}월 ${d}일`;
}

function renderPostNavLinks(navPosts, latestPost, emptyMessage) {
  if (!navPosts.length) {
    return `<span class="nav-empty">${escapeHtml(emptyMessage)}</span>`;
  }

  return navPosts
    .map((post) => {
      const label = `${post.dateFormatted} · ${post.section || post.categoryLabel || "포스트"}`;
      return `<a class="nav-link${latestPost && post.href === latestPost.href ? " active" : ""}" href="${escapeHtml(post.href)}">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function minifyHtml(html) {
  return (
    html
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .replace(/>\s+</g, "><")
      .trim() + "\n"
  );
}

function classifyCategory(section, title, fileName) {
  const haystack = `${section} ${title} ${fileName}`.toLowerCase();
  const economyPattern =
    /(경제|증시|주식|코스피|코스닥|금리|환율|채권|원자재|etf|etn|ipo|공모주|상장|리츠|배당)/i;
  return economyPattern.test(haystack) ? CATEGORY.ECONOMY : CATEGORY.MAJOR;
}

function parsePost(relPath) {
  const filePath = path.join(POSTS_DIR, relPath);
  const html = readFile(filePath);
  const fileName = path.basename(relPath);

  const fallbackDateFromName =
    (fileName.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || "1970-01-01";
  const datePublished = toIsoDate(
    pickFirstMatch(html, [
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i,
    ]),
    fallbackDateFromName,
  );

  const title =
    pickFirstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<title>([\s\S]*?)<\/title>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    ]) || fileName.replace(/\.html$/i, "");

  const description =
    pickFirstMatch(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<p[^>]*>([\s\S]*?)<\/p>/i,
    ]) || "세계 주요 이슈를 한국어로 요약한 데일리 브리핑입니다.";

  const detectedSection = pickFirstMatch(html, [
    /<meta[^>]+property=["']article:section["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ]);

  const plainText = stripHtml(html);
  const readMinutes = Math.max(3, Math.round(plainText.length / 900));
  const href = `/posts/${relPath}`;
  const categoryKey = classifyCategory(detectedSection, title, fileName);
  const categoryLabel =
    categoryKey === CATEGORY.ECONOMY ? "종합 경제" : "주요 이슈";
  const section =
    detectedSection ||
    (categoryKey === CATEGORY.ECONOMY ? "종합 경제" : "세계 뉴스");

  return {
    fileName,
    relPath,
    filePath,
    href,
    url: `${BASE_URL}${href}`,
    title: stripHtml(title),
    description: stripHtml(description).slice(0, 180),
    section: stripHtml(section),
    category: categoryKey,
    categoryLabel,
    datePublished,
    dateFormatted: formatKoDate(datePublished),
    readMinutes,
  };
}

function ensurePostSeo(post) {
  let html = readFile(post.filePath);
  let updated = html;

  if (!/<html[^>]*\blang=["'][^"']+["']/i.test(updated)) {
    updated = updated.replace(/<html(\s|>)/i, '<html lang="ko"$1');
  }

  const metaTags = [];
  if (!/<meta[^>]+name=["']description["']/i.test(updated)) {
    metaTags.push(
      `<meta name="description" content="${escapeHtml(post.description)}">`,
    );
  }
  if (!/<meta[^>]+name=["']robots["']/i.test(updated)) {
    metaTags.push('<meta name="robots" content="index, follow">');
  }
  if (!/<link[^>]+rel=["']canonical["']/i.test(updated)) {
    metaTags.push(`<link rel="canonical" href="${escapeHtml(post.url)}">`);
  } else {
    updated = updated.replace(
      /<link([^>]+rel=["']canonical["'][^>]*href=["'])[^"']*(["'][^>]*>)/i,
      `<link$1${escapeHtml(post.url)}$2`,
    );
  }
  if (!/<meta[^>]+property=["']og:type["']/i.test(updated)) {
    metaTags.push('<meta property="og:type" content="article">');
  }
  if (!/<meta[^>]+property=["']og:title["']/i.test(updated)) {
    metaTags.push(
      `<meta property="og:title" content="${escapeHtml(post.title)}">`,
    );
  }
  if (!/<meta[^>]+property=["']og:description["']/i.test(updated)) {
    metaTags.push(
      `<meta property="og:description" content="${escapeHtml(post.description)}">`,
    );
  }
  if (!/<meta[^>]+property=["']og:url["']/i.test(updated)) {
    metaTags.push(`<meta property="og:url" content="${escapeHtml(post.url)}">`);
  } else {
    updated = updated.replace(
      /<meta([^>]+property=["']og:url["'][^>]*content=["'])[^"']*(["'][^>]*>)/i,
      `<meta$1${escapeHtml(post.url)}$2`,
    );
  }
  if (!/<meta[^>]+name=["']twitter:card["']/i.test(updated)) {
    metaTags.push('<meta name="twitter:card" content="summary_large_image">');
  }
  if (!/<meta[^>]+property=["']article:published_time["']/i.test(updated)) {
    metaTags.push(
      `<meta property="article:published_time" content="${escapeHtml(post.datePublished)}">`,
    );
  }
  if (!/<meta[^>]+property=["']article:section["']/i.test(updated)) {
    metaTags.push(
      `<meta property="article:section" content="${escapeHtml(post.section)}">`,
    );
  }

  if (metaTags.length > 0) {
    if (/<\/title>/i.test(updated)) {
      updated = updated.replace(
        /<\/title>/i,
        `</title>\n    ${metaTags.join("\n    ")}`,
      );
    } else if (/<head[^>]*>/i.test(updated)) {
      updated = updated.replace(
        /<head[^>]*>/i,
        (match) => `${match}\n    ${metaTags.join("\n    ")}`,
      );
    }
  }

  if (
    !/<script[^>]+type=["']application\/ld\+json["'][\s\S]*?BlogPosting[\s\S]*?<\/script>/i.test(
      updated,
    )
  ) {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.datePublished,
      dateModified: post.datePublished,
      author: {
        "@type": "Organization",
        name: SITE_NAME,
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
      },
      articleSection: post.section,
      mainEntityOfPage: post.url,
      description: post.description,
    };

    updated = updated.replace(
      /<\/head>/i,
      `    <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n    </script>\n  </head>`,
    );
  }

  if (
    GA_MEASUREMENT_ID &&
    !/googletagmanager\.com\/gtag\/js\?id=/i.test(updated)
  ) {
    updated = updated.replace(
      /<\/head>/i,
      `${renderGaTagSnippet()}\n  </head>`,
    );
  }

  if (!/<style[^>]+id=["']blog-theme-style["']/i.test(updated)) {
    updated = updated.replace(
      /<\/head>/i,
      `${renderThemeStyleTag()}\n  </head>`,
    );
  }
  if (!/<script[^>]+id=["']blog-theme-init["']/i.test(updated)) {
    updated = updated.replace(
      /<\/head>/i,
      `${renderThemeInitScript()}\n  </head>`,
    );
  }
  if (!/<script[^>]+id=["']blog-theme-toggle-script["']/i.test(updated)) {
    updated = updated.replace(
      /<\/body>/i,
      `${renderThemeToggleScript()}\n  </body>`,
    );
  }

  if (updated !== html) {
    writeFile(post.filePath, updated);
  }
}

function renderIndex(posts, majorPosts, economyPosts) {
  const latest = posts[0];
  const others = posts.slice(1, 9);
  const navPosts = posts.slice(0, 10);
  const latestMajor = majorPosts[0];
  const latestEconomy = economyPosts[0];

  const latestCard = latest
    ? `
        <a class="card latest" href="${escapeHtml(latest.href)}">
          <span class="tag">${escapeHtml(latest.section)}</span>
          <h3>${escapeHtml(latest.title)}</h3>
          <p>${escapeHtml(latest.description)}</p>
          <p class="meta"><time datetime="${escapeHtml(latest.datePublished)}">${escapeHtml(latest.dateFormatted)}</time> · ${latest.readMinutes}분 읽기</p>
        </a>`
    : '\n        <div class="empty">등록된 브리핑이 없습니다.</div>';

  const recentList = others.length
    ? others
        .map(
          (post) => `
          <li>
            <a href="${escapeHtml(post.href)}">${escapeHtml(post.title)}</a>
            <span>${escapeHtml(post.dateFormatted)}</span>
          </li>`,
        )
        .join("")
    : "\n          <li>추가 브리핑이 없습니다.</li>";

  const navLinks = renderPostNavLinks(
    navPosts,
    latest,
    "포스트가 아직 없습니다.",
  );

  const itemListJson = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "최신 브리핑 목록",
    itemListElement: posts.slice(0, 20).map((post, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.datePublished,
        url: post.url,
      },
    })),
  };

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-TP2SWKBR');</script>
    <!-- End Google Tag Manager -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${SITE_NAME} | 매일 세계 뉴스 브리핑</title>
    <meta name="description" content="${SITE_NAME}는 매일 세계 뉴스를 한국어로 요약하는 데일리 브리핑 블로그입니다.">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#0b0f14">
    <meta name="author" content="${SITE_NAME} 편집팀">
    <link rel="canonical" href="${BASE_URL}/">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${SITE_NAME} | 매일 세계 뉴스 브리핑">
    <meta property="og:description" content="매일 저녁, 핵심 세계 뉴스를 한국어로 간결하게 정리합니다.">
    <meta property="og:url" content="${BASE_URL}/">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${SITE_NAME} | 매일 세계 뉴스 브리핑">
    <meta name="twitter:description" content="매일 저녁, 핵심 세계 뉴스를 한국어로 간결하게 정리합니다.">
    <meta name="google-site-verification" content="HyJwG4YbPmrn7ckTfmC2ofOR1tXynBiaxvohZjyixHc">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&amp;display=swap" rel="stylesheet">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
${renderGaTagSnippet()}
    <style>
      :root {
        --bg: #0b0f14;
        --bg-soft: #0f1520;
        --surface: #121824;
        --surface-soft: #0f1622;
        --text: #e8eef6;
        --muted: #aab6c5;
        --line: #263246;
        --primary: #6aa6ff;
        --accent: #9ac1ff;
        --radius: 16px;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 12% 6%, rgba(106, 166, 255, 0.14), rgba(106, 166, 255, 0) 34%),
          linear-gradient(180deg, var(--bg-soft), var(--bg));
      }
      .container { width: min(1080px, 92vw); margin: 0 auto; }
      .site-header {
        position: sticky;
        top: 0;
        z-index: 60;
        border-bottom: 1px solid var(--line);
        backdrop-filter: blur(8px);
        background: rgba(11, 15, 20, 0.88);
      }
      .header-inner { display: flex; justify-content: space-between; align-items: center; padding: 0.95rem 0; }
      .brand { margin: 0; font-size: 1.08rem; font-weight: 800; color: var(--text); text-decoration: none; }
      .header-links { display: flex; gap: 0.65rem; flex-wrap: wrap; }
      .header-link { color: var(--primary); text-decoration: none; font-weight: 700; font-size: 0.92rem; }
      .post-nav {
        position: sticky;
        top: 56px;
        z-index: 55;
        border-bottom: 1px solid var(--line);
        background: rgba(15, 22, 34, 0.92);
      }
      .post-nav-inner {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        overflow-x: auto;
        padding: 0.55rem 0;
        scrollbar-width: thin;
      }
      .nav-link {
        white-space: nowrap;
        text-decoration: none;
        color: var(--muted);
        border: 1px solid var(--line);
        background: #1a2436;
        border-radius: 999px;
        padding: 0.36rem 0.68rem;
        font-size: 0.86rem;
      }
      .nav-link.active {
        color: #0b1320;
        background: var(--accent);
        border-color: var(--accent);
        font-weight: 700;
      }
      .nav-empty {
        color: var(--muted);
        font-size: 0.9rem;
      }
      .hero { padding: 2.7rem 0 1.2rem; }
      .hero h1 { margin: 0; font-size: clamp(1.85rem, 4vw, 3rem); line-height: 1.22; }
      .hero p { margin: 0.85rem 0 0; color: var(--muted); max-width: 64ch; }
      .metrics { margin-top: 1rem; display: grid; gap: 0.65rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .metric { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 0.95rem; }
      .metric dt { font-size: 0.8rem; color: var(--muted); }
      .metric dd { margin: 0.2rem 0 0; font-weight: 800; font-size: 1.1rem; }
      main { padding: 1.1rem 0 2.8rem; }
      .section { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 1rem; }
      .section + .section { margin-top: 0.95rem; }
      .section h2 { margin: 0; font-size: 1.2rem; }
      .card { margin-top: 0.7rem; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-soft); padding: 0.95rem; text-decoration: none; display: block; color: inherit; }
      .card:hover, .card:focus-visible { outline: 2px solid rgba(15, 118, 110, 0.2); outline-offset: 2px; }
      .tag { display: inline-block; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); font-weight: 700; }
      .card h3 { margin: 0.42rem 0 0; font-size: 1.15rem; line-height: 1.35; }
      .card p { margin: 0.42rem 0 0; color: var(--muted); }
      .meta { margin-top: 0.45rem; font-size: 0.88rem; color: var(--muted); }
      .toc-list { margin: 0.65rem 0 0; padding-left: 1.1rem; }
      .toc-list li + li { margin-top: 0.45rem; }
      .toc-list a { color: var(--primary); font-weight: 700; text-decoration: none; }
      .toc-list span { color: var(--muted); margin-left: 0.4rem; font-size: 0.9rem; }
      .category-grid {
        margin-top: 0.7rem;
        display: grid;
        gap: 0.7rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .category-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--surface-soft);
        text-decoration: none;
        color: inherit;
        padding: 0.8rem;
        display: block;
      }
      .category-card:hover, .category-card:focus-visible {
        outline: 2px solid rgba(106, 166, 255, 0.25);
        outline-offset: 2px;
      }
      .category-card h3 { margin: 0; font-size: 1rem; }
      .category-card p { margin: 0.4rem 0 0; color: var(--muted); font-size: 0.9rem; }
      .ad-note { margin: 0.6rem 0 0; color: var(--muted); font-size: 0.9rem; }
      ins.adsbygoogle[data-ad-status="unfilled"] { display: none !important; }
      .site-footer { border-top: 1px solid var(--line); padding: 1.4rem 0 2rem; color: var(--muted); font-size: 0.9rem; }
      .site-footer .container { display: grid; gap: 0.35rem; }
      .visitor-stats { font-size: 0.8rem; opacity: 0.9; }
      .empty { margin-top: 0.7rem; color: var(--muted); }
      @media (max-width: 780px) {
        .metrics { grid-template-columns: 1fr; }
        .header-inner { gap: 0.45rem; }
        .brand { font-size: 1rem; }
        .header-link { font-size: 0.92rem; }
        .post-nav { top: 52px; }
        .category-grid { grid-template-columns: 1fr; }
      }
    </style>
${renderThemeStyleTag()}
${renderThemeInitScript()}
    <script type="application/ld+json">
${JSON.stringify(itemListJson, null, 2)}
    </script>
  </head>
  <body>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TP2SWKBR"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/">${SITE_NAME}</a>
        <div class="header-links">
          <a class="header-link" href="/briefings.html">주요 이슈</a>
          <a class="header-link" href="/economy.html">종합 경제</a>
        </div>
      </div>
    </header>
    <nav class="post-nav" aria-label="포스트 네비게이션">
      <div class="container post-nav-inner">${navLinks}
      </div>
    </nav>
    <section class="hero container">
      <h1>매일 저녁, 세계 뉴스를 한국어로 간결하게 정리합니다.</h1>
      <p>신규 포스트를 <code>public/posts</code>에 추가하면 배포 시 목록이 자동 반영됩니다.</p>
      <dl class="metrics" aria-label="블로그 지표">
        <div class="metric"><dt>발행 글 수</dt><dd>${posts.length}개</dd></div>
        <div class="metric"><dt>주요 이슈 / 경제</dt><dd>${majorPosts.length} / ${economyPosts.length}</dd></div>
        <div class="metric"><dt>언어 기준</dt><dd>한국어</dd></div>
      </dl>
    </section>

    <div class="container" style="margin-top:0.3rem;">
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <main class="container" id="main-content" aria-label="메인 콘텐츠">
      <section class="section" aria-labelledby="latest-title">
        <h2 id="latest-title">최신 발행</h2>${latestCard}
      </section>
      <section class="section" aria-labelledby="toc-title">
        <h2 id="toc-title">카테고리</h2>
        <div class="category-grid">
          <a class="category-card" href="/briefings.html">
            <h3>주요 이슈</h3>
            <p>포스트 ${majorPosts.length}개 · 최신: ${latestMajor ? escapeHtml(latestMajor.dateFormatted) : "없음"}</p>
          </a>
          <a class="category-card" href="/economy.html">
            <h3>종합 경제</h3>
            <p>포스트 ${economyPosts.length}개 · 최신: ${latestEconomy ? escapeHtml(latestEconomy.dateFormatted) : "없음"}</p>
          </a>
        </div>
      </section>
      <section class="section" aria-labelledby="nav-title">
        <h2 id="nav-title">브리핑 목차</h2>
        <ul class="toc-list">
          <li><a href="/briefings.html">전체 브리핑 목록 보기</a></li>${recentList}
        </ul>
      </section>
      <section class="section" aria-labelledby="ad-title">
        <h2 id="ad-title">광고 안내</h2>
        <p class="ad-note">Google AdSense Auto Ads가 적용되어 있으며, 승인 상태에 따라 자동으로 광고가 노출됩니다.</p>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container">
        <small>&copy; 2026 ${SITE_NAME}</small>
        <small id="visitor-stats" class="visitor-stats">방문자 통계를 불러오는 중...</small>
      </div>
    </footer>
${renderThemeToggleScript()}
    <script>
      (function () {
        var statsEl = document.getElementById("visitor-stats");
        if (!statsEl) return;
        var gaStatsEndpoint = ${JSON.stringify(GA_STATS_ENDPOINT)};
        var namespace = "bloghosting-b5700-main";
        var today = new Date().toISOString().slice(0, 10);
        var totalKey = "home-total";
        var dailyKey = "home-" + today;

        function fetchGaStats() {
          if (!gaStatsEndpoint) {
            return Promise.reject(new Error("No GA endpoint"));
          }

          return fetch(gaStatsEndpoint, { cache: "no-store" })
            .then(function (res) {
              if (!res.ok) throw new Error("GA endpoint failed");
              return res.json();
            })
            .then(function (data) {
              var daily = Number(data.todayVisitors ?? data.dailyVisitors ?? data.today);
              var total = Number(data.totalVisitors ?? data.total);
              if (!Number.isFinite(daily) || !Number.isFinite(total)) {
                throw new Error("Invalid GA payload");
              }
              return { daily: daily, total: total, source: data.source || "GA4" };
            });
        }

        function hit(key) {
          return fetch("https://api.countapi.xyz/hit/" + namespace + "/" + key, { cache: "no-store" })
            .then(function (res) { return res.json(); });
        }

        function fetchCountApiStats() {
          return Promise.all([hit(dailyKey), hit(totalKey)]).then(function (values) {
            var daily = values[0] && typeof values[0].value === "number" ? values[0].value : "-";
            var total = values[1] && typeof values[1].value === "number" ? values[1].value : "-";
            return { daily: daily, total: total, source: "CountAPI" };
          });
        }

        fetchGaStats()
          .catch(fetchCountApiStats)
          .then(function (stats) {
            statsEl.textContent = "오늘 방문: " + stats.daily + " · 누적 방문: " + stats.total + " (" + stats.source + ")";
          })
          .catch(function () {
            statsEl.textContent = "방문자 통계를 가져오지 못했습니다.";
          });
      })();
    </script>
  </body>
</html>
`;
}

function renderBriefings(posts) {
  const latest = posts[0];
  const navPosts = posts.slice(0, 10);
  const todayCard = latest
    ? `
        <a class="card" href="${escapeHtml(latest.href)}">
          <span class="tag">${escapeHtml(latest.section)}</span>
          <h3>${escapeHtml(latest.title)}</h3>
          <p>${escapeHtml(latest.description)}</p>
          <p class="meta"><time datetime="${escapeHtml(latest.datePublished)}">${escapeHtml(latest.dateFormatted)}</time> · ${latest.readMinutes}분 읽기</p>
        </a>`
    : '\n        <div class="empty">등록된 브리핑이 없습니다.</div>';

  const allItems = posts
    .map(
      (post) => `
          <li>
            <a href="${escapeHtml(post.href)}">${escapeHtml(post.title)}</a>
            <span>${escapeHtml(post.dateFormatted)}</span>
          </li>`,
    )
    .join("");

  const navLinks = renderPostNavLinks(
    navPosts,
    latest,
    "포스트가 아직 없습니다.",
  );

  const itemListJson = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "주요 이슈 브리핑 목차",
    itemListElement: posts.map((post, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.datePublished,
        url: post.url,
      },
    })),
  };

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>주요 이슈 브리핑 | ${SITE_NAME}</title>
    <meta name="description" content="${SITE_NAME}의 주요 이슈 브리핑 목록입니다. 날짜별 발행 글을 바로 확인할 수 있습니다.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${BASE_URL}/briefings.html">
    <meta property="og:type" content="website">
    <meta property="og:title" content="주요 이슈 브리핑 | ${SITE_NAME}">
    <meta property="og:description" content="주요 이슈 카테고리 브리핑 목록을 확인하세요.">
    <meta property="og:url" content="${BASE_URL}/briefings.html">
    <meta name="theme-color" content="#0b0f14">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&amp;display=swap" rel="stylesheet">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
${renderGaTagSnippet()}
    <style>
      :root {
        --bg: #0b0f14;
        --bg-soft: #0f1520;
        --surface: #121824;
        --surface-soft: #0f1622;
        --text: #e8eef6;
        --muted: #aab6c5;
        --line: #263246;
        --primary: #6aa6ff;
        --accent: #9ac1ff;
        --radius: 16px;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 12% 6%, rgba(106, 166, 255, 0.14), rgba(106, 166, 255, 0) 34%),
          linear-gradient(180deg, var(--bg-soft), var(--bg));
      }
      .container { width: min(980px, 92vw); margin: 0 auto; }
      .header {
        position: sticky;
        top: 0;
        z-index: 60;
        border-bottom: 1px solid var(--line);
        background: rgba(11, 15, 20, 0.88);
        backdrop-filter: blur(8px);
      }
      .header-inner { display: flex; align-items: center; justify-content: space-between; padding: 0.95rem 0; }
      .brand { margin: 0; font-size: 1.08rem; font-weight: 800; }
      .header-links { display: flex; gap: 0.65rem; flex-wrap: wrap; }
      .home-link { color: var(--primary); font-weight: 700; text-decoration: none; font-size: 0.92rem; }
      .post-nav {
        position: sticky;
        top: 56px;
        z-index: 55;
        border-bottom: 1px solid var(--line);
        background: rgba(15, 22, 34, 0.92);
      }
      .post-nav-inner {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        overflow-x: auto;
        padding: 0.55rem 0;
        scrollbar-width: thin;
      }
      .nav-link {
        white-space: nowrap;
        text-decoration: none;
        color: var(--muted);
        border: 1px solid var(--line);
        background: #1a2436;
        border-radius: 999px;
        padding: 0.36rem 0.68rem;
        font-size: 0.86rem;
      }
      .nav-link.active {
        color: #0b1320;
        background: var(--accent);
        border-color: var(--accent);
        font-weight: 700;
      }
      .nav-empty { color: var(--muted); font-size: 0.9rem; }
      .hero { padding: 2.2rem 0 1.1rem; }
      .hero h1 { margin: 0; font-size: clamp(1.7rem, 3.5vw, 2.8rem); line-height: 1.25; }
      .hero p { margin: 0.8rem 0 0; color: var(--muted); }
      main { padding: 0.8rem 0 2.7rem; }
      .section { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 1rem; }
      .section + .section { margin-top: 0.9rem; }
      .section h2 { margin: 0; font-size: 1.2rem; }
      .toc-list { margin: 0.7rem 0 0; padding-left: 1.1rem; }
      .toc-list li + li { margin-top: 0.45rem; }
      .toc-list a { color: var(--primary); font-weight: 700; text-decoration: none; }
      .toc-list span { color: var(--muted); margin-left: 0.4rem; font-size: 0.9rem; }
      .card { margin-top: 0.75rem; border: 1px solid var(--line); border-radius: 13px; background: var(--surface-soft); padding: 0.9rem; text-decoration: none; display: block; color: inherit; }
      .card:hover, .card:focus-visible { outline: 2px solid rgba(15, 118, 110, 0.2); outline-offset: 2px; }
      .tag { display: inline-block; color: var(--accent); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
      .card h3 { margin: 0.45rem 0 0; font-size: 1.16rem; }
      .card p { margin: 0.45rem 0 0; color: var(--muted); }
      .meta { margin-top: 0.45rem; color: var(--muted); font-size: 0.88rem; }
      .ad-note { margin: 0.65rem 0 0; color: var(--muted); font-size: 0.9rem; }
      ins.adsbygoogle[data-ad-status="unfilled"] { display: none !important; }
      .footer { border-top: 1px solid var(--line); padding: 1.4rem 0 2rem; color: var(--muted); font-size: 0.9rem; }
      .empty { margin-top: 0.7rem; color: var(--muted); }
      @media (max-width: 700px) {
        .header-inner { gap: 0.45rem; }
        .brand { font-size: 1rem; }
        .post-nav { top: 52px; }
      }
    </style>
${renderThemeStyleTag()}
${renderThemeInitScript()}
    <script type="application/ld+json">
${JSON.stringify(itemListJson, null, 2)}
    </script>
  </head>
  <body>
    <header class="header">
      <div class="container header-inner">
        <h1 class="brand">${SITE_NAME}</h1>
        <div class="header-links">
          <a class="home-link" href="/">홈</a>
          <a class="home-link" href="/economy.html">종합 경제</a>
        </div>
      </div>
    </header>
    <nav class="post-nav" aria-label="포스트 네비게이션">
      <div class="container post-nav-inner">${navLinks}
      </div>
    </nav>

    <section class="hero container">
      <h1>주요 이슈 브리핑 목록</h1>
      <p>세계 주요 이슈 카테고리 포스트를 날짜별로 확인할 수 있습니다.</p>
    </section>

    <div class="container" style="margin-top:0.3rem;">
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <main class="container" id="main-content" aria-label="브리핑 목차">
      <section class="section" aria-labelledby="toc-title">
        <h2 id="toc-title">목차</h2>
        <ul class="toc-list">
          <li><a href="#today-briefing">오늘 발행 브리핑</a></li>
          <li><a href="#all-briefings">전체 브리핑</a></li>
        </ul>
      </section>

      <section class="section" id="today-briefing" aria-labelledby="today-title">
        <h2 id="today-title">오늘 발행 브리핑</h2>${todayCard}
      </section>

      <section class="section" id="all-briefings" aria-labelledby="all-title">
        <h2 id="all-title">전체 브리핑</h2>
        <ul class="toc-list">${allItems || "<li>등록된 브리핑이 없습니다.</li>"}
        </ul>
      </section>

      <section class="section" aria-labelledby="ad-title">
        <h2 id="ad-title">광고 안내</h2>
        <p class="ad-note">Google AdSense Auto Ads가 적용되어 있으며, 승인/설정 상태에 따라 광고가 자동 배치됩니다.</p>
      </section>
    </main>

    <footer class="footer"><div class="container"><small>&copy; 2026 ${SITE_NAME}</small></div></footer>
${renderThemeToggleScript()}
  </body>
</html>
`;
}

function renderEconomy(posts) {
  const latest = posts[0];
  const navPosts = posts.slice(0, 10);
  const todayCard = latest
    ? `
        <a class="card" href="${escapeHtml(latest.href)}">
          <span class="tag">${escapeHtml(latest.section)}</span>
          <h3>${escapeHtml(latest.title)}</h3>
          <p>${escapeHtml(latest.description)}</p>
          <p class="meta"><time datetime="${escapeHtml(latest.datePublished)}">${escapeHtml(latest.dateFormatted)}</time> · ${latest.readMinutes}분 읽기</p>
        </a>`
    : '\n        <div class="empty">등록된 경제 포스트가 없습니다.</div>';

  const allItems = posts
    .map(
      (post) => `
          <li>
            <a href="${escapeHtml(post.href)}">${escapeHtml(post.title)}</a>
            <span>${escapeHtml(post.dateFormatted)}</span>
          </li>`,
    )
    .join("");

  const navLinks = renderPostNavLinks(
    navPosts,
    latest,
    "경제 포스트가 아직 없습니다.",
  );

  const itemListJson = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "종합 경제 포스트 목차",
    itemListElement: posts.map((post, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.datePublished,
        url: post.url,
      },
    })),
  };

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>종합 경제 포스트 | ${SITE_NAME}</title>
    <meta name="description" content="${SITE_NAME}의 종합 경제 포스트 목록입니다. 공모주, ETF, 증시·거시 이슈를 날짜별로 확인할 수 있습니다.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${BASE_URL}/economy.html">
    <meta property="og:type" content="website">
    <meta property="og:title" content="종합 경제 포스트 | ${SITE_NAME}">
    <meta property="og:description" content="공모주, ETF, 증시·거시 이슈 포스트 목록을 확인하세요.">
    <meta property="og:url" content="${BASE_URL}/economy.html">
    <meta name="theme-color" content="#0b0f14">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&amp;display=swap" rel="stylesheet">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
${renderGaTagSnippet()}
    <style>
      :root {
        --bg: #0b0f14;
        --bg-soft: #0f1520;
        --surface: #121824;
        --surface-soft: #0f1622;
        --text: #e8eef6;
        --muted: #aab6c5;
        --line: #263246;
        --primary: #6aa6ff;
        --accent: #9ac1ff;
        --radius: 16px;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 12% 6%, rgba(106, 166, 255, 0.14), rgba(106, 166, 255, 0) 34%),
          linear-gradient(180deg, var(--bg-soft), var(--bg));
      }
      .container { width: min(980px, 92vw); margin: 0 auto; }
      .header {
        position: sticky;
        top: 0;
        z-index: 60;
        border-bottom: 1px solid var(--line);
        background: rgba(11, 15, 20, 0.88);
        backdrop-filter: blur(8px);
      }
      .header-inner { display: flex; align-items: center; justify-content: space-between; padding: 0.95rem 0; }
      .brand { margin: 0; font-size: 1.08rem; font-weight: 800; }
      .header-links { display: flex; gap: 0.65rem; flex-wrap: wrap; }
      .home-link { color: var(--primary); font-weight: 700; text-decoration: none; font-size: 0.92rem; }
      .post-nav {
        position: sticky;
        top: 56px;
        z-index: 55;
        border-bottom: 1px solid var(--line);
        background: rgba(15, 22, 34, 0.92);
      }
      .post-nav-inner {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        overflow-x: auto;
        padding: 0.55rem 0;
        scrollbar-width: thin;
      }
      .nav-link {
        white-space: nowrap;
        text-decoration: none;
        color: var(--muted);
        border: 1px solid var(--line);
        background: #1a2436;
        border-radius: 999px;
        padding: 0.36rem 0.68rem;
        font-size: 0.86rem;
      }
      .nav-link.active {
        color: #0b1320;
        background: var(--accent);
        border-color: var(--accent);
        font-weight: 700;
      }
      .nav-empty { color: var(--muted); font-size: 0.9rem; }
      .hero { padding: 2.2rem 0 1.1rem; }
      .hero h1 { margin: 0; font-size: clamp(1.7rem, 3.5vw, 2.8rem); line-height: 1.25; }
      .hero p { margin: 0.8rem 0 0; color: var(--muted); }
      main { padding: 0.8rem 0 2.7rem; }
      .section { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); padding: 1rem; }
      .section + .section { margin-top: 0.9rem; }
      .section h2 { margin: 0; font-size: 1.2rem; }
      .toc-list { margin: 0.7rem 0 0; padding-left: 1.1rem; }
      .toc-list li + li { margin-top: 0.45rem; }
      .toc-list a { color: var(--primary); font-weight: 700; text-decoration: none; }
      .toc-list span { color: var(--muted); margin-left: 0.4rem; font-size: 0.9rem; }
      .card { margin-top: 0.75rem; border: 1px solid var(--line); border-radius: 13px; background: var(--surface-soft); padding: 0.9rem; text-decoration: none; display: block; color: inherit; }
      .card:hover, .card:focus-visible { outline: 2px solid rgba(15, 118, 110, 0.2); outline-offset: 2px; }
      .tag { display: inline-block; color: var(--accent); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
      .card h3 { margin: 0.45rem 0 0; font-size: 1.16rem; }
      .card p { margin: 0.45rem 0 0; color: var(--muted); }
      .meta { margin-top: 0.45rem; color: var(--muted); font-size: 0.88rem; }
      .ad-note { margin: 0.65rem 0 0; color: var(--muted); font-size: 0.9rem; }
      ins.adsbygoogle[data-ad-status="unfilled"] { display: none !important; }
      .footer { border-top: 1px solid var(--line); padding: 1.4rem 0 2rem; color: var(--muted); font-size: 0.9rem; }
      .empty { margin-top: 0.7rem; color: var(--muted); }
      @media (max-width: 700px) {
        .header-inner { gap: 0.45rem; }
        .brand { font-size: 1rem; }
        .post-nav { top: 52px; }
      }
    </style>
${renderThemeStyleTag()}
${renderThemeInitScript()}
    <script type="application/ld+json">
${JSON.stringify(itemListJson, null, 2)}
    </script>
  </head>
  <body>
    <header class="header">
      <div class="container header-inner">
        <h1 class="brand">${SITE_NAME}</h1>
        <div class="header-links">
          <a class="home-link" href="/">홈</a>
          <a class="home-link" href="/briefings.html">주요 이슈</a>
        </div>
      </div>
    </header>
    <nav class="post-nav" aria-label="포스트 네비게이션">
      <div class="container post-nav-inner">${navLinks}
      </div>
    </nav>

    <section class="hero container">
      <h1>종합 경제 포스트</h1>
      <p>공모주, ETF, 증시·거시경제 포스트를 날짜별로 확인할 수 있습니다.</p>
    </section>

    <div class="container" style="margin-top:0.3rem;">
      <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <main class="container" id="main-content" aria-label="경제 포스트 목차">
      <section class="section" aria-labelledby="toc-title">
        <h2 id="toc-title">목차</h2>
        <ul class="toc-list">
          <li><a href="#today-briefing">최신 경제 포스트</a></li>
          <li><a href="#all-briefings">전체 경제 포스트</a></li>
        </ul>
      </section>

      <section class="section" id="today-briefing" aria-labelledby="today-title">
        <h2 id="today-title">최신 경제 포스트</h2>${todayCard}
      </section>

      <section class="section" id="all-briefings" aria-labelledby="all-title">
        <h2 id="all-title">전체 경제 포스트</h2>
        <ul class="toc-list">${allItems || "<li>등록된 경제 포스트가 없습니다.</li>"}
        </ul>
      </section>

      <section class="section" aria-labelledby="ad-title">
        <h2 id="ad-title">광고 안내</h2>
        <p class="ad-note">Google AdSense Auto Ads가 적용되어 있으며, 승인/설정 상태에 따라 광고가 자동 배치됩니다.</p>
      </section>
    </main>

    <footer class="footer"><div class="container"><small>&copy; 2026 ${SITE_NAME}</small></div></footer>
${renderThemeToggleScript()}
  </body>
</html>
`;
}

function renderSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${BASE_URL}/`, lastmod: today },
    { loc: `${BASE_URL}/briefings.html`, lastmod: today },
    { loc: `${BASE_URL}/economy.html`, lastmod: today },
    ...posts.map((post) => ({ loc: post.url, lastmod: post.datePublished })),
  ];

  const body = urls
    .map(
      (entry) =>
        `  <url>\n    <loc>${entry.loc}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${entry.loc.endsWith("/") ? "1.0" : "0.8"}</priority>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function collectPostRelPaths() {
  const results = [];
  const entries = fs.readdirSync(POSTS_DIR, { withFileTypes: true });

  // Scan category subdirectories first
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      const subDir = path.join(POSTS_DIR, entry.name);
      const files = fs
        .readdirSync(subDir)
        .filter((name) => name.endsWith(".html"))
        .filter((name) => !name.startsWith("_"))
        .filter((name) => !/^_template/i.test(name));
      for (const file of files) {
        results.push(`${entry.name}/${file}`);
      }
    }
  }

  // Also pick up any flat HTML files in the root posts dir (backward compat)
  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".html") &&
      !entry.name.startsWith("_") &&
      !/^_template/i.test(entry.name)
    ) {
      results.push(entry.name);
    }
  }

  return results;
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    throw new Error(`Posts directory not found: ${POSTS_DIR}`);
  }

  const postFiles = collectPostRelPaths();

  const posts = postFiles.map(parsePost);

  posts.sort((a, b) => {
    if (a.datePublished === b.datePublished)
      return a.title.localeCompare(b.title, "ko");
    return b.datePublished.localeCompare(a.datePublished);
  });

  const majorPosts = posts.filter((post) => post.category === CATEGORY.MAJOR);
  const economyPosts = posts.filter(
    (post) => post.category === CATEGORY.ECONOMY,
  );

  posts.forEach(ensurePostSeo);

  writeFile(
    path.join(PUBLIC_DIR, "index.html"),
    minifyHtml(renderIndex(posts, majorPosts, economyPosts)),
  );
  writeFile(
    path.join(PUBLIC_DIR, "briefings.html"),
    minifyHtml(renderBriefings(majorPosts)),
  );
  writeFile(
    path.join(PUBLIC_DIR, "economy.html"),
    minifyHtml(renderEconomy(economyPosts)),
  );
  writeFile(path.join(PUBLIC_DIR, "sitemap.xml"), renderSitemap(posts));
  const manifestPosts = posts.map((post) => ({
    fileName: post.fileName,
    relPath: post.relPath,
    href: post.href,
    url: post.url,
    title: post.title,
    description: post.description,
    section: post.section,
    category: post.category,
    categoryLabel: post.categoryLabel,
    datePublished: post.datePublished,
    dateFormatted: post.dateFormatted,
    readMinutes: post.readMinutes,
  }));
  writeFile(
    path.join(PUBLIC_DIR, "posts", "manifest.json"),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      posts: manifestPosts,
    }) + "\n",
  );

  console.log(
    `[build-blog-pages] Generated index/briefings/economy/sitemap from ${posts.length} posts (major=${majorPosts.length}, economy=${economyPosts.length}).`,
  );
}

main();
