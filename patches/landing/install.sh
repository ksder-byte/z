#!/usr/bin/env bash
# Устанавливает лендинг DurdenVPN в кабинет (страница /buy/{slug}).
# Запускать из корня кабинета: cd ~/bedolaga-cabinet && bash путь/к/install.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f src/pages/QuickPurchase.tsx ]; then
  echo "Запускайте из корня кабинета (там, где лежит src/pages/QuickPurchase.tsx)" >&2
  exit 1
fi

mkdir -p src/components/landing
cp "$HERE/MonoLanding.tsx" "$HERE/monoLanding.css" src/components/landing/
python3 "$HERE/landing_hook.py"
python3 "$HERE/landing_align.py"
python3 "$HERE/landing_i18n.py"

echo
echo "Готово. Пересоберите и выкатите кабинет:"
echo "  docker compose build cabinet-frontend \\"
echo "    && docker compose up -d --force-recreate cabinet-frontend \\"
echo "    && docker cp cabinet_frontend:/usr/share/nginx/html/. /srv/cabinet/"
