# dsh-workspace-switcher

把 DeepSeek Harness（DSH）侧栏那条**又长又难找**的工作区列表，变成**只显示当前工作区**。

## 效果

```
之前：                       之后：
[工作区A]                    [毕设·视觉对抗小车 ▾ 2] ◎
  [会话1]                    [📁 毕设·视觉对抗小车]
  [会话2]                      [会话1]
[工作区B]                      [会话2]
  [会话3]                    [📁 game]
[工作区C]                    [📁 AI-video]
  [会话4]
```

点顶部条 → 弹窗选择工作区（可搜索名称/路径）→ 只展开该工作区。

## 设计原则：非侵入

**不替换任何原生组件。** 只在原生列表上方插入一个自定义顶部条，
然后通过折叠非当前工作区的分组达到聚焦效果。

所以这些原生功能**全部保留**：

- ✅ 搜索会话
- ✅ 视图选项（分组方式/排序）
- ✅ 新建工作区
- ✅ 工作区右键菜单
- ✅ 会话右键菜单（重命名/归档/置顶）
- ✅ 拖拽排序
- ✅ 会话分组与折叠

## 安装

### 方式一：本地 tgz（推荐自用）

```bash
cd $DSH_HOME/profiles/web
npm install /path/to/dsh-workspace-switcher-2.3.0.tgz
```

然后在 `cordis.patch.yml` 里加：

```yaml
- insert:
    - id: dsh-workspace-switcher
      name: 'dsh-workspace-switcher'
      config:
        enabled: true
```

重启 DSH 生效。

### 方式二：直接拷贝（不用 npm）

```bash
# 解压 tgz
tar -xzf dsh-workspace-switcher-2.3.0.tgz

# 拷到 profile 的 node_modules
cp -r package $DSH_HOME/profiles/web/node_modules/dsh-workspace-switcher
```

同样需要在 `cordis.patch.yml` 注册。

### 方式三：npm（如果发布到 registry）

```bash
npm install dsh-workspace-switcher
```

### 验证安装成功

重启后侧栏「工作区」下方应该出现：

```
工作区              🔍 ⚙ ＋
┌──────────────────┐ ┌──┐
│ 当前工作区名  3 ▾ │ │ ＋ │
└──────────────────┘ └──┘
  会话 1
  会话 2
```

只显示当前工作区的会话。点选择器可切换，点 `＋` 在当前工作区新建会话。

---
## 配置

| 选项 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 是否启用 |

## 使用

| 操作 | 效果 |
|---|---|
| 点顶部条 | 打开工作区选择弹窗 |
| 弹窗里输入 | 搜索工作区 |
| 选一个工作区 | 切过去，只展开它 |
| 点右侧 ◎ | 关闭/开启聚焦模式 |

聚焦模式关掉后，就是原生行为（所有工作区都展开）。

## 兼容性

| 项 | 要求 |
|---|---|
| DSH | `>=0.2.1-rc.1 <0.3.0` |
| 测试版本 | `0.2.2-rc.3` |

依赖的 DOM 钩子（DSH 内部约定，可能随版本变化）：

```js
[data-sidebar-workspace-header]   // 侧栏工作区头部（搜索/排序/新建按钮所在）
[data-sidebar-list-area]          // 列表容器
[data-row-key="workspace:<id>"]   // 工作区行（靠 click 切换展开）
aria-expanded                     // 展开状态
```

## 调试

```js
window.__DSW__.state                 // 当前状态
window.__DSW__.refresh()             // 重新读取数据
window.__DSW__.pickWorkspace('w1')   // 切到某个工作区
window.__DSW__.applyFocus()          // 手动应用折叠
window.__DSW__.remount()             // 重新挂载顶部条
```


---

## ⚠️ 兼容性与已知限制（发布必读）

### 依赖 DSH 内部实现，**升级 DSH 后可能失效**

这不是官方接口，全靠 DOM 结构约定：

| 依赖项 | 用途 | 失效后果 |
|---|---|---|
| `[data-sidebar-workspace-header]` | 找标题栏位置 | 选择器不显示 |
| `[data-sidebar-list-area]` | 找列表容器 | 无法隐藏其他工作区 |
| `[data-row-key="workspace:*"]` | 识别工作区行 | 全部功能失效 |
| `[class*="groupSection"]` | 找分组容器 | 隐藏失效 |
| `localStorage['dsh.workspace.view.v5']` | 读/写展开状态 | 会话不显示 |

