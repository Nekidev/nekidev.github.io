---
title: "Welcome to Wlroots! Part 5: Keyboard Input"
layout: post
tags: [wlroots]
spintag: wlroots
---

> This blog post is part of the [Welcome to Wlroots!](/2026/10/30/1-welcome-to-wlroots.html) series.
> It works on code we've written in past blog posts.

I really wanted to put this blog post's contents into the last one, yet it was already past 5 AM by
the time I finished writing it, so here we are.

Keyboard input! Once this is done, we can start moving windows with keybinds and the mouse combined.
That's really cool stuff. I thought this part would be quite similar to the past cursors post, yet
wlroots handles keyboards differently so it'll not be quite the same.

A note on this post, I'll be aiming to handling a single keyboard at a time. Unlike with multiple
cursors or outputs where you can either emulate them with windows or coordinate them with
`wlr_cursor`, keyboards are handled via multiple individual `wlr_keyboard`s firing key events. In a
more general-purpose compositor, you'd want to either handle only one of them at a time and let the
user select which keyboard to use or merge all keyboard states into a single bigger keyboard state.
The latter is probably the best one given you can use any keyboard without much thought, the issue
with it is that XKB states can't be simply ORed due to keymap differences. Due to all of it, for the
sake of simplicity I'll handle keyboards the "bad" way. A single keyboard will work fine, yet two
keyboards will likely fight for attention if both have keys pressed at the same time.

Disclaimer done, let's get to the code! Handling keyboard events is quite light in code given we
already wrote most of the infrastructure for it when handling cursors.

## `wlr_keyboard` Lifecycle

As I mentioned before, each keyboard input device has its own `wlr_keyboard`, so let's store them
and their events in our `nye_input`.

```c
struct nye_input
{
    // -- snip --

    // When the input device is a keyboard, these will be set. If the input device is not a
    // keyboard, this will be null.
    struct wlr_keyboard *wlr_keyboard;

    // on_key_* will only be set when the input device is a keyboard.
    struct wl_listener on_keyboard_key;
    struct wl_listener on_keyboard_modifiers;

    // -- snip --
};
```

Let's also create some placeholders for `on_keyboard_key` and `on_keyboard_modifier` handlers.

```c
static void on_keyboard_key(struct wl_listener *, void *) {}
static void on_keyboard_modifier(struct wl_listener *, void *) {}
```

Modifier keys will fire both of them. That's because `wlr_keyboard`, like `wlr_cursor`, keeps track
of the pressed keys and modifiers. When `on_keyboard_key` is fired, it means a physical key was
pressed/released. When `on_keyboard_modifier` is fired, it means `wlr_keyboard`'s modifier state
changed.

Now that we have that covered, we can go handle the lifecycle of our `wlr_keyboard`s when new input
devices are created and destroyed.

```c
static void on_input_del(struct wl_listener *wl_listener, void *data)
{
    // -- snip --

    switch (wlr_input_device->type)
    {
    // -- snip --

    case WLR_INPUT_DEVICE_KEYBOARD:
        wl_list_remove(&nye_input->on_keyboard_key.link);
        wl_list_remove(&nye_input->on_keyboard_modifiers.link);
        break;

    default:
        break;
    }

    // -- snip --
}

static void on_input_add(struct wl_listener *wl_listener, void *data)
{
    // -- snip --

    switch (wlr_input_device->type)
    {
    // -- snip --

    case WLR_INPUT_DEVICE_KEYBOARD:
        nye_input->wlr_keyboard = wlr_keyboard_from_input_device(wlr_input_device);
        nye_input->on_keyboard_key.notify = on_keyboard_key;
        wl_signal_add(&nye_input->wlr_keyboard->events.key, &nye_input->on_keyboard_key);
        nye_input->on_keyboard_modifiers.notify = on_keyboard_modifiers;
        wl_signal_add(&nye_input->wlr_keyboard->events.modifiers, &nye_input->on_keyboard_modifiers);
        break;

    default:
        break;
    }

    // -- snip --
}
```

Great! The code is simple, we just create the `wlr_keyboard` from the input device and hook the
listeners, then unlink them before destruction when the input device is disconnected.

Now that that's handled, we can go to our key/modifier events and forward them to the focused
window.

