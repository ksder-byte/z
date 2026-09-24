import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import type { LandingConfig, LandingPaymentMethod } from '../../api/landings';
import { brandingApi, getCachedBranding, preloadLogo } from '../../api/branding';
import { formatPrice } from '../../utils/format';
import './monoLanding.css';

// ──────────────────────────────────────────────────────────────────
// MonoLanding — лендинг DurdenVPN вокруг формы покупки.
//
// Форма оплаты (период, тариф, способ оплаты, итог) остаётся апстримовской
// и не трогается: это путь денег. Здесь только то, что вокруг неё — герой,
// цифры, преимущества, шаги, вопросы и финальный призыв.
//
// Все цифры берутся из конфига лендинга, а не пишутся текстом: цена «от»,
// устройства, трафик, способы оплаты, сроки. Поменяете тариф в админке —
// лендинг перестроится сам и не пообещает того, чего нет.
//
// Преимущества — поле «Преимущества» редактора лендинга. Пока оно пустое,
// показывается набор по умолчанию, тоже собранный из данных тарифов.
// ──────────────────────────────────────────────────────────────────

const CHECKOUT_ID = 'mono-checkout';

/** Цена без «,00»: для героя и цифр «от 100 ₽» читается лучше «от 100,00 ₽». */
function priceShort(kopeks: number): string {
  return formatPrice(kopeks).replace(/[.,]00(?=\D*$)/, '');
}

/** Человеческое имя способа оплаты: «♠️ Heleket (Крипта)» → «Крипта». */
function paymentLabels(method: LandingPaymentMethod): string[] {
  if (method.sub_options && method.sub_options.length > 0) {
    return method.sub_options.map((option) => option.name.trim()).filter(Boolean);
  }
  const inBrackets = method.display_name.match(/\(([^)]+)\)/);
  if (inBrackets) return [inBrackets[1].trim()];
  // Эмодзи и прочие не-буквы в начале названия — украшение, не имя.
  const bare = method.display_name.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return bare ? [bare] : [];
}

/** В середине фразы «Карта» → «карта», но «СБП» остаётся «СБП». */
function inSentence(word: string, index: number): string {
  if (index === 0 || word === word.toUpperCase()) return word;
  return word.charAt(0).toLowerCase() + word.slice(1);
}

type Facts = {
  minMonthlyKopeks: number | null;
  maxDevices: number;
  unlimitedDevices: boolean;
  maxTrafficGb: number;
  unlimitedTraffic: boolean;
  minMonths: number;
  maxMonths: number;
  longerIsCheaper: boolean;
  payments: string[];
};

function collectFacts(config: LandingConfig): Facts {
  let minMonthly: number | null = null;
  let maxDevices = 0;
  let unlimitedDevices = false;
  let maxTraffic = 0;
  let unlimitedTraffic = false;
  let minMonths = Infinity;
  let maxMonths = 0;
  let longerIsCheaper = false;

  for (const tariff of config.tariffs) {
    if (tariff.device_limit === 0) unlimitedDevices = true;
    maxDevices = Math.max(maxDevices, tariff.device_limit);
    if (tariff.traffic_limit_gb === 0) unlimitedTraffic = true;
    maxTraffic = Math.max(maxTraffic, tariff.traffic_limit_gb);

    if (tariff.is_daily && tariff.daily_price_kopeks) {
      const monthly = tariff.daily_price_kopeks * 30;
      minMonthly = minMonthly === null ? monthly : Math.min(minMonthly, monthly);
      continue;
    }

    const monthlyByPeriod: number[] = [];
    for (const period of tariff.periods) {
      const months = Math.max(1, Math.round(period.days / 30));
      const monthly = period.price_kopeks / months;
      monthlyByPeriod.push(monthly);
      minMonthly = minMonthly === null ? monthly : Math.min(minMonthly, monthly);
      minMonths = Math.min(minMonths, months);
      maxMonths = Math.max(maxMonths, months);
    }
    // «Чем дольше, тем дешевле» обещаем, только если это правда: месяц в
    // самом длинном периоде заметно дешевле месяца в самом коротком.
    if (monthlyByPeriod.length > 1) {
      const first = monthlyByPeriod[0];
      const last = monthlyByPeriod[monthlyByPeriod.length - 1];
      if (last < first * 0.97) longerIsCheaper = true;
    }
  }

  const seen = new Set<string>();
  const payments: string[] = [];
  for (const method of [...config.payment_methods].sort((a, b) => a.sort_order - b.sort_order)) {
    for (const label of paymentLabels(method)) {
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        payments.push(label);
      }
    }
  }

  return {
    minMonthlyKopeks: minMonthly === null ? null : Math.ceil(minMonthly / 100) * 100,
    maxDevices,
    unlimitedDevices,
    maxTrafficGb: maxTraffic,
    unlimitedTraffic,
    minMonths: Number.isFinite(minMonths) ? minMonths : 0,
    maxMonths,
    longerIsCheaper,
    payments,
  };
}

