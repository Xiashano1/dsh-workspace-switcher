# 维护指南

> 这个插件依赖 DSH 的内部实现，**不是官方 API**。DSH 升级后可能失效。
> 本文档列出全部依赖点，方便快速定位问题。

## 快速排查流程

### 第一步：打开调试模式

在 DSH 页面 URL 后加 `?dws-debug=1`，例如：

```
http://127.0.0.1:3083/?dws-debug=1
```

### 第二步：运行诊断

```js
window.__DSW_DIAG__()
```

输出示例：

```json
{
  "sessionServiceKeys": ["byId", "ids"],
  "sessionSnapshotType": "object",
  "sessionByIdSize": 4,
  "workspacesCount": 6,
  "currentWorkspaceId": "w3",
  "currentSessionId": "s1",
  "archivedSize": 0,
  "hasByIdInSnapshot": true,
  "snapshotPreview": "..."
}
```

### 第三步：对照下表定位

| 症状 | 检查项 | 修复方向 |
|---|---|---|
| 选择器不显示 | `data-sidebar-workspace-header` 是否存在 | 改 `mount()` 里的选择器 |
| 无法隐藏其他工作区 | `data-sidebar-list-area` + `data-row-key` | 改 `applyFocusMode()` |
| 会话数显示 0 | `sessionByIdSize` 是否 > 0 | DSH 的 session 服务结构变了 |
| 当前工作区不跟随 | `workspacesCount` / `currentSessionId` | 改 `detectCurrentWorkspaceFromDom()` |
| 切换后会话不显示 | `dsh.workspace.view.v5` | store key 版本号变了 |
| 分组不自动展开 | `aria-expanded` 属性 | 改 `ensureCurrentExpanded()` |

---

## 依赖清单

### 1. DOM 属性（最关键）

| 选择器 | 用途 | 用法位置 | 失效后果 |
|---|---|---|---|
| `[data-sidebar-workspace-header]` | 定位侧栏「工作区」标题栏，插入我们的选择器 | `mount()` L1620 | **选择器完全不显示** |
| `[data-sidebar-list-area]` | 定位会话列表容器 | `refresh()` L516 | 无法判断列表是否渲染完成 |
| `[data-row-key^="workspace:"]` | 识别工作区行 | `applyFocusMode()` L386 等 9 处 | **全部功能失效** |
| `[data-row-key^="session:"]` | 统计分组内会话数 | `countSessions()` L398 | 会话数显示错误 |
| `[data-row-key^="search:"]` | 检测是否在搜索状态 | `isSearching()` | 搜索时不隐藏分组（可能与搜索冲突） |

**行 key 格式**：

```
workspace:<workspaceId>    例如 workspace:w1
session:<sessionId>        例如 session:s1
```

### 2. CSS 类名（CSS Module 哈希）

| 选择器 | 用途 | 失效后果 |
|---|---|---|
| `[class*="groupSection"]` | 定位分组容器（要隐藏它） | 无法隐藏非当前工作区 |
| `[class*="folderActive"]` | 检测当前工作区（图标高亮） | 无法从 DOM 反推当前工作区 |
| `[class*="searchResult"]` | 区分搜索结果行 | 搜索结果处理异常 |

**注意**：DSH 用 CSS Modules，类名会带哈希（如 `groupSection_a1b2c`），所以用 `class*=` 而非 `=`。

### 3. localStorage key

| Key | 用途 | 读取内容 | 失效后果 |
|---|---|---|---|
| `dsh.sessions.current` | 当前会话 | `{sessionId, workspaceId}` | 刷新时无法恢复选择 |
| `dsh.workspace.view.v5` | 分组展开状态 | `.groupExpansion[key]` | **切换工作区后会话不显示** |

**`dsh.workspace.view.v5` 的 `v5` 是版本号**，DSH 升级时可能变成 `v6`。

代码位置：`forceExpandInStore()` L571。

**兼容写法**（如果版本号变化）：

```js
// 扫描所有可能的 key
function findViewStoreKey() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('dsh.workspace.view.')) return k;
  }
  return 'dsh.workspace.view.v5';
}
```

### 4. `aria-expanded` 属性

工作区行上的展开状态：

```js
row.getAttribute('aria-expanded') === 'true'   // 已展开
```

用途：
- `detectCurrentWorkspaceFromDom()` — 唯一展开的分组就是当前工作区
- `ensureCurrentExpanded()` — 检查并点击展开

### 5. DSH 服务 API

通过 `ctx.get('workspaces')` 获取：

```js
{
  list: {
    getSnapshot(): { items: WorkspaceView[], archivedSessionIds: string[] },
    subscribe(cb): () => void
  },
  rename(workspaceId, title): Promise<void>,
  delete(workspaceId): Promise<void>,
  insertBefore(workspaceId, beforeWorkspaceId?): Promise<void>  // 排序
}
```

