window.__ModuleLoader__.load({
  id: "dsh-workspace-switcher",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    // ============================================================
    // DSH 工作区切换器（非侵入式）
    //
    // 设计原则：不替换任何原生组件，只在原生列表上方插入一个工作区选择按钮，
    // 并通过折叠「非当前工作区」的分组来达到「只显示一个工作区」的效果。
    //
    // 这样搜索、排序、新建工作区、右键菜单、拖拽、会话置顶/归档全部保留。
    // ============================================================

    exports.name = "dsh-workspace-switcher";
    exports.inject = ["uiWorkspace", "workspaces", "sessions"];

    const CSS_ID = "dsh-workspace-switcher-style";
    const PICK_KEY = "dsw.currentWorkspace";
    const STYLE = `
      .dws-inline {
        display: flex; align-items: center;
        padding: 2px 10px 8px;
      }
      .dws-inline-inner {
        display: flex; align-items: center; gap: 6px;
        width: 100%; min-width: 0;
      }
      /* 新建会话按钮 */
      .dws-inline-add {
        flex: 0 0 auto;
        width: 30px; height: 30px; padding: 0;
        display: flex; align-items: center; justify-content: center;
        border-radius: 7px; cursor: pointer;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background: color-mix(in srgb, currentColor 5%, transparent);
        color: inherit; font-size: 15px; line-height: 1;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .dws-inline-add:hover {
        background: color-mix(in srgb, currentColor 12%, transparent);
        border-color: color-mix(in srgb, currentColor 22%, transparent);
      }
      .dws-inline-add:active { transform: scale(.94); }
      /* 切换时的平滑过渡，减少闪跳感 */
      [data-sidebar-list-area] { transition: opacity 120ms ease; }
      [class*="groupSection"] { transition: opacity 100ms ease; }
      .dws-inline-btn {
        display: flex; align-items: center; gap: 7px;
        flex: 1 1 auto; min-width: 0;
        padding: 7px 10px; border-radius: 8px;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background: color-mix(in srgb, currentColor 5%, transparent);
        color: inherit; font: inherit; font-size: 13px; text-align: left;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .dws-inline-btn:hover {
        background: color-mix(in srgb, currentColor 10%, transparent);
        border-color: color-mix(in srgb, currentColor 20%, transparent);
      }
      .dws-inline-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dws-inline-count { flex: 0 0 auto; opacity: .45; font-size: .9em; font-variant-numeric: tabular-nums; }
      .dws-inline-caret { flex: 0 0 auto; opacity: .5; font-size: .8em; }
      .dws-mask {
        position: fixed; inset: 0; z-index: 9000;
        background: rgba(0,0,0,.42);
        display: flex; align-items: flex-start; justify-content: center;
        padding-top: 12vh;
      }
      .dws-modal {
        width: min(720px, 94vw); max-height: 66vh; display: flex; flex-direction: column;
        border-radius: 12px; overflow: hidden;
        background: var(--dsw-alias-bg-0, #1b1b1f);
        border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
        box-shadow: 0 18px 50px rgba(0,0,0,.5);
      }
      .dws-modal-head { padding: 10px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
      .dws-search {
        width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 7px;
        background: color-mix(in srgb, currentColor 7%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        color: inherit; font: inherit; font-size: 13px;
      }
      .dws-search:focus { outline: none; border-color: rgba(120,180,255,.6); }
      .dws-modal-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px; }
      .dws-ws {
        display: flex; align-items: center; gap: 8px; width: 100%;
        padding: 9px 10px; border: 0; border-radius: 8px; cursor: pointer;
        background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left;
      }
      .dws-ws:hover { background: color-mix(in srgb, currentColor 9%, transparent); }
      /* 选中状态：持久，实心蓝条 + 淡背景 */
      .dws-ws.active {
        background: rgba(120,180,255,.14);
      }
      /* ---- 拖拽 ---- */
      /* 手柄：3 条杠，只有按住它才能拖 */
      .dws-ws-grip {
        flex: 0 0 auto;
        display: flex; align-items: center; justify-content: center;
        width: 14px; height: 20px;
        margin-right: 2px; margin-left: -4px;
        cursor: grab; opacity: .32;
        border-radius: 3px;
        transition: opacity 120ms ease, background 120ms ease;
      }
      .dws-ws:hover .dws-ws-grip { opacity: .7; }
      .dws-ws-grip:hover { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }
      .dws-ws-grip:active { cursor: grabbing; }

      /* 正在拖的行 */
      .dws-ws.dragging {
        opacity: .45;
        box-shadow: 0 4px 14px rgba(0,0,0,.35);
        z-index: 2;
        position: relative;
      }
      /* 拖动中：其它行平滑让位 */
      .dws-modal-list.is-dragging .dws-ws {
        will-change: transform;
      }
      .dws-ws.drop-before { box-shadow: inset 0 2px 0 0 rgba(120,180,255,.95); }
      .dws-ws.drop-after  { box-shadow: inset 0 -2px 0 0 rgba(120,180,255,.95); }

      /* 行默认带过渡，让让位更顺滑 */
      .dws-ws { transition: background 120ms ease; }
      /* 键盘焦点：临时，虚线框，和选中区分开 */
      .dws-ws.kb-active {
        outline: 1.5px dashed rgba(160, 200, 255, .7);
        outline-offset: -2px;
        background: color-mix(in srgb, currentColor 9%, transparent);
      }
      /* 两者叠加时：实心 + 虚线框 */
      .dws-ws.active.kb-active {
        background: rgba(120,180,255,.20);
      }
      /* 当前工作区左侧加一条色条，一眼看出在哪 */
      .dws-ws.active::before {
        content: ''; position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 2.5px; height: 60%; border-radius: 2px;
        background: #7ec8ff;
      }
      .dws-ws { position: relative; }
      .dws-ws-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dws-ws-path {
        flex: 0 1 auto; min-width: 0; max-width: 58%;
        font-size: 11px; opacity: .45;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        direction: rtl;              /* 超长时截断头部，保留尾部的项目名 */
        text-align: left; unicode-bidi: plaintext;
      }
      .dws-ws-path:hover { opacity: .75; }
      .dws-ws-badge { flex: 0 0 auto; font-size: 11px; opacity: .5; font-variant-numeric: tabular-nums; }
      .dws-empty { padding: 18px 10px; text-align: center; font-size: 12px; opacity: .5; }

      /* 不兼容提示横幅 */
      .dws-banner {
        position: fixed; left: 16px; bottom: 16px; z-index: 9500;
        max-width: 380px; padding: 12px 14px;
        border-radius: 10px;
        background: #2a1f1f;
        border: 1px solid rgba(255, 150, 120, .35);
        box-shadow: 0 8px 28px rgba(0,0,0,.45);
        color: #f0d8d0;
        font-size: 12.5px; line-height: 1.55;
      }
      .dws-banner-title { font-size: 13px; font-weight: 650; color: #ffb4a0; margin-bottom: 4px; }
      .dws-banner-desc { opacity: .85; }
      .dws-banner-list { margin: 6px 0 0; padding-left: 18px; opacity: .7; font-size: 11.5px; }
      .dws-banner-list li { margin: 2px 0; }
      .dws-banner-close {
        margin-top: 10px; padding: 4px 12px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(255,180,160,.35);
        background: rgba(255,180,160,.12); color: inherit; font: inherit; font-size: 12px;
      }
      .dws-banner-close:hover { background: rgba(255,180,160,.22); }

      /* 右键菜单 */
      .dws-ctx {
        position: fixed; z-index: 9100; min-width: 148px;
        padding: 5px; border-radius: 9px;
        background: var(--dsw-alias-bg-0, #1b1b1f);
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
        box-shadow: 0 10px 30px rgba(0,0,0,.45);
      }
      .dws-ctx-item {
        display: block; width: 100%; padding: 7px 10px;
        border: 0; border-radius: 6px; cursor: pointer;
        background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left;
      }
      .dws-ctx-item:hover { background: color-mix(in srgb, currentColor 10%, transparent); }

      /* 重命名对话框 */
      .dws-rename { width: min(420px, 90vw); max-height: none; }
      .dws-rename-label { font-size: 12px; opacity: .6; margin-bottom: 8px; }
      .dws-rename-hint {
        min-height: 0; margin-top: 6px; font-size: 11.5px;
        color: #ff9a9a;
      }
      .dws-rename-hint:empty { display: none; }
      .dws-rename-actions {
        display: flex; justify-content: flex-end; gap: 8px; padding: 10px;
      }
      .dws-btn {
        padding: 6px 14px; border-radius: 7px; cursor: pointer; font: inherit; font-size: 13px;
        background: color-mix(in srgb, currentColor 8%, transparent);
        border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
        color: inherit;
      }
      .dws-btn:hover { background: color-mix(in srgb, currentColor 13%, transparent); }
      .dws-btn-primary {
        background: rgba(120,180,255,.22);
        border-color: rgba(120,180,255,.45);
      }
      .dws-btn-primary:hover { background: rgba(120,180,255,.32); }
      .dws-btn:disabled { opacity: .5; cursor: default; }
      .dws-btn-danger {
        background: rgba(255,107,107,.18);
        border-color: rgba(255,107,107,.45);
        color: #ff9a9a;
      }
      .dws-btn-danger:hover { background: rgba(255,107,107,.28); }

      /* 右键菜单分隔线与危险项 */
      .dws-ctx-sep {
        height: 1px; margin: 4px 2px;
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
      .dws-ctx-danger { color: #ff9a9a; }
      .dws-ctx-danger:hover { background: rgba(255,107,107,.14); }

      /* 删除对话框内容 */
      .dws-del-body { display: flex; flex-direction: column; gap: 5px; }
      .dws-del-target { font-size: 14px; font-weight: 650; word-break: break-word; }
      .dws-del-path {
        font-size: 11.5px; opacity: .5; word-break: break-all;
        font-family: ui-monospace, monospace;
      }
      .dws-del-warn {
        margin-top: 6px; padding: 8px 10px; border-radius: 7px;
        font-size: 12px; line-height: 1.6;
        background: color-mix(in srgb, currentColor 6%, transparent);
        opacity: .8;
      }
      .dws-del-warn strong { color: #7ec8ff; font-weight: 650; }
      .dws-del-warn.is-error { color: #ff9a9a; background: rgba(255,107,107,.12); }
    `;

    function ensureStyle() {
      if (typeof document === "undefined") return;
      if (document.getElementById(CSS_ID)) return;
      const el = document.createElement("style");
      el.id = CSS_ID;
      el.textContent = STYLE;
      document.head.appendChild(el);
    }

    let disposed = false;      // 插件卸载标记（mount/heal 都要用，必须前置声明）

    // 用户手动选过工作区的保护期：这段时间内不让「跟随当前会话」把选择弹回去。
    // 点了目标工作区的会话 / 新建会话时会 refresh(ctx, true) 提前解锁。
    const PICK_LOCK_MS = 12000;

    const state = {
      focusMode: true,        // true = 只显示当前工作区的会话
      currentWorkspaceId: "",
      workspaces: [],
      sessions: [],
      archivedSessionIds: new Set(),
      sessionById: new Map(),
      currentSessionId: "",
      pickLockUntil: 0         // 用户手动选工作区的保护期截止时间戳
    };

    // 取服务：Cordis 的 ctx.get(name) 才是正确入口（ctx.xxx 不保证存在）
    // inject 声明的服务会直接挂在 ctx 上；ctx.get() 是兜底
    function serviceOf(ctx, name) {
      try {
        const direct = ctx[name];
        if (direct) return direct;
      } catch (_) {}
      try {
        if (typeof ctx.get === "function") return ctx.get(name);
      } catch (_) {}
      return undefined;
    }

    function readWorkspaces(ctx) {
      try {
        const svc = serviceOf(ctx, "workspaces");
        if (!svc) { diagnostic(ctx, "workspaces 服务不存在", "no-ws-svc"); return []; }
        const src = svc.list;
        if (!src) { diagnostic(ctx, "workspaces.list 不存在，键: " + Object.keys(svc).join(","), "no-ws-list"); return []; }
        let snap = null;
        if (typeof src.getSnapshot === "function") snap = src.getSnapshot();
        else if (typeof src === "function") snap = src();
        else snap = src;
        if (!snap) { diagnostic(ctx, "snapshot 为空", "empty-snap"); return []; }
        // 保存归档集合（计数要排除它们，DSH 不渲染已归档会话）
        try {
          const arch = snap.archivedSessionIds;
          if (Array.isArray(arch)) state.archivedSessionIds = new Set(arch.map(String));
        } catch (_) {}
        const items = Array.isArray(snap) ? snap : (Array.isArray(snap.items) ? snap.items : []);
        if (!items.length) diagnostic(ctx, "snapshot.items 为空", "empty-items");
        return items;
      } catch (error) { diagnostic(ctx, "读工作区异常: " + error); return []; }
    }

    function readSessions(ctx) {
      try {
        const svc = serviceOf(ctx, "sessions");
        if (!svc) { diagnostic(ctx, "sessions 服务不存在", "no-sess-svc"); return []; }
        const src = svc.list || svc.state;
        if (!src) { diagnostic(ctx, "sessions.list/state 不存在", "no-sess-list"); return []; }
        let r = null;
        if (typeof src.getSnapshot === "function") r = src.getSnapshot();
        else if (typeof src === "function") r = src();
        else r = src;
        if (!r) return [];
        if (Array.isArray(r)) return r;
        if (Array.isArray(r.items)) return r.items;
        // 尝试多种结构提取 byId
        const byIdSource = r.byId || (r.value && r.value.byId) || (r.sessions && r.sessions.byId);
        if (byIdSource && typeof byIdSource === "object") {
          // 保存 id → session 完整对象（计数要用 origin/blank）
          try {
            const map = new Map();
            for (const [k, v] of Object.entries(byIdSource)) map.set(String(k), v);
            state.sessionById = map;
            // 当前会话（retainedBy.mainView > 0）
            // 每次都重算：原先只在为空时读一次，之后 DSH 自己切了会话这里也永远不变，
            // 于是「同步1」一直拿一个旧会话去覆盖用户刚选的工作区。
            let current = "";
            for (const v of map.values()) {
              if (v && v.retainedBy && (v.retainedBy.mainView || 0) > 0) {
                current = String(v.id || "");
                break;
              }
            }
            if (current && current !== state.currentSessionId) {
              state.currentSessionId = current;
            }
          } catch (_) {}
          return Object.values(byIdSource);
        }
        if (r.value && Array.isArray(r.value.items)) return r.value.items;
        return [];
      } catch (error) { diagnostic(ctx, "读会话异常: " + error); return []; }
    }

    // 诊断：同一类问题只提醒一次，避免巡检时刷屏
    const diagSeen = new Set();
    function diagnostic(ctx, msg, key) {
      const k = key || msg;
      if (diagSeen.has(k)) return;
      diagSeen.add(k);
      try { ctx.logger?.warn?.("[workspace-switcher] " + msg); } catch (_) {}
    }

    function readCurrent() {
      try {
        const raw = localStorage.getItem("dsh.sessions.current");
        return raw ? JSON.parse(raw) : {};
      } catch (_) { return {}; }
    }

    // 兜底：服务读不到时，直接从原生 DOM 反推工作区列表
    function readWorkspacesFromDom() {
      try {
        const out = [];
        const rows = document.querySelectorAll('[data-row-key^="workspace:"]');
        for (const row of rows) {
          const raw = String(row.getAttribute("data-row-key") || "");
          const key = raw.slice("workspace:".length);
          if (!key) continue;   // 跳过未分组
          const txt = String(row.textContent || "").replace(/\s+/g, " ").trim();
          let name = txt.replace(/^[^\w\u4e00-\u9fa5]+/, "").replace(/\s+\d+.*$/, "").trim();
          if (name === "default-workspace") name = "默认工作区";
          // 该分组下有多少会话
          const section = row.closest('[class*="groupSection"]') || row.parentElement;
          let sessionIds = [];
          if (section) {
            const sessRows = section.querySelectorAll('[data-row-key^="session:"]');
            sessionIds = [...sessRows].map((s) => String(s.getAttribute("data-row-key") || "").slice("session:".length));
          }
          out.push({ workspaceId: key, title: name || key, path: row.title || "", sessionIds });
        }
        return out;
      } catch (_) { return []; }
    }

    // 会话计数：服务数据优先，缺失时从 DOM 数
    // 会话计数：用数据里的真实总数（不是 DOM 里渲染的条数）
    // DSH 有水位线机制（每区默认只渲染 5 条），DOM 数会偏少。
    function countSessions(ws) {
      if (!ws) return 0;
      const ids = sessionIdsOf(ws);
      if (!ids) {
        // 无 sessionIds：DOM 兜底
        try {
          const row = document.querySelector('[data-row-key="workspace:' + String(ws.workspaceId) + '"]');
          const section = row ? (row.closest('[class*="groupSection"]') || row.parentElement) : null;
          if (section) return section.querySelectorAll('[data-row-key^="session:"]').length;
        } catch (_) {}
        return 0;
      }

      const archived = state.archivedSessionIds || new Set();
      const byId = state.sessionById || new Map();

      // 关键容错：读不到 session 详情时，只排除归档（无法判断子代理/空白）
      // 否则会把所有会话都过滤掉，显示 0
      const canFilterDetail = byId.size > 0;

      let n = 0;
      for (const rawId of ids) {
        const id = String(rawId);
        if (canFilterDetail) {
          const s = byId.get(id);
          if (s) {
            if (s.origin === "subagent") continue;
            if (s.blank && s.id !== state.currentSessionId) continue;
          }
        }
        if (archived.has(id)) continue;
        n += 1;
      }
      return n;
    }


    // 调试：分解计数来源
    function explainCount(ws) {
      const ids = sessionIdsOf(ws);
      const archived = state.archivedSessionIds || new Set();
      const byId = state.sessionById || new Map();
      if (!ids) return { total: 0, archived: 0, subagent: 0, blank: 0, visible: 0 };
      let arch = 0, sub = 0, blank = 0, visible = 0;
      for (const rawId of ids) {
        const id = String(rawId);
        const s = byId.get(id);
        if (s && s.origin === "subagent") { sub += 1; continue; }
        if (s && s.blank && s.id !== state.currentSessionId) { blank += 1; continue; }
        if (archived.has(id)) { arch += 1; continue; }
        visible += 1;
      }
      return { total: ids.size, archived: arch, subagent: sub, blank, visible,
               archivedSetSize: archived.size, hasSessionData: byId.size > 0 };
    }

    // DSH 的自动工作区目录名，显示时要本地化
    const DEFAULT_WORKSPACE_DIRECTORY = "default-workspace";
    const DEFAULT_WORKSPACE_LABEL = "默认工作区";

    function workspaceTitle(w) {
      if (!w) return "";
      let t = w.title || w.name || "";
      if (t && typeof t === "object") t = String(t.zh || t.en || "");
      t = String(t || "");
      // 和 DSH 一致：标题等于目录名时显示本地化名称
      if (t === DEFAULT_WORKSPACE_DIRECTORY) return DEFAULT_WORKSPACE_LABEL;
      if (t) return t;
      const p = String(w.path || "");
      const seg = p.split(/[\\/]/).filter(Boolean);
      const leaf = seg[seg.length - 1] || p || "未命名";
      // 路径末尾是 default-workspace 也要本地化
      if (leaf === DEFAULT_WORKSPACE_DIRECTORY) return DEFAULT_WORKSPACE_LABEL;
      return leaf;
    }

    // 完整路径（统一成正斜杠，去掉多余分隔符）
    function fullPath(p) {
      return String(p || "").replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    }

    function sessionIdsOf(ws) {
      return ws && Array.isArray(ws.sessionIds) ? new Set(ws.sessionIds.map(String)) : null;
    }

    // ---------- 核心：折叠非当前工作区的分组（不替换组件）----------
    // 做法：直接点击原生工作区行的 toggle，把非当前工作区收起来。
    // 这样搜索/排序/新建/右键菜单全部保留。
    let collapseTimer = null;

    // 只显示当前工作区：给其它工作区的分组加 display:none
    // 用 CSS 类而非 data 属性，避免污染原生状态；移除时立即恢复。
    // 记录我们主动点开过的分组，卸载时恢复原状（避免污染用户的持久化展开状态）
    const expandedByUs = new Set();
    let applyingFocus = false;
    const lastExpandClickAt = new Map();
    let lastEnsuredWorkspaceId = "";
    let focusDirty = false;

    // 搜索中：列表被 SearchResults 替换，此时不应应用聚焦过滤
    function isSearching() {
      try {
        // 原生搜索框有输入值时，列表是搜索结果，不能按工作区过滤
        const input = document.querySelector('[data-sidebar-workspace-header] input');
        if (input && String(input.value || "").trim()) return true;
        // 列表区里没有工作区行，但有会话行 → 搜索结果视图
        const area = document.querySelector("[data-sidebar-list-area]");
        if (!area) return false;
        const hasWorkspaceRow = area.querySelector('[data-row-key^="workspace:"]');
        const hasSearchResults = area.querySelector('[data-row-key^="search:"], [class*="searchResult"]');
        return !hasWorkspaceRow && Boolean(hasSearchResults);
      } catch (_) { return false; }
    }


    function applyFocusMode() {
      if (!state.focusMode || !state.currentWorkspaceId) return;
      if (isSearching()) return;
      // 防重入：这个函数会改 DOM，DOM 变化又会触发 observer 调用它
      if (applyingFocus) return;
      applyingFocus = true;
      try {
        const rows = document.querySelectorAll('[data-row-key^="workspace:"]');
        for (const row of rows) {
          const raw = String(row.getAttribute("data-row-key") || "");
          const key = raw.slice("workspace:".length);
          const section = row.closest('[class*="groupSection"]') || row.parentElement;
          if (!section) continue;
          const isCurrent = key !== "" && key === state.currentWorkspaceId;

          // 只做两件事：隐藏非当前分组、隐藏当前分组的标题行
          if (section.style.display !== (isCurrent ? "" : "none")) {
            section.style.display = isCurrent ? "" : "none";
          }
          if (isCurrent) {
            if (row.style.display !== "none") row.style.display = "none";
          } else if (row.style.display !== "") {
            row.style.display = "";
          }
        }
        // 确保当前分组展开。
        // React 每次重渲染都可能把它重置回折叠，所以这里要能反复点，
        // 用 300ms 节流避免连点风暴（而不是限制总次数）。
        const curKey = state.currentWorkspaceId;
        const cur = [...document.querySelectorAll('[data-row-key^="workspace:"]')]
          .find((r) => String(r.getAttribute("data-row-key")).slice("workspace:".length) === curKey);
        if (cur && cur.getAttribute("aria-expanded") !== "true") {
          const now = Date.now();
          const last = lastExpandClickAt.get(curKey) || 0;
          if (now - last > 300) {
            lastExpandClickAt.set(curKey, now);
            expandedByUs.add(curKey);
            try { cur.click(); } catch (_) {}
          }
        }
      } catch (_) {}
      finally { applyingFocus = false; }
    }

    // DSH 把分组展开状态持久化在 localStorage['dsh.workspace.view.v5'].groupExpansion
    // 直接写这里比反复点击 DOM 更可靠（不会被 React 重渲染重置）
    const VIEW_STORE_KEY = "dsh.workspace.view.v5";
    function forceExpandInStore(workspaceId) {
      try {
        const raw = localStorage.getItem(VIEW_STORE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        // defineStore 的持久化格式可能是 {state:{...}} 或直接对象
        const root = data && typeof data === "object" ? data : {};
        const holder = root.state && typeof root.state === "object" ? root.state : root;
        if (!holder.groupExpansion || typeof holder.groupExpansion !== "object") holder.groupExpansion = {};
        if (holder.groupExpansion[workspaceId] === true) return true;   // 已经是展开
        holder.groupExpansion[workspaceId] = true;
        localStorage.setItem(VIEW_STORE_KEY, JSON.stringify(data));
        return false;   // 表示刚改过，需要 DSH 重读
      } catch (_) { return false; }
    }

    // 独立职责：确保当前工作区的分组是展开的。
    // 与 applyFocusMode（负责隐藏）分离，避免互相干扰。
    let ensureTimer = null;
    function ensureCurrentExpanded() {
      if (!state.focusMode || !state.currentWorkspaceId) return false;
      try {
        const key = String(state.currentWorkspaceId);
        const row = document.querySelector('[data-row-key="workspace:' + key + '"]');
        if (!row) return false;
        if (row.getAttribute("aria-expanded") === "true") return true;   // 已展开
        // 未展开：先尝试写 store（更持久），再点一次触发 React 重读
        forceExpandInStore(key);
        try { row.click(); } catch (_) {}
        return false;
      } catch (_) { return false; }
    }

    // 启动后持续尝试，直到成功（最长 15 秒）
    function startEnsureExpanded() {
      // 每次重新启动，避免上一个在跑时被跳过
      if (ensureTimer) { clearInterval(ensureTimer); ensureTimer = null; }
      let elapsed = 0;
      ensureTimer = setInterval(() => {
        elapsed += 300;
        if (disposed || elapsed > 15000) {
          clearInterval(ensureTimer);
          ensureTimer = null;
          return;
        }
        if (!state.focusMode) return;
        if (ensureCurrentExpanded()) {
          clearInterval(ensureTimer);
          ensureTimer = null;
        }
      }, 300);
    }

    // 恢复：清掉所有内联 display
    function clearFocusMode() {
      try {
        const rows = document.querySelectorAll('[data-row-key^="workspace:"]');
        for (const row of rows) {
          const key = String(row.getAttribute("data-row-key") || "").slice("workspace:".length);
          const section = row.closest('[class*="groupSection"]') || row.parentElement;
          if (section) section.style.display = "";
          row.style.display = "";
          // 还原我们为了显示会话而点开的分组
          if (expandedByUs.has(key) && row.getAttribute("aria-expanded") === "true") {
            try { row.click(); } catch (_) {}
          }
        }
        expandedByUs.clear();
      } catch (_) {}
    }

    function scheduleApply(delay) {
      if (collapseTimer) clearTimeout(collapseTimer);
      collapseTimer = setTimeout(() => { collapseTimer = null; applyFocusMode(); }, delay == null ? 120 : delay);
    }

    // ---------- 行内选择器（替代「工作区」三个字）----------
    // 选择器节点构建：所有元素带 data-dws 标记，便于 DOM 现查
    // 返回值：{ picker: 选择器按钮, add: 新建会话按钮 }
    function createInlineNode(ctx) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dws-inline-btn";
      btn.setAttribute("data-dws", "btn");
      const name = document.createElement("span");
      name.className = "dws-inline-name";
      name.setAttribute("data-dws", "name");
      const count = document.createElement("span");
      count.className = "dws-inline-count";
      count.setAttribute("data-dws", "count");
      const caret = document.createElement("span");
      caret.className = "dws-inline-caret";
      caret.textContent = "▾";
      btn.append(name, count, caret);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof openModal === "function") openModal(ctx);
      });

      // 新建会话按钮（在当前工作区）
      const add = document.createElement("button");
      add.type = "button";
      add.className = "dws-inline-add";
      add.setAttribute("data-dws", "add");
      add.title = "在当前工作区新建会话";
      add.textContent = "＋";
      add.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        createSessionInCurrent(ctx);
      });

      const wrap = document.createElement("span");
      wrap.className = "dws-inline-inner";
      wrap.append(btn, add);
      return { node: wrap, picker: btn, add };
    }

    // 内容渲染：无状态，直接从 DOM 找到节点并更新文字
    // 找不到就静默返回（由 heal/mount 负责补齐 DOM）
    function paintInline(ctx) {
      try {
        const container = document.querySelector('.dws-inline[data-dws="host"]');
        if (!container) return false;
        const name = container.querySelector('[data-dws="name"]');
        const count = container.querySelector('[data-dws="count"]');
        const btn = container.querySelector('[data-dws="btn"]');
        if (!name || !count) return false;
        const ws = state.workspaces.find((w) => String(w.workspaceId) === state.currentWorkspaceId);
        const nextName = ws ? workspaceTitle(ws) : "选择工作区";
        const nextCount = String(countSessions(ws));
        const nextTitle = ws ? (String(ws.path || "") + " · 点击切换工作区") : "切换工作区";
        // 只在内容真的变化时写 DOM —— 否则每次写都会触发 MutationObserver，形成循环
        if (name.textContent !== nextName) name.textContent = nextName;
        if (count.textContent !== nextCount) count.textContent = nextCount;
        if (btn && btn.title !== nextTitle) btn.title = nextTitle;
        return true;
      } catch (_) { return false; }
    }

    // 拖拽实时动画：把被拖行在列表中"视觉移动"到目标位置
    // 其他行用 CSS transition 平滑让位
    function liveMove(srcRow, targetRow, after) {
      try {
        if (!srcRow || !targetRow || srcRow === targetRow) return;
        const list = srcRow.parentElement;
        if (!list) return;
        const srcIdx = [...list.children].indexOf(srcRow);
        const tgtIdx = [...list.children].indexOf(targetRow);
        if (srcIdx < 0 || tgtIdx < 0) return;
        // 计算应该插入到哪
        let insertBeforeEl;
        if (after) insertBeforeEl = targetRow.nextElementSibling;
        else insertBeforeEl = targetRow;
        if (insertBeforeEl === srcRow) {
          // 已经在正确位置
          return;
        }
        // 用 FLIP：记录旧位置 → 移动 DOM → 计算差值 → 动画
        const rows = [...list.children];
        const first = new Map();
        for (const r of rows) first.set(r, r.getBoundingClientRect().top);

        list.insertBefore(srcRow, insertBeforeEl);

        for (const r of rows) {
          if (r === srcRow) {
            // 被拖行也做一次瞬移补偿，避免视觉跳动
            const prevSrc = first.get(srcRow);
            const nowSrc = srcRow.getBoundingClientRect().top;
            if (prevSrc !== undefined && Math.abs(prevSrc - nowSrc) > 1) {
              srcRow.style.transition = "none";
              srcRow.style.transform = "translateY(" + (prevSrc - nowSrc) + "px)";
              requestAnimationFrame(() => {
                srcRow.style.transition = "transform 140ms ease-out";
                srcRow.style.transform = "";
              });
            }
            continue;
          }
          const prev = first.get(r);
          const now = r.getBoundingClientRect().top;
          const delta = prev - now;
          if (!delta || Math.abs(delta) < 1) continue;
          r.style.transition = "none";
          r.style.transform = "translateY(" + delta + "px)";
          requestAnimationFrame(() => {
            r.style.transition = "transform 180ms cubic-bezier(.2,.8,.2,1)";
            r.style.transform = "";
          });
        }
      } catch (_) {}
    }

    // 移动工作区到目标位置
    // 用 DSH 的 insertBefore(workspaceId, beforeWorkspaceId)。
    // 拖到某行上半 = 插到它前面；下半 = 插到它后面（即插到它的下一个之前）。
    async function moveWorkspace(ctx, srcId, targetId, after) {
      if (!srcId || !targetId || srcId === targetId) return;
      try {
        const svc = serviceOf(ctx, "workspaces");
        if (!svc || typeof svc.insertBefore !== "function") {
          diagnostic(ctx, "workspaces.insertBefore 不可用", "no-insert-before");
          return;
        }
        // 计算 beforeId：after=true 时插到 target 的下一个之前
        let beforeId;
        if (after) {
          const list = state.workspaces;
          const ti = list.findIndex((w) => String(w.workspaceId) === String(targetId));
          const next = ti >= 0 ? list[ti + 1] : undefined;
          // 下一个如果是自己，则再往后找
          if (next && String(next.workspaceId) === String(srcId)) {
            const next2 = list[ti + 2];
            beforeId = next2 ? String(next2.workspaceId) : undefined;
          } else {
            beforeId = next ? String(next.workspaceId) : undefined;
          }
        } else {
          beforeId = String(targetId);
        }
        await svc.insertBefore(String(srcId), beforeId);
        // 重新读取，让顺序更新
        refresh(ctx);
        // 弹窗重渲染保持视觉一致
        setTimeout(() => { try { const m = document.querySelector(".dws-modal-list"); if (m) {/* render 由闭包持有，用事件触发 */} } catch (_) {} }, 0);
      } catch (error) {
        diagnostic(ctx, "移动工作区失败: " + error, "move-fail");
      }
    }

    // 在当前工作区新建会话
    // 优先用 uiWorkspace.startSession(workspaceId)，失败则退回 connectWorkspace
    async function createSessionInCurrent(ctx) {
      const wsId = state.currentWorkspaceId;
      if (!wsId) {
        diagnostic(ctx, "没有选中工作区，无法新建会话", "no-ws-for-new");
        return;
      }
      const svc = ctx && ctx.uiWorkspace;
      try {
        if (svc && typeof svc.startSession === "function") {
          svc.startSession(String(wsId));
          // startSession 是同步的（会内部异步创建）
          // 立刻解锁跟随：DSH 一旦有了新会话，「跟随当前会话」就该接管
          setTimeout(() => { refresh(ctx, true); scheduleApply(60); }, 300);
          setTimeout(() => { refresh(ctx, true); scheduleApply(60); }, 1200);
          return;
        }
        // 退回：connectWorkspace 返回 Promise<SessionId>
        if (svc && typeof svc.connectWorkspace === "function") {
          const sid = await svc.connectWorkspace(String(wsId));
          if (sid && typeof svc.openSession === "function") svc.openSession(String(sid));
          refresh(ctx);
          scheduleApply(60);
          return;
        }
        diagnostic(ctx, "uiWorkspace 没有可用的新建会话接口", "no-start-session");
      } catch (error) {
        diagnostic(ctx, "新建会话失败: " + error, "new-session-fail");
      }
    }

    // ---------- 弹窗 ----------
    let modalOpen = false;
    function openModal(ctx, onPick) {
      if (modalOpen) return;      // 防止连点开出多个弹窗
      modalOpen = true;
      // 清掉可能残留的遮罩
      document.querySelectorAll(".dws-mask").forEach((el) => el.remove());
      const mask = document.createElement("div");
      mask.className = "dws-mask";
      const modal = document.createElement("div");
      modal.className = "dws-modal";
      const head = document.createElement("div");
      head.className = "dws-modal-head";
      const input = document.createElement("input");
      input.className = "dws-search";
      input.placeholder = "搜索工作区（名称或路径）";
      input.autocomplete = "off";
      head.appendChild(input);
      const body = document.createElement("div");
      body.className = "dws-modal-list";
      modal.append(head, body);
      mask.appendChild(modal);

      function close() {
        modalOpen = false;
        closeContextMenu();
        mask.remove();
        document.removeEventListener("keydown", onKey, true);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.stopPropagation(); close(); }
      }

      let activeIndex = -1;
    let dragSrcId = "";

      function render() {
        body.innerHTML = "";
        activeIndex = -1;
        if (!state.workspaces.length) {
          const empty = document.createElement("div");
          empty.className = "dws-empty";
          empty.textContent = "还没有工作区";
          body.appendChild(empty);
          return;
        }
        const q = String(input.value || "").trim().toLowerCase();
        const items = state.workspaces.filter((w) => {
          if (!q) return true;
          return (workspaceTitle(w) + " " + String(w.path || "")).toLowerCase().includes(q);
        });
        if (!items.length) {
          const empty = document.createElement("div");
          empty.className = "dws-empty";
          empty.textContent = "没有匹配的工作区";
          body.appendChild(empty);
          return;
        }
        for (const w of items) {
          const wid = String(w.workspaceId);
          const row = document.createElement("button");
          row.type = "button";
          const idx = body.children.length;
          row.dataset.idx = String(idx);
          row.className = "dws-ws" + (wid === state.currentWorkspaceId ? " active" : "");
          row.title = String(w.path || "");
          // 拖动手柄：只有按它才能拖
          const grip = document.createElement("span");
          grip.className = "dws-ws-grip";
          grip.setAttribute("data-dws", "grip");
          grip.title = "拖动调整顺序";
          grip.innerHTML = '<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><g fill="currentColor"><rect x="0" y="1" width="10" height="1.6" rx="0.8"/><rect x="0" y="6.2" width="10" height="1.6" rx="0.8"/><rect x="0" y="11.4" width="10" height="1.6" rx="0.8"/></g></svg>';
          // 只有手柄可拖
          // HTML5 拖拽必须让 row 在按下手柄时变为可拖
          grip.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            row.draggable = true;
          });
          grip.addEventListener("pointerup", () => { row.draggable = false; });
          document.addEventListener("pointerup", () => { if (row.draggable) row.draggable = false; });
          const nm = document.createElement("span");
          nm.className = "dws-ws-name";
          nm.textContent = workspaceTitle(w);
          const pth = document.createElement("span");
          pth.className = "dws-ws-path";
          pth.textContent = fullPath(w.path);
          pth.title = fullPath(w.path);
          const badge = document.createElement("span");
          badge.className = "dws-ws-badge";
          badge.textContent = String(countSessions(w));
          row.append(grip, nm, pth, badge);
          row.draggable = false;
          row.dataset.wid = wid;
          row.addEventListener("dragstart", (e) => {
            dragSrcId = wid;
            row.classList.add("dragging");
            body.classList.add("is-dragging");
            try {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", wid);
              // 自定义拖拽图像（用整行，稍透明）
              if (e.dataTransfer.setDragImage) {
                try { e.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2); } catch (_) {}
              }
            } catch (_) {}
          });
          row.addEventListener("dragend", () => {
            row.classList.remove("dragging");
            row.draggable = false;
            dragSrcId = "";
            body.classList.remove("is-dragging");
            for (const el of body.querySelectorAll(".dws-ws")) {
              el.classList.remove("drop-before", "drop-after", "shift-down", "shift-up");
              el.style.transform = "";
            }
          });
          row.addEventListener("dragover", (e) => {
            if (!dragSrcId || dragSrcId === wid) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const rect = row.getBoundingClientRect();
            const after = (e.clientY - rect.top) > rect.height / 2;
            // 只有变化时才更新，避免抖动
            if (row.classList.contains("drop-after") === after && row.classList.contains("drop-before") === !after) return;
            for (const el of body.querySelectorAll(".dws-ws")) el.classList.remove("drop-before", "drop-after");
            row.classList.add(after ? "drop-after" : "drop-before");
            // 实时移动 DOM：其他行用 FLIP 平滑让位
            const srcRow = body.querySelector(".dws-ws.dragging");
            if (srcRow) liveMove(srcRow, row, after);
          });
          row.addEventListener("dragleave", () => {
            row.classList.remove("drop-before", "drop-after");
          });
          row.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const srcId = dragSrcId || e.dataTransfer.getData("text/plain");
            if (!srcId || srcId === wid) return;
            const rect = row.getBoundingClientRect();
            const after = (e.clientY - rect.top) > rect.height / 2;
            moveWorkspace(ctx, srcId, wid, after);
            row.classList.remove("drop-before", "drop-after");
            for (const el of body.querySelectorAll(".dws-ws")) { el.style.transform = ""; el.classList.remove("shift-down", "shift-up"); }
          });
          row.addEventListener("click", () => {
            close();                 // 先关弹窗，视觉上更跟手
            pickWorkspace(ctx, wid);
            if (onPick) onPick();
          });
          // 右键：重命名 / 复制路径
          row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(ctx, e.clientX, e.clientY, w, () => render());
          });
          body.appendChild(row);
        }
      }

      function highlight(idx) {
        const rows = [...body.querySelectorAll(".dws-ws")];
        if (!rows.length) return;
        if (idx < 0) idx = 0;
        if (idx >= rows.length) idx = rows.length - 1;
        rows.forEach((r, i) => r.classList.toggle("kb-active", i === idx));
        activeIndex = idx;
        try { rows[idx].scrollIntoView({ block: "nearest" }); } catch (_) {}
      }

      function onNavKey(e) {
        if (e.key === "ArrowDown") {
          e.preventDefault(); e.stopPropagation();
          highlight(activeIndex < 0 ? 0 : activeIndex + 1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault(); e.stopPropagation();
          highlight(activeIndex < 0 ? 0 : activeIndex - 1);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          const rows = [...body.querySelectorAll(".dws-ws")];
          // 有键盘高亮 → 用它；否则不做事（避免误选第一项）
          const target = activeIndex >= 0 ? rows[activeIndex] : null;
          if (target) target.click();
          return;
        }
      }

      input.addEventListener("input", () => { render(); });
      input.addEventListener("keydown", onNavKey, true);
      mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
      body.addEventListener("dragover", (e) => { e.preventDefault(); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(mask);
      render();
      // 不默认高亮：只有用户按 ↑↓ 时才出现键盘焦点框
      // 这样"选中工作区"的蓝色高亮不会被键盘框干扰
      // 焦点放到输入框（requestAnimationFrame 比 setTimeout 更稳）
      requestAnimationFrame(() => { try { input.focus(); } catch (_) {} });
    }

    // ---------- 右键菜单（重命名 / 复制路径）----------
    let ctxMenuEl = null;
    function closeContextMenu() {
      if (ctxMenuEl) { try { ctxMenuEl.remove(); } catch (_) {} ctxMenuEl = null; }
    }

    function showContextMenu(ctx, x, y, workspace, onDone) {
      closeContextMenu();
      const menu = document.createElement("div");
      menu.className = "dws-ctx";
      // 先放到视口外测量尺寸，再决定最终位置（避免越界）
      menu.style.left = "-9999px";
      menu.style.top = "-9999px";

      const mk = (label, handler) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dws-ctx-item";
        item.textContent = label;
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          closeContextMenu();
          handler();
        });
        return item;
      };

      menu.appendChild(mk("重命名", () => openRename(ctx, workspace, onDone)));
      menu.appendChild(mk("复制路径", () => {
        try {
          const p = fullPath(workspace.path);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(p).catch(() => {});
          }
        } catch (_) {}
      }));
      // 分隔线
      const sep = document.createElement("div");
      sep.className = "dws-ctx-sep";
      menu.appendChild(sep);
      const del = mk("删除工作区…", () => openDelete(ctx, workspace, onDone));
      del.classList.add("dws-ctx-danger");
      menu.appendChild(del);

      document.body.appendChild(menu);
      ctxMenuEl = menu;

      // 测量后夹到视口内（右下角右键也能完整显示）
      try {
        const rect = menu.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
        const vh = window.innerHeight || document.documentElement.clientHeight || 768;
        const margin = 8;
        let left = x;
        let top = y;
        if (left + rect.width + margin > vw) left = vw - rect.width - margin;
        if (top + rect.height + margin > vh) top = vh - rect.height - margin;
        menu.style.left = Math.max(margin, left) + "px";
        menu.style.top = Math.max(margin, top) + "px";
      } catch (_) {
        menu.style.left = Math.max(8, x) + "px";
        menu.style.top = Math.max(8, y) + "px";
      }

      // 点别处关闭
      const off = (ev) => {
        if (menu.contains(ev.target)) return;
        closeContextMenu();
        document.removeEventListener("mousedown", off, true);
      };
      setTimeout(() => document.addEventListener("mousedown", off, true), 0);
    }

    // 重命名对话框
    function openRename(ctx, workspace, onDone) {
      const old = workspaceTitle(workspace);
      const mask = document.createElement("div");
      mask.className = "dws-mask";
      const box = document.createElement("div");
      box.className = "dws-modal dws-rename";
      const head = document.createElement("div");
      head.className = "dws-modal-head";
      const label = document.createElement("div");
      label.className = "dws-rename-label";
      label.textContent = "重命名工作区";
      const input = document.createElement("input");
      input.className = "dws-search";
      input.value = old;
      input.maxLength = 120;
      const hint = document.createElement("div");
      hint.className = "dws-rename-hint";
      head.append(label, input, hint);

      function setHint(text) {
        hint.textContent = text || "";
        hint.classList.toggle("is-error", Boolean(text));
      }

      const actions = document.createElement("div");
      actions.className = "dws-rename-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "dws-btn";
      cancel.textContent = "取消";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "dws-btn dws-btn-primary";
      ok.textContent = "保存";
      actions.append(cancel, ok);
      box.append(head, actions);
      mask.appendChild(box);

      function close() {
        mask.remove();
        document.removeEventListener("keydown", onKey, true);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.stopPropagation(); close(); }
        if (e.key === "Enter") { e.stopPropagation(); submit(); }
      }
      async function submit() {
        const title = String(input.value || "").trim();
        if (!title) { setHint("名称不能为空"); input.focus(); return; }
        if (title === old) { close(); return; }
        // 查重：同名的其他工作区
        const dup = state.workspaces.some((w) =>
          String(w.workspaceId) !== String(workspace.workspaceId) && workspaceTitle(w) === title);
        if (dup) { setHint("已经有同名工作区了"); input.focus(); return; }
        setHint("");
        ok.disabled = true;
        try {
          const svc = serviceOf(ctx, "workspaces");
          if (svc && typeof svc.rename === "function") {
            await svc.rename(String(workspace.workspaceId), title);
          } else {
            diagnostic(ctx, "workspaces.rename 不可用，无法重命名", "no-rename");
          }
          close();
          // 立即在本地更新标题，避免等服务回包
          try { workspace.title = title; } catch (_) {}
          refresh(ctx);
          if (onDone) onDone();
        } catch (error) {
          ok.disabled = false;
          diagnostic(ctx, "重命名失败: " + error, "rename-fail");
        }
      }

      input.addEventListener("input", () => setHint(""));
      cancel.addEventListener("click", close);
      ok.addEventListener("click", submit);
      mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(mask);
      requestAnimationFrame(() => { try { input.focus(); input.select(); } catch (_) {} });
    }

    // 删除确认对话框
    // 注意：DSH 的 delete 只「取消注册」，不删除会话和文件（官方语义）。
    // 这里把这句话明确写给用户看，避免误以为会删文件。
    function openDelete(ctx, workspace, onDone) {
      const name = workspaceTitle(workspace);
      const pathText = fullPath(workspace.path);
      const sessionCount = countSessions(workspace);

      const mask = document.createElement("div");
      mask.className = "dws-mask";
      const box = document.createElement("div");
      box.className = "dws-modal dws-rename";
      const head = document.createElement("div");
      head.className = "dws-modal-head";

      const label = document.createElement("div");
      label.className = "dws-rename-label";
      label.textContent = "删除工作区";

      const body = document.createElement("div");
      body.className = "dws-del-body";
      const target = document.createElement("div");
      target.className = "dws-del-target";
      target.textContent = name;
      target.title = pathText;
      const pth = document.createElement("div");
      pth.className = "dws-del-path";
      pth.textContent = pathText;

      const warn = document.createElement("div");
      warn.className = "dws-del-warn";
      warn.innerHTML = "只从列表移除这个工作区，<strong>不会删除任何会话，也不会删除磁盘上的文件</strong>。"
        + (sessionCount ? "（当前有 " + sessionCount + " 个会话会变成「未分组」）" : "");

      body.append(target, pth, warn);
      head.append(label, body);

      const actions = document.createElement("div");
      actions.className = "dws-rename-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "dws-btn";
      cancel.textContent = "取消";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "dws-btn dws-btn-danger";
      ok.textContent = "删除";
      actions.append(cancel, ok);
      box.append(head, actions);
      mask.appendChild(box);

      let busy = false;
      function close() {
        if (busy) return;
        mask.remove();
        document.removeEventListener("keydown", onKey, true);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.stopPropagation(); close(); }
        if (e.key === "Enter") { e.stopPropagation(); submit(); }
      }
      async function submit() {
        if (busy) return;
        busy = true;
        ok.disabled = true;
        ok.textContent = "删除中…";
        try {
          const svc = serviceOf(ctx, "workspaces");
          if (!svc || typeof svc.delete !== "function") {
            throw new Error("workspaces.delete 不可用");
          }
          await svc.delete(String(workspace.workspaceId));
          // 如果删的正是当前选中的，切到剩下的第一个
          if (String(state.currentWorkspaceId) === String(workspace.workspaceId)) {
            state.currentWorkspaceId = "";
            try { localStorage.removeItem(PICK_KEY); } catch (_) {}
          }
          busy = false;
          // 先刷新数据（refresh 会重算 currentWorkspaceId 并重渲染选择器），再关闭对话框
          refresh(ctx);
          if (onDone) onDone();
          close();
          scheduleApply(60);
        } catch (error) {
          busy = false;
          ok.disabled = false;
          ok.textContent = "删除";
          diagnostic(ctx, "删除工作区失败: " + error, "delete-fail");
          // 在对话框里显示错误，而不是静默失败
          warn.textContent = "删除失败：" + String(error && error.message || error);
          warn.classList.add("is-error");
        }
      }

      cancel.addEventListener("click", close);
      ok.addEventListener("click", submit);
      mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(mask);
      requestAnimationFrame(() => { try { ok.focus(); } catch (_) {} });
    }

    // ---------- 选择工作区 ----------
    function pickWorkspace(ctx, workspaceId) {
      const target = String(workspaceId);
      const changed = String(state.currentWorkspaceId) !== target;
      state.currentWorkspaceId = target;
      // 保护期：3 秒内不让"当前会话反推"覆盖用户的手动选择
      // （DSH 的导航是异步的，这期间旧会话还在，会把选择弹回去）
      state.pickLockUntil = Date.now() + 600;
      try { localStorage.setItem(PICK_KEY, target); } catch (_) {}

      // 和 DSH 自己的「新会话」下拉用同一个 API：
      //   workspaceNavigation.openWorkspace(workspaceId, beforeOpen?)
      // 它会切到该工作区已有的（或可复用的空白）会话，不会无脑新建。
      // 之前我误判成"每次都新开会话"，实际是第二个参数 beforeOpen 的语义。
      try {
        const svc = ctx && ctx.uiWorkspace;
        if (svc && typeof svc.openWorkspace === "function" && changed) {
          const p = svc.openWorkspace(target);
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch (error) {
        diagnostic(ctx, "切换工作区失败: " + error, "pick-fail");
      }

      refresh(ctx);
      scheduleApply(40);
      startEnsureExpanded();
      // 切换后多次同步（等 DSH 完成内部导航 + React 重渲染）
      [120, 350, 700, 1200].forEach((ms) => {
        setTimeout(() => {
          if (disposed) return;
          refresh(ctx);
          applyFocusMode();
        }, ms);
      });
    }

    // ---------- 刷新 ----------
    // 从 DOM 反推当前工作区（最可靠的信号）：
    // DSH 会展开"当前会话所在的工作区"分组，所以展开着的那个就是当前工作区。
    // 另外当前分组的文件夹图标会带 folderActive 样式类。
    function detectCurrentWorkspaceFromDom() {
      try {
        const rows = [...document.querySelectorAll('[data-row-key^="workspace:"]')];
        if (!rows.length) return "";
        // 优先级 1：有 active 样式的工作区行
        for (const r of rows) {
          const key = String(r.getAttribute("data-row-key")).slice("workspace:".length);
          if (!key) continue;
          // 找行内是否有 active 类的图标
          const hasActive = r.querySelector('[class*="folderActive"], [class*="Active"]');
          if (hasActive) return key;
        }
        // 优先级 2：唯一展开的分组
        const expanded = rows.filter((r) => r.getAttribute("aria-expanded") === "true")
          .map((r) => String(r.getAttribute("data-row-key")).slice("workspace:".length))
          .filter(Boolean);
        if (expanded.length === 1) return expanded[0];
        return "";
      } catch (_) { return ""; }
    }

    // 用户刚手动选过工作区时，给一个保护期：期间不让"当前会话反推"覆盖用户的选择
    function isUserLocked() {
      try {
        return Date.now() < (state.pickLockUntil || 0);
      } catch (_) { return false; }
    }

    function refresh(ctx, unlock) {
      if (unlock) state.pickLockUntil = 0;
      state.workspaces = readWorkspaces(ctx);
      if (!state.workspaces.length) {
        const fromDom = readWorkspacesFromDom();
        if (fromDom.length) {
          state.workspaces = fromDom;
          diagnostic(ctx, "服务无数据，已从 DOM 兜底读取 " + fromDom.length + " 个工作区", "dom-fallback");
        }
      }
      state.sessions = readSessions(ctx);
      // 每次都重新读 DSH 的当前会话（用户可能在 DSH 那边切了会话）
      try {
        const cur = readCurrent();
        const sid = String(cur.sessionId || "");
        if (sid && sid !== state.currentSessionId) {
          state.currentSessionId = sid;
        }
      } catch (_) {}
      if (!state.currentWorkspaceId) {
        try { state.currentWorkspaceId = localStorage.getItem(PICK_KEY) || ""; } catch (_) {}
      }
      if (!state.currentWorkspaceId) {
        const cur = readCurrent();
        if (cur.workspaceId) state.currentWorkspaceId = String(cur.workspaceId);
        else if (state.workspaces[0]) state.currentWorkspaceId = String(state.workspaces[0].workspaceId);
      }
      // 同步 0（最高优先级）：从 DOM 反推——谁展开着，谁就是当前工作区。
      // 这不依赖任何内部数据结构，DSH 切工作区时一定会展开它。
      let domDetected = false;
      if (!isUserLocked()) {
        const domWs = detectCurrentWorkspaceFromDom();
        if (domWs) {
          domDetected = true;
          if (domWs !== state.currentWorkspaceId) {
            state.currentWorkspaceId = domWs;
            try { localStorage.setItem(PICK_KEY, domWs); } catch (_) {}
            // 关键：工作区变了就立刻重排显示，不等下一轮巡检
            focusDirty = true;
          }
        }
      }
      // 同步 1：DSH 的当前会话在哪个工作区，就跟随它。
      // 但只在「DOM 探测失败」时才用——DOM 是真相，数据可能是陈旧的。
      if (!domDetected && state.currentSessionId && !isUserLocked()) {
        const owner = state.workspaces.find((w) => {
          const ids = sessionIdsOf(w);
          return ids && ids.has(state.currentSessionId);
        });
        if (owner && String(owner.workspaceId) !== String(state.currentWorkspaceId)) {
          state.currentWorkspaceId = String(owner.workspaceId);
          try { localStorage.setItem(PICK_KEY, state.currentWorkspaceId); } catch (_) {}
        }
      }
      // 兜底 1：用 DSH 的当前会话反推（仅当还没定下来时）
      if (!state.currentWorkspaceId && !domDetected && state.currentSessionId) {
        const owner = state.workspaces.find((w) => {
          const ids = sessionIdsOf(w);
          return ids && ids.has(state.currentSessionId);
        });
        if (owner) {
          state.currentWorkspaceId = String(owner.workspaceId);
          try { localStorage.setItem(PICK_KEY, state.currentWorkspaceId); } catch (_) {}
        }
      }
      // 兜底 2：当前工作区不存在（被删或从未选过）→ 回落到第一个
      if (state.workspaces.length
          && (!state.currentWorkspaceId
              || !state.workspaces.some((w) => String(w.workspaceId) === state.currentWorkspaceId))) {
        state.currentWorkspaceId = String(state.workspaces[0].workspaceId);
        try { localStorage.setItem(PICK_KEY, state.currentWorkspaceId); } catch (_) {}
      }
      // 当前工作区变了 → 立即重排 + 确保展开
      if (state.currentWorkspaceId && state.currentWorkspaceId !== lastEnsuredWorkspaceId) {
        lastEnsuredWorkspaceId = state.currentWorkspaceId;
        focusDirty = true;
        startEnsureExpanded();
      }
      if (focusDirty) {
        focusDirty = false;
        applyFocusMode();
      }
      // 直接现查 DOM 更新，不依赖任何缓存的句柄
      paintInline(ctx);
    }

    // ---------- 环境自检 ----------
    // DSH 更新后 DOM 结构可能变化，导致插件失效。
    // 这里主动检测并给出用户可见的提示，而不是静默失败。
    function checkEnvironment() {
      const issues = [];
      try {
        const header = document.querySelector("[data-sidebar-workspace-header]");
        if (!header) issues.push("找不到侧栏标题栏（data-sidebar-workspace-header）");
        const listArea = document.querySelector("[data-sidebar-list-area]");
        if (!listArea) issues.push("找不到会话列表区（data-sidebar-list-area）");
        const wsRow = document.querySelector('[data-row-key^="workspace:"]');
        if (!wsRow) issues.push("找不到工作区行（data-row-key=workspace:*）");
        else {
          const section = wsRow.closest('[class*="groupSection"]') || wsRow.parentElement;
          if (!section) issues.push("工作区行没有父容器");
        }
      } catch (error) {
        issues.push("自检异常: " + (error && error.message || error));
      }
      return issues;
    }

    // 显示可见的失败横幅（用户能看到，而不是只有控制台）
    const BANNER_ID = "dws-incompatible-banner";
    function showIncompatibleBanner(issues) {
      try {
        if (document.getElementById(BANNER_ID)) return;
        ensureStyle();
        const box = document.createElement("div");
        box.id = BANNER_ID;
        box.className = "dws-banner";
        const title = document.createElement("div");
        title.className = "dws-banner-title";
        title.textContent = "工作区切换器未生效";
        const desc = document.createElement("div");
        desc.className = "dws-banner-desc";
        desc.textContent = "可能是不兼容当前 DSH 版本。原生侧栏不受影响，可以继续使用。";
        const list = document.createElement("ul");
        list.className = "dws-banner-list";
        for (const it of issues.slice(0, 3)) {
          const li = document.createElement("li");
          li.textContent = it;
          list.appendChild(li);
        }
        const close = document.createElement("button");
        close.type = "button";
        close.className = "dws-banner-close";
        close.textContent = "知道了";
        close.addEventListener("click", () => box.remove());
        box.append(title, desc, list, close);
        document.body.appendChild(box);
      } catch (_) {}
    }

    function hideIncompatibleBanner() {
      try {
        const el = document.getElementById(BANNER_ID);
        if (el) el.remove();
      } catch (_) {}
    }

    // ---------- 挂载 ----------
    // 目标：把「工作区」这三个字的位置换成一个可点击的工作区选择器，
    // 右侧的搜索/排序/新建按钮原位不动。
    //
    // 做法：找到 header 里的 .sectionLabel 节点，把它隐藏，
    // 在同位置插入我们的按钮（保持同样的布局流，不影响右侧按钮）。

    // 幂等挂载：确保 DOM 存在且位置正确，不维护任何引用
    // 每次调用都从 DOM 现查，因此可以随便重复调用
    function mount(ctx) {
      ensureStyle();
      const header = document.querySelector("[data-sidebar-workspace-header]");
      if (!header || !header.parentElement) return false;

      const parent = header.parentElement;
      const listArea = parent.querySelector("[data-sidebar-list-area]");
      let host = parent.querySelector('.dws-inline[data-dws="host"]');

      // 1) 没有就建
      if (!host) {
        host = document.createElement("div");
        host.className = "dws-inline";
        host.setAttribute("data-dws", "host");
        const built = createInlineNode(ctx);
        host.appendChild(built.node);

        // 插到 listArea 之前；没有 listArea 就插在 header 后面
        if (listArea && listArea.parentElement === parent) parent.insertBefore(host, listArea);
        else header.after(host);
      } else if (listArea && listArea.parentElement === parent && host.nextElementSibling !== listArea) {
        // 2) 有但位置不对 → 校正
        parent.insertBefore(host, listArea);
      }

      // 3) 刷新内容
      hideIncompatibleBanner();
      const ok = paintInline(ctx);

      // 4) 应用聚焦：此刻数据可能还没就绪（currentWorkspaceId 为空），
      //    所以在多个时间点重试，确保数据到位后能应用上。
      const tryFocus = (attempt) => {
        if (disposed) return;
        if (state.currentWorkspaceId) {
          applyFocusMode();
          startEnsureExpanded();       // 持续确保展开
          return;
        }
        if (attempt < 12) setTimeout(() => tryFocus(attempt + 1), 250);
      };
      tryFocus(0);

      return ok || Boolean(host);
    }

    function unmount() {
      try {
        // 移除所有我们的节点（可能有残留）
        document.querySelectorAll(".dws-inline").forEach((el) => el.remove());
        document.querySelectorAll(".dws-mask").forEach((el) => el.remove());
        // 恢复原生标签
        // 恢复所有被我们改过的分组/行
        document.querySelectorAll('[data-row-key^="workspace:"]').forEach((row) => {
          row.style.display = "";
          const section = row.closest('[class*="groupSection"]') || row.parentElement;
          if (section) section.style.display = "";
        });
        // 移除样式
        const styleEl = document.getElementById(CSS_ID);
        if (styleEl) styleEl.remove();
      } catch (_) {}
      modalOpen = false;
    }

    exports.apply = function apply(ctx) {
      ctx.logger?.info?.("[workspace-switcher] 已加载（非侵入式）");

      let mountTimer = null;
  
      function tryMount(attempt) {
        if (disposed) return;
        if (mount(ctx)) {
          // 挂载成功后，短时间内多刷几次数据（服务可能还没就绪）
          [150, 400, 900, 1800].forEach((ms) => setTimeout(() => { if (!disposed) refresh(ctx); }, ms));
          return;
        }
        if (attempt > 40) {
          const issues = checkEnvironment();
          ctx.logger?.warn?.("[workspace-switcher] 挂载失败：" + (issues.join("；") || "40 次重试后仍未找到侧栏"));
          showIncompatibleBanner(issues.length ? issues : ["侧栏结构未找到"]);
          return;
        }
        setTimeout(() => tryMount(attempt + 1), 250);
      }

      // 自愈：React 重渲染会移除我们插入的节点。
      // 策略：MutationObserver 监听侧栏变化（即时响应）+ 低频兜底巡检（1.2s）。
      let observer = null;
      let lastApply = 0;

      // 防重入：mount 会改 DOM，改 DOM 会触发 observer，observer 又调 heal —— 必须加锁
      let healing = false;
      let healScheduled = false;
      let lastRefresh = 0;

      function heal() {
        if (disposed || healing) return;
        healing = true;
        try {
          const header = document.querySelector("[data-sidebar-workspace-header]");
          if (!header || !header.parentElement) return;

          const host = header.parentElement.querySelector('.dws-inline[data-dws="host"]');
          const listArea = header.parentElement.querySelector("[data-sidebar-list-area]");

          // 只有两种情况需要动 DOM：节点不存在，或位置不对
          let needMount = false;
          if (!host) needMount = true;
          else if (listArea && host.nextElementSibling !== listArea) needMount = true;

          if (needMount) {
            if (mount(ctx)) {
              ctx.logger?.info?.("[workspace-switcher] 已修复节点");
            }
          } else {
            // 节点和位置都对：定期重读数据（不在这里应用聚焦，避免链式触发）
            const now = Date.now();
            if (now - lastRefresh > 500) {
              lastRefresh = now;
              refresh(ctx);
            }
          }
        } finally {
          healing = false;
        }
      }

      function startWatchdog() {
        if (observer) return;
        // 即时响应 DOM 变化
        if (typeof MutationObserver === "function") {
          // 只关心「分组被重建」这一种变化。
          // 我们自己的 display 修改会产生 attribute mutation，必须忽略，否则死循环。
          observer = new MutationObserver((mutations) => {
            let needFix = false;
            for (const m of mutations) {
              if (m.type !== "childList") continue;    // 忽略属性变化（我们自己改的）
              for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                const el = n;
                if (el.matches && el.matches('[class*="groupSection"]')) { needFix = true; break; }
                if (el.querySelector && el.querySelector('[data-row-key^="workspace:"]')) { needFix = true; break; }
              }
              if (needFix) break;
            }
            if (!needFix) return;              // 没有分组重建就不管
            if (healScheduled) return;
            healScheduled = true;
            setTimeout(() => {
              healScheduled = false;
              if (disposed) return;
              // 只补隐藏状态，不走完整 heal 流程
              applyFocusMode();
            }, 30);
          });
          const target = document.querySelector("[data-sidebar-list-area]") || document.body;
          try {
            observer.observe(target.nodeType === 1 ? target.parentElement || document.body : document.body, {
              childList: true, subtree: true
            });
          } catch (_) {
            try { observer.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
          }
        }
        // 低频兜底（防 MutationObserver 漏掉的情况）
        mountTimer = setInterval(heal, 400);
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => { tryMount(0); startWatchdog(); }, { once: true });
      } else {
        tryMount(0);
        startWatchdog();
      }

      // 诊断：让用户能看到实际读到的数据
      // 调试接口：只在 URL 带 ?dws-debug=1 时暴露，避免污染用户全局
      const DEBUG = (() => {
        try { return /[?&]dws-debug=1/.test(location.search); } catch (_) { return false; }
      })();

      const exposeDiag = () => {
        const svc = serviceOf(ctx, "sessions");
        const wsSvc = serviceOf(ctx, "workspaces");
        let sessKeys = [], wsSnap = null, sessSnap = null;
        try {
          const src = svc && (svc.list || svc.state);
          if (src) {
            sessSnap = typeof src.getSnapshot === "function" ? src.getSnapshot() : src;
            sessKeys = sessSnap && typeof sessSnap === "object" ? Object.keys(sessSnap) : [];
          }
        } catch (e) { sessKeys = ["ERR:" + e.message]; }
        try {
          const wsrc = wsSvc && wsSvc.list;
          wsSnap = wsrc && typeof wsrc.getSnapshot === "function" ? wsrc.getSnapshot() : null;
        } catch (_) {}
        return {
          sessionServiceKeys: sessKeys,
          sessionSnapshotType: sessSnap === null ? "null" : (Array.isArray(sessSnap) ? "array" : typeof sessSnap),
          sessionByIdSize: state.sessionById ? state.sessionById.size : -1,
          workspacesCount: state.workspaces.length,
          currentWorkspaceId: state.currentWorkspaceId,
          currentSessionId: state.currentSessionId,
          archivedSize: state.archivedSessionIds ? state.archivedSessionIds.size : -1,
          hasByIdInSnapshot: Boolean(sessSnap && sessSnap.byId),
          snapshotPreview: sessSnap ? JSON.stringify(sessSnap).slice(0, 400) : null
        };
      };
      if (DEBUG) { try { window.__DSW_DIAG__ = exposeDiag; } catch (_) {} }

      // 核心调试对象：同样只在 debug 模式暴露
      const dswApi = {
        state,
        refresh: () => refresh(ctx),
        pickWorkspace: (id) => pickWorkspace(ctx, id),
        applyFocus: () => applyFocusMode(),
        clearFocus: () => clearFocusMode(),
        remount: () => mount(ctx),
    moveWorkspace: (src, tgt, after) => moveWorkspace(ctx, src, tgt, after),
    explainCount: (wid) => explainCount(state.workspaces.find((w) => String(w.workspaceId) === String(wid))),
        dispose: () => {
          disposed = true;
          if (mountTimer) { clearInterval(mountTimer); mountTimer = null; }
          if (ensureTimer) { clearInterval(ensureTimer); ensureTimer = null; }
          if (observer) { try { observer.disconnect(); } catch (_) {} observer = null; }
          clearFocusMode();
          unmount();
        }
      };
      if (DEBUG) { try { window.__DSW__ = dswApi; } catch (_) {} }

      // 插件卸载时清理（Cordis effect）
      try {
        ctx.effect?.(() => () => {
          disposed = true;
          if (mountTimer) { clearInterval(mountTimer); mountTimer = null; }
          clearFocusMode();
          unmount();
        });
      } catch (_) {}
    };

    return module.exports;
  }
});
