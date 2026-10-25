const errors: Record<string, [string, string]> = {
  STARTER_SYNC_PENDING: [
    '本机首次伙伴等待同步。请重新连接恢复，账号和本机伙伴均已保留。',
    'Your first companion is awaiting sync. Reconnect to recover; your account and local companion are preserved.'
  ],
  CLIENT_UPDATE_REQUIRED: [
    '请更新到最新正式版本后再登录或注册。当前可继续离线学习。',
    'Update to the latest stable version before signing in or registering. Offline learning remains available.'
  ],
  CLIENT_POLICY_UNAVAILABLE: [
    '暂时无法验证最新版本，账号功能暂不可用。请重新连接；离线学习可以继续。',
    'The latest version cannot be verified. Reconnect to use your account; offline learning remains available.'
  ],
  CLIENT_APP_MISMATCH: [
    '账号会话与应用不匹配，请退出后重新登录。',
    'This session belongs to another app. Sign out and sign in again.'
  ],
  DRAW_POOL_CHANGED: [
    '奖池已经换期，请刷新后重新确认寻访。',
    'The pool changed. Refresh and confirm your discovery again.'
  ],
  HOME_CHANGED: [
    '另一台设备已修改家园，请刷新后再保存。',
    'Another device changed your home. Refresh before saving.'
  ],
  INVALID_HOME_SKIN: ['请选择已有的家园风格。', 'Choose an available home style.'],
  INVALID_HOME_POSITION: ['请将伙伴放在家园范围内。', 'Place companions inside the home.'],
  PENDING_RECOVERY: [
    '上一次操作结果尚未确认，请先重新连接恢复。',
    'Reconnect to recover the previous operation before continuing.'
  ],
  COMPANION_CHANGED: [
    '另一台设备已更换养成伙伴，请刷新后再确认。',
    'Another device changed your companion. Refresh before confirming.'
  ],
  CHARACTER_NOT_OWNED: ['请先获得这只语言伙伴。', 'Collect this language companion first.'],
  SHOP_PRICE_CHANGED: [
    '价格已经更新，请刷新商店并重新确认。',
    'The price changed. Refresh the shop and confirm again.'
  ],
  FRIEND_NOT_FOUND: ['没有找到该公开编号对应的用户。', 'No user has this public ID.'],
  CANNOT_FRIEND_SELF: ['不能添加自己为好友。', 'You cannot add yourself as a friend.'],
  ALREADY_FRIENDS: ['已经是好友。', 'You are already friends.'],
  FRIEND_REQUEST_PENDING: ['好友邀请已发送，请等待对方处理。', 'An invitation is already pending.'],
  FRIEND_INVITATION_NOT_FOUND: ['该邀请不存在或不属于你。', 'This invitation is unavailable.'],
  FRIEND_INVITATION_HANDLED: ['这条邀请已处理。', 'This invitation has already been handled.'],
  FRIEND_LIMIT: ['好友数量已达到上限。', 'The friend limit has been reached.'],
  FRIEND_REQUEST_LIMIT: [
    '待处理的邀请已达到上限。',
    'The pending invitation limit has been reached.'
  ],
  NOT_FRIENDS: ['目前不是好友。', 'You are not currently friends.'],
  COMPANION_NOT_OWNED: ['请先获得这只语言伙伴。', 'Collect this language companion first.'],
  COMPANION_NOT_SELECTED: [
    '请先在图鉴选择一只养成伙伴。',
    'Select a companion in the catalog first.'
  ],
  DAILY_ANSWER_LIMIT: [
    '今日养成经验已达上限，仍可继续学习。',
    'Today’s companion XP limit is reached; learning can continue.'
  ],
  INVALID_PUBLIC_ID: ['请填写完整的好友公开编号。', 'Enter the full public ID.'],
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
  PAYMENT_STATUS_UNKNOWN: [
    '暂时无法确认付款结果，请稍后核对同一订单，不要重复付款。',
    'The payment result is not confirmed. Check the same order again shortly; do not pay twice.'
  ],
  PAYMENT_PROVIDER_UNAVAILABLE: [
    '暂时无法连接微信收款服务。已有订单请稍后重新核对，不要重复付款。',
    'WeChat checkout is temporarily unavailable. Check existing orders again shortly; do not pay twice.'
  ],
  PAYMENT_PROVIDER_NOT_CONFIGURED: [
    '微信收款入口暂不可用，请勿付款。已有订单可稍后核对。',
    'WeChat checkout is unavailable. Do not make a payment; check existing orders again shortly.'
  ],
  PAYMENT_PROVIDER_TIMEOUT: [
    '收款服务响应超时，付款结果尚未确认。请稍后核对同一订单，不要重复付款。',
    'The payment service timed out and the result is unconfirmed. Check the same order again shortly; do not pay twice.'
  ],
  PAYMENT_CHECK_BUSY: [
    '这笔订单正在核对，请稍后查看同一订单。',
    'This order is being checked. View the same order again shortly.'
  ],
  PAYMENT_NOT_CONFIRMED: [
    '服务器尚未确认付款到账，请稍后核对同一订单。',
    'The server has not confirmed payment yet. Check the same order again shortly.'
  ],
  PAYMENT_REVIEW_REQUIRED: [
    '这笔付款需要进一步核对，请保留订单编号并联系运营者。',
    'This payment needs further review. Keep the order ID and contact the operator.'
  ],
  PAYMENT_REFUNDED: [
    '这笔订单已有退款或待核对的退款记录，请查看同一订单并联系运营者。',
    'This order has a refund or pending refund review. View the same order and contact the operator.'
  ],
  ORDER_NOT_FOUND: [
    '没有找到此订单，请刷新订单记录。',
    'This order was not found. Refresh your order history.'
  ],
  ORDER_MODE_MISMATCH: [
    '此订单不支持当前付款操作，请查看订单记录。',
    'This order does not support this payment action. View your order history.'
  ],
  IDEMPOTENCY_CONFLICT: [
    '上一次请求的信息尚待核对，请重新连接恢复，不要重复付款。',
    'The previous request needs verification. Reconnect to recover it; do not pay twice.'
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
for (const code of [
  'PAYMENT_PROVIDER_INVALID_RESPONSE',
  'PAYMENT_PROVIDER_AMOUNT_MISMATCH',
  'PAYMENT_PROVIDER_INVALID_ORDER',
  'PAYMENT_PROVIDER_INVALID_SIGNATURE',
  'PAYMENT_PROVIDER_INVALID_AMOUNT',
  'PAYMENT_ORDER_MISMATCH',
  'PAYMENT_AMOUNT_MISMATCH',
  'PAYMENT_REFERENCE_MISMATCH',
  'PAYMENT_REFERENCE_INVALID',
  'PAYMENT_ALREADY_USED'
])
  errors[code] = [
    '付款资料暂未通过核验，尚未发放寻访笺。请保留订单编号并联系运营者，不要重复付款。',
    'Payment details have not passed verification and tickets have not been issued. Keep the order ID and contact the operator; do not pay twice.'
  ]
/** Raw errors stay in state for recovery logic; transport/IPC internals never become user copy. */
export function accountError(raw: string, locale: string): string {
  const code = Object.keys(errors).find((key) => raw.includes(key))
  return code
    ? errors[code][locale === 'zh' ? 0 : 1]
    : locale === 'zh'
      ? '操作未完成，请刷新后重试。'
      : 'The operation did not complete. Refresh and try again.'
}
