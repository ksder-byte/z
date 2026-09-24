#!/usr/bin/env python3
"""Подключает лендинг DurdenVPN к странице покупки (/buy/{slug}).

Три правки в src/pages/QuickPurchase.tsx:
  1) импорт MonoLandingTop / MonoLandingBottom;
  2) шапка страницы (заголовок + подзаголовок) заменяется верхом лендинга:
     герой, цифры, преимущества, шаги, заголовок формы;
  3) после формы оплаты добавляется низ лендинга: вопросы и финальный призыв.

Сама форма оплаты — период, тариф, способ оплаты, итог — не трогается.

Скрипт идемпотентный: повторный запуск ничего не делает.
"""

import sys

PATH = 'src/pages/QuickPurchase.tsx'

IMPORT_AFTER = "import { safeSession } from '../utils/safeStorage';\n"
IMPORT_LINE = "import { MonoLandingBottom, MonoLandingTop } from '../components/landing/MonoLanding';\n"

HEADER_OLD = """        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight text-dark-50 sm:text-4xl">
            {config.title}
          </h1>
          {config.subtitle && (
            <p className="mt-3 text-base text-dark-300 sm:text-lg">{config.subtitle}</p>
          )}
        </motion.div>
"""

HEADER_NEW = """        {/* Лендинг: герой, цифры, преимущества, шаги — до формы оплаты */}
        <MonoLandingTop config={config} />
"""

TAIL_OLD = """          </motion.div>
        </div>
      </div>
    </div>
  );
}
"""

TAIL_NEW = """          </motion.div>
        </div>

        {/* Лендинг: вопросы и финальный призыв — после формы оплаты */}
        <MonoLandingBottom config={config} />
      </div>
    </div>
  );
}
"""


def die(msg):
    print('ОШИБКА: ' + msg)
    sys.exit(1)


src = open(PATH, encoding='utf-8').read()

if 'MonoLandingTop' in src:
    print('страница уже подключена, пропускаем')
    sys.exit(0)

if src.count(IMPORT_AFTER) != 1:
    die('не найдена строка импорта safeSession — файл изменён')
if src.count(HEADER_OLD) != 1:
    die('не найдена шапка страницы (заголовок + подзаголовок) — файл изменён')
if not src.endswith(TAIL_OLD):
    die('не найден конец разметки страницы — файл изменён')

original = src
src = src.replace(IMPORT_AFTER, IMPORT_AFTER + IMPORT_LINE, 1)
src = src.replace(HEADER_OLD, HEADER_NEW, 1)
src = src[: -len(TAIL_OLD)] + TAIL_NEW

open(PATH + '.landing.bak', 'w', encoding='utf-8').write(original)
open(PATH, 'w', encoding='utf-8').write(src)
print('готово: лендинг подключён, исходник в %s.landing.bak' % PATH)
