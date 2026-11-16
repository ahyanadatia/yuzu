#!/bin/sh
# Builds index.html from src/. Usage: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_KEY=sb_publishable_xxx ./build.sh
set -e
cd "$(dirname "$0")"
cat src/head.html src/core.js src/app.js src/views.js > index.html
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  sed -i.bak "s#__SUPABASE_URL__#$SUPABASE_URL#; s#__SUPABASE_KEY__#$SUPABASE_KEY#" index.html && rm -f index.html.bak
fi
echo "Built index.html"
