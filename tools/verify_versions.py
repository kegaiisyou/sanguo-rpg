# -*- coding: utf-8 -*-
"""
校验「版本号四源一致」+ bundle 已重建。
这是防止两个历史坑的低成本门禁：
  (A) constants.js / bundle.py / index.html 的 ?v 没对齐
  (B) 改了源码却忘了跑 bundle.py（bundle 里搜不到当前版本号）
用法： python tools/verify_versions.py
退出码：0 通过 / 1 有问题
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(p):
    with io.open(os.path.join(ROOT, p), encoding='utf-8', errors='ignore') as f:
        return f.read()


errors, ok = [], []

# 1) constants.js
const = read('shared/config/constants.js')
m = re.search(r"VERSION\s*[:=]\s*['\"]([^'\"]+)['\"]", const)
const_ver = m.group(1) if m else None
if not const_ver:
    errors.append('constants.js: 未找到 VERSION')
else:
    ok.append('constants.js        = %s' % const_ver)

# 2) bundle.py（硬编码行）
bp = read('tools/bundle.py')
m = re.search(r"^VERSION\s*=\s*['\"]([^'\"]+)['\"]", bp, re.M)
bundle_py_ver = m.group(1) if m else None
if not bundle_py_ver:
    errors.append('bundle.py: 未找到 VERSION 硬编码行')
else:
    ok.append('bundle.py           = %s' % bundle_py_ver)

# 3) index.html 的两个 ?v
ih = read('index.html')
m = re.search(r'bundle\.js\?v=([^"\'&]+)', ih)
html_bundle = m.group(1) if m else None
m = re.search(r'game\.css\?v=([^"\'&]+)', ih)
html_css = m.group(1) if m else None
ok.append('index.html bundle.js?v = %s' % html_bundle)
ok.append('index.html game.css?v  = %s' % html_css)

# 4) bundle.js 是否包含当前版本（判断是否重建过）
bundle = read('shared/bundle.js')
bundle_has = bool(const_ver) and (const_ver in bundle)
ok.append('bundle.js 含版本号 %s : %s' % (const_ver, bundle_has))

# ---- 交叉校验 ----
if const_ver and bundle_py_ver and const_ver != bundle_py_ver:
    errors.append('constants(%s) != bundle.py(%s)' % (const_ver, bundle_py_ver))
if const_ver and html_bundle and const_ver != html_bundle:
    errors.append('constants(%s) != index bundle?v(%s)' % (const_ver, html_bundle))
if const_ver and html_css and const_ver != html_css:
    errors.append('constants(%s) != index game.css?v(%s)' % (const_ver, html_css))
if not bundle_has:
    errors.append('bundle.js 里搜不到版本号 %s —— 八成是没跑 bundle.py 重建' % const_ver)

print('--- 当前状态 ---')
for o in ok:
    print('  ' + o)
print('--- 结论 ---')
if errors:
    print('FAIL：%d 个问题' % len(errors))
    for e in errors:
        print('  - ' + e)
    sys.exit(1)
else:
    print('PASS：四源一致（%s），bundle 已重建' % const_ver)
    sys.exit(0)