**`WorkspaceView` 结构**：

```ts
{
  workspaceId: string,
  path: string,
  title: string,
  sessionIds: string[],
  createdAt: number,
  updatedAt: number
}
```

### 6. 会话可见性规则（从 DSH 源码复刻）

`countSessions()` 里的过滤逻辑，对应 DSH 的 `sessionVisible`：

```js
// 以下任一条件 → 不计入
session.origin === 'subagent'                    // 子代理会话
session.blank && session.id !== currentSession   // 非当前的空会话
archivedSessionIds.has(session.id)               // 已归档
```

**如果 DSH 改了可见性规则，计数会不准。**

位置：`countSessions()` L417 附近。

### 7. `uiWorkspace` 导航 API

```js
ctx.uiWorkspace.openSession(sessionId)        // 切到指定会话（不创建新的）
ctx.uiWorkspace.openWorkspace(workspaceId)    // 打开/创建空白会话
ctx.uiWorkspace.startSession(workspaceId)     // 创建或复用空白会话
```

**重要**：DSH 的 `openWorkspace` **内部必然调用 `connectBlank`**，所以会跳到空白会话。

我们优先用 `openSession` 打开已有会话，只有工作区没有会话时才用 `openWorkspace`。

---

## 版本对应表

| 插件版本 | 测试的 DSH 版本 | 变更 |
|---|---|---|
| 2.6.0 | 0.2.2-rc.3 | 拖拽物理换位，去掉指示线 |
| 2.5.0 | 0.2.2-rc.3 | 拖拽改用 Pointer Events |
| 2.3.0 | 0.2.2-rc.3 | 首个公开版本 |

**升级 DSH 后请重新验证这三项：**

1. 选择器是否显示
2. 切换工作区后会话是否显示
3. 拖拽排序是否生效

---

## 修改指南

### 改选择器

文件：`lib/client.js`

| 要改什么 | 搜索什么 |
|---|---|
| 标题栏选择器 | `data-sidebar-workspace-header` |
| 列表容器 | `data-sidebar-list-area` |
| 工作区行 | `data-row-key^="workspace:"` |
| 分组容器 | `groupSection` |
| store key | `dsh.workspace.view.v5` |

### 改完要做的

```bash
# 1. 语法检查
node --check lib/client.js

# 2. 同步到 profile
cp lib/client.js $DSH_HOME/profiles/web/node_modules/dsh-workspace-switcher/lib/client.js

# 3. 重启 DSH 验证

# 4. 更新版本号 + CHANGELOG

# 5. 发布
npm publish --access public
```

---

## 关键函数索引

| 函数 | 职责 | 行号（2.6.0） |
|---|---|---|
| `mount(ctx)` | 幂等挂载，插入选择器 UI | ~1620 |
| `paintInline(ctx)` | 更新选择器文字/计数 | ~1100 |
| `refresh(ctx)` | 重读数据 + 同步当前工作区 | ~1280 |
| `applyFocusMode()` | 隐藏非当前分组 | ~380 |
| `detectCurrentWorkspaceFromDom()` | 从 DOM 反推当前工作区 | ~1500 |
| `forceExpandInStore()` | 写 localStorage 强制展开 | ~570 |
| `ensureCurrentExpanded()` | 点击展开当前分组 | ~540 |
| `countSessions(ws)` | 统计可见会话数 | ~410 |
| `pickWorkspace(ctx, id)` | 切换工作区 | ~1180 |
| `moveWorkspace(ctx, src, tgt, after)` | 提交排序 | ~771 |
| `startPointerDrag()` | 启动拖拽 | ~900 |
| `reorderByPointer()` | 拖拽中实时换位 | ~940 |
| `commitDomOrder()` | 松手后提交顺序 | ~1000 |

> 行号仅供参考，以实际代码为准。

---

## 已知设计决策

| 决策 | 原因 |
|---|---|
| **非侵入式**，不改原生组件 | 保留搜索/排序/新建/右键菜单等全部原生功能 |
| 用 `visibility: hidden` 而非 `display: none` 隐藏被拖行 | 保持占位，其他行不塌陷 |
| 拖拽用 Pointer Events 不用 HTML5 draggable | `<button>` 元素上 draggable 不可靠 |
| 从 DOM 反推当前工作区，而非读会话数据 | 会话数据可能延迟/为空，DOM 是最终真相 |
| 优先 `openSession` 而非 `openWorkspace` | 后者必然跳到空白会话 |

---

## 联系

问题反馈：https://github.com/Xiashano1/dsh-workspace-switcher/issues
