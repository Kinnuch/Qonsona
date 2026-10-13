const errors: Record<string, [string, string]> = {
  UNAUTHORIZED: ['登录已失效，请重新登录。', 'Your session expired. Please sign in again.'],
  SESSION_EXPIRED: ['登录已失效，请重新登录。', 'Your session expired. Please sign in again.'],
  INVALID_CREDENTIALS: ['用户名或密码不正确。', 'Username or password is incorrect.'],
  USERNAME_TAKEN: ['这个用户名已被使用。', 'This username is already taken.'],
  INVALID_USERNAME: [
    '用户名须为 3–32 位英文字母、数字或下划线。',
    'Use 3–32 ASCII letters, digits or underscores for your username.'
  ],
  INVALID_PASSWORD: ['密码须为 10–128 位。', 'Use a password of 10–128 characters.'],
  INSUFFICIENT_POINTS: [
    '灵墨不足，请先完成学习任务。',
    'Not enough Ink. Complete learning activities first.'
  ],
  INSUFFICIENT_TICKETS: ['所选寻访笺不足。', 'Not enough tickets from the selected source.'],
  INSUFFICIENT_ECHOES: ['余韵不足。', 'Not enough echoes.'],
  INSUFFICIENT_ITEMS: ['续页笺不足。', 'Not enough makeup slips.'],
  ALREADY_OWNED: ['已经拥有这件馆藏或装饰。', 'This collectible or decoration is already owned.'],
  RATE_LIMITED: ['请求过于频繁，请稍后再试。', 'Too many requests. Please try again later.'],
  SERVICE_UNAVAILABLE: [
    '暂时无法连接账号服务器。本地学习可以继续；重新连接后可重试原操作。',
    'The account server is unavailable. Local learning continues; reconnect and retry the original operation.'
  ],
  PAYMENTS_DISABLED: [
    '支持订单暂未开放，请勿付款。',
    'Support orders are unavailable. Do not make a payment.'
  ],
  TASK_PLAN_LOCKED: [
    '今日学习已经开始，不能再修改任务计划。',
    'Today’s learning has started; the task plan is locked.'
  ],
  TASK_PLAN_CHANGE_LIMIT: ['今天已调整过任务计划。', 'Today’s task plan has already been changed.'],
  INVALID_TASK_PLAN: ['请选择两个不同的学习板块。', 'Choose two different learning sections.'],
  MAKEUP_MONTH_LIMIT: ['本月续页次数已用完。', 'This month’s makeup allowance is used up.'],
  MAKEUP_DATE_RANGE: [
    '只能补记过去七天的空白日。',
    'Choose a missed day within the last seven days.'
  ],
  ALREADY_CHECKED_IN: ['这一天已经签到。', 'This day already has a check-in.'],
  INVENTORY_CAP: [
    '续页笺库存已满（最多三张）。',
    'Your makeup-slip inventory is full (maximum three).'
  ],
  SUPPORT_MONTH_LIMIT: [
    '本月支持订单已达到上限。',
    'This month’s support-order limit has been reached.'
  ],
  INVALID_BODY: [
    '提交的信息格式不正确，请检查后重试。',
    'Please check the submitted information and try again.'
  ]
}
/** Raw errors stay in state for recovery logic; transport/IPC internals never become user copy. */
export function accountError(raw: string, locale: string): string {
  const code = Object.keys(errors).find((key) => raw.includes(key))
  return code
    ? errors[code][locale === 'zh' ? 0 : 1]
    : locale === 'zh'
      ? '操作未完成，请刷新后重试。'
      : 'The operation did not complete. Refresh and try again.'
}
