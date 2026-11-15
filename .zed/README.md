# Zed settings

Zed opens this repository through WSL remote development, so language servers
run inside WSL and use the Linux Biome binary.

`biome.json` lives at the repository root because that is Zed's worktree root
and Biome's project root. `files.includes` limits Biome to `app/**`.

Placing the config only in `app/biome.json` does not work with the current Biome
LSP: the language server is started with the repository root as its workspace
root, and Biome crashes with `path is expected to be under the root` when the
configuration path points to a subdirectory. Running Biome from `app/` still
works, which is why the `lint` script uses that directory.

Windows Smart App Control blocks `biome.exe` on the Windows side, but Zed's WSL
remote server does not use that binary. Keep the formatter pointed at the
`biome` language server rather than a Windows executable.
