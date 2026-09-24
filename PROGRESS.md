## §9.83 v20260924z6（行囊丢弃按钮失效修复）
- 用户报"行囊丢弃按钮按了没反应"。定位根因：丢弃按钮的 disabled 是 renderPack 渲染时快照
  （`<button (canDiscard()?'':'disabled')>`），而点选物品时面板只更新高亮不重渲染 → 按钮永远停在初始禁用态。
- 修复：按钮去掉渲染时 disabled、始终可点；discardInspect 在未选中时 toast「先点选一件行囊物品，再丢弃。」
  作为明确反馈（此前禁用态无声无息，体验像 bug）。
- 实测：未选点丢弃→提示；选中点丢弃→物品消失+「已丢弃『干粮』。」；无报错。
- 改动：shared/core/pack.js（丢弃按钮 + discardInspect 提示）、版本号 20260924z6。
