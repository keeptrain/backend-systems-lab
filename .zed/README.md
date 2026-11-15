# Zed settings

Zed opens this repository through WSL remote development, so language servers
run inside WSL and use the Linux Biome binary.

`biome.json` must stay at the repository root because that is the worktree root.
`files.includes` limits Biome to `app/**`.

Windows Smart App Control blocks `biome.exe` on the Windows side, but Zed's WSL
remote server does not use that binary. Keep the formatter pointed at the
`biome` language server rather than a Windows executable.
