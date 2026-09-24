#!/usr/bin/env python3
"""Тексты лендинга DurdenVPN на четырёх языках.

Компонент MonoLanding вызывает каждый текст как t('landing.mono.*', 'русский').
Без ключей в файлах локалей i18next отдал бы русский запасной текст всем
языкам — ровно та ошибка, что была на экране входа. Поэтому ключи сразу
кладутся во все четыре локали.

Пять ключей плюральные (число устройств, способов оплаты): для них пишутся
формы _one/_few/_many/_other, как принято в остальных файлах кабинета.

Скрипт идемпотентный: чужие переводы не перетирает, повторный запуск
ничего не делает.
"""

import json
import sys

LOCALES = 'src/locales'
LANGS = ('ru', 'en', 'fa', 'zh')
PREFIX = 'landing.mono.'

# Плюральные формы по языкам — как их ждёт i18next.
PLURAL_FORMS = {
    'ru': ('one', 'few', 'many', 'other'),
    'en': ('one', 'other'),
    'fa': ('one', 'other'),
    'zh': ('other',),
}

# ключ: (ru, en, fa, zh). Для плюральных — словари {форма: текст}.
STRINGS = {
    'advDevicesText': (
        'Телефон, ноутбук, планшет — одна подписка на всё.',
        'Phone, laptop, tablet — one subscription for everything.',
        'گوشی، لپ‌تاپ، تبلت — یک اشتراک برای همه.',
        '手机、笔记本、平板——一个订阅全搞定。',
    ),
    'advDevicesUnlimitedTitle': ('Любое число устройств', 'Any number of devices', 'هر تعداد دستگاه', '设备数量不限'),
    'advFastText': (
        'Оплатили — и ссылка на подписку уже у вас: на email или в Telegram.',
        'Pay — and your subscription link is already yours: by email or in Telegram.',
        'پرداخت کنید — و لینک اشتراک همان لحظه در ایمیل یا تلگرام شماست.',
        '付款后，订阅链接立即发送到您的邮箱或 Telegram。',
    ),
    'advFastTitle': ('Ключ за минуту', 'Key in a minute', 'کلید در یک دقیقه', '一分钟拿到密钥'),
    'advKicker': ('Преимущества', 'Advantages', 'مزایا', '优势'),
    'advNoSignupText': (
        'Нужен только email или Telegram-ник. Личный кабинет создастся сам.',
        'All you need is an email or a Telegram username. Your account is created automatically.',
        'فقط ایمیل یا نام کاربری تلگرام لازم است. حساب کاربری خودکار ساخته می‌شود.',
        '只需邮箱或 Telegram 用户名，账户会自动创建。',
    ),
    'advNoSignupTitle': ('Без регистрации', 'No sign-up', 'بدون ثبت‌نام', '无需注册'),
    'advPayText': (
        '{{methods}} — выбирайте, как удобно.',
        '{{methods}} — pay the way you like.',
        '{{methods}} — هر طور راحت‌ترید پرداخت کنید.',
        '{{methods}}——随心选择。',
    ),
    'advPayTitle': ('Удобная оплата', 'Easy payment', 'پرداخت آسان', '便捷支付'),
    'advTermCheaper': (
        'От {{from}} до {{to}} мес. — чем дольше, тем дешевле месяц.',
        'From {{from}} to {{to}} months — the longer, the cheaper per month.',
        'از {{from}} تا {{to}} ماه — هرچه طولانی‌تر، هر ماه ارزان‌تر.',
        '{{from}} 至 {{to}} 个月——时间越长，每月越便宜。',
    ),
    'advTermText': (
        'От {{from}} до {{to}} месяцев — на сколько удобно.',
        'From {{from}} to {{to}} months — as long as you need.',
        'از {{from}} تا {{to}} ماه — به هر مدتی که لازم دارید.',
        '{{from}} 至 {{to}} 个月，按需选择。',
    ),
    'advTermTitle': ('Гибкий срок', 'Flexible term', 'مدت انعطاف‌پذیر', '灵活期限'),
    'advTitle': ('Почему {{brand}}', 'Why {{brand}}', 'چرا {{brand}}', '为什么选择 {{brand}}'),
    'advTrafficText': (
        'Хватит на видео, звонки и работу.',
        'Enough for video, calls and work.',
        'کافی برای ویدیو، تماس و کار.',
        '足够观看视频、通话和工作。',
    ),
    'advTrafficTitle': ('{{gb}} ГБ трафика', '{{gb}} GB of traffic', '{{gb}} گیگابایت ترافیک', '{{gb}} GB 流量'),
    'advTrafficUnlimitedTitle': ('Безлимитный трафик', 'Unlimited traffic', 'ترافیک نامحدود', '无限流量'),
    'checkoutKicker': ('Оформление', 'Checkout', 'خرید', '下单'),
    'checkoutLead': (
        'Ключ придёт на email или в Telegram сразу после оплаты.',
        'Your key arrives by email or in Telegram right after payment.',
        'کلید شما بلافاصله پس از پرداخت به ایمیل یا تلگرام ارسال می‌شود.',
        '付款后，密钥会立即发送到您的邮箱或 Telegram。',
    ),
    'checkoutTitle': ('Выберите тариф', 'Choose a plan', 'طرح را انتخاب کنید', '选择套餐'),
    'cta': ('Выбрать тариф', 'Choose a plan', 'انتخاب طرح', '选择套餐'),
    'devicesLabel': (
        {'one': 'устройство', 'few': 'устройства', 'many': 'устройств', 'other': 'устройства'},
        {'one': 'device', 'other': 'devices'},
        {'one': 'دستگاه', 'other': 'دستگاه'},
        {'other': '台设备'},
    ),
    'faqConnectA': (
        'Откройте ключ подписки в приложении-клиенте, например Happ, — серверы подтянутся сами. '
        'Пошаговая инструкция есть в личном кабинете.',
        'Open the subscription key in a client app, for example Happ — the servers load automatically. '
        'Step-by-step instructions are in your account.',
        'کلید اشتراک را در یک برنامه کلاینت، مثلاً Happ، باز کنید — سرورها خودکار بارگذاری می‌شوند. '
        'راهنمای گام‌به‌گام در حساب کاربری شما هست.',
        '在客户端应用（例如 Happ）中打开订阅密钥，服务器会自动载入。分步说明可在个人中心查看。',
    ),
    'faqConnectQ': (
        'Как подключиться после оплаты?',
        'How do I connect after payment?',
        'بعد از پرداخت چطور وصل شوم؟',
        '付款后如何连接？',
    ),
    'faqDevicesA': (
        {
            'one': 'До {{count}} устройства на одной подписке одновременно.',
            'few': 'До {{count}} устройств на одной подписке одновременно.',
            'many': 'До {{count}} устройств на одной подписке одновременно.',
            'other': 'До {{count}} устройств на одной подписке одновременно.',
        },
        {
            'one': 'Up to {{count}} device on one subscription at the same time.',
            'other': 'Up to {{count}} devices on one subscription at the same time.',
        },
        {
            'one': 'تا {{count}} دستگاه هم‌زمان روی یک اشتراک.',
            'other': 'تا {{count}} دستگاه هم‌زمان روی یک اشتراک.',
        },
        {'other': '一个订阅最多可同时连接 {{count}} 台设备。'},
    ),
    'faqDevicesQ': (
        'Сколько устройств можно подключить?',
        'How many devices can I connect?',
        'چند دستگاه می‌توانم وصل کنم؟',
        '可以连接多少台设备？',
    ),
    'faqDevicesUnlimitedA': (
        'Сколько угодно — ограничения по числу устройств нет.',
        'As many as you like — there is no device limit.',
        'هر تعداد که بخواهید — محدودیتی برای تعداد دستگاه نیست.',
        '不限数量——没有设备限制。',
    ),
    'faqGiftA': (
        'Да. При оформлении отметьте покупку в подарок и укажите контакт получателя — ключ уйдёт ему.',
        "Yes. At checkout, mark the purchase as a gift and enter the recipient's contact — "
        'the key will be sent to them.',
        'بله. هنگام خرید، آن را هدیه علامت بزنید و اطلاعات تماس گیرنده را وارد کنید — کلید برای او ارسال می‌شود.',
        '可以。下单时勾选作为礼物并填写收件人联系方式，密钥将发送给对方。',
    ),
    'faqGiftQ': (
        'Можно ли подарить подписку?',
        'Can I give a subscription as a gift?',
        'می‌توانم اشتراک را هدیه بدهم؟',
        '可以把订阅作为礼物吗？',
    ),
    'faqKicker': ('Вопросы', 'Questions', 'پرسش‌ها', '问题'),
    'faqPayA': (
        '{{methods}}. Ссылка на оплату откроется после нажатия «{{pay}}».',
        '{{methods}}. The payment link opens after you press «{{pay}}».',
        '{{methods}}. لینک پرداخت پس از زدن «{{pay}}» باز می‌شود.',
        '{{methods}}。点击「{{pay}}」后将打开付款链接。',
    ),
    'faqPayQ': ('Как оплатить?', 'How do I pay?', 'چطور پرداخت کنم؟', '如何付款？'),
    'faqRenewA': (
        'В личном кабинете — новый срок добавится к текущему, оставшиеся дни не пропадут.',
        'In your account — the new term is added to the current one, remaining days are kept.',
        'در حساب کاربری — مدت جدید به مدت فعلی اضافه می‌شود و روزهای باقی‌مانده از بین نمی‌روند.',
        '在个人中心续订——新期限会叠加到当前期限，剩余天数不会丢失。',
    ),
    'faqRenewQ': (
        'Как продлить подписку?',
        'How do I renew my subscription?',
        'چطور اشتراک را تمدید کنم؟',
        '如何续订？',
    ),
    'faqSignupA': (
        'Нет. Укажите email или Telegram-ник — ключ подписки придёт туда, '
        'а личный кабинет создастся автоматически.',
        'No. Enter your email or Telegram username — the subscription key will be sent there, '
        'and your account is created automatically.',
        'خیر. ایمیل یا نام کاربری تلگرام را وارد کنید — کلید اشتراک به آنجا ارسال می‌شود '
        'و حساب کاربری خودکار ساخته می‌شود.',
        '不需要。填写邮箱或 Telegram 用户名，订阅密钥会发送到那里，账户也会自动创建。',
    ),
    'faqSignupQ': ('Нужна ли регистрация?', 'Do I need to sign up?', 'آیا ثبت‌نام لازم است؟', '需要注册吗？'),
    'faqTitle': ('Частые вопросы', 'FAQ', 'پرسش‌های متداول', '常见问题'),
    'finalKicker': ('Готовы?', 'Ready?', 'آماده‌اید؟', '准备好了吗？'),
    'finalText': (
        'Без регистрации. Ключ придёт сразу после оплаты.',
        'No sign-up. The key arrives right after payment.',
        'بدون ثبت‌نام. کلید بلافاصله پس از پرداخت می‌رسد.',
        '无需注册，付款后立即收到密钥。',
    ),
    'finalTitle': ('Подключайтесь за минуту', 'Connect in a minute', 'در یک دقیقه وصل شوید', '一分钟即可连接'),
    'from': ('от', 'from', 'از', '低至'),
    'gb': ('ГБ', 'GB', 'گیگابایت', 'GB'),
    'heroLead': (
        'VPN без регистрации. Оплатили — ключ уже у вас на email или в Telegram.',
        'VPN with no sign-up. Pay — and the key is already in your email or Telegram.',
        'VPN بدون ثبت‌نام. پرداخت کنید — کلید همان لحظه در ایمیل یا تلگرام شماست.',
        '无需注册的 VPN。付款后，密钥立即发送到您的邮箱或 Telegram。',
    ),
    'paymentsLabel': (
        {'one': 'способ оплаты', 'few': 'способа оплаты', 'many': 'способов оплаты', 'other': 'способа оплаты'},
        {'one': 'payment method', 'other': 'payment methods'},
        {'one': 'روش پرداخت', 'other': 'روش پرداخت'},
        {'other': '种支付方式'},
    ),
    'perMonth': ('в месяц', 'a month', 'در ماه', '每月'),
    'step1Text': (
        'Срок от {{from}} до {{to}} месяцев.',
        'Term from {{from}} to {{to}} months.',
        'مدت از {{from}} تا {{to}} ماه.',
        '期限 {{from}} 至 {{to}} 个月。',
    ),
    'step1TextPlain': (
        'И срок, который вам подходит.',
        'And a term that suits you.',
        'و مدتی که برایتان مناسب است.',
        '以及适合您的期限。',
    ),
    'step1Title': ('Выберите тариф', 'Choose a plan', 'طرح را انتخاب کنید', '选择套餐'),
    'step2Text': ('{{methods}}.', '{{methods}}.', '{{methods}}.', '{{methods}}。'),
    'step2TextPlain': ('Любым удобным способом.', 'Any way you like.', 'به هر روشی که راحت‌ترید.', '任选方式。'),
    'step2Title': ('Оплатите', 'Pay', 'پرداخت کنید', '付款'),
    'step3Text': (
        'Ключ придёт на email или в Telegram — откройте его в приложении.',
        'The key arrives by email or in Telegram — open it in the app.',
        'کلید به ایمیل یا تلگرام می‌رسد — آن را در برنامه باز کنید.',
        '密钥将发送到邮箱或 Telegram，在应用中打开即可。',
    ),
    'step3Title': ('Подключитесь', 'Connect', 'وصل شوید', '连接'),
    'stepsKicker': ('Как это работает', 'How it works', 'چطور کار می‌کند', '使用流程'),
    'stepsTitle': ('Три шага до VPN', 'Three steps to VPN', 'سه قدم تا VPN', '三步开启 VPN'),
    'trafficLabel': ('трафика', 'of traffic', 'ترافیک', '流量'),
    'unlimited': ('Безлимит', 'Unlimited', 'نامحدود', '无限'),
    'upToDevicesTitle': (
        {
            'one': 'До {{count}} устройства',
            'few': 'До {{count}} устройств',
            'many': 'До {{count}} устройств',
            'other': 'До {{count}} устройств',
        },
        {'one': 'Up to {{count}} device', 'other': 'Up to {{count}} devices'},
        {'one': 'تا {{count}} دستگاه', 'other': 'تا {{count}} دستگاه'},
        {'other': '最多 {{count}} 台设备'},
    ),
}


