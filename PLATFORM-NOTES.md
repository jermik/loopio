# Platform notes

MyLoopio gebruikt op dit moment Windows native input APIs via `user32.dll`.
Daardoor is de huidige automation-functionaliteit alleen volledig werkend op Windows.

Deze v5 voegt wel toe:
- build scripts voor Windows / Linux / macOS
- GitHub Actions workflow voor automatische builds
- icons/resources voor meerdere platformen

Voor Linux/macOS moet later nog een native input laag worden toegevoegd.
