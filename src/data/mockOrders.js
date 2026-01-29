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

const now = dayjs('2026-01-29T13:50:00');

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
      new: 14 * 3600, // перевищення 12 год
      approval: 26 * 3600 + 30 * 60, // перевищення 24 год
      production: 22 * 3600, // трохи менше ліміту
      delivery: 14 * 3600 + 20 * 60 // перевищення 12 год
    },
    timeline: [
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-26T09:00:00', leftAt: '2026-01-26T23:00:00' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-26T23:00:00', leftAt: '2026-01-27T12:30:00' },
      { stage: 'approval', status: 'Макет', enteredAt: '2026-01-27T12:30:00', leftAt: '2026-01-28T01:30:00' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-28T01:30:00', leftAt: '2026-01-28T13:30:00' },
      { stage: 'production', status: 'Пакування', enteredAt: '2026-01-28T13:30:00', leftAt: '2026-01-28T23:30:00' },
      { stage: 'delivery', status: 'Передано в доставку', enteredAt: '2026-01-28T23:30:00', leftAt: '2026-01-29T06:30:00' },
      { stage: 'delivery', status: 'В дорозі (зовнішня служба)', enteredAt: '2026-01-29T06:30:00', leftAt: null }
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
      { stage: 'new', status: 'Новий', enteredAt: '2026-01-29T05:30:00', leftAt: '2026-01-29T08:10:00' },
      { stage: 'approval', status: 'Матеріали', enteredAt: '2026-01-29T08:10:00', leftAt: '2026-01-29T09:40:00' },
      { stage: 'approval', status: 'Обробка замовлення', enteredAt: '2026-01-29T09:40:00', leftAt: '2026-01-29T11:40:00' },
      { stage: 'production', status: 'Друк', enteredAt: '2026-01-29T11:40:00', leftAt: null }
    ]
  }
];
