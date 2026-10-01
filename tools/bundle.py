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
VERSION = '20261001c'

def read(p): return io.open(p, 'r', encoding='utf-8', newline='').read().replace('\r\n', '\n')
def write(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

SRC_RE = re.compile(r'<script src="(shared/[^"]+?\.js)\?v=[^"]*"[^>]*></script>')

def extract_from_index():
    return [m.group(1) for m in SRC_RE.finditer(read(INDEX))]

def find_terser():
    """探测可用 terser 模块路径：npm 全局 / 项目 tools/node_modules / 常见全局目录。"""
    import shutil
    cands = [
        'terser',
        os.path.expanduser('~/.npm-global/lib/node_modules/terser'),
        os.path.expanduser('~/terser/node_modules/terser'),
        '/tmp/node_modules/terser',
        '/usr/local/lib/node_modules/terser',
        os.path.join(WS, 'tools', 'node_modules', 'terser'),
    ]
    for c in cands:
        try:
            if c == 'terser':
                if shutil.which('terser'):
                    return 'terser'
                # npm 全局 require 也常可用
                r = subprocess.run(['node', '-e', "require('terser');console.log('ok')"],
                                   capture_output=True, text=True)
                if r.returncode == 0 and 'ok' in r.stdout:
                    return 'terser'
                continue
            if os.path.isdir(c) and os.path.exists(os.path.join(c, 'package.json')):
                r = subprocess.run(['node', '-e', "require('" + c + "');console.log('ok')"],
                                   capture_output=True, text=True)
                if r.returncode == 0 and 'ok' in r.stdout:
                    return c
        except Exception:
            continue
    return None

def build_manifest(from_index=False):
    if from_index or not os.path.exists(MANIFEST):
        srcs = [s for s in extract_from_index() if not s.endswith('bundle.js')]
        assert srcs, 'index.html 中找不到任何 shared/*.js 脚本标签'
        write(MANIFEST, '\n'.join(srcs) + '\n')
        print('manifest: 引导/同步了 %d 个源文件' % len(srcs))
        return srcs
    return [l.strip() for l in read(MANIFEST).splitlines() if l.strip()]

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
    write(BUNDLE, bundle)

    # 1.5) terser 压缩（v20260928h · 首屏提速）：纯拼接 1.7MB 手机下载/解析慢，
    #       terser 后体积约减半。多路径探测，找不到 terser 则保留原文并警告（不阻断构建）。
    terser_path = find_terser()
    if terser_path:
        comp = r'''
const fs=require('fs');
const t=require(process.argv[2]);
const src=fs.readFileSync(0,'utf8');
t.minify(src,{compress:{passes:2},mangle:true,format:{comments:false}}).then(r=>{
  process.stdout.write(r.code);
}).catch(e=>{ console.error('TERSER_FAIL:'+e.message); process.exit(2); });
'''
        comp_js = os.path.join(WS, 'tools', '.terser_run.js')
        write(comp_js, comp)
        try:
            raw_size = len(bundle)
            r = subprocess.run(['node', comp_js, terser_path], input=bundle.encode('utf-8'),
                               capture_output=True, timeout=180)
            if r.returncode == 0 and r.stdout:
                bundle = r.stdout.decode('utf-8')
                write(BUNDLE, bundle)
                print('bundle.js: %d 文件, %d → %d 字节（terser 压缩 -%.1f%%）' % (
                    len(srcs), raw_size, len(bundle), 100.0 * (1 - len(bundle) / float(raw_size))))
            else:
                print('WARN terser 压缩失败，保留原文：' + r.stderr.decode('utf-8', 'ignore')[:300])
        finally:
            try: os.remove(comp_js)
            except Exception: pass
    else:
        print('WARN 未找到 terser，bundle 保持未压缩（体积约 1.7MB，首屏加载偏慢）。可 npm i -g terser 后重建。')

    print('bundle.js: 最终 %d 字节' % len(bundle))

    # 2) 语法 + 顶层 let/const 冲突校验
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
    s = re.sub(r'\s*<script src="shared/bundle\.js\?v=[^"]*"></script>', '', s)  # 去旧 bundle
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
