Generated code will currently not work in next.js due to:
vercel/next.js#17806

You'll see a "ReferenceError: module is not defined" error client side importing
anything from the .alinea package.
