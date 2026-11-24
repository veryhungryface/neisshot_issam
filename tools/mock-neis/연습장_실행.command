#!/bin/bash
# 더블클릭: 자동화 연습장(모의 나이스·모의 에듀파인)을 이 컴퓨터에서만 띄웁니다.
cd "$(dirname "$0")"
# kev-ultrafast 폴더 안에 있으면 에이전트까지 함께 켭니다 (화면 패널에서 바로 요청 가능)
if [ -x ../scripts/start.sh ] && [ -f ../AI연습장_시작.command ]; then exec bash ../AI연습장_시작.command; fi
PORT=${SANDBOX_PORT:-8770}
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3가 없습니다. 터미널에서 xcode-select --install 을 먼저 실행하세요."; read -r; exit 1
fi
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "이미 실행 중입니다: http://127.0.0.1:$PORT/"; open "http://127.0.0.1:$PORT/"; read -r -p "Enter를 누르면 창을 닫습니다."; exit 0
fi
( sleep 1.5; open "http://127.0.0.1:$PORT/" ) &
echo "연습장을 시작합니다. 이 창을 닫거나 Ctrl+C를 누르면 종료됩니다."
python3 server.py --port $PORT
