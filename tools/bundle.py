# -*- coding: utf-8 -*-
"""
tools/bundle.py  —  把 index.html 里 75 个 <script src="shared/...?v="> 合并成一个 shared/bundle.js
（少一次冷加载 75 个 HTTP 请求 → 1 个），用于 GitHub Pages 部署。

用法：
  python tools/bundle.py            # 读 tools/bundle.manifest（首次自动从 index.html 引导生成）→ 产出 bundle.js → 改写 index.html
  python tools/bundle.py --check    # 只校验/重建 manifest 与 bundle，不碰 index.html
  python tools/bundle.py --from-index  # 重新从 index.html 的 <script src> 标签同步 manifest（新增模块后）

约定：
  - manifest 是「合并顺序的唯一真相源」；源文件仍留在 shared/ 下，供编辑与重建。
  - 合并顺序 = manifest 行序 = 原 index.html 标签序，保证各模块顶层 global（LF 等）与执行次序不变。
  - d3 等 vendor 走 __MAP_ASSETS 懒加载字符串，不在标签里，故不会被并入 bundle（保留懒加载优化）。
"""
import io, os, re, subprocess, sys

WS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(WS, 'tools', 'bundle.manifest')
INDEX = os.path.join(WS, 'index.html')
BUNDLE = os.path.join(WS, 'shared', 'bundle.js')
CONSTANTS = os.path.join(WS, 'shared', 'config', 'constants.js')
VERSION = '20260928d'

def read(p): return io.open(p, 'r', encoding='utf-8', newline='').read().replace('\r\n', '\n')
def write(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

SRC_RE = re.compile(r'<script src="(shared/[^"]+?\.js)\?v=[^"]*"[^>]*></script>')

def extract_from_index():
    return [m.group(1) for m in SRC_RE.finditer(read(INDEX))]

def build_manifest(from_index=False):
    if from_index or not os.path.exists(MANIFEST):
        srcs = [s for s in extract_from_index() if not s.endswith('bundle.js')]
        assert srcs, 'index.html 中找不到任何 shared/*.js 脚本标签'
        write(MANIFEST, '\n'.join(srcs) + '\n')
        print('manifest: 引导/同步了 %d 个源文件' % len(srcs))
        return srcs
    return [l.strip() for l in read(MANIFEST).splitlines() if l.strip()]

def minify_bundle(src):
    """P0-①：用 terser 压缩 bundle（去注释/空白/局部变量名）；失败则原样返回，保证构建不中断。"""
    try:
        node_src = (
            "const fs=require('fs');\n"
            "const terser=require('terser');\n"
            "const src=fs.readFileSync(process.argv[2],'utf8');\n"
            "terser.minify(src,{compress:{passes:2},mangle:true,format:{comments:/bundle\\.py|版本/}})\n"
            " .then(function(r){ if(r.error){console.error('TERSER_ERR '+String(r.error));process.exit(2);} fs.writeFileSync(process.argv[3], r.code); })\n"
            " .catch(function(e){ console.error('TERSER_FAIL '+String(e)); process.exit(3); });\n"
        )
        tmp = os.path.join(WS, 'tools', '_terser_min.js')
        write(tmp, node_src)
        raw = os.path.join(WS, 'tools', '_bundle_raw.js')
        write(raw, src)
        out = os.path.join(WS, 'tools', '_bundle_min.js')
        r = subprocess.run(['node', tmp, raw, out], capture_output=True, text=True)
        for f in (tmp, raw):
            try: os.remove(f)
            except OSError: pass
        if r.returncode != 0:
            print('  [warn] terser 压缩失败，保留未压缩版本（不影响功能）:', r.stderr.strip()[-300:])
            try: os.remove(out)
            except OSError: pass
            return src
        minified = read(out)
        try: os.remove(out)
        except OSError: pass
        return minified
    except Exception as e:
        print('  [warn] terser 不可用，跳过压缩（不影响功能）:', e)
        return src

def main():
    from_index = '--from-index' in sys.argv
    check_only = '--check' in sys.argv
    srcs = build_manifest(from_index=from_index)

    # 0) 安全性预检：ES module 语法会破坏经典脚本拼接
    bad = []
    for rel in srcs:
        fp = os.path.join(WS, rel)
        if not os.path.exists(fp):
            print('MISSING: ' + rel); sys.exit(1)
        txt = read(fp)
        if re.search(r'(?:^|\n)\s*(?:import\s|export\s|export\s*default)', txt):
            bad.append(rel)
    if bad:
        print('ES-module 语法，不能并入经典 bundle：', bad); sys.exit(1)

    # 1) 拼接
    parts = []
    for rel in srcs:
        txt = read(os.path.join(WS, rel))
        parts.append('// ============ %s ============\n' % rel + txt)
    header = '// 自动生成 bundle（tools/bundle.py）。请勿手改；改 shared/ 后重跑本脚本。\n' \
             '// 源文件数: %d   版本: %s\n' % (len(srcs), VERSION)
    bundle = header + '\n;\n'.join(parts) + '\n'
    raw_size = len(bundle)
    bundle = minify_bundle(bundle)          # P0-① terser 压缩（失败则保留未压缩版）
    write(BUNDLE, bundle)
    print('bundle.js: %d 文件, %d → %d 字节（terser 压缩）' % (len(srcs), raw_size, len(bundle)))

    # 2) 语法 + 顶层 let/const 冲突校验（对压缩后文件）
    r = subprocess.run(['node', '--check', BUNDLE], capture_output=True, text=True)
    if r.returncode != 0:
        print('node --check 失败（多半是跨文件顶层 let/const 重名）：\n' + r.stderr)
        sys.exit(1)
    print('node --check OK（无语法/顶层词法冲突）')

    if check_only:
        return

    # 3) bump VERSION（constants.js）—— 安全写法，无 backreference
    cs = read(CONSTANTS)
    cs2 = re.sub(r"VERSION:\s*'[^']*'", "VERSION: '%s'" % VERSION, cs, count=1)
    if cs2 != cs:
        write(CONSTANTS, cs2)
        print('constants.js VERSION -> ' + VERSION)
    else:
        print('constants.js VERSION 已是 ' + VERSION + '（跳过）')

    # 4) 改写 index.html：删掉 75 个独立标签，插入单 bundle 标签（放在 __MAP_ASSETS 内联脚本之后）
    s = read(INDEX)
    s = SRC_RE.sub('', s)                                   # 去独立 src 标签
    s = re.sub(r'\s*<script src="shared/bundle\.js\?v=[^"]*"[^>]*></script>', '', s)  # 去旧 bundle（含 defer 属性）
    tag = '<script src="shared/bundle.js?v=%s" defer></script>' % VERSION
    m = re.search(r'(window\.__MAP_ASSETS\s*=\s*\{.*?</script>)', s, re.S)
    if m:
        s = s[:m.end()] + '\n' + tag + s[m.end():]
    else:
        s = s.replace('</body>', tag + '\n</body>')
    write(INDEX, s)
    print('index.html: 已替换为单 bundle 标签 (?v=%s)' % VERSION)
    print('DONE')

if __name__ == '__main__':
    main()
