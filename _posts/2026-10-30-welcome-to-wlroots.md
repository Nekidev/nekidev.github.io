---
layout: post
title: Welcome to Wlroots! Part 1
author: Nyeki
---

So I ditched Arch Linux with Hyprland and moved to Ubuntu Desktop with Gnome Shell. People can say
whatever about Ubuntu, in the end it has been a really smooth experience overall. However, I do
have a bunch of complaints.

1. Some keybinds seem hardcoded into the compositor,
2. The settings app's hotspot doesn't allow wifi + hotspot even when my network card supports it,
3. The settings app's keybinds aren't as customizable as hyprland's without touching the CLI,
4. Hyprland breaks. It breaks MANY times. Way too many. Some day they just decided to ditch their
   config format and went for Lua. Lua's great, yet only 1 version to migrate everything before
   catastrophe wasn't nice. And it seems coded for the vibes, which I don't like.
5. Went to the Hyprland Discord server to ask for help with some issue I had, I got greeted with
   jokes from the dev and no help at all. Welp.

So I set sail to build my own compositor.

For context, I had tried implementing my own wayland compositor with Smithay and Rust before, but
they all just seem to have absolutely zero "newbies click here" step-by-step guide to get to work,
the wlroots docs are just a bunch of method lists, it's not a nice experience for someone getting
started.

It's not impossible to get started with it, in fact it's quite easy. The only issue is the lack of
docs, so here I am. Writing this for myself to learn as I go, and hopefully it becomes useful to
you too.

It's worth noticing that at the time of writing this I have a compositor accepting connections but
not doing anything useful with them, it just renders a black screen. I have not yet implemented
XDG shell yet, though, so it makes sense stuff hasn't been rendering.

This is the first post of a bunch I'll be writing as notes for myself not to forget and better
internalize what I learn. Also notice that I am a beginner to C as well, though I have experience
with Rust, Python, and the dreadful JavaScript.

These posts will also be based on what I learned reading from [Drew Devault's blog]. Issue with it
is that many APIs have since changed considerably, so many parts of the code snippets provided in
those examples just don't work anymore.

Feel free to raise an issue in [this blog's GitHub issues] if you notice any typos or other
mistakes.

[Drew Devault's blog]: https://drewdevault.com/blog/
[this blog's GitHub issues]: https://github.com/Nekidev/nekidev.github.io
