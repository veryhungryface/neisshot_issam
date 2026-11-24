#!/bin/bash
# dev helper: restart the sandbox server using a pid file (never pattern-matches other processes)
cd "$(dirname "$0")/.."
PIDF=/tmp/sandbox.pid
[ -f $PIDF ] && kill "$(cat $PIDF)" 2>/dev/null
sleep 0.4
setsid nohup python3 server.py --port 8770 > /tmp/sandbox.log 2>&1 < /dev/null &
echo $! > $PIDF
sleep 1.2
curl -s -o /dev/null -w "server %{http_code}\n" http://127.0.0.1:8770/
