import base from "@shikijs/themes/ayu-dark";
import { ThemeRegistration } from "shiki";

const theme: ThemeRegistration = {
  ...base,
  tokenColors: [
    {
      settings: {
        background: "none",
        foreground: "none",
      }
    },
    ...base.tokenColors!,
  ]
};

export default theme;
