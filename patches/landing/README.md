# Лендинг DurdenVPN для bedolaga-cabinet 1.69.1

Страница покупки `/buy/{slug}` превращается в полноценный лендинг в
монохромном стиле DurdenVPN:

- герой с огромным заголовком лендинга и полутоновым шаром, логотип из
  брендинга, кнопка «Выбрать тариф» и цена «от … в месяц»;
- четыре цифры с набегающими счётчиками — цена, устройства, трафик,
  способы оплаты;
- сетка преимуществ (инвертируется при наведении);
- «Три шага до VPN» с прорисовывающейся линией;
- форма оплаты — **апстримовская, без изменений**;
- частые вопросы (аккордеон) и финальный светлый блок.

Все цифры берутся из конфига лендинга, а не пишутся текстом: поменяете
тариф в админке — страница перестроится сама. Преимущества — поле
«Преимущества» редактора лендинга; пока оно пустое, показывается набор по
умолчанию, собранный из данных тарифов. Все тексты переведены на ru, en,
fa, zh. При `prefers-reduced-motion` анимации отключаются.

## Установка

```bash
cd ~/bedolaga-cabinet
bash /путь/к/этой/папке/install.sh
docker compose build cabinet-frontend \
  && docker compose up -d --force-recreate cabinet-frontend \
  && docker cp cabinet_frontend:/usr/share/nginx/html/. /srv/cabinet/
```

## Что меняется

| Файл | Изменение |
| --- | --- |
| `src/components/landing/MonoLanding.tsx` | новый |
| `src/components/landing/monoLanding.css` | новый |
| `src/pages/QuickPurchase.tsx` | импорт, шапка → `<MonoLandingTop>`, после формы `<MonoLandingBottom>` |
| `src/locales/{ru,en,fa,zh}.json` | ключи `landing.mono.*` |

Откат страницы: `mv src/pages/QuickPurchase.tsx.landing.bak src/pages/QuickPurchase.tsx`
и пересобрать. Новые файлы и ключи локалей можно оставить — без импорта
они ни на что не влияют.
