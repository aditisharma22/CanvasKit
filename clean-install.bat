@echo off
echo Cleaning the project...
rmdir /s /q node_modules
del package-lock.json

echo Installing dependencies...
npm install

echo Starting the development server...
npm run dev
