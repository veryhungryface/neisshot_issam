@echo off
chcp 65001 >nul
REM 더블클릭: 자동화 연습장(모의 나이스·모의 에듀파인)을 이 PC에서만 띄웁니다. (Python 3 필요)
cd /d "%~dp0"
start "" http://127.0.0.1:8770/
python server.py --port 8770
pause
