export const name = 'dsh-workspace-switcher';

// 服务端半边：这个插件没有服务端逻辑。
// 全部工作在 client.js 里通过 DSH 的 slots 插槽完成（替换 sidebar.workspaces）。
// 保留此文件是 DSH 插件契约要求（必须导出 name 和 apply）。

export const Config = {
  enabled: { type: 'boolean', default: true, description: '是否启用' },
  defaultCollapsed: { type: 'boolean', default: true, description: '启动时收起' }
};

export function apply(ctx, config) {
  const enabled = config?.enabled !== false;
  ctx.logger?.info?.('[workspace-switcher] ' + (enabled ? '已启用（UI 在客户端）' : '已禁用'));
}
