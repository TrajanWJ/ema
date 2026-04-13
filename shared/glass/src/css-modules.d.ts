/**
 * Ambient declaration so `import styles from "./X.module.css"` type-checks
 * without a bundler plugin. Consumers (Vite, Next, etc.) provide the real
 * transform at runtime. The shape is a string->string map: all class names
 * become string properties.
 */
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.css" {
  const content: string;
  export default content;
}
