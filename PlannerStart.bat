@echo off
title Wild Hunt Skill Planner
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js wasn't found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)
node server.js
if errorlevel 1 pause
