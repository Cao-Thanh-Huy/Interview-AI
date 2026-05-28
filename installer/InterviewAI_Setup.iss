; ============================================================
;  Interview AI -- Inno Setup Script v2 (Portable Node.js)
;  Output: installer\output\InterviewAI_Setup_v1.0.0.exe
;
;  Requirements:
;    1. Run build-release.ps1 first -> Release_Package/ is ready
;    2. Compile with: ISCC.exe installer\InterviewAI_Setup.iss
; ============================================================

#define AppName      "Interview AI"
#define AppVersion   "1.0.0"
#define AppPublisher "Interview AI"
#define SourceDir    "..\Release_Package"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=http://localhost:3001
DefaultDirName={localappdata}\InterviewAI
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=InterviewAI_Setup_v{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayName={#AppName}

[Languages]
Name: "vi"; MessagesFile: "compiler:Default.isl"

; ============================================================
[Files]
; Main app bundle (minified/obfuscated JS) + ESM marker
Source: "{#SourceDir}\app\index.js";           DestDir: "{app}\app"; Flags: ignoreversion
Source: "{#SourceDir}\app\package.json";       DestDir: "{app}\app"; Flags: ignoreversion

; Frontend static files (React build)
Source: "{#SourceDir}\app\frontend-dist\*";   DestDir: "{app}\app\frontend-dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; All node_modules (production deps: @xenova, better-sqlite3, groq-sdk, etc.)
Source: "{#SourceDir}\app\node_modules\*";    DestDir: "{app}\app\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; Portable Node.js runtime (no install required on client machine)
Source: "{#SourceDir}\runtime\node.exe";      DestDir: "{app}\runtime"; Flags: ignoreversion

; Launchers
Source: "{#SourceDir}\InterviewAI.vbs";       DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\InterviewAI_Debug.bat"; DestDir: "{app}"; Flags: ignoreversion

; Config files - preserved across uninstall/reinstall cycles
; Note: .env is NOT bundled — created automatically by the app on first key save
Source: "{#SourceDir}\license.key"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall
Source: "{#SourceDir}\README.txt";  DestDir: "{app}"; Flags: ignoreversion

; AI Models folder (empty - filled at runtime)
Source: "{#SourceDir}\models\*"; DestDir: "{app}\models"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; ============================================================
[Dirs]
Name: "{app}\data"
Name: "{app}\models"

; ============================================================
[Icons]
Name: "{autodesktop}\{#AppName}"; Filename: "wscript.exe"; Parameters: """{app}\InterviewAI.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\runtime\node.exe"; Comment: "Open Interview AI"
Name: "{autoprograms}\{#AppName}\{#AppName}"; Filename: "wscript.exe"; Parameters: """{app}\InterviewAI.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\runtime\node.exe"
Name: "{autoprograms}\{#AppName}\{#AppName} (Debug Console)"; Filename: "{app}\InterviewAI_Debug.bat"; WorkingDir: "{app}"
Name: "{autoprograms}\{#AppName}\Uninstall {#AppName}"; Filename: "{uninstallexe}"

; ============================================================
[Run]
Filename: "wscript.exe"; Parameters: """{app}\InterviewAI.vbs"""; Description: "Launch {#AppName} now"; Flags: nowait postinstall shellexec runasoriginaluser; StatusMsg: "Starting Interview AI..."

; ============================================================
[UninstallRun]
Filename: "taskkill"; Parameters: "/F /IM node.exe"; Flags: runhidden

; ============================================================
[Code]
function InitializeSetup(): Boolean;
var ResultCode: Integer;
begin
  // Kill any running instance before install/update
  Exec('taskkill', '/F /IM node.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;
