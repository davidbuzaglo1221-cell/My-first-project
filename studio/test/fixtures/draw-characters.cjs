const { chromium } = require('playwright');
const page = (body) => `<html><body style="margin:0;width:768px;height:1024px;background:radial-gradient(70% 55% at 50% 42%, #3b1f6b 0%, #120b1f 60%, #07060a 100%)">${body}</body></html>`;
const eyes = (cx, cy, s=1) => `<g transform="translate(${cx},${cy}) scale(${s})"><ellipse cx="-48" cy="0" rx="34" ry="42" fill="#fff"/><ellipse cx="48" cy="0" rx="34" ry="42" fill="#fff"/><circle cx="-40" cy="8" r="18" fill="#1a1020"/><circle cx="56" cy="8" r="18" fill="#1a1020"/><circle cx="-34" cy="0" r="6" fill="#fff"/><circle cx="62" cy="0" r="6" fill="#fff"/></g>`;
const tomato = page(`<svg width="768" height="1024" viewBox="0 0 768 1024"><defs><radialGradient id="t" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ff7a6b"/><stop offset=".45" stop-color="#e5281e"/><stop offset="1" stop-color="#7a0b0b"/></radialGradient><radialGradient id="sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="384" cy="905" rx="230" ry="38" fill="url(#sh)"/>
<path d="M300 790 q-10 70 -40 100 M468 790 q10 70 40 100" stroke="#2b7a2b" stroke-width="22" stroke-linecap="round" fill="none"/>
<ellipse cx="384" cy="560" rx="270" ry="250" fill="url(#t)"/>
<ellipse cx="300" cy="420" rx="70" ry="38" fill="#fff" opacity=".28" transform="rotate(-25 300 420)"/>
<path d="M384 320 l-70 -40 60 10 10 -60 20 60 60 -20 -50 50z" fill="#3aa83a" stroke="#1f6b1f" stroke-width="6" stroke-linejoin="round"/>
<path d="M384 300 q10 -50 40 -70" stroke="#1f6b1f" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M290 470 q50 -30 80 0 M398 470 q50 -30 80 0" stroke="#4a0505" stroke-width="12" fill="none" stroke-linecap="round"/>
${eyes(384,540,1)}
<path d="M320 650 q64 50 128 0" stroke="#4a0505" stroke-width="12" fill="#8a1010" stroke-linecap="round"/>
<path d="M120 560 q-40 -60 -10 -120 M648 560 q50 -40 40 -110" stroke="#c51d14" stroke-width="26" stroke-linecap="round" fill="none"/>
</svg>`);
const cucumber = page(`<svg width="768" height="1024" viewBox="0 0 768 1024"><defs><linearGradient id="c" x1="0" x2="1"><stop offset="0" stop-color="#174d1d"/><stop offset=".35" stop-color="#3f9a3a"/><stop offset=".6" stop-color="#2d7a2c"/><stop offset="1" stop-color="#0f3512"/></linearGradient><radialGradient id="sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="384" cy="935" rx="170" ry="30" fill="url(#sh)"/>
<path d="M330 860 q-6 50 -30 70 M438 860 q6 50 30 70" stroke="#1f5c22" stroke-width="20" stroke-linecap="round" fill="none"/>
<rect x="250" y="130" width="268" height="760" rx="134" fill="url(#c)"/>
<g fill="#9ad38f" opacity=".55"><circle cx="300" cy="260" r="7"/><circle cx="460" cy="320" r="7"/><circle cx="290" cy="560" r="7"/><circle cx="470" cy="640" r="7"/><circle cx="320" cy="780" r="7"/><circle cx="450" cy="820" r="7"/><circle cx="460" cy="200" r="6"/></g>
<rect x="296" y="180" width="30" height="300" rx="15" fill="#fff" opacity=".18"/>
<path d="M300 330 q40 20 70 0 M398 330 q40 -20 70 0" stroke="#0b2a0d" stroke-width="11" fill="none" stroke-linecap="round"/>
<g transform="translate(384,390) scale(.82)"><ellipse cx="-48" cy="0" rx="34" ry="30" fill="#fff"/><ellipse cx="48" cy="0" rx="34" ry="30" fill="#fff"/><circle cx="-44" cy="10" r="16" fill="#120b14"/><circle cx="52" cy="10" r="16" fill="#120b14"/><rect x="-86" y="-30" width="76" height="22" fill="#2d7a2c"/><rect x="10" y="-30" width="76" height="22" fill="#2d7a2c"/></g>
<path d="M338 480 q46 22 92 -6" stroke="#0b2a0d" stroke-width="11" fill="none" stroke-linecap="round"/>
<path d="M252 520 q-70 30 -80 110 M516 520 q70 -10 90 -90" stroke="#2d7a2c" stroke-width="24" stroke-linecap="round" fill="none"/>
</svg>`);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:768,height:1024}});
for (const [n,h] of [['tomato',tomato],['cucumber',cucumber]]){await p.setContent(h);await p.screenshot({path:n+'.png'});}
await b.close();})();
