{
  description = "Development shell for the Reveal Obsidian plugin";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              bun
              ripgrep
            ];

            shellHook = ''
              echo "Reveal development shell"
              echo "Run 'bun install' and then 'bun run check'."
            '';
          };
        });
    };
}
