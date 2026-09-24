#!/usr/bin/env python3
"""Итог заказа — вровень с первой карточкой левой колонки.

На странице покупки (/buy/{slug}) правая карточка итога начиналась на
уровне подписи «Выберите период», то есть выше всех карточек слева: те
начинаются только под кнопками периодов, с карточки email.

Периоды выносятся в отдельную строку сетки над левой колонкой, а итог
ставится во вторую строку. Так его верх совпадает с верхом карточки email
при любом числе периодов, даже если кнопки переносятся на второй ряд.
Отступы прежние: 24px между секциями слева, 32px между колонками, на
телефоне порядок блоков и расстояния не меняются.

Если раньше ставился mono_quick_head.py (подпись «Ваш заказ» над итогом),
подпись убирается: с новым выравниванием она повисла бы над карточкой.

Правит src/pages/QuickPurchase.tsx. Скрипт идемпотентный: повторный запуск
ничего не делает.
"""

import sys

PATH = 'src/pages/QuickPurchase.tsx'

MARKER = "allPeriods.length > 0 ? 'lg:row-start-2' : 'lg:row-start-1'"

LEFT_OLD = """        {/* Two-column layout */}
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="min-w-0 space-y-6"
          >
            {/* Period tabs */}
            {allPeriods.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-dark-400">
                  {t('landing.choosePeriod', 'Choose period')}
                </h2>
                <PeriodTabs
                  periods={allPeriods}
                  selectedDays={selectedPeriodDays ?? 0}
                  onSelect={setSelectedPeriodDays}
                />
              </div>
            )}

"""

LEFT_NEW = """        {/* Two-column layout. Периоды — отдельной строкой сетки над левой
            колонкой, итог справа — во второй строке: так он встаёт вровень с
            первой карточкой слева, сколько бы рядов ни заняли кнопки периодов.
            Интервалы прежние: 24px между секциями, 32px между колонками. */}
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[1fr_380px]">
          {/* Period tabs */}
          {allPeriods.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="min-w-0 lg:col-start-1"
            >
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-dark-400">
                {t('landing.choosePeriod', 'Choose period')}
              </h2>
              <PeriodTabs
                periods={allPeriods}
                selectedDays={selectedPeriodDays ?? 0}
                onSelect={setSelectedPeriodDays}
              />
            </motion.div>
          )}

          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="min-w-0 space-y-6 lg:col-start-1"
          >
"""

# mt-2 на телефоне: 24px зазора сетки + 8px = прежние 32px до блока итога.
RIGHT_OLD = """            className={cn(
              'min-w-0 lg:sticky lg:top-8 lg:self-start',
              config?.sticky_pay_button && 'mb-20 lg:mb-0',
            )}
          >
"""

RIGHT_NEW = """            className={cn(
              'mt-2 min-w-0 lg:sticky lg:top-8 lg:col-start-2 lg:mt-0 lg:self-start',
              allPeriods.length > 0 ? 'lg:row-start-2' : 'lg:row-start-1',
              config?.sticky_pay_button && 'mb-20 lg:mb-0',
            )}
          >
"""

# Подпись «Ваш заказ» из mono_quick_head.py — ровно в том виде, как он её ставит.
HEADING = """            {/* Заголовок колонки. У левых секций он есть, у правой не было —
                и карточка итога начиналась на 20px ниже соседнего текста (это
                её собственный внутренний отступ), отчего колонки читались как
                несовпадающие. С подписью совпадают обе линии: подпись с
                подписью и верх карточки с первым блоком слева. */}
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-dark-400">
              {t('landing.yourOrder', 'Your order')}
            </h2>
"""


def die(msg):
    print('ОШИБКА: ' + msg)
    sys.exit(1)


src = open(PATH, encoding='utf-8').read()

if MARKER in src:
    print('итог уже выровнен, пропускаем')
    sys.exit(0)

if src.count(LEFT_OLD) != 1:
    die('не найдено начало двухколоночной сетки с периодами — файл изменён')
if src.count(RIGHT_OLD) != 1:
    die('не найдены классы правой колонки — файл изменён')
has_heading = 'landing.yourOrder' in src
if has_heading and src.count(HEADING) != 1:
    die('подпись «Ваш заказ» есть, но изменена вручную — уберите её и запустите снова')

original = src
src = src.replace(LEFT_OLD, LEFT_NEW, 1)
src = src.replace(RIGHT_OLD, RIGHT_NEW, 1)
if has_heading:
    src = src.replace(HEADING, '', 1)

open(PATH + '.align.bak', 'w', encoding='utf-8').write(original)
open(PATH, 'w', encoding='utf-8').write(src)
print('готово: итог выровнен по карточке email%s, исходник в %s.align.bak'
      % (' (подпись «Ваш заказ» убрана)' if has_heading else '', PATH))