```c
static void on_keyboard_key(struct wl_listener *wl_listener, void *data)
{
    struct nye_input *nye_input = wl_container_of(wl_listener, nye_input, on_keyboard_key);
    struct nye_server *nye_server = nye_input->nye_server;
    struct wlr_keyboard_key_event *wlr_keyboard_key_event = data;

    struct wlr_surface *wlr_surface = nye_scene_get_hovered_surface(nye_input->nye_server, NULL, NULL);
    if (wlr_surface != NULL)
    {
        wlr_seat_keyboard_notify_enter(
            nye_server->wlr_seat,
            wlr_surface,
            nye_input->wlr_keyboard->keycodes,
            nye_input->wlr_keyboard->num_keycodes,
            &nye_input->wlr_keyboard->modifiers);
        wlr_seat_keyboard_notify_key(
            nye_server->wlr_seat,
            wlr_keyboard_key_event->time_msec,
            wlr_keyboard_key_event->keycode,
            wlr_keyboard_key_event->state);
    }
}

static void on_keyboard_modifiers(struct wl_listener *wl_listener, void *)
{
    struct nye_input *nye_input = wl_container_of(wl_listener, nye_input, on_keyboard_modifiers);
    struct nye_server *nye_server = nye_input->nye_server;

    struct wlr_surface *wlr_surface = nye_scene_get_hovered_surface(nye_input->nye_server, NULL, NULL);
    if (wlr_surface != NULL)
    {
        wlr_seat_keyboard_notify_enter(
            nye_server->wlr_seat,
            wlr_surface,
            nye_input->wlr_keyboard->keycodes,
            nye_input->wlr_keyboard->num_keycodes,
            &nye_input->wlr_keyboard->modifiers);
        wlr_seat_keyboard_notify_modifiers(
            nye_server->wlr_seat,
            &nye_input->wlr_keyboard->modifiers);
    }
}
```

It's practically the same code as for our cursor events. We reuse our
`nye_scene_get_hovered_surface()` function to get the currently focused window, if any, and if the
focused window is not null (i.e. we're actually hovering a window) we forward keyboard events to it.

## Keyboard Layout

The code above works for simple stuff, yet it's missing a keymap. A keymap is a dictionary that maps
what physical keys represent which software letters and modifiers. Without one, modifier keys won't
work, so you'll be able to type stuff in windows but not do stuff like `Ctrl + A` to select all text
in an input field.

Wlroots (and many other things) handles keymaps via xkbcommon (x keyboard common). To be able to use
it, we need to install it and link to it. You can install it from the package `libxkbcommon`,
`libxkbcommon-dev`, or `libxkbcommon-devel` depending on your system. Once it's installed, let's
link it in our Makefile.

```makefile
# -- snip --
DEPENDENCIES = xkbcommon wayland-server wlroots-0.19
# -- snip --
```

Then in our code, we can include the header as follows.

```c
#include <xkbcommon/xkbcommon.h>
```

Now that that's done, we can head over to our `on_input_add` and set our `wlr_keyboard`s keymaps.

```c
static void on_input_add(struct wl_listener *wl_listener, void *data)
{
    // -- snip --

    switch (wlr_input_device->type)
    {
    // -- snip --

    case WLR_INPUT_DEVICE_KEYBOARD:
        nye_input->wlr_keyboard = wlr_keyboard_from_input_device(wlr_input_device);
        nye_input->on_keyboard_key.notify = on_keyboard_key;
        wl_signal_add(&nye_input->wlr_keyboard->events.key, &nye_input->on_keyboard_key);
        nye_input->on_keyboard_modifiers.notify = on_keyboard_modifiers;
        wl_signal_add(&nye_input->wlr_keyboard->events.modifiers, &nye_input->on_keyboard_modifiers);

        struct xkb_context *xkb_context = xkb_context_new(XKB_CONTEXT_NO_FLAGS);
        struct xkb_keymap *xkb_keymap = xkb_keymap_new_from_names2(
            xkb_context,
            NULL, // We use the default keymap
            XKB_KEYMAP_FORMAT_TEXT_V1,
            XKB_KEYMAP_COMPILE_NO_FLAGS);
        wlr_keyboard_set_keymap(nye_input->wlr_keyboard, xkb_keymap);
        xkb_context_unref(xkb_context);
        xkb_keymap_unref(xkb_keymap);
        wlr_keyboard_set_repeat_info(nye_input->wlr_keyboard, 25, 600);

        break;

    default:
        break;
    }

    // -- snip --
}
```

Great! That should be it, you now have fully working keyboard input.

## Focus Management

In the next part of this series, we'll be diving into better focus management. That's given we'll:

1. Need to add some configs not to hardcode shortcuts,
2. Need to move windows around,
3. Need not to depend on a pointer for focus.