/**
 * Колонки сетки преимуществ под их число: четыре плитки в три колонки
 * оставляли бы одну сироту во втором ряду.
 */
function advantagesGrid(count: number): string {
  if (count <= 1) return '';
  if (count === 2) return 'sm:grid-cols-2';
  if (count % 4 === 0) return 'sm:grid-cols-2 lg:grid-cols-4';
  return 'sm:grid-cols-2 lg:grid-cols-3';
}

function scrollToCheckout(reduce: boolean) {
  document
    .getElementById(CHECKOUT_ID)
    ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

// ── Появление при прокрутке ──────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // Без анимаций — без скрытого стартового состояния: иначе блоки, мимо
  // которых мгновенно проскочила прокрутка, так и остались бы невидимыми.
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Число набегает от нуля, когда попадает в экран. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    if (!inView) return;
    const started = performance.now();
    const duration = 1100;
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      // ease-out: к концу число «тормозит», а не упирается в стену
      setShown(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, value]);

  return <span ref={ref}>{shown}</span>;
}

// ── Halftone-шар ─────────────────────────────────────────────────

/**
 * Освещённый шар из точек — классический полутон: радиус точки задаётся
 * яркостью поверхности в этом месте. Геометрия считается один раз.
 */
function HalftoneSphere({ className }: { className?: string }) {
  const dots = useMemo(() => {
    const cells = 30;
    const size = 100 / cells;
    const light = { x: -0.55, y: -0.6, z: 0.58 };
    const out: { cx: number; cy: number; r: number }[] = [];
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const cx = (col + 0.5) * size;
        const cy = (row + 0.5) * size;
        const nx = (cx - 50) / 50;
        const ny = (cy - 50) / 50;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const lit = Math.max(0, nx * light.x + ny * light.y + nz * light.z);
        const r = (size / 2) * (0.1 + 0.85 * lit ** 1.2);
        if (r > 0.12) out.push({ cx, cy, r });
      }
    }
    return out;
  }, []);

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      {dots.map((dot) => (
        <circle
          key={`${dot.cx}-${dot.cy}`}
          cx={dot.cx.toFixed(2)}
          cy={dot.cy.toFixed(2)}
          r={dot.r.toFixed(2)}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

// ── Иконки преимуществ по умолчанию ──────────────────────────────

const ICONS: Record<string, ReactNode> = {
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.2-8.2M17 6l2.5 2.5M14.5 8.5 16 10" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  devices: (
    <>
      <rect x="2.5" y="4.5" width="13" height="10" rx="1" />
      <path d="M1.5 18h11" />
      <rect x="16.5" y="8.5" width="6" height="11" rx="1" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.2 17a8.5 8.5 0 1 1 15.6 0" />
      <path d="m12 13 4-4.5" />
      <circle cx="12" cy="13" r="1.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="1" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
};

function MonoIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

// ── Мелкие примитивы ─────────────────────────────────────────────

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-dark-400">
      {children}
    </div>
  );
}

function SectionHead({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <Reveal className="mb-8 sm:mb-10">
      <Kicker>{kicker}</Kicker>
      <h2 className="ml-h2 text-dark-50">{title}</h2>
      {lead && <p className="mt-4 max-w-xl text-base text-dark-400 sm:text-lg">{lead}</p>}
    </Reveal>
  );
}

function BuyButton({
  label,
  onClick,
  inverted = true,
}: {
  label: string;
  onClick: () => void;
  inverted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ml-cta inline-flex items-center gap-3 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] transition-colors ${
        inverted
          ? 'bg-dark-50 text-dark-950 hover:bg-dark-200'
          : 'bg-dark-950 text-dark-50 hover:bg-dark-800'
      }`}
    >
      {label}
      <span className="ml-cta-arrow" aria-hidden="true">
        ↓
      </span>
    </button>
  );
}

// ── Верх страницы: герой → цифры → преимущества → шаги → заголовок формы ──

export function MonoLandingTop({ config }: { config: LandingConfig }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const facts = useMemo(() => collectFacts(config), [config]);

  const { data: branding } = useQuery({
    queryKey: ['landing-branding'],
    queryFn: async () => {
      const data = await brandingApi.getBranding();
      await preloadLogo(data);
      return data;
    },
    // Повторный визит в той же вкладке — бренд уже известен, без ожидания.
    initialData: getCachedBranding() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });
  const logoUrl = branding ? brandingApi.getLogoUrl(branding) : null;
  const brand = branding?.name || 'VPN';
  // Знак показываем, только когда знаем, какой он: иначе первый визит
  // начинался с заглушки «V», которая через мгновение подменялась логотипом.
  const markReady = branding ? (branding.has_custom_logo ? Boolean(logoUrl) : true) : false;

  const buy = () => scrollToCheckout(reduce);
  const priceFrom = facts.minMonthlyKopeks ? priceShort(facts.minMonthlyKopeks) : null;
  const methodsText = facts.payments.map(inSentence).join(', ');
  const devicesCount = facts.unlimitedDevices ? 0 : facts.maxDevices;
  const trafficText = facts.unlimitedTraffic
    ? t('landing.mono.unlimited', 'Безлимит')
    : `${facts.maxTrafficGb} ${t('landing.mono.gb', 'ГБ')}`;

  const words = config.title.split(/\s+/).filter(Boolean);

  // Преимущества: из админки, а пока там пусто — набор по умолчанию из данных.
  const advantages: { icon: ReactNode; title: string; text: string }[] =
    config.features.length > 0
      ? config.features.map((feature) => ({
          icon: feature.icon ? (
            <span className="text-xl leading-none">{feature.icon}</span>
          ) : (
            <MonoIcon name="bolt" />
          ),
          title: feature.title,
          text: feature.description,
        }))
      : [
          {
            icon: <MonoIcon name="bolt" />,
            title: t('landing.mono.advFastTitle', 'Ключ за минуту'),
            text: t(
              'landing.mono.advFastText',
              'Оплатили — и ссылка на подписку уже у вас: на email или в Telegram.',
            ),
          },
          {
            icon: <MonoIcon name="key" />,
            title: t('landing.mono.advNoSignupTitle', 'Без регистрации'),
            text: t(
              'landing.mono.advNoSignupText',
              'Нужен только email или Telegram-ник. Личный кабинет создастся сам.',
            ),
          },
          ...(facts.payments.length > 0
            ? [
                {
                  icon: <MonoIcon name="card" />,
                  title: t('landing.mono.advPayTitle', 'Удобная оплата'),
                  text: t('landing.mono.advPayText', {
                    methods: methodsText,
                    defaultValue: '{{methods}} — выбирайте, как удобно.',
                  }),
                },
              ]
            : []),
          {
            icon: <MonoIcon name="devices" />,
            title: facts.unlimitedDevices
              ? t('landing.mono.advDevicesUnlimitedTitle', 'Любое число устройств')
              : t('landing.mono.upToDevicesTitle', {
                  count: devicesCount,
                  defaultValue: 'До {{count}} устройств',
                }),
            text: t(
              'landing.mono.advDevicesText',
              'Телефон, ноутбук, планшет — одна подписка на всё.',
            ),
          },
          {
            icon: <MonoIcon name="gauge" />,
            title: facts.unlimitedTraffic
              ? t('landing.mono.advTrafficUnlimitedTitle', 'Безлимитный трафик')
              : t('landing.mono.advTrafficTitle', {
                  gb: facts.maxTrafficGb,
                  defaultValue: '{{gb}} ГБ трафика',
                }),
            text: t('landing.mono.advTrafficText', 'Хватит на видео, звонки и работу.'),
          },
          ...(facts.maxMonths > facts.minMonths
            ? [
                {
                  icon: <MonoIcon name="calendar" />,
                  title: t('landing.mono.advTermTitle', 'Гибкий срок'),
                  text: facts.longerIsCheaper
                    ? t('landing.mono.advTermCheaper', {
                        from: facts.minMonths,
                        to: facts.maxMonths,
                        defaultValue: 'От {{from}} до {{to}} мес. — чем дольше, тем дешевле месяц.',
                      })
                    : t('landing.mono.advTermText', {
                        from: facts.minMonths,
                        to: facts.maxMonths,
                        defaultValue: 'От {{from}} до {{to}} месяцев — на сколько удобно.',
                      }),
                },
              ]
            : []),
        ];

  const steps = [
    {
      title: t('landing.mono.step1Title', 'Выберите тариф'),
      text:
        facts.maxMonths > facts.minMonths
          ? t('landing.mono.step1Text', {
              from: facts.minMonths,
              to: facts.maxMonths,
              defaultValue: 'Срок от {{from}} до {{to}} месяцев.',
            })
          : t('landing.mono.step1TextPlain', 'И срок, который вам подходит.'),
    },
    {
      title: t('landing.mono.step2Title', 'Оплатите'),
      text: methodsText
        ? t('landing.mono.step2Text', { methods: methodsText, defaultValue: '{{methods}}.' })
        : t('landing.mono.step2TextPlain', 'Любым удобным способом.'),
    },
    {
      title: t('landing.mono.step3Title', 'Подключитесь'),
      text: t(
        'landing.mono.step3Text',
        'Ключ придёт на email или в Telegram — откройте его в приложении.',
      ),
    },
  ];

  return (
    <div className="mono-landing">
      {/* ─── Герой ─── */}
      <section className="relative mb-16 pt-6 sm:mb-24 sm:pt-10">
        {/* Шар — фон, а не объект: тусклый, под всем содержимым (z-0 против
            z-10 у текста) и без наложения на заголовок. Яркий, он читался
            как самостоятельный предмет и спорил с надписью за внимание. */}
        <div className="pointer-events-none absolute -right-24 top-4 z-0 w-[88vw] max-w-[560px] text-dark-50 opacity-[0.14] sm:-right-16 md:-right-36 md:top-10 md:opacity-[0.3] rtl:-left-24 rtl:right-auto rtl:sm:-left-16 rtl:md:-left-36">
          <HalftoneSphere className="ml-sphere w-full" />
        </div>

        <div className="relative z-10">
          <motion.div
            className="mb-8 flex h-16 items-center gap-3"
            initial={{ opacity: 0, y: reduce ? 0 : -8 }}
            animate={markReady ? { opacity: 1, y: 0 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {!markReady ? null : logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="ml-float h-16 w-auto max-w-[112px] object-contain"
              />
            ) : (
              <span className="ml-float flex h-12 w-12 items-center justify-center bg-dark-50 text-lg font-black text-dark-950">
                {branding?.logo_letter || brand.charAt(0)}
              </span>
            )}
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-dark-400">
              {brand}
            </span>
          </motion.div>

          <h1 className="ml-hero-title max-w-[12ch] text-dark-50">
            {words.map((word, index) => (
              <span key={`${word}-${index}`} className="ml-word">
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.1 + index * 0.09,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {word}
                </motion.span>
                {index < words.length - 1 ? ' ' : null}
              </span>
            ))}
          </h1>

          <motion.p
            className="mt-7 max-w-md text-lg leading-snug text-dark-300 sm:text-xl"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 + words.length * 0.09 + 0.1 }}
          >
            {config.subtitle ||
              t(
                'landing.mono.heroLead',
                'VPN без регистрации. Оплатили — ключ уже у вас на email или в Telegram.',
              )}
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 + words.length * 0.09 + 0.1 }}
          >
            <BuyButton label={t('landing.mono.cta', 'Выбрать тариф')} onClick={buy} />
            {priceFrom && (
              <span className="flex flex-col leading-none">
                <span className="text-2xl font-black tracking-[-0.04em] text-dark-50 [overflow-wrap:anywhere]">
                  {t('landing.mono.from', 'от')} {priceFrom}
                </span>
                <span className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-dark-400">
                  {t('landing.mono.perMonth', 'в месяц')}
                </span>
              </span>
            )}
          </motion.div>
        </div>
      </section>

      {/* ─── Цифры ─── */}
      <section className="mb-20 grid grid-cols-2 gap-2.5 sm:mb-28 md:grid-cols-4">
        {(
          [
            priceFrom
              ? {
                  value: (
                    <>
                      <span className="text-[0.42em] font-bold tracking-[-0.02em]">
                        {t('landing.mono.from', 'от')}{' '}
                      </span>
                      {priceFrom}
                    </>
                  ),
                  label: t('landing.mono.perMonth', 'в месяц'),
                  // Суммы в риалах и подобных валютах длиннее «100 ₽» в разы:
                  // крупным кеглем они вылезали из плитки на соседнюю.
                  long: priceFrom.length > 9,
                }
              : null,
            {
              value: facts.unlimitedDevices ? '∞' : <CountUp value={devicesCount} />,
              label: t('landing.mono.devicesLabel', {
                count: facts.unlimitedDevices ? 5 : devicesCount,
                defaultValue: 'устройства',
              }),
            },
            {
              value: facts.unlimitedTraffic ? (
                '∞'
              ) : (
                <>
                  <CountUp value={facts.maxTrafficGb} />
                  <span className="text-[0.42em] font-bold tracking-[-0.02em]">
                    {' '}
                    {t('landing.mono.gb', 'ГБ')}
                  </span>
                </>
              ),
              label: facts.unlimitedTraffic
                ? trafficText
                : t('landing.mono.trafficLabel', 'трафика'),
            },
            facts.payments.length > 0
              ? {
                  value: <CountUp value={facts.payments.length} />,
                  label: t('landing.mono.paymentsLabel', {
                    count: facts.payments.length,
                    defaultValue: 'способа оплаты',
                  }),
                }
              : null,
          ] as ({ value: ReactNode; label: string; long?: boolean } | null)[]
        )
          .filter(
            (stat): stat is { value: ReactNode; label: string; long?: boolean } => stat !== null,
          )
          .map((stat, index) => (
            <Reveal key={index} delay={index * 0.08}>
              <div className="flex h-full min-h-[132px] flex-col justify-end border border-[color:var(--ml-hair)] bg-dark-900 p-4 sm:min-h-[160px] sm:p-5">
                <div
                  className={`font-black leading-[0.9] tracking-[-0.05em] text-dark-50 tabular-nums [overflow-wrap:anywhere] ${
                    stat.long ? 'text-[clamp(22px,4vw,34px)]' : 'text-[clamp(34px,6vw,54px)]'
                  }`}
                >
                  {stat.value}
                </div>
                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-dark-400">
                  {stat.label}
                </div>
              </div>
            </Reveal>
          ))}
      </section>

      {/* ─── Преимущества ─── */}
      <section className="mb-20 sm:mb-28">
        <SectionHead
          kicker={t('landing.mono.advKicker', 'Преимущества')}
          title={t('landing.mono.advTitle', { brand, defaultValue: 'Почему {{brand}}' })}
        />
        <div className={`grid grid-cols-1 gap-2.5 ${advantagesGrid(advantages.length)}`}>
          {advantages.map((adv, index) => (
            <Reveal key={index} delay={(index % 4) * 0.07}>
              <div className="ml-tile flex h-full flex-col border border-[color:var(--ml-hair)] bg-dark-900 p-5 text-dark-50 sm:min-h-[210px] sm:p-6">
                <div className="ml-tile-icon flex h-11 w-11 items-center justify-center border border-[color:var(--ml-hair)]">
                  {adv.icon}
                </div>
                <div className="pt-6 sm:pt-10">
                  <h3 className="text-xl font-black leading-tight tracking-[-0.03em] sm:text-2xl">
                    {adv.title}
                  </h3>
                  <p className="ml-tile-muted mt-2 text-sm leading-relaxed text-dark-400">
                    {adv.text}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Как это работает ─── */}
      <section className="mb-20 sm:mb-28">
        <SectionHead
          kicker={t('landing.mono.stepsKicker', 'Как это работает')}
          title={t('landing.mono.stepsTitle', 'Три шага до VPN')}
        />
        <div className="relative grid gap-2.5 md:grid-cols-3">
          {/* Линия-связка шагов прорисовывается слева направо */}
          <motion.div
            className="pointer-events-none absolute left-0 right-0 top-[46px] hidden h-px origin-left bg-dark-600 md:block"
            initial={{ scaleX: reduce ? 1 : 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
          />
          {steps.map((step, index) => (
            <Reveal key={index} delay={0.15 + index * 0.15}>
              <div className="relative h-full pr-4">
                <div className="flex h-[92px] items-center">
                  <span className="bg-dark-950 pr-4 text-[64px] font-black leading-none tracking-[-0.06em] text-transparent [-webkit-text-stroke:1.5px_rgb(var(--color-dark-50))]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-[-0.03em] text-dark-50">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-dark-400">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Заголовок формы ─── */}
      <div id={CHECKOUT_ID} className="scroll-mt-6">
        <SectionHead
          kicker={t('landing.mono.checkoutKicker', 'Оформление')}
          title={t('landing.mono.checkoutTitle', 'Выберите тариф')}
          lead={t(
            'landing.mono.checkoutLead',
            'Ключ придёт на email или в Telegram сразу после оплаты.',
          )}
        />
      </div>
    </div>
  );
}

// ── Низ страницы: вопросы и финальный призыв ─────────────────────

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="border-b border-[color:var(--ml-hair)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 py-5 text-left text-lg font-bold tracking-[-0.02em] text-dark-50 sm:text-xl"
      >
        <span>{q}</span>
        <span
          className={`relative h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          <span className="absolute left-0 top-1/2 h-[2px] w-4 -translate-y-1/2 bg-dark-50" />
          <span className="absolute left-1/2 top-0 h-4 w-[2px] -translate-x-1/2 bg-dark-50" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-6 text-base leading-relaxed text-dark-400">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MonoLandingBottom({ config }: { config: LandingConfig }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion() ?? false;
  const facts = useMemo(() => collectFacts(config), [config]);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const methodsText = facts.payments.map(inSentence).join(', ');

  const faq = [
    {
      q: t('landing.mono.faqSignupQ', 'Нужна ли регистрация?'),
      a: t(
        'landing.mono.faqSignupA',
        'Нет. Укажите email или Telegram-ник — ключ подписки придёт туда, а личный кабинет создастся автоматически.',
      ),
    },
    ...(methodsText
      ? [
          {
            q: t('landing.mono.faqPayQ', 'Как оплатить?'),
            a: t('landing.mono.faqPayA', {
              methods: methodsText,
              pay: t('landing.pay', 'Оплатить'),
              defaultValue: '{{methods}}. Ссылка на оплату откроется после нажатия «{{pay}}».',
            }),
          },
        ]
      : []),
    {
      q: t('landing.mono.faqDevicesQ', 'Сколько устройств можно подключить?'),
      a: facts.unlimitedDevices
        ? t(
            'landing.mono.faqDevicesUnlimitedA',
            'Сколько угодно — ограничения по числу устройств нет.',
          )
        : t('landing.mono.faqDevicesA', {
            count: facts.maxDevices,
            defaultValue: 'До {{count}} устройств на одной подписке одновременно.',
          }),
    },
    {
      q: t('landing.mono.faqConnectQ', 'Как подключиться после оплаты?'),
      a: t(
        'landing.mono.faqConnectA',
        'Откройте ключ подписки в приложении-клиенте, например Happ, — серверы подтянутся сами. Пошаговая инструкция есть в личном кабинете.',
      ),
    },
    ...(config.gift_enabled
      ? [
          {
            q: t('landing.mono.faqGiftQ', 'Можно ли подарить подписку?'),
            a: t(
              'landing.mono.faqGiftA',
              'Да. При оформлении отметьте покупку в подарок и укажите контакт получателя — ключ уйдёт ему.',
            ),
          },
        ]
      : []),
    {
      q: t('landing.mono.faqRenewQ', 'Как продлить подписку?'),
      a: t(
        'landing.mono.faqRenewA',
        'В личном кабинете — новый срок добавится к текущему, оставшиеся дни не пропадут.',
      ),
    },
  ];

  return (
    <div className="mono-landing">
      {/* ─── Вопросы ─── */}
      <section className="mb-20 mt-20 sm:mb-28 sm:mt-28">
        <SectionHead
          kicker={t('landing.mono.faqKicker', 'Вопросы')}
          title={t('landing.mono.faqTitle', 'Частые вопросы')}
        />
        <Reveal>
          <div className="border-t border-[color:var(--ml-hair)]">
            {faq.map((item, index) => (
              <FaqItem
                key={index}
                q={item.q}
                a={item.a}
                open={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─── Финальный призыв: единственный светлый блок страницы ─── */}
      <Reveal className="mb-12">
        <section className="relative overflow-hidden bg-dark-50 px-6 py-12 text-dark-950 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -bottom-24 -right-16 z-0 w-[420px] max-w-[70%] text-dark-950 opacity-[0.08]">
            <HalftoneSphere className="ml-sphere w-full" />
          </div>
          <div className="relative z-10">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-dark-950/50">
              {t('landing.mono.finalKicker', 'Готовы?')}
            </div>
            <h2 className="ml-h2 max-w-[14ch] text-dark-950">
              {t('landing.mono.finalTitle', 'Подключайтесь за минуту')}
            </h2>
            <p className="mt-4 max-w-md text-base text-dark-950/60 sm:text-lg">
              {t('landing.mono.finalText', 'Без регистрации. Ключ придёт сразу после оплаты.')}
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={() => scrollToCheckout(reduce)}
                className="ml-cta inline-flex items-center gap-3 bg-dark-950 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-dark-50 transition-colors hover:bg-dark-800"
              >
                {t('landing.mono.cta', 'Выбрать тариф')}
                <span className="ml-cta-arrow" aria-hidden="true">
                  ↑
                </span>
              </button>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
