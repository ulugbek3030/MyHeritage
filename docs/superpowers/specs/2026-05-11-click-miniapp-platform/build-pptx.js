// Generate the Click Mini-Apps Platform proposal presentation
// Palette: Ocean Gradient — deep blue / teal / midnight on dark, white / pale grey on light
// Fonts: Calibri (headers, bold) + Calibri Light (body)

const PptxGenJS = require('pptxgenjs');
const pres = new PptxGenJS();

pres.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5"
pres.title = 'Click Mini-Apps Platform — Предложение';
pres.author = 'Click Family team';
pres.company = 'Click';

// ── palette ──────────────────────────────────────────────────────────────────
const C = {
  deepBlue: '065A82',
  teal:     '1C7293',
  midnight: '21295C',
  white:    'FFFFFF',
  paleBg:   'F5F8FA',
  textDark: '1A2238',
  textMute: '5A6478',
  accent:   'F2B14F', // warm gold accent — used sparingly
  green:    '4CAF50',
  red:      'D9534F',
  amber:    'F0AD4E',
};

const F = {
  header: 'Calibri',
  body:   'Calibri Light',
};

// ── helpers ──────────────────────────────────────────────────────────────────
const slide = (opts = {}) => {
  const s = pres.addSlide();
  s.background = opts.bg ? { color: opts.bg } : { color: C.paleBg };
  return s;
};

const title = (s, text, opts = {}) => {
  s.addText(text, {
    x: 0.5, y: 0.45, w: 12.33, h: 0.9,
    fontFace: F.header, fontSize: opts.size || 36, bold: true,
    color: opts.color || C.midnight,
    align: 'left', valign: 'top',
  });
};

const subtitle = (s, text, opts = {}) => {
  s.addText(text, {
    x: 0.5, y: 1.35, w: 12.33, h: 0.5,
    fontFace: F.body, fontSize: 15, italic: true,
    color: opts.color || C.textMute,
    align: 'left', valign: 'top',
  });
};

const pageNumber = (s, n, total) => {
  s.addText(`${n} / ${total}`, {
    x: 12.4, y: 7.05, w: 0.8, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.textMute, align: 'right',
  });
};

const TOTAL = 11;

