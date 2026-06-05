$langs = @(
    @{ Name = "Python (python)"; Cmd = "python"; Args = "--version" },
    @{ Name = "Python (python3)"; Cmd = "python3"; Args = "--version" },
    @{ Name = "Python Launcher (py)"; Cmd = "py"; Args = "--version" },
    @{ Name = "Node.js (node)"; Cmd = "node"; Args = "--version" },
    @{ Name = "NPM"; Cmd = "npm"; Args = "--version" },
    @{ Name = "Java"; Cmd = "java"; Args = "-version" },
    @{ Name = "Go"; Cmd = "go"; Args = "version" },
    @{ Name = "Rust"; Cmd = "rustc"; Args = "--version" },
    @{ Name = "PHP"; Cmd = "php"; Args = "--version" },
    @{ Name = "Ruby"; Cmd = "ruby"; Args = "--version" },
    @{ Name = "C/C++ (GCC)"; Cmd = "gcc"; Args = "--version" },
    @{ Name = "C/C++ (Clang)"; Cmd = "clang"; Args = "--version" },
    @{ Name = "C# / .NET CLI"; Cmd = "dotnet"; Args = "--version" },
    @{ Name = "Git (Git Bash/Perl/etc)"; Cmd = "git"; Args = "--version" },
    @{ Name = "Bash (Git Bash/WSL)"; Cmd = "bash"; Args = "--version" },
    @{ Name = "Perl"; Cmd = "perl"; Args = "--version" },
    @{ Name = "WSL (Windows Subsystem for Linux)"; Cmd = "wsl"; Args = "--list --quiet" }
)

foreach ($l in $langs) {
    $command = Get-Command $l.Cmd -ErrorAction SilentlyContinue
    if ($command) {
        $version = & $l.Cmd $l.Args 2>&1
        $verString = ($version -join ' ').Trim()
        Write-Host "$($l.Name): Terinstal ($verString)"
    } else {
        Write-Host "$($l.Name): Tidak ditemukan"
    }
}
Write-Host "PowerShell: Terinstal ($($PSVersionTable.PSVersion.ToString()))"