**测试版本：DSH `0.2.2-rc.3`**

### 失效时会发生什么

**不会崩溃，也不会破坏原生功能。** 插件会：

1. 在左下角弹出提示横幅：「工作区切换器未生效」
2. 列出具体缺了哪个 DOM 元素
3. 原生侧栏完全不受影响，照常使用

### 如何排查

在 DSH 页面 URL 后加 `?dws-debug=1`，然后打开控制台：

```js
window.__DSW_DIAG__()
```

输出：

```json
{
  "sessionServiceKeys": ["byId", "ids"],
  "sessionByIdSize": 4,
  "workspacesCount": 3,
  "currentWorkspaceId": "w3",
  "currentSessionId": "r1",
  "hasByIdInSnapshot": true
}
```

### 只在调试模式暴露的接口

正常使用时 `window.__DSW__` / `window.__DSW_DIAG__` **不存在**，
只有 URL 带 `?dws-debug=1` 才挂载，避免污染全局。

### 想临时关掉插件

在 `cordis.patch.yml` 里把 `enabled` 改成 `false`：

```yaml
- insert:
    - id: dsh-workspace-switcher
      name: 'dsh-workspace-switcher'
      config:
        enabled: false
```

### 不会做的事

- ❌ 不删除任何会话或文件
- ❌ 不修改原生侧栏的搜索/排序/新建功能
- ❌ 不改 DSH 的配置文件（除 `cordis.patch.yml` 注册外）

---

## 更新日志

### 2.3.0
- 环境自检：DOM 结构不匹配时显示可见提示横幅
- 调试接口（`window.__DSW__`）改为 `?dws-debug=1` 才暴露
- README 补充兼容性边界与排查方法


### 1.0.0（2026-11-20）正式版
- **键盘导航**：搜索框里 ↑↓ 选择、Enter 确认，自动高亮首项
- **重命名查重**：同名会提示「已经有同名工作区了」
- **右键菜单防越界**：右下角右键也能完整显示
- **性能优化**：MutationObserver 即时响应 + 1.2s 低频兜底（原来 200ms 盲扫）
- **当前工作区指示条**：左侧蓝条，一眼看出在哪
- **清理死代码**：删除 1.4KB 旧版样式 + findLabel/labelNode 空逻辑

### 0.9.0（2026-11-20）
- 弹窗里右键可**重命名 / 复制路径 / 删除工作区**
- 路径**完整显示**（不再截断，弹窗加宽到 720px）
- 删除有二次确认，明确提示「只取消注册，不删会话和文件」

### 0.8.0（2026-11-20）
- 选择器改为**独立一行**（放在「工作区」标题下方），避免展开后与标题重叠

### 0.7.0（2026-11-20）
- 右键重命名 + 完整路径

### 0.6.0（2026-11-20）
修复 11 个缺陷：

| # | 问题 | 影响 |
|---|---|---|
| 1 | 调 `row.click()` 污染持久化展开状态 | 卸载后工作区仍折叠 |
| 2 | 退出聚焦时不还原展开状态 | 同上 |
| 3 | 搜索时仍应用聚焦过滤 | 搜索结果被藏 |
| 4 | React 重渲染移除插入的节点 | 选择器消失 |
| 5 | 弹窗可重复打开 | 多个遮罩叠加 |
| 6 | 焦点用 setTimeout(0) | 偶尔不聚焦 |
| 7 | 诊断日志重复输出 | 控制台刷屏 |
| 8 | unmount 清理不完整 | 残留节点/样式 |
| 9 | findLabel 可能误选按钮区 | 隐藏错元素 |
| 10 | 会话计数只依赖服务 | 服务不可用时不准 |
| 11 | 无工作区时无提示 | 弹窗空白 |

## 与 v0.0.x 的区别

早期版本用 `slots.inject('sidebar.workspaces')` 替换整个插槽，
导致搜索、排序、新建工作区、右键菜单全部丢失。**现已改为非侵入式。**

## License

MIT