# Rebuilds docs/signavio/view.html from the two .bpmn files. Run from the repo root: python scripts/signavio-view.py
import json
b = open('docs/signavio/frontline-shift-before.bpmn', encoding='utf8').read()
a = open('docs/signavio/frontline-shift-after.bpmn', encoding='utf8').read()
html = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signavio models</title>
<!-- Opens the two BPMN files without Signavio. Regenerate after changing a .bpmn file: the models are copied in. -->
<link rel="stylesheet" href="https://unpkg.com/bpmn-js@17.11.1/dist/assets/bpmn-js.css">
<style>body{font-family:sans-serif;margin:0;background:#fff;color:#111} h2{margin:12px 16px 4px} .c{height:440px;border-top:1px solid #ddd;border-bottom:1px solid #ddd}</style></head>
<body><h2>Before: how a better role gets filled today (assumed)</h2><div id="b" class="c"></div>
<h2>After: with Frontline Shift</h2><div id="a" class="c"></div>
<script src="https://unpkg.com/bpmn-js@17.11.1/dist/bpmn-navigated-viewer.production.min.js"></script>
<script>
window.warnings = {}
const show = async (id, xml) => {
  const v = new BpmnJS({ container: '#' + id })
  const { warnings } = await v.importXML(xml)
  window.warnings[id] = warnings.map(w => w.message)
  window[id + 'Viewer'] = v
  v.get('canvas').zoom('fit-viewport')
}
show('b', BEFORE); show('a', AFTER)
</script></body></html>"""
html = html.replace('BEFORE', json.dumps(b)).replace('AFTER', json.dumps(a))
open('docs/signavio/view.html', 'w', encoding='utf8').write(html)
print('ok')
