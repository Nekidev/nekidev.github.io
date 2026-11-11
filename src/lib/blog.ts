import { SiGithub, SiKofi, SiX } from "@icons-pack/react-simple-icons";
import dedent from "dedent";

const blog = {
  title: "Nyeki's Blog",
  description: dedent`
    A bunch of posts I write as I learn to internalize things and share my thoughts. Launching my
    first (of many) company. Developer in Rust, Python, and JS/TS, learning C.
  `.replaceAll("\n", " "),
  avatar: "https://avatars.githubusercontent.com/u/84998222?v=4&size=64",
  social: {
    email: "rafael@duckity.com",
    other: [
      { Icon: SiKofi, link: "https://ko-fi.com/nyeki" },
      { Icon: SiGithub, link: "https://github.com/nekidev" },
      { Icon: SiX, link: "https://x.com/nyekipy" },
    ],
  },
};

export default blog;