def die(msg):
    print('ОШИБКА: ' + msg)
    sys.exit(1)


def put(tree, dotted, value):
    """Записать значение по пути a.b.c, создавая промежуточные словари.

    Возвращает False, если ключ уже есть: чужие переводы не перетираем.
    """
    node = tree
    parts = dotted.split('.')
    for part in parts[:-1]:
        nxt = node.get(part)
        if nxt is None:
            nxt = {}
            node[part] = nxt
        elif not isinstance(nxt, dict):
            die('в локали путь %s упирается в строку на %s' % (dotted, part))
        node = nxt
    if parts[-1] in node:
        return False
    node[parts[-1]] = value
    return True


total = 0
for index, language in enumerate(LANGS):
    path = '%s/%s.json' % (LOCALES, language)
    try:
        data = json.load(open(path, encoding='utf-8'))
    except OSError:
        print('локаль %s не найдена, пропускаем' % path)
        continue

    added = 0
    for key, values in STRINGS.items():
        value = values[index]
        if isinstance(value, dict):
            for form in PLURAL_FORMS[language]:
                if form not in value:
                    die('нет формы %s для %s в %s' % (form, key, language))
                if put(data, '%s%s_%s' % (PREFIX, key, form), value[form]):
                    added += 1
        elif put(data, PREFIX + key, value):
            added += 1

    if not added:
        print('%s: всё на месте' % path)
        continue

    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    total += added
    print('%s: добавлено строк — %d' % (path, added))

print('итого добавлено: %d' % total)
