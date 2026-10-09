!macro customInit
  ; An older tray build can remain alive without a visible tray icon and lock
  ; its executable. Closing only this app makes both manual and auto updates
  ; recover without asking the user to find the hidden process.
  nsExec::ExecToLog 'taskkill /F /IM "Codex Usage Monitor.exe"'
!macroend
