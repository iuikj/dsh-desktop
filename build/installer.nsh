; 自定义安装阶段：检测 DeepSeek Harness，缺失则自动安装。
; 具体逻辑由随应用打包的 bootstrap-dsh.cmd / bootstrap-dsh.js 完成。
!macro customInstall
  DetailPrint "正在检测 / 安装 DeepSeek Harness 依赖…"
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /c "$INSTDIR\resources\scripts\bootstrap-dsh.cmd"'
  Pop $0
  ${If} $0 == 0
    DetailPrint "DeepSeek Harness 依赖已就绪。"
  ${Else}
    DetailPrint "DeepSeek Harness 自动安装未完成；应用首次启动时会再次尝试自动安装。"
  ${EndIf}
!macroend
