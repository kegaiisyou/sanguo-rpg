# 03 · GitHub 与发布

> 最后核验：2026-10-29

---

## 一、仓库信息

| 项 | 值 |
|---|---|
| 仓库 | `kegaiisyou/sanguo-rpg` |
| remote | `git@github.com:kegaiisyou/sanguo-rpg.git`（**SSH**） |
| 主分支 | `main` |
| 保护情况 | 未见分支保护规则配置；另有历史分支 `backup-pre-split` |
| 线上地址 | https://kegaiisyou.github.io/sanguo-rpg/ |
| Pages 配置 | 仓库根目录有 `.nojekyll`，Pages 直接发布静态文件 |

---

## 二、权限状态（2026-10-29 实测）

| 能力 | 状态 | 依据 |
|---|---|---|
| SSH 连通 / 读权限 | ✅ **已验证** | `git ls-remote origin HEAD` 成功返回远端 HEAD 哈希 |
| 写权限（push） | ⚠️ **未实测** | 本会话未执行过 push。同一 SSH key 且仓库归属同名账号，预期可写，**但未经实际推送验证** |

> 若后续 push 失败，先确认本机 SSH agent 是否加载了对应 key：`ssh -T git@github.com`。
>
> **注意**：本机 HTTPS 直连 github.com **不通**（超时），所以必须走 SSH。不要把 remote 改成 HTTPS。

---

## 三、发布流程（改一版并上线）

```bash
# 1) 改代码后重建 bundle（跑两次）
python tools/bundle.py && python tools/bundle.py

# 2) 对齐版本号三处（见 02 文档）
#    constants.js / tools/bundle.py / index.html 的 ?v=

# 3) 校验
node --check shared/bundle.js
node test/syntax_check_all.js
node test/cross_reference_check.js

# 4) 浏览器实测（0 pageerror）后再提交

# 5) 提交
git status                      # 确认没有把临时脚本/截图混进来
git add -A
git commit -m "简述：改了什么 + 版本号"

# 6) 推送 → Pages 自动更新
git push origin main
```

### ⚠️ 提交前务必确认这几件事

- `-- 不要把临时文件提交进来 --`：仓库历史上曾累积了上百个调试截图（`*.png`）与临时脚本（`*_test.py` / `*.pwtest/`）。
  已于 **2026-10-29 清理**；若 `.gitignore` 未覆盖，新增垃圾前先补规则。
- `shared/bundle.js` **必须一起提交**（它是产物，属于版本库的一部分）。
- 确认 `index.html` 的 `?v=` 与本版一致，否则用户端拿缓存，改了看不见。

---

## 四、上线后的缓存问题

`index.html` 已含 no-cache 元标记，但 **GitHub Pages 的 CDN 仍可能短暂缓存**（数分钟级）。

- 版本号是排查线上是否生效的**唯一可靠依据**：标题页 `.tt-ver` / 状态栏 `.st-ver` 显示的就是 `LF.CONSTANTS.VERSION`。
- 若玩家端显示旧版本号 → 硬刷新；持续不更新再去查 CDN。

---

## 五、回滚

当前如需回退版本号 ∨ 产物，用 git 常规手段：

```bash
git log --oneline -10        # 找到目标 commit
git revert <commit>          # 推荐：生成反向提交，保留历史
```

历史上多次用 `git checkout -- <file>` 从 HEAD 重派生受损文件（如被脚本破坏的 `constants.js`）。
**注意**：`git checkout --` 会丢弃工作区改动，执行前确认没有未保存的编辑。
