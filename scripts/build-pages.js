#!/usr/bin/env node
/**
 * The Global Brief — Page Builder
 * Generates: index.html, politics.html, economy.html, sitemap.xml
 * Reads from: data/posts.json
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data", "posts.json");
const PUBLIC = path.join(ROOT, "public");

const BLOG_NAME = "The Global Brief";
const BLOG_TAGLINE = "Global Politics & Economy, Explained";
const ADS_CLIENT = "ca-pub-3898675618700513";
const GTM_ID = "GTM-TP2SWKBR";
const BLOG_BASE_URL =
  process.env.BLOG_BASE_URL || "https://the-global-brief-504d5.web.app";
const GA_ID = process.env.GA_MEASUREMENT_ID || "G-L3Z7HC2RGD";

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ── Read posts ────────────────────────────────────────────────────────────────
function readPosts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

// ── Shared header/footer HTML ─────────────────────────────────────────────────
function websiteSchema() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BLOG_NAME,
    url: BLOG_BASE_URL,
    description:
      "In-depth analysis of global politics and economics — in English and Korean.",
    inLanguage: ["en", "ko"],
    publisher: {
      "@type": "Organization",
      name: BLOG_NAME,
      url: BLOG_BASE_URL,
      logo: { "@type": "ImageObject", url: `${BLOG_BASE_URL}/logo.png` },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BLOG_BASE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  });
}

function sharedHead(title, desc, url, ogImage, extraSchema) {
  const schemaBlock = extraSchema
    ? `<script type="application/ld+json">${extraSchema}</script>`
    : "";
  return `<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="google-site-verification" content="UHheXZQb222-Nj4Ib3R_5iY9ZUTbPFudBsT4dS6jC5g" />
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${BLOG_NAME}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${schemaBlock}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--red:#c0392b;--red-lt:#e74c3c;--navy:#0f1722;--navy2:#1a2535;--text:#18181b;--text2:#3f3f46;--muted:#71717a;--bg:#f4f5f7;--card:#fff;--border:#e4e4e7;--serif:'Merriweather',Georgia,serif;--sans:'Inter',-apple-system,sans-serif;}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.65}
.container{max-width:1180px;margin:0 auto;padding:0 20px}
/* Header */
.site-header{background:var(--navy);position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(0,0,0,.45)}
.hdr-inner{max-width:1180px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-weight:800;font-size:1.2rem;color:#fff;text-decoration:none;letter-spacing:-.4px}
.logo em{color:var(--red-lt);font-style:normal}
.main-nav{display:flex;gap:2px}
.main-nav a{color:rgba(255,255,255,.72);text-decoration:none;font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.6px;padding:7px 12px;border-radius:5px;transition:all .18s}
.main-nav a:hover,.main-nav a.active{color:#fff;background:rgba(255,255,255,.1)}
.nav-cta{background:var(--red)!important;color:#fff!important}
.nav-cta:hover{background:var(--red-lt)!important}
/* Footer */
.site-footer{background:var(--navy);color:rgba(255,255,255,.5);padding:40px 20px;margin-top:60px}
.footer-inner{max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px}
.footer-logo{font-size:1rem;font-weight:800;color:#fff;text-decoration:none}
.footer-logo em{color:var(--red-lt);font-style:normal}
.footer-nav{display:flex;flex-wrap:wrap;gap:14px}
.footer-nav a{color:rgba(255,255,255,.5);text-decoration:none;font-size:.8rem;transition:color .2s}
.footer-nav a:hover{color:#fff}
.footer-copy{max-width:1180px;margin:16px auto 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:.7rem;color:rgba(255,255,255,.28);text-align:center}
/* Post cards */
.post-card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;transition:all .22s;box-shadow:0 1px 4px rgba(0,0,0,.04);display:flex;flex-direction:column}
.post-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.1)}
.card-img{width:100%;aspect-ratio:16/9;object-fit:cover;background:#ddd;display:block}
.card-body{padding:16px;display:flex;flex-direction:column;flex:1}
.card-cat{font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--red);letter-spacing:.6px;margin-bottom:7px}
.card-title{font-family:var(--serif);font-size:1.02rem;font-weight:700;line-height:1.4;color:var(--text);margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card-sub{font-size:.83rem;color:var(--text2);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
.card-meta{font-size:.72rem;color:var(--muted);display:flex;align-items:center;gap:6px;margin-top:auto}
.card-sep{color:var(--border)}
/* Ad unit */
.ad-unit{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center;margin:28px 0}
.ad-label{font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
/* Section heading */
.section-head{display:flex;align-items:center;gap:14px;margin-bottom:22px}
.section-head h2{font-family:var(--serif);font-size:1.25rem;font-weight:900;color:var(--text);white-space:nowrap}
.section-head::after{content:'';flex:1;height:1px;background:var(--border)}
.section-head a{font-size:.78rem;font-weight:600;color:var(--red);text-decoration:none;white-space:nowrap;padding:4px 12px;border:1px solid var(--red);border-radius:20px;transition:all .18s}
.section-head a:hover{background:var(--red);color:#fff}
/* Responsive */
@media(max-width:600px){.main-nav{display:none}.hdr-inner{padding:0 16px}}
</style>
</head>`;
}

function sharedHeader(activeNav) {
  const links = [
    { href: "/politics.html", label: "Politics", key: "politics" },
    { href: "/economy.html", label: "Economy", key: "economy" },
    { href: "/about.html", label: "About", key: "about" },
  ];
  return `<!-- GTM noscript -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<header class="site-header">
  <div class="hdr-inner">
    <a href="/" class="logo">The <em>Global</em> Brief</a>
    <nav class="main-nav">
      ${links.map((l) => `<a href="${l.href}"${l.key === activeNav ? ' class="active"' : ""}>${l.label}</a>`).join("\n      ")}
      <a href="/" class="nav-cta">Latest</a>
    </nav>
  </div>
</header>`;
}

function sharedFooter(year) {
  return `<footer class="site-footer">
  <div class="footer-inner">
    <a href="/" class="footer-logo">The <em>Global</em> Brief</a>
    <nav class="footer-nav">
      <a href="/politics.html">Politics</a>
      <a href="/economy.html">Economy</a>
      <a href="/about.html">About</a>
      <a href="/privacy-policy.html">Privacy Policy</a>
    </nav>
  </div>
  <div class="footer-copy">© ${year} ${BLOG_NAME} · Independent global journalism ·
    <a href="/privacy-policy.html" style="color:rgba(255,255,255,.25)">Privacy</a>
  </div>
</footer>`;
}

// ── Card HTML ─────────────────────────────────────────────────────────────────
function postCard(post) {
  return `<a href="${esc(post.url)}" class="post-card">
  <img class="card-img" src="${esc(post.imageUrl || "")}" alt="${esc(post.title)}" loading="lazy" onerror="this.style.background='#e0e0e0';this.removeAttribute('src')">
  <div class="card-body">
    <div class="card-cat">${esc(post.category)}</div>
    <div class="card-title">${esc(post.title)}</div>
    <div class="card-sub">${esc(post.subtitle || post.metaDescription || "")}</div>
    <div class="card-meta">
      <time>${esc(post.dateStr)}</time>
      <span class="card-sep">·</span>
      <span>${post.readingTime || 9} min read</span>
    </div>
  </div>
</a>`;
}

// ── Build index.html ──────────────────────────────────────────────────────────
function buildIndex(posts) {
  const year = new Date().getFullYear();
  const latest = posts[0];
  const featOgImg = latest ? latest.imageUrl : "";

  // Hero: latest post
  const heroHtml = latest
    ? `
<section style="background:var(--navy);margin-bottom:0">
  <div style="position:relative;height:520px;overflow:hidden;background:#111">
    <img src="${esc(latest.imageUrl || "")}" alt="${esc(latest.title)}" style="width:100%;height:100%;object-fit:cover;opacity:.55" loading="eager" onerror="this.style.background='#111';this.removeAttribute('src')">
    <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.1) 55%,transparent 100%);display:flex;align-items:flex-end">
      <div style="max-width:780px;margin:0 auto;width:100%;padding:0 20px 44px">
        <span style="display:inline-block;background:var(--red);color:#fff;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;padding:4px 11px;border-radius:3px;margin-bottom:14px">${esc(latest.category)}</span>
        <h2 style="font-family:var(--serif);font-size:clamp(1.6rem,3.8vw,2.6rem);font-weight:900;color:#fff;line-height:1.22;margin-bottom:12px">
          <a href="${esc(latest.url)}" style="color:inherit;text-decoration:none">${esc(latest.title)}</a>
        </h2>
        <p style="font-size:1.05rem;color:rgba(255,255,255,.8);line-height:1.55;margin-bottom:18px;max-width:560px">${esc(latest.subtitle || latest.metaDescription || "")}</p>
        <div style="display:flex;align-items:center;gap:10px;font-size:.8rem;color:rgba(255,255,255,.6)">
          <time>${esc(latest.dateStr)}</time>
          <span>·</span>
          <span>${latest.readingTime || 9} min read</span>
          <a href="${esc(latest.url)}" style="margin-left:8px;background:var(--red);color:#fff;padding:7px 18px;border-radius:5px;text-decoration:none;font-weight:600;font-size:.82rem">Read More →</a>
        </div>
      </div>
    </div>
  </div>
</section>`
    : `
<section style="background:var(--navy);padding:80px 20px;text-align:center;color:#fff">
  <h1 style="font-family:var(--serif);font-size:2.2rem;margin-bottom:14px">The Global Brief</h1>
  <p style="font-size:1.1rem;color:rgba(255,255,255,.7);max-width:500px;margin:0 auto">${BLOG_TAGLINE}</p>
  <p style="margin-top:28px;font-size:.9rem;color:rgba(255,255,255,.45)">First article coming soon. Configure your API keys and run the generator.</p>
</section>`;

  // Recent grid (skip latest, show next 6)
  const recentPosts = posts.slice(1, 7);
  const recentGrid = recentPosts.length
    ? `
<section style="padding:48px 0">
  <div class="container">
    <div class="section-head"><h2>Latest Stories</h2><a href="/politics.html">View All →</a></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px">
      ${recentPosts.map(postCard).join("\n      ")}
    </div>
  </div>
</section>`
    : "";

  // Top ad
  const topAd = `
<div class="container">
  <div class="ad-unit">
    <p class="ad-label">Advertisement</p>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>
</div>`;

  // Politics section
  const politicsPosts = posts
    .filter((p) => p.category === "politics")
    .slice(0, 3);
  const politicsSection = politicsPosts.length
    ? `
<section style="padding:44px 0;background:var(--card);border-top:1px solid var(--border)">
  <div class="container">
    <div class="section-head"><h2>🏛 Politics</h2><a href="/politics.html">More Politics →</a></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${politicsPosts.map(postCard).join("\n      ")}
    </div>
  </div>
</section>`
    : "";

  // Mid ad
  const midAd = `
<div class="container">
  <div class="ad-unit">
    <p class="ad-label">Advertisement</p>
    <ins class="adsbygoogle" style="display:block;text-align:center" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="${ADS_CLIENT}" data-ad-slot=""></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>
</div>`;

  // Economy section
  const economyPosts = posts
    .filter((p) => p.category === "economy")
    .slice(0, 3);
  const economySection = economyPosts.length
    ? `
<section style="padding:44px 0">
  <div class="container">
    <div class="section-head"><h2>📈 Economy</h2><a href="/economy.html">More Economy →</a></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${economyPosts.map(postCard).join("\n      ")}
    </div>
  </div>
</section>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
${sharedHead(`${BLOG_NAME} | ${BLOG_TAGLINE}`, "In-depth analysis of global politics and economics — in English and Korean. Published twice daily.", BLOG_BASE_URL, featOgImg, websiteSchema())}
<body>
${sharedHeader()}
${heroHtml}
${topAd}
${recentGrid}
${politicsSection}
${midAd}
${economySection}
${sharedFooter(year)}
</body>
</html>`;

  fs.writeFileSync(path.join(PUBLIC, "index.html"), html, "utf8");
  console.log("✅  index.html built");
}

// ── Build category page ───────────────────────────────────────────────────────
function breadcrumbSchema(category, catLabelPlain) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BLOG_BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: catLabelPlain,
        item: `${BLOG_BASE_URL}/${category}.html`,
      },
    ],
  });
}

function buildCategory(category, posts) {
  const year = new Date().getFullYear();
  const catLabel = category === "politics" ? "🏛 Politics" : "📈 Economy";
  const catLabelPlain = category === "politics" ? "Politics" : "Economy";
  const catDesc =
    category === "politics"
      ? "In-depth analysis of global political developments, geopolitics, elections, and diplomacy."
      : "Expert coverage of global markets, central banks, trade, technology, and economic trends.";
  const filteredPosts = posts.filter((p) => p.category === category);
  const title = `${catLabel} | ${BLOG_NAME}`;

  // Combine WebSite + BreadcrumbList schemas
  const combinedSchema = JSON.stringify([
    JSON.parse(websiteSchema()),
    JSON.parse(breadcrumbSchema(category, catLabelPlain)),
  ]);

  const gridHtml = filteredPosts.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px">
      ${filteredPosts.map(postCard).join("\n      ")}
    </div>`
    : `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
      <p style="font-size:1.1rem;margin-bottom:8px">No articles yet</p>
      <p style="font-size:.9rem">New stories will appear here when the generator runs.</p>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
${sharedHead(title, catDesc, `${BLOG_BASE_URL}/${category}.html`, filteredPosts[0]?.imageUrl || "", combinedSchema)}
<body>
${sharedHeader(category)}
<!-- Category hero -->
<div style="background:var(--navy);padding:48px 20px;text-align:center">
  <div style="max-width:600px;margin:0 auto">
    <h1 style="font-family:'Merriweather',serif;font-size:clamp(1.8rem,4vw,2.6rem);font-weight:900;color:#fff;margin-bottom:12px">${catLabel}</h1>
    <p style="font-size:1rem;color:rgba(255,255,255,.7);line-height:1.6">${catDesc}</p>
  </div>
</div>
<!-- Ad -->
<div class="container">
  <div class="ad-unit">
    <p class="ad-label">Advertisement</p>
    <ins class="adsbygoogle" style="display:block" data-ad-client="${ADS_CLIENT}" data-ad-slot="" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>
</div>
<!-- Posts -->
<section style="padding:36px 0 60px">
  <div class="container">
    ${gridHtml}
  </div>
</section>
${sharedFooter(year)}
</body>
</html>`;

  fs.writeFileSync(path.join(PUBLIC, `${category}.html`), html, "utf8");
  console.log(`✅  ${category}.html built (${filteredPosts.length} posts)`);
}

// ── Build sitemap.xml ─────────────────────────────────────────────────────────
function buildSitemap(posts) {
  const now = new Date().toISOString().split("T")[0];
  const staticPages = [
    { url: BLOG_BASE_URL, priority: "1.0", freq: "daily" },
    { url: `${BLOG_BASE_URL}/politics.html`, priority: "0.9", freq: "daily" },
    { url: `${BLOG_BASE_URL}/economy.html`, priority: "0.9", freq: "daily" },
    { url: `${BLOG_BASE_URL}/about.html`, priority: "0.6", freq: "monthly" },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${staticPages
  .map(
    (p) => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join("\n")}
${posts
  .map(
    (p) => `  <url>
    <loc>${BLOG_BASE_URL}${p.url}</loc>
    <lastmod>${p.isoDate ? p.isoDate.split("T")[0] : now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <news:news>
      <news:publication>
        <news:name>${BLOG_NAME}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${p.isoDate || new Date().toISOString()}</news:publication_date>
      <news:title>${(p.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</news:title>
    </news:news>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  fs.writeFileSync(path.join(PUBLIC, "sitemap.xml"), xml, "utf8");
  console.log(
    `✅  sitemap.xml built (${posts.length + staticPages.length} URLs)`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log("\n🏗   The Global Brief — Page Builder");
  console.log("═".repeat(44));

  fs.mkdirSync(PUBLIC, { recursive: true });

  const posts = readPosts();
  console.log(`📚  Found ${posts.length} posts in data/posts.json`);

  buildIndex(posts);
  buildCategory("politics", posts);
  buildCategory("economy", posts);
  buildSitemap(posts);

  console.log("\n🎉  All pages built successfully!\n");
}

main();
