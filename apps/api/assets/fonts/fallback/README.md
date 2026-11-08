# Certificate fallback fonts

Fraunces and Inter (bundled one level up) cover Latin scripts. Drop extra `.ttf`/`.otf` files in this
folder and the certificate renderer tries them, in filename order, for any learner name, course
title or teacher name the bundled fonts cannot draw. Only the glyphs used are embedded (subset).

Recommended for Singapore: `NotoSansSC-Regular.otf` (Chinese) and `NotoSansTamil-Regular.ttf`
(Tamil), both SIL Open Font License, from https://fonts.google.com/noto. Font files are
git-ignored here; copy them in during deployment, or point `CERTIFICATE_FALLBACK_FONTS` at files
elsewhere on the host.
