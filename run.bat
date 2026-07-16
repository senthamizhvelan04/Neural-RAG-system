@echo off
echo =========================================
echo  Starting NeuralRAG Server...
echo =========================================
call venv\Scripts\activate.bat
python server.py
pause
