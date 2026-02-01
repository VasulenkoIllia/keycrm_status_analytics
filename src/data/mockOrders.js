import dayjs from 'dayjs';

export const STAGE_LIMITS_HOURS = {
  new: 12,
  approval: 24,
  production: 24,
  delivery: 12
};

export const STAGE_LABELS = {
  new: 'Новий',
  approval: 'Погодження',
  production: 'Виробництво',
  delivery: 'Доставка',
  done: 'Виконано'
};

export const STATUS_BY_STAGE = {
  new: ['Новий'],
  approval: ['Матеріали', 'Макет', 'Заміна', 'Без файлу', 'Обробка замовлення', 'Оплата не підтверджена'],
  production: ['Друк', 'Пакування', 'Постер', 'Скачано макет', 'Заміна друк', 'Заміна пакування', 'Заміна скачано макет'],
  delivery: ['Передано в доставку', 'В дорозі (зовнішня служба)', 'Нема ТТН'],
  done: ['Виконано', 'Оплату отримано відправником']
};

const now = dayjs('2026-01-31T12:00:00Z');

export const mockOrders = [
  {
    id: '23194',
    project: 'Shopify',
    createdAt: now.subtract(26, 'hour').toISOString(),
    updatedAt: now.subtract(1, 'hour').toISOString(),
    currentStatus: 'В дорозі (зовнішня служба)',
    stageTimes: {
      new: 6 * 3600 + 20 * 60,
      approval: 7 * 3600 + 10 * 60,
      production: 9 * 3600 + 45 * 60,
      delivery: 3 * 3600 + 5 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-28T11:30:00', leftAt: '2026-01-28T17:50:00' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-28T17:50:00', leftAt: '2026-01-28T21:00:00' },
      { stage: 'approval', status: 'Макет', enteredAt: '2026-01-28T21:00:00', leftAt: '2026-01-29T00:40:00' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-29T00:40:00', leftAt: '2026-01-29T06:25:00' },
      { stage: 'production', status: 'Пакування', enteredAt: '2026-01-29T06:25:00', leftAt: '2026-01-29T09:25:00' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-29T09:25:00', leftAt: '2026-01-29T10:45:00' },
      { stage: 'delivery', status: 'В дорозі (зовнішня служба)', enteredAt: '2026-01-29T10:45:00', leftAt: null }
    ]
  },
  {
    id: '23192',
    project: 'Shopify',
    createdAt: now.subtract(3, 'day').toISOString(),
    updatedAt: now.subtract(30, 'minute').toISOString(),
    currentStatus: 'В дорозі (зовнішня служба)',
    stageTimes: {
      new: 14 * 3600,
      approval: 26 * 3600 + 30 * 60,
      production: 22 * 3600,
      delivery: 14 * 3600 + 20 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-26T09:00:00Z', leftAt: '2026-01-26T23:00:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-26T23:00:00Z', leftAt: '2026-01-27T12:30:00Z' },
      { stage: 'approval', status: 'Макет', enteredAt: '2026-01-27T12:30:00Z', leftAt: '2026-01-28T01:30:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-28T01:30:00Z', leftAt: '2026-01-28T13:30:00Z' },
      { stage: 'production', status: 'Пакування', enteredAt: '2026-01-28T13:30:00Z', leftAt: '2026-01-28T23:30:00Z' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-28T23:30:00Z', leftAt: '2026-01-29T06:30:00Z' },
      { stage: 'delivery', status: 'В дорозі (зовнішня служба)', enteredAt: '2026-01-29T06:30:00Z', leftAt: null }
    ]
  },
  {
    id: '23193',
    project: 'Shopify',
    createdAt: now.subtract(8, 'hour').toISOString(),
    updatedAt: now.subtract(20, 'minute').toISOString(),
    currentStatus: 'Друк',
    stageTimes: {
      new: 2 * 3600 + 40 * 60,
      approval: 3 * 3600 + 30 * 60,
      production: 4 * 3600 + 15 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-31T04:00:00Z', leftAt: '2026-01-31T06:40:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-31T06:40:00Z', leftAt: '2026-01-31T08:10:00Z' },
      { stage: 'approval', status: 'Обробка замовлення', enteredAt: '2026-01-31T08:10:00Z', leftAt: '2026-01-31T09:40:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-31T09:40:00Z', leftAt: null }
    ]
  },
  {
    id: '23195',
    project: 'Etsy',
    createdAt: now.subtract(1, 'day').toISOString(),
    updatedAt: now.subtract(10, 'minute').toISOString(),
    currentStatus: 'Пакування',
    stageTimes: {
      new: 1 * 3600 + 15 * 60,
      approval: 2 * 3600 + 40 * 60,
      production: 6 * 3600 + 30 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-30T10:00:00Z', leftAt: '2026-01-30T11:15:00Z' },
      { stage: 'approval', status: 'Макет', enteredAt: '2026-01-30T11:15:00Z', leftAt: '2026-01-30T13:55:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-30T13:55:00Z', leftAt: '2026-01-30T19:15:00Z' },
      { stage: 'production', status: 'Пакування', enteredAt: '2026-01-30T19:15:00Z', leftAt: null }
    ]
  },
  {
    id: '23196',
    project: 'B2B',
    createdAt: now.subtract(5, 'day').toISOString(),
    updatedAt: now.subtract(2, 'day').toISOString(),
    currentStatus: 'Виконано',
    stageTimes: {
      new: 3 * 3600,
      approval: 4 * 3600,
      production: 7 * 3600 + 20 * 60,
      delivery: 5 * 3600 + 10 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-26T09:00:00Z', leftAt: '2026-01-26T12:00:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-26T12:00:00Z', leftAt: '2026-01-26T16:00:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-26T16:00:00Z', leftAt: '2026-01-27T00:20:00Z' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-27T00:20:00Z', leftAt: '2026-01-27T05:30:00Z' },
      { stage: 'delivery', status: 'Виконано', enteredAt: '2026-01-27T05:30:00Z', leftAt: null }
    ]
  },
  {
    id: '23197',
    project: 'B2B',
    createdAt: now.subtract(12, 'hour').toISOString(),
    updatedAt: now.subtract(40, 'minute').toISOString(),
    currentStatus: 'В дорозі (зовнішня служба)',
    stageTimes: {
      new: 1 * 3600,
      approval: 1 * 3600 + 20 * 60,
      production: 2 * 3600 + 30 * 60,
      delivery: 5 * 3600 + 30 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-31T00:00:00Z', leftAt: '2026-01-31T01:00:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-31T01:00:00Z', leftAt: '2026-01-31T02:20:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-31T02:20:00Z', leftAt: '2026-01-31T04:50:00Z' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-31T04:50:00Z', leftAt: '2026-01-31T10:20:00Z' },
      { stage: 'delivery', status: 'В дорозі (зовнішня служба)', enteredAt: '2026-01-31T10:20:00Z', leftAt: null }
    ]
  },
  {
    id: '23198',
    project: 'Retail',
    createdAt: now.subtract(6, 'hour').toISOString(),
    updatedAt: now.subtract(15, 'minute').toISOString(),
    currentStatus: 'Оплату отримано відправником',
    stageTimes: {
      new: 45 * 60,
      approval: 1 * 3600,
      production: 2 * 3600,
      delivery: 1 * 3600 + 15 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-31T05:45:00Z', leftAt: '2026-01-31T06:30:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-31T06:30:00Z', leftAt: '2026-01-31T07:30:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-31T07:30:00Z', leftAt: '2026-01-31T09:30:00Z' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-31T09:30:00Z', leftAt: '2026-01-31T10:45:00Z' },
      { stage: 'delivery', status: 'Оплату отримано відправником', enteredAt: '2026-01-31T10:45:00Z', leftAt: null }
    ]
  },
  {
    id: '23199',
    project: 'Retail',
    createdAt: now.subtract(18, 'hour').toISOString(),
    updatedAt: now.subtract(3, 'hour').toISOString(),
    currentStatus: 'Постер',
    stageTimes: {
      new: 30 * 60,
      approval: 50 * 60,
      production: 8 * 3600 + 20 * 60
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-30T18:00:00Z', leftAt: '2026-01-30T18:30:00Z' },
      { stage: 'approval', status: 'Макет', enteredAt: '2026-01-30T18:30:00Z', leftAt: '2026-01-30T19:20:00Z' },
      { stage: 'production', status: 'Постер', enteredAt: '2026-01-30T19:20:00Z', leftAt: null }
    ]
  },
  {
    id: '23200',
    project: 'Enterprise',
    createdAt: now.subtract(10, 'day').toISOString(),
    updatedAt: now.subtract(7, 'day').toISOString(),
    currentStatus: 'В дорозі (зовнішня служба)',
    stageTimes: {
      new: 5 * 3600,
      approval: 8 * 3600 + 30 * 60,
      production: 30 * 3600,
      delivery: 48 * 3600
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-21T08:00:00Z', leftAt: '2026-01-21T13:00:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-21T13:00:00Z', leftAt: '2026-01-21T21:30:00Z' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-21T21:30:00Z', leftAt: '2026-01-23T03:30:00Z' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-23T03:30:00Z', leftAt: '2026-01-25T03:30:00Z' },
      { stage: 'delivery', status: 'В дорозі (зовнішня служба)', enteredAt: '2026-01-25T03:30:00Z', leftAt: null }
    ]
  },
  {
    id: '23201',
    project: 'Enterprise',
    createdAt: now.subtract(2, 'day').toISOString(),
    updatedAt: now.subtract(1, 'day').toISOString(),
    currentStatus: 'Матеріали',
    stageTimes: {
      new: 6 * 3600,
      approval: 20 * 3600
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-29T10:00:00Z', leftAt: '2026-01-29T16:00:00Z' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-29T16:00:00Z', leftAt: null }
    ]
  }
];
