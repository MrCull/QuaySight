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
    return '\n'.join(out)
print("/* Quay Sight tokens. Generated from tokens.json - edit that file, then run: python3 design-system/scripts/build-tokens.py design-system/tokens.json > design-system/tokens.css")
print("   Night quay (dark) is the default; set data-theme=\"light\" on <html> for Daylight. */")
print(":root,\n:root[data-theme=\"dark\"] {\n  color-scheme: dark;\n" + block('dark', True) + "\n}\n")
print(":root[data-theme=\"light\"] {\n  color-scheme: light;\n" + block('light', False) + "\n}\n")
print("/* Type styles */")
for g in t['type']['groups']:
    for s in g['styles']:
        ls = f" letter-spacing: {s['letterSpacing']};" if s.get('letterSpacing') else ''
        tt = " text-transform: uppercase;" if s['name'] == 'label' else ''
        print(f".qs-type-{s['name']} {{ font: {s['fontWeight']} {s['fontSize']}/{s['lineHeight']} var(--font-{g['family']});{ls}{tt} }}")
