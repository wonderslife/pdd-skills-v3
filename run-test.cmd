@echo off
setlocal
set CHROME_PATH=C:\Users\name\AppData\Local\Google\Chrome\Application\chrome.exe
if "%1"=="" (
  echo Usage: run-test ^<yaml文件^>
  echo Example: run-test ruoyi-project\testcases\frontend\PRESALE-001-goods-create.yaml
  exit /b 1
)
"C:\Users\name\.workbuddy\binaries\python\envs\pdd-test\Scripts\python.exe" "%~dp0tests\testcase-ai.py" %1
