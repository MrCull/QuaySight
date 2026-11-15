import json, sys
t = json.load(open(sys.argv[1]))
def block(theme, with_static):
    out = []
    for fam in ['color', 'shadow']:
        for tk in t[fam]['tokens']:
            v = tk['value']
            out.append(f"  --{tk['name']}: {v[theme] if isinstance(v, dict) else v};")
    if with_static:
        for fam in ['spacing', 'radius', 'size', 'duration']:
            for tk in t[fam]['tokens']:
                out.append(f"  --{tk['name']}: {tk['value']};")
        for k, v in t['type']['families'].items():
            out.append(f"  --font-{k}: {v};")
        # Each type style's size and line height, for components that set weight and family themselves.
        for g in t['type']['groups']:
            for s in g['styles']:
                out.append(f"  --type-{s['name']}-size: {s['fontSize']};")
                out.append(f"  --type-{s['name']}-line: {s['lineHeight']};")
    return '\n'.join(out)
print("/* Quay Sight tokens. Generated from tokens.json - edit that file, then run: python3 design-system/scripts/build-tokens.py design-system/tokens.json > design-system/tokens.css")
print("   Night quay is the app's default (it sets data-theme=\"dark\" on <html>); Daylight is the alternative and the fallback with no data-theme. */")
print(":root,\n:root[data-theme=\"light\"] {\n  color-scheme: light;\n" + block('light', True) + "\n}\n")
print(":root[data-theme=\"dark\"] {\n  color-scheme: dark;\n" + block('dark', False) + "\n}\n")
print("/* Type styles */")
for g in t['type']['groups']:
    for s in g['styles']:
        ls = f" letter-spacing: {s['letterSpacing']};" if s.get('letterSpacing') else ''
        tt = " text-transform: uppercase;" if s['name'] == 'label' else ''
        print(f".qs-type-{s['name']} {{ font: {s['fontWeight']} {s['fontSize']}/{s['lineHeight']} var(--font-{g['family']});{ls}{tt} }}")
