@echo off
chcp 65001 >nul
setlocal

rem 切换到 bat 所在目录
cd /d "%~dp0"

rem ====== MySQL 服务名（按你的实际情况修改）======
set "MYSQL_SERVICE=MySQL"

echo 正在检测 MySQL 服务：%MYSQL_SERVICE%
sc query "%MYSQL_SERVICE%" | find /i "RUNNING" >nul

if %errorlevel%==0 (
    echo MySQL 服务已启动。
) else (
    echo MySQL 服务未启动，正在尝试启动...
    net start "%MYSQL_SERVICE%"

    if errorlevel 1 (
        echo MySQL 服务启动失败。
        echo 请检查：
        echo 1. 服务名是否正确
        echo 2. 是否使用管理员身份运行此 bat
        pause
        exit /b 1
    ) else (
        echo MySQL 服务启动成功。
    )
)

echo.
echo 正在运行 movie.js ...
node movie.js

pause