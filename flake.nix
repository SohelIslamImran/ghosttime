{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }:
  let
    pkgs = nixpkgs.legacyPackages.x86_64-linux;
  in
  {
    packages.x86_64-linux.ghosttime = pkgs.buildNpmPackage {
      pname = "ghosttime";
      version = "1.3.0";

      src = ./.;
      npmDepsHash = "sha256-LANlvgvf6ErIL+1hhqt2A77BVxxTe8V2uXlKdYgsz10=";

      nativeBuildInputs = with pkgs; [ bun ];
      buildInputs = with pkgs; [ nodejs ];

      meta. description = " Ghostty animation for any terminal with customizable colors";
    };

    devShells.x86_64-linux.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        nodejs
        bun
        self.packages.x86_64-linux.ghosttime
      ];
    };
  };
}
