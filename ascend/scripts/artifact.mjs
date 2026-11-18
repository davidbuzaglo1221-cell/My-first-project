// Turns the single-file build into an artifact page (the host adds doctype/html/head/body).
import { readFileSync, writeFileSync } from 'node:fs'
const html = readFileSync('dist-single/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n')
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n')
const page = `<title>ASCEND</title>
<meta name="theme-color" content="#020504">
<style>:root{color-scheme:dark}html,body{background:#010302;color:#edf4f0}</style>
${styles}
<div id="root" lang="he" dir="rtl"></div>
<script>document.documentElement.lang='he';document.documentElement.dir='rtl'</script>
${scripts}
${body.replace(/<div id="root"><\/div>/, '')}`
writeFileSync('dist-single/ascend.html', page)
console.log('ascend.html', (page.length / 1024).toFixed(0), 'KB')
