export function ledgerName(kind: string, locale: string): string {
  const labels: [string, string, string][] = [
    ['companion/select', '选择养成精灵', 'Companion selected'],
    ['companion/answer', '语言精灵成长', 'Companion growth'],
    ['friends/request', '发送好友邀请', 'Friend invitation sent'],
    ['friends/respond', '处理好友邀请', 'Friend invitation handled'],
    ['friends/remove', '删除好友', 'Friend removed'],
    ['reward/activity', '学习奖励', 'Learning rewards'],
    ['shop/purchase', '商店兑换', 'Shop redemption'],
    ['inventory/use', '使用续页笺', 'Makeup slip used'],
    ['tasks/configure', '调整任务计划', 'Task plan changed'],
    ['collection/legacy', '旧纪念同步', 'Earlier memorials synced'],
    ['test/grant', '测试寻访笺', 'Test tickets'],
    ['support', '支持订单', 'Support order'],
    ['draw', '寻访相遇', 'Discovery']
  ]
  const match = labels.find(([key]) => kind.includes(key))
  return match ? match[locale === 'zh' ? 1 : 2] : locale === 'zh' ? '账号记录' : 'Account record'
}
export function orderStatus(status: string, locale: string): string {
  const labels: Record<string, [string, string]> = {
    pending: ['待人工核验', 'Pending manual verification'],
    approved: ['已核验', 'Verified'],
    rejected: ['未通过核验', 'Not verified'],
    cancelled: ['已取消', 'Cancelled']
  }
  return labels[status]?.[locale === 'zh' ? 0 : 1] ?? (locale === 'zh' ? '处理中' : 'Processing')
}