// ─────────────────────────────────────────────────────────────────────────────
// Slide 1 — Title (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide({ bg: C.deepBlue });

  // big left accent block — teal
  s.addShape('rect', {
    x: 0, y: 0, w: 0.45, h: 7.5, fill: { color: C.teal },
  });

  // floating midnight square (decorative motif)
  s.addShape('rect', {
    x: 11.0, y: 5.0, w: 2.0, h: 2.0, fill: { color: C.midnight },
    line: { color: C.teal, width: 1 },
  });
  s.addShape('rect', {
    x: 10.2, y: 5.8, w: 2.0, h: 2.0, fill: { color: C.teal },
    line: { color: C.midnight, width: 1 }, transparency: 25,
  });

  s.addText('Click Mini-Apps\nPlatform', {
    x: 1.0, y: 2.0, w: 10.0, h: 2.2,
    fontFace: F.header, fontSize: 60, bold: true, color: C.white,
    align: 'left', valign: 'top',
    paraSpaceBefore: 4,
  });

  s.addText('Предложение по программе для внешних разработчиков', {
    x: 1.0, y: 4.4, w: 10.0, h: 0.6,
    fontFace: F.body, fontSize: 22, color: 'CADCFC',
    align: 'left', valign: 'top',
  });

  // divider line
  s.addShape('line', {
    x: 1.0, y: 5.2, w: 5.0, h: 0,
    line: { color: C.accent, width: 2 },
  });

  s.addText([
    { text: '11 мая 2026', options: { fontFace: F.header, fontSize: 14, color: C.white, bold: true } },
    { text: '   ·   ', options: { fontFace: F.body, fontSize: 14, color: C.teal } },
    { text: 'Подготовлено командой Click Family', options: { fontFace: F.body, fontSize: 14, color: 'CADCFC' } },
  ], {
    x: 1.0, y: 5.4, w: 10.0, h: 0.4,
    align: 'left', valign: 'top',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 2 — Цель
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Цель');
  subtitle(s, 'Зачем формализовать программу для разработчиков мини-аппов');

  // left column: explanatory text
  s.addText([
    {
      text: 'Click открывает программу для ',
      options: { fontFace: F.body, fontSize: 16, color: C.textDark },
    },
    {
      text: 'внешних разработчиков',
      options: { fontFace: F.body, fontSize: 16, color: C.deepBlue, bold: true },
    },
    {
      text: ' (юр.лицо / ИП / самозанятый) — с понятными правилами, документами и SLA. Превращаем разработку мини-аппов из «дёрни знакомого в Click» в публичную программу.',
      options: { fontFace: F.body, fontSize: 16, color: C.textDark },
    },
  ], {
    x: 0.5, y: 2.1, w: 6.0, h: 2.5,
    align: 'left', valign: 'top',
    paraSpaceAfter: 8,
  });

  // right column: 3 stacked cards
  const cards = [
    { title: 'Полный контроль', text: 'KYC, ревью, kill-switch, audit log — что попадает к пользователям решает Click' },
    { title: 'Низкая операционка', text: 'Self-hosted мини-аппы — runtime у разработчика, Click не несёт нагрузку выполнения' },
    { title: 'Compliance trail',  text: 'Прозрачная аудиторская цепочка для регулятора и собственного compliance' },
  ];
  cards.forEach((c, i) => {
    const y = 2.0 + i * 1.55;
    // card bg
    s.addShape('rect', {
      x: 6.9, y: y, w: 5.9, h: 1.35, fill: { color: C.white },
      line: { color: 'E0E6EE', width: 1 },
    });
    // left coloured bar
    s.addShape('rect', {
      x: 6.9, y: y, w: 0.12, h: 1.35, fill: { color: C.teal },
    });
    s.addText(c.title, {
      x: 7.2, y: y + 0.15, w: 5.5, h: 0.4,
      fontFace: F.header, fontSize: 16, bold: true, color: C.midnight,
    });
    s.addText(c.text, {
      x: 7.2, y: y + 0.55, w: 5.5, h: 0.75,
      fontFace: F.body, fontSize: 12, color: C.textMute,
    });
  });

  pageNumber(s, 2, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 3 — Что предлагаем — в одном абзаце
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Что предлагаем — в одном абзаце');
  subtitle(s, 'Программа Click Mini-Apps Platform одной строкой');

  // accent quote-style block
  s.addShape('rect', {
    x: 0.5, y: 2.0, w: 0.15, h: 4.5,
    fill: { color: C.deepBlue },
  });

  s.addText([
    {
      text: 'Click открывает программу ',
      options: { fontFace: F.body, fontSize: 18, color: C.textDark },
    },
    {
      text: 'miniapps.click.uz',
      options: { fontFace: F.body, fontSize: 18, color: C.deepBlue, bold: true },
    },
    {
      text: ' с кабинетом разработчика, тестовой инфраструктурой (собственный GitLab + sandbox API + sandbox-эмулятор Click WebView), документацией и формализованным процессом ',
      options: { fontFace: F.body, fontSize: 18, color: C.textDark },
    },
    {
      text: 'ревью → approve → публикация',
      options: { fontFace: F.body, fontSize: 18, color: C.deepBlue, bold: true },
    },
    {
      text: ' в нативном Click marketplace.\n\nМини-аппы хостятся на стороне разработчика. Click выступает identity provider (WebView Bridge), процессором платежей (HMAC backend API), доставщиком push (registry утверждённых шаблонов) и каталогом.\n\nБезопасность — четырёхслойная: domain pinning + daily fingerprint + delta-review + kill-switch. Эскалация при повторных нарушениях — всегда через менеджера.',
      options: { fontFace: F.body, fontSize: 18, color: C.textDark },
    },
  ], {
    x: 0.9, y: 2.0, w: 11.9, h: 4.7,
    align: 'left', valign: 'top',
    paraSpaceAfter: 6,
  });

  pageNumber(s, 3, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 4 — Три плоскости (Architecture)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Архитектура: три плоскости');
  subtitle(s, 'Чёткое разделение ответственности и интерфейсов');

  const planes = [
    {
      header: 'Developer Plane',
      tag:    'Что видит разработчик',
      color:  C.teal,
      items: [
        'miniapps.click.uz — кабинет',
        'git.miniapps.click.uz — GitLab CE',
        'docs.miniapps.click.uz — документация',
      ],
    },
    {
      header: 'Runtime Plane',
      tag:    'Где живёт мини-апп',
      color:  C.deepBlue,
      items: [
        'Мини-апп self-hosted',
        'sandbox.api.click.uz',
        'api.click.uz / auth.click.uz',
        'Click app marketplace',
      ],
    },
    {
      header: 'Governance Plane',
      tag:    'Что делает Click внутри',
      color:  C.midnight,
      items: [
        'Admin Console',
        'Daily Fingerprint Bot',
        'Push Template Registry',
        'Moderation Queue + Audit Log',
      ],
    },
  ];

  const cardW = 4.0;
  const cardH = 4.5;
  const startX = 0.4;
  const gap = 0.18;
  planes.forEach((p, i) => {
    const x = startX + i * (cardW + gap);
    // top header band
    s.addShape('rect', {
      x: x, y: 2.0, w: cardW, h: 0.85, fill: { color: p.color },
    });
    s.addText(p.header, {
      x: x + 0.2, y: 2.05, w: cardW - 0.4, h: 0.45,
      fontFace: F.header, fontSize: 18, bold: true, color: C.white, align: 'left',
    });
    s.addText(p.tag, {
      x: x + 0.2, y: 2.45, w: cardW - 0.4, h: 0.35,
      fontFace: F.body, fontSize: 11, color: 'CADCFC', align: 'left', italic: true,
    });
    // body
    s.addShape('rect', {
      x: x, y: 2.85, w: cardW, h: cardH - 0.85,
      fill: { color: C.white },
      line: { color: 'E0E6EE', width: 1 },
    });
    p.items.forEach((it, j) => {
      const itemY = 3.05 + j * 0.6;
      // bullet dot
      s.addShape('ellipse', {
        x: x + 0.25, y: itemY + 0.13, w: 0.12, h: 0.12, fill: { color: p.color },
      });
      s.addText(it, {
        x: x + 0.5, y: itemY, w: cardW - 0.6, h: 0.4,
        fontFace: F.body, fontSize: 13, color: C.textDark, valign: 'middle',
      });
    });
  });

  // footer connecting note
  s.addText('Плоскости общаются строго через определённые API. Никаких ad-hoc обходов. Все cross-plane вызовы — в audit log.', {
    x: 0.4, y: 6.7, w: 12.5, h: 0.4,
    fontFace: F.body, fontSize: 12, italic: true, color: C.textMute, align: 'center',
  });

  pageNumber(s, 4, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 5 — Что получает разработчик
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Что получает разработчик');
  subtitle(s, '10 ключевых элементов developer experience');

  const items = [
    'Регистрация за 15 мин — sandbox сразу, без проверок',
    'GitLab-репо из template под выбранный capability-уровень',
    'Sandbox Launcher — эмулятор Click WebView в кабинете',
    '10–20 тестовых пользователей с разными KYC-статусами',
    'Fake-платежи и fake-push с возможностью форсить отказы',
    'Cabinet Security Scanner (shift-left, те же проверки что на ревью)',
    'Webhook Inspector — если нет публичного URL',
    'Документация на RU+UZ, SDK для JS/Node.js',
    'Прозрачный flow ревью: 30 мин auto + 7 раб.дней manual + 3 раб.дня delta',
    'Понятная политика lifecycle: как избежать auto-disable, как восстановиться',
  ];

  const cols = 2;
  const rowH = 0.95;
  const colW = 6.1;
  const startX = 0.4;
  const startY = 2.0;
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (colW + 0.2);
    const y = startY + row * rowH;
    // numbered circle
    s.addShape('ellipse', {
      x: x, y: y + 0.1, w: 0.5, h: 0.5, fill: { color: C.teal },
    });
    s.addText(String(i + 1), {
      x: x, y: y + 0.1, w: 0.5, h: 0.5,
      fontFace: F.header, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle',
    });
    s.addText(it, {
      x: x + 0.7, y: y, w: colW - 0.7, h: 0.7,
      fontFace: F.body, fontSize: 13, color: C.textDark, valign: 'middle',
    });
  });

  pageNumber(s, 5, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 6 — Что получает Click
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Что получает Click');
  subtitle(s, '7 стратегических выигрышей для платформы');

  const items = [
    { h: 'Контролируемая экосистема',  t: 'Партнёрские сервисы в нативном marketplace без операционной нагрузки на хостинг' },
    { h: 'Compliance trail',           t: 'KYC, договоры, ревью, audit log, fingerprint history — всё структурно' },
    { h: 'Защита бренда',              t: 'Kill-switch при нарушениях, эскалация повторных — на менеджеров' },
    { h: 'Готовность к монетизации',   t: 'Поле fee_amount в payment API живёт с нуля, активация когда захотим' },
    { h: 'Стандартизация',             t: 'Все мини-аппы (включая embedded) могут переехать на единый протокол' },
    { h: 'Регуляторная готовность',    t: 'Consent flows, ПДн в Узбекистане, отчётность по транзакциям/push' },
    { h: 'Качество разработчиков',     t: 'Pen-test от утверждённых компаний отсеивает шарашек на входе' },
  ];

  const cols = 2;
  const rowH = 1.2;
  const colW = 6.1;
  const startX = 0.4;
  const startY = 2.0;
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (colW + 0.2);
    const y = startY + row * rowH;
    // card
    s.addShape('rect', {
      x: x, y: y, w: colW, h: rowH - 0.1, fill: { color: C.white },
      line: { color: 'E0E6EE', width: 1 },
    });
    s.addShape('rect', {
      x: x, y: y, w: 0.1, h: rowH - 0.1, fill: { color: C.deepBlue },
    });
    s.addText(it.h, {
      x: x + 0.3, y: y + 0.1, w: colW - 0.4, h: 0.4,
      fontFace: F.header, fontSize: 15, bold: true, color: C.midnight,
    });
    s.addText(it.t, {
      x: x + 0.3, y: y + 0.5, w: colW - 0.4, h: 0.65,
      fontFace: F.body, fontSize: 12, color: C.textMute,
    });
  });

  pageNumber(s, 6, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 7 — Capability Levels (L1-L4)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Capability Levels — что мини-аппы могут делать');
  subtitle(s, 'Инкрементальные уровни; каждый = отдельная подача на ревью');

  const levels = [
    {
      tag: 'L1', name: 'SSO',
      what: 'user_id, имя, телефон, аватар',
      kyc: 'K1 (юр.лицо / ИП / самозанятый)',
      use: 'Информационные мини-аппы, справочники',
      color: C.teal,
    },
    {
      tag: 'L2', name: 'Profile',
      what: '+ KYC статус, регион, язык',
      kyc: 'K1',
      use: 'Сервисы с ограничениями по KYC',
      color: C.deepBlue,
    },
    {
      tag: 'L3', name: 'Payments',
      what: '+ инициация платежа + webhooks',
      kyc: 'K2 (K1 + расч.счёт + договор)',
      use: 'E-commerce, доставка, услуги за деньги',
      color: C.midnight,
    },
    {
      tag: 'L4', name: 'Push',
      what: '+ push по утверждённым шаблонам',
      kyc: 'K3 (K2 + DPO + privacy policy)',
      use: 'Уведомления о заказах, статусах',
      color: '4A2545',
    },
  ];

  const colW = 3.05;
  const startX = 0.35;
  const gap = 0.12;
  levels.forEach((l, i) => {
    const x = startX + i * (colW + gap);
    // header
    s.addShape('rect', { x: x, y: 2.0, w: colW, h: 1.1, fill: { color: l.color } });
    s.addText(l.tag, {
      x: x + 0.2, y: 2.1, w: colW - 0.4, h: 0.5,
      fontFace: F.header, fontSize: 28, bold: true, color: C.white,
    });
    s.addText(l.name, {
      x: x + 0.2, y: 2.6, w: colW - 0.4, h: 0.4,
      fontFace: F.body, fontSize: 15, color: 'CADCFC',
    });

    // body
    s.addShape('rect', {
      x: x, y: 3.1, w: colW, h: 3.7, fill: { color: C.white },
      line: { color: 'E0E6EE', width: 1 },
    });

    const rows = [
      { label: 'Возможности',         val: l.what },
      { label: 'KYC tier',             val: l.kyc },
      { label: 'Типовое применение',   val: l.use },
    ];
    rows.forEach((r, ri) => {
      const ry = 3.25 + ri * 1.15;
      s.addText(r.label.toUpperCase(), {
        x: x + 0.2, y: ry, w: colW - 0.4, h: 0.3,
        fontFace: F.header, fontSize: 9, bold: true, color: l.color, charSpacing: 1,
      });
      s.addText(r.val, {
        x: x + 0.2, y: ry + 0.3, w: colW - 0.4, h: 0.75,
        fontFace: F.body, fontSize: 12, color: C.textDark,
      });
    });
  });

  pageNumber(s, 7, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 8 — KYC tiers
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'KYC tiers — кто допускается на каждом уровне');
  subtitle(s, 'Лестница, не параллельные треки. K0 → K1 → K2 → K3');

  const tiers = [
    { tag: 'K0', name: 'Sandbox',           who: 'Любой человек с Click-аккаунтом',                     needs: 'Email, телефон, согласие',                              perm: 'Песочница, GitLab, sandbox API',                     color: C.textMute },
    { tag: 'K1', name: 'Production L1/L2',  who: 'Юр.лицо / ИП / самозанятый',                          needs: 'Реквизиты, DNS-подтверждение домена, договор',           perm: 'Информационные мини-аппы в marketplace',             color: C.teal },
    { tag: 'K2', name: 'Production L3',     who: 'K1 + расчётный счёт',                                  needs: 'Банковские реквизиты, расширенный договор, pen-test',  perm: '+ платежи',                                           color: C.deepBlue },
    { tag: 'K3', name: 'Production L4',     who: 'K2 + DPO + privacy policy',                            needs: 'Privacy policy, ФИО ответственного, утв. push-шаблоны', perm: '+ push',                                              color: C.midnight },
  ];

  const rowH = 1.05;
  const startY = 2.0;
  tiers.forEach((t, i) => {
    const y = startY + i * rowH;
    // left tier band
    s.addShape('rect', { x: 0.35, y: y, w: 1.6, h: rowH - 0.1, fill: { color: t.color } });
    s.addText(t.tag, {
      x: 0.35, y: y + 0.05, w: 1.6, h: 0.45,
      fontFace: F.header, fontSize: 28, bold: true, color: C.white, align: 'center',
    });
    s.addText(t.name, {
      x: 0.35, y: y + 0.5, w: 1.6, h: 0.4,
      fontFace: F.body, fontSize: 11, color: 'CADCFC', align: 'center',
    });

    // 3 info columns
    s.addShape('rect', { x: 1.95, y: y, w: 10.95, h: rowH - 0.1, fill: { color: C.white }, line: { color: 'E0E6EE', width: 1 } });

    const cols = [
      { x: 2.1,  w: 3.0,  label: 'КТО',           val: t.who },
      { x: 5.2,  w: 4.3,  label: 'ЧТО НУЖНО',     val: t.needs },
      { x: 9.6,  w: 3.2,  label: 'ЧТО РАЗРЕШЕНО', val: t.perm },
    ];
    cols.forEach(c => {
      s.addText(c.label, {
        x: c.x, y: y + 0.1, w: c.w, h: 0.25,
        fontFace: F.header, fontSize: 9, bold: true, color: t.color, charSpacing: 1,
      });
      s.addText(c.val, {
        x: c.x, y: y + 0.36, w: c.w, h: 0.55,
        fontFace: F.body, fontSize: 12, color: C.textDark,
      });
    });
  });

  pageNumber(s, 8, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 9 — Безопасность — 4-layer защита
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Безопасность как ключевая ценность');
  subtitle(s, 'Четыре слоя защиты + независимый pen-test для L3/L4');

  const layers = [
    {
      num: '01', name: 'Domain Pinning',
      desc: 'Мини-апп зафиксирован на конкретном домене через DNS TXT-record. Переезд = новый submission.',
    },
    {
      num: '02', name: 'Daily Fingerprint',
      desc: 'Бот каждые 24 часа сравнивает мини-апп с эталоном на момент approve. Критические расхождения → немедленный auto-disable.',
    },
    {
      num: '03', name: 'Mandatory Delta-Review',
      desc: 'Значимые изменения (новые scopes, внешние домены, формы сбора данных) — только через кабинет с повторным ревью.',
    },
    {
      num: '04', name: 'Kill-switch + Reporting',
      desc: 'Пользователь Click жалуется → moderation queue → модератор может мгновенно отключить. Эскалация повторных нарушений — через человека.',
    },
  ];

  const rowH = 1.0;
  const startY = 2.0;
  layers.forEach((l, i) => {
    const y = startY + i * rowH;
    // numbered block
    s.addShape('rect', {
      x: 0.4, y: y, w: 1.3, h: rowH - 0.12,
      fill: { color: [C.teal, C.deepBlue, C.midnight, '4A2545'][i] },
    });
    s.addText(l.num, {
      x: 0.4, y: y + 0.15, w: 1.3, h: 0.6,
      fontFace: F.header, fontSize: 28, bold: true, color: C.white, align: 'center', valign: 'middle',
    });
    // body
    s.addShape('rect', {
      x: 1.7, y: y, w: 11.2, h: rowH - 0.12,
      fill: { color: C.white }, line: { color: 'E0E6EE', width: 1 },
    });
    s.addText(l.name, {
      x: 1.95, y: y + 0.1, w: 11.0, h: 0.4,
      fontFace: F.header, fontSize: 17, bold: true, color: C.midnight,
    });
    s.addText(l.desc, {
      x: 1.95, y: y + 0.45, w: 11.0, h: 0.45,
      fontFace: F.body, fontSize: 12, color: C.textMute,
    });
  });

  // footer note
  s.addText([
    { text: '+ для L3/L4 — ', options: { fontFace: F.body, fontSize: 12, color: C.textMute } },
    { text: 'обязательный pen-test', options: { fontFace: F.body, fontSize: 12, color: C.deepBlue, bold: true } },
    { text: ' от утверждённой Click-пентестерской компании, валиден 12 мес. ', options: { fontFace: F.body, fontSize: 12, color: C.textMute } },
    { text: 'Cabinet Security Scanner', options: { fontFace: F.body, fontSize: 12, color: C.deepBlue, bold: true } },
    { text: ' (shift-left) — те же проверки, что на финальном ревью.', options: { fontFace: F.body, fontSize: 12, color: C.textMute } },
  ], {
    x: 0.4, y: 6.4, w: 12.5, h: 0.7,
    align: 'left', valign: 'top',
  });

  pageNumber(s, 9, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 10 — Что нужно от Click для запуска
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide();
  title(s, 'Что нужно от Click для запуска');
  subtitle(s, 'Три параллельных потока работ: технически, юридически, организационно');

  const groups = [
    {
      header: 'Технически',
      color: C.teal,
      items: [
        'Поднять GitLab CE на инфре Click',
        'Создать sandbox-стенд (тестовые пользователи, fake-платежи/push, Webhook Inspector)',
        'Расширить Click API: WebView Bridge с JWT, HMAC backend-канал, scopes',
        'Push Template Registry + rate-limit / окна enforcement',
        'Daily Fingerprint Bot (headless Chromium + cron)',
        'Admin Console для менеджеров',
      ],
    },
    {
      header: 'Юридически',
      color: C.deepBlue,
      items: [
        'Шаблоны договоров оферты для K1, K2, K3',
        'Политика контента (что запрещено в Click marketplace)',
        'Список утверждённых пен-тестерских компаний',
        'Регламент эскалации (kill-switch, расторжение, передача в фин.разведку)',
      ],
    },
    {
      header: 'Организационно',
      color: C.midnight,
      items: [
        'Команда модераторов (review, complaints)',
        'Команда compliance (KYC, договоры)',
        'Security Officer (фрод, утечки)',
        'Документация на 3 языках (RU primary, UZ latin + cyrillic, EN опционально)',
      ],
    },
  ];

  const cardW = 4.0;
  const startX = 0.4;
  const gap = 0.18;
  groups.forEach((g, i) => {
    const x = startX + i * (cardW + gap);
    // header
    s.addShape('rect', { x: x, y: 2.0, w: cardW, h: 0.7, fill: { color: g.color } });
    s.addText(g.header, {
      x: x + 0.2, y: 2.05, w: cardW - 0.4, h: 0.55,
      fontFace: F.header, fontSize: 18, bold: true, color: C.white, valign: 'middle',
    });
    // body
    s.addShape('rect', {
      x: x, y: 2.7, w: cardW, h: 4.0,
      fill: { color: C.white }, line: { color: 'E0E6EE', width: 1 },
    });
    g.items.forEach((it, j) => {
      const y = 2.85 + j * 0.6;
      s.addShape('rect', {
        x: x + 0.2, y: y + 0.18, w: 0.16, h: 0.04, fill: { color: g.color },
      });
      s.addText(it, {
        x: x + 0.45, y: y, w: cardW - 0.55, h: 0.55,
        fontFace: F.body, fontSize: 11, color: C.textDark, valign: 'top',
      });
    });
  });

  // footer
  s.addText('Решение по фазированию (что в каком порядке) — за командой Click.', {
    x: 0.4, y: 6.85, w: 12.5, h: 0.4,
    fontFace: F.body, fontSize: 12, italic: true, color: C.textMute, align: 'center',
  });

  pageNumber(s, 10, TOTAL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 11 — Closing (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = slide({ bg: C.deepBlue });

  s.addShape('rect', {
    x: 0, y: 0, w: 0.45, h: 7.5, fill: { color: C.teal },
  });

  s.addText('Дальше', {
    x: 1.0, y: 1.5, w: 11.0, h: 1.0,
    fontFace: F.header, fontSize: 60, bold: true, color: C.white,
  });

  s.addShape('line', {
    x: 1.0, y: 2.7, w: 4.0, h: 0,
    line: { color: C.accent, width: 2 },
  });

  s.addText([
    { text: 'При согласии команды Click с предложением — следующий шаг ', options: { fontFace: F.body, fontSize: 18, color: 'CADCFC' } },
    { text: 'формирование implementation plan', options: { fontFace: F.body, fontSize: 18, color: C.white, bold: true } },
    { text: ': разбиение по командам и сервисам, оценки трудозатрат, milestones.\n\n', options: { fontFace: F.body, fontSize: 18, color: 'CADCFC' } },
    { text: 'Этот материал готовится отдельно после feedback по текущему предложению.', options: { fontFace: F.body, fontSize: 18, color: 'CADCFC' } },
  ], {
    x: 1.0, y: 2.95, w: 11.0, h: 2.0,
    align: 'left', valign: 'top',
  });

  // companion documents reference
  s.addShape('rect', { x: 1.0, y: 5.2, w: 11.0, h: 1.6, fill: { color: C.midnight }, line: { color: C.teal, width: 1 } });
  s.addText('СОПРОВОЖДАЮЩИЕ ДОКУМЕНТЫ', {
    x: 1.3, y: 5.3, w: 10.5, h: 0.3,
    fontFace: F.header, fontSize: 10, bold: true, color: C.accent, charSpacing: 2,
  });
  s.addText([
    { text: '02-architecture.md  ', options: { fontFace: F.header, fontSize: 14, color: C.white, bold: true } },
    { text: '— полное архитектурное описание (топология, three-channel API, KYC, ревью, lifecycle)\n', options: { fontFace: F.body, fontSize: 13, color: 'CADCFC' } },
    { text: '03-requirements.md  ', options: { fontFace: F.header, fontSize: 14, color: C.white, bold: true } },
    { text: '— функциональные, нефункциональные, security, compliance, UX и операционные требования', options: { fontFace: F.body, fontSize: 13, color: 'CADCFC' } },
  ], {
    x: 1.3, y: 5.6, w: 10.5, h: 1.1,
    align: 'left', valign: 'top',
    paraSpaceAfter: 4,
  });

  // page number bottom-right
  s.addText(`${TOTAL} / ${TOTAL}`, {
    x: 12.4, y: 7.05, w: 0.8, h: 0.3,
    fontFace: F.body, fontSize: 9, color: 'CADCFC', align: 'right',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const out = path.join(__dirname, '01-presentation.pptx');
pres.writeFile({ fileName: out }).then((f) => {
  console.log('Wrote', f);
});
