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

; 卸载阶段：询问是否同时删除应用自身的配置与日志（不会动 ~/.dsh 的会话数据）。
!macro customUnInstall
  MessageBox MB_YESNO "是否同时删除 DeepSeek Harness 桌面端的配置与日志？（不会删除你的 DSH 会话数据）" IDNO dsh_skip_cleanup
    RMDir /r "$APPDATA\DeepSeek Harness"
  dsh_skip_cleanup:
!macroend
