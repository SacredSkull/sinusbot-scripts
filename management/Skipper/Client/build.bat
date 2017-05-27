@echo off
cd src
call "C:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat" x86_amd64
MSBuild /p:Configuration=Release /property:Platform=x64
