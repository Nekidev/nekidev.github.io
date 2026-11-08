---
title: Welcome to Wlroots! Part 2
layout: post
author: Nyeki
---

Part two of the Welcome to Wlroots! series. If you haven't yet, you should go read the [part 1 of
this series].

It has been some days since I last touched my compositor codebase, so we'll start by checking out
how Make works to make it easy for us to be building the project. If you're a C expert already and
you're comfortable with Meson or other tool, feel free to use it instead. I'm using Make because
it's the easiest for beginners (like me).

Also, we'll be using the clang compiler for this project. GCC should work just fine, yet I've heard
clang has better error messages.

## Setting up The Project

Make files are shell scripts with rainbows and unicorns. Compiling a C project usually includes a
lot of chaining commands, which we'll use Make to do. Make sure to have clang, make, and pkg-config
installed in your system. You'll also need `wayland-server` and `wlroots-0.19`. Note that in Ubuntu
at least, `wlroots` is distributed as `wlroots-0.19` and not as `wlroots`.

To begin with, create your project directory and put these things in it:

```
src/
    main.c
.gitignore
Makefile
```

In our `main.c` file, let's put a basic `main()` to run our code.

```c
int main(void) {
    return 0;
}
```

Then in our Makefile, let's write this (indented with tabs, spaces won't work):

```makefile
# Variable for all the Clang flags we'll be using. It enables warnings, makes warnings fail to
# compile, enables wlroots unstable features (wlroots has lots of things marked unstable), and
# enables AddressSanitizer to help us catch memory bugs.
CFLAGS = -o build/compositor --std c23 -Wall -Wextra -Wpedantic -Werror -DWLR_USE_UNSTABLE \
	-Iwayland -g -O0 -fsanitize=address -fno-omit-frame-pointer

# Our build script, we just make an out dir and compile our main.c file.
build:
	mkdir -p build
	clang src/main.c $(CFLAGS)

# This tells Make that `build` is a command and not a file we want to output.
.PHONY: build
```

If you run `make` or `make build` in your terminal, it should output a binary you can execute at
`build/compositor`.

Now that that's done, time to start building our compositor!

## Our First Compositor

Every wayland and wlroots compositor has a `wl_display` ruling it all. It handles the event loop
and incoming connections. Let's create one!

```c
#include <assert.h>
#include <wayland-server-core.h>

int main(void) {
    struct wl_display *wl_display = wl_display_create();
    assert(wl_display);

    return 0;
}
```

That piece of code doesn't compile just yet. That's because we didn't specify any dependencies in
our Makefile. Let's update it.

```makefile
DEPENDENCIES = wayland-server wlroots-0.19
DEP_SRC_FLAGS = $(shell pkg-config --cflags $(DEPENDENCIES))
DEP_LIB_FLAGS = $(shell pkg-config --libs $(DEPENDENCIES))

FLAGS = $(CFLAGS) $(DEP_SRC_FLAGS) $(DEP_LIB_FLAGS)

# Our build script, we just make an out dir and compile our main.c file.
build:
	mkdir -p build
	clang src/main.c $(FLAGS)
```

We use `pkg-config` to get the compiler flags needed to compile using our dependencies. Unlike
other programming languages like Rust or Python, we don't get a nice manifest with dependencies in
there, rather point the compiler to where those dependencies are in our system. `pkg-config` lets
us do that dynamically instead of hardcoding values.

Back to our display, we're not accepting any incoming connections yet, though, so let's start it.
Wayland connections come in through a socket, usually at `/run/user/1000/wayland-0` (replace 1000
with your Linux UID). I'm on GNOME shell, which means I'm already running a Wayland compositor, so
I'll customize my socket's name to `way-nyeki`.

```c
const int socket = wl_display_add_socket(wl_display, "way-nyeki");
if (socket != 0)
    return 1;
```

Now yes, time to start our compositor.

```c
#define _POSIX_C_SOURCE 200112L  // setenv() is POSIX-only, we enable it with this flag
#include <stdlib.h>
// -- snip --

int main(void) {
    // -- snip --
    
    // This env var lets clients know what socket to use to connect to the wayland compositor.
    setenv("WAYLAND_DISPLAY", "way-nyeki", true);
    wl_display_run(wl_display);
    
    // Once the compositor is done running, disconnect everyone cleanly.
    wl_display_destroy_clients(wl_display);
    wl_display_destroy(wl_display);
}
```

FINALLY. We got a compositor that runs, let's run it! `make build` in your terminal will yield your
new compositor under `build`. Paste `build/compositor` to run it, and...

It does nothing. But hey, it doesn't crash!

## Rendering Something

Compositors are useless without rendering something, so let's get to rendering such something.

Wlroots has a `wlr_backend` type which handles outputs and inputs. It supports 4 different
backends: DRM (directly to your screen), libinput (we won't be touching inputs yet), wayland
(rendering our wayland compositor inside another wayland compositor, as a window), and x11 (same as
the wayland one but for x11).

Wlroots can automatically choose the backend we'll need, so we'll just do that. It requires a
reference to the event loop, so we'll also grab it from our `wl_display`.

```c
// -- snip --
#include <wlr/backend.h>

int main(void) {
    // -- snip --
    assert(wl_display);
    
    struct wl_event_loop *wl_event_loop = wl_display_get_event_loop(wl_display);
    assert(wl_event_loop);
    
    // The NULL is a pointer to extra options. We don't need to pass any.
    struct wlr_backend *wlr_backend = wlr_backend_autocreate(wl_event_loop, NULL);
    assert(wlr_backend);

    assert(wlr_backend_start(wlr_backend));

    // -- snip --
}
```

Now, before we keep going like this, our compositor state is growing big, so let's make a type to
hold it all.

```c
struct nye_server {
    // Wayland stuff
    struct wl_display *wl_display;
    struct wl_event_loop *wl_event_loop;

    // Wlroots stuff
    struct wlr_backend *wlr_backend;
};

int main(void) {
    struct nye_server nye_server = {0};

    nye_server.wl_display = wl_display_create();
    assert(nye_server.wl_display);

    nye_server.wl_event_loop = wl_display_get_event_loop(nye_server.wl_display);
    assert(nye_server.wl_event_loop);
    
    // The NULL is a pointer to extra options. We don't need to pass any.
    nye_server.wlr_backend = wlr_backend_autocreate(nye_server.wl_event_loop, NULL);
    assert(nye_server.wlr_backend);

    // -- snip --
}
```

Also update all references to those variables. Great.

## Tracking Outputs

Now, before we can render something, there's a topic I have to introduce: Outputs. In your normal
compositor-to-your-screen setup where the compositor is the one you're actually using (and not a
nested one like we currently have), each output usually corresponds to a monitor. Since at the
moment we're running out compositor nested inside another compositor, each output will correspond
to a window our compositor has within the wayland compositor.

Our backend will fire an event for us to listen to when an output is created, and another one when
that output is destroyed (window closed, monitor unplugged). Wlroots keeps some track of this
internally, yet we'll also keep a reference to those output handles plus some state of ours to
store extra state for our compositor.

The wayland library uses linked lists to store stuff, so we'll use those too. `wl_list` is the type
used for nodes within them. Let's create one for our outputs, and also a wrapper output type.

```c
struct nye_server {
    // -- snip --

    // Our stuff
    struct wl_list nye_outputs;
};

struct nye_output {
    struct wl_list link;  // nye_server::nye_outputs

    struct nye_server *nye_server;  // Easy access to our compositor state.
    struct wlr_output *wlr_output;
};
```

Now, let's initialize our linked list.

```c
int main(void) {
    // -- snip --
    assert(nye_server.wlr_backend);

    wl_list_init(&nye_server.nye_outputs);
    // -- snip --
}
```

Great! That's an empty list, though. We need to add our outputs when they appear, so let's add an
event listener for it.

Event listeners in wayland are wrapped in `wl_listner` types. We'll call ours
`on_{resource}_{action}` (unless there's no `{action}`) to make it clear which does what.

```c
// -- snip --
#include <stdio.h>

struct nye_server {
    // -- snip --
    
    struct wl_listener on_output_add;
};

static void on_output_add(struct wl_listener *, void *) {
    printf("New output!\n");
}

int main(void) {
    // -- snip --

    wl_list_init(&nye_server.nye_outputs);
    // Set the wl_listener's callback to our new function.
    nye_server.on_output_add.notify = on_output_add;
    // Hook our new listener to the backend's new_output event.
    wl_signal_add(&nye_server.wlr_backend->events.new_output, &nye_server.on_output_add);

    // -- snip --
}
```

Try running the compositor with `make build && build/compositor`. You'll now see the following gets
printed to the terminal:

```
New output!
```

That new output represents our wayland window just created.

Now, the window is there but not rendering anything yet. It's very possible that in a compositor
like Hyprland you don't have a way of seeing it. In GNOME shell, nothing pops up on the screen, but
the application bar shows an extra empty VS Code window.

Now, back to our `on_output_add` function, we need to store new outputs in our
`nye_server::nye_outputs` list. We'll first get a reference to our `nye_server` through the
`wl_listener` reference our callback gets and cast the `void *` to the original `wlr_output` type.

```c
static void on_output_add(struct wl_listener *wl_listener, void *data) {
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_output_add);
    struct wlr_output *wlr_output = data;
}
```

Ok but wait a sec, what's `wl_container_of` doing here? Black magic, plain and simple. It's said
that it uses some forgotten spells to get back `arg2` from `arg1` via `arg2::arg3`'s offset in
memory.

Anyway, now we have our wlroots output and our server, we can create our `nye_output` wrapper and
store it in our `nye_server`.

```c
static void on_output_add(struct wl_listener *wl_listener, void *data) {
    // -- snip --

    // It's gonna outlive the function's call, so it goes to the heap.
    struct nye_output *nye_output = calloc(1, sizeof(struct nye_output));
    nye_output->nye_server = nye_server;
    nye_output->wlr_output = wlr_output;
    // Connect em `wl_list`s.
    wl_list_insert(&nye_server->nye_outputs, &nye_output->link);
}
```

Great! Now we have them tracked.

## Output Modes

As we said before, wayland outputs are usually monitors. Such monitors have properties like refresh
rate, height and width, and other properties. Before we can use our outputs for apps, we need to do
two things:

1. To set the output's mode (outputs can have many supported ones or none)
2. To create the `wl_output` global for apps to use those monitors.

Wlroots makes this dead simple, starting with setting the mode:

```c
static void on_output_add(struct wl_listener *wl_listener, void *data) {
    // -- snip --
    wl_signal_add(&nye_server.wlr_backend->events.new_output, &nye_server.on_output_add);
    
    struct wlr_output_state wlr_output_state;
    wlr_output_state_init(&wlr_output_state);
    wlr_output_state_set_enabled(&wlr_output_state, true);

    // Nested wayland outputs don't have modes. We commit an empty state if that's the case.
    if (!wl_list_empty(&wlr_output->modes))
    {
        // Outputs can have many supported modes, we pick the preferred one (biggest, fastest).
        struct wlr_output_mode *wlr_output_mode = wlr_output_preferred_mode(wlr_output);
        wlr_output_state_set_mode(&wlr_output_state, wlr_output_mode);
    }

    wlr_output_commit_state(wlr_output, &wlr_output_state);
    wlr_output_state_finish(&wlr_output_state);

    struct nye_output *nye_output = calloc(1, sizeof(struct nye_output));
    // -- snip --
}
```

And at the end of our handler function, we add this line to create the global:

```c
wlr_output_create_global(wlr_output, nye_server->wl_display);
```

Great! This is a bit of code that won't produce any visible changes, but it's the foundation for
our rendering in a minute.

Last but not least, our code currently leaks memory. We store outputs when they're created, but we
don't free that memory when an output is destroyed. Let's create a listener that takes care of
that.

```c
struct nye_output {
    // -- snip --
    struct wl_listener on_output_del;
};

static void on_output_del(struct wl_listener *wl_listener, void *) {
    // More memory dark magic.
    struct nye_output *nye_output = wl_container_of(wl_listener, nye_output, on_output_del);

    // Remove the output from the linked list and unlink our handler.
    wl_list_remove(&nye_output->link);
    wl_list_remove(&nye_output->on_output_del.link);

    free(nye_output);
}

static void on_output_add(struct wl_listener *wl_listener, void *data) {
    // -- snip --
    nye_output->wlr_output = wlr_output;

    nye_output->on_output_del.notify = on_output_del;
    wl_signal_add(&wlr_output->events.destroy, &nye_output->on_output_del);

    wl_list_insert(&nye_server->nye_outputs, &nye_output->link);
    // -- snip --
}
```

## Rendering Something (Now Yes)

Unfortunately, to render apps we still have some chunk (we need to implement XDG and I haven't yet
learned to do that). BUT, don't leave me yet, we'll make our window render some colors to see if
we've done everything correctly up to now.

In an unhappy world, we'd need to do OpenGL/Vulkan rendering by hand. Since this is a world that's
bright and full of love, though, wlroots gives us a nice API that handles all of the ugly part
without us having to touch it.

Wlroots's Scene API allows us to create a tree of nodes, which can be surfaces or rects, to draw
on a screen without handling all the raw graphics ourselves. We create a `wlr_scene` for our whole
compositor, then one or more `wlr_scene_tree` to place our drawables in. For example, we could have
a tree per monitor, or a tree per workspace, or even both combined.

We'll keep it simple and go for a single tree (the one that comes by default with `wlr_scene`) for
everything to begin with. Let's create a new scene and store it in our server state.

```c
// -- snip --
#include <wlr/types/wlr_scene.h>

struct nye_server {
    // -- snip --
    struct wlr_scene *wlr_scene;
    // -- snip --
};

int main(void) {
    // -- snip --
    assert(nye_server.wlr_backend);

    nye_server.wlr_scene = wlr_scene_create();
    assert(nye_server.wlr_scene);
    // -- snip --
}
```

Outputs need to be made available for our scene, so lets create the wrapping `wlr_scene_output` and
store it in our `nye_output`. We'll also destroy it when the output is deleted.

```c
struct nye_output {
    // -- snip --
    struct wlr_scene_output *wlr_scene_output;
    // -- snip --
};

static void on_output_del(struct wl_listener *wl_listener, void *) {
    // -- snip --
    wl_list_remove(&nye_output->on_output_del.link);

    wlr_scene_output_destroy(nye_output->wlr_scene_output);

    free(nye_output);
}

static void on_output_add(struct wl_listener *wl_listener, void *data) {
    // -- snip --
    nye_output->wlr_output = wlr_output;

    nye_output->wlr_scene_output = wlr_scene_output_create(nye_server->wlr_scene, wlr_output);
    // -- snip --
}
```

Great! Now, we still haven't made our scene render, so let's get to that.

If we were handling rendering by hand, we'd need to handle synchronization, buffer rotation, and
many ugly parts of it. However, wlroots makes our life full of happiness and rainbows by giving us
an `on_frame` event callback we can use to render without worrying about all that.

```c
struct nye_output {
    // -- snip --
    struct wl_listener on_frame;
    // -- snip --
};

static void on_frame(struct wl_listener *, void *) {}

static void on_output_del(struct wl_listener *wl_listener, void *) {
    // -- snip --
    wl_list_remove(&nye_output->link);

    wl_list_remove(&nye_output->on_frame.link);
    
    wl_list_remove(&nye_output->on_output_del.link);
    // -- snip --
}

static void on_output_add(struct wl_listener *wl_listener, void *data) {
    // -- snip --
    nye_output->on_frame.notify = on_frame;
    wl_signal_add(&wlr_output->events.frame, &nye_output->on_frame);

    nye_output->on_output_del.notify = on_output_del;
    // -- snip --
}
```

Now yes, once an output is created, `on_frame()` will start getting called every time we have to
draw.

NOW YES! Time for the part where we actually get something drawn on our screens. Our `on_frame`
just needs to call `wlr_scene_output_commit()` and send done callbacks to clients when the frame is
done being rendered.

```c
static void on_frame(struct wl_listener *wl_listener, void *) {
    // More black magic!
    struct nye_output *nye_output = wl_container_of(wl_listener, nye_output, on_frame);
    
    // Draw everything our scene output has pending to the actual output.
    wlr_scene_output_commit(nye_output->wlr_scene_output, NULL);

    // Once our frame is drawn, we let our clients know so that they can start drawing their next
    // frame.
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    wlr_scene_output_send_frame_done(nye_output->wlr_scene_output, &now);
}
```

Okay, finally, our time has come. Compile, run, and...

```
New output!
compositor: types/output/swapchain.c:15: create_swapchain: Assertion `output->allocator != NULL' failed.
Aborted                    build/compositor
```

No please don't leave yet I'm begging. Happens to be that rendering in wlroots requires a renderer
and an allocator. They're easy to create, yet we didn't so this failed. Let's create them quickly.

```c
// -- snip --
#include <wlr/render/allocator.h>
#include <wlr/render/wlr_renderer.h>

struct nye_server {
    // -- snip --
    struct wlr_renderer *wlr_renderer;
    struct wlr_allocator *wlr_allocator;
    // -- snip --
};

static void on_output_add(struct wl_listener *wl_listener, void *data) {
    // -- snip --
    wlr_output_state_set_enabled(&wlr_output_state, true);

    wlr_output_init_render(wlr_output, nye_server->wlr_allocator, nye_server->wlr_renderer);
    // -- snip --
}

int main(void) {
    // -- snip --
    assert(nye_server.wlr_scene);

    nye_server.wlr_renderer = wlr_renderer_autocreate(nye_server.wlr_backend);
    assert(nye_server.wlr_renderer);
    nye_server.wlr_allocator = wlr_allocator_autocreate(nye_server.wlr_backend, nye_server.wlr_renderer);
    assert(nye_server.wlr_allocator);

    // -- snip --
}
```

NOW YES! I PROMISE THIS TIME IT'LL WORK. Compile, run, and...

IT WORKS! A black screen gets displayed in your screen. Apps can't render anything yet, but we went
from an invisible window to something shown in our screens, great step!

I said we'd render some colors in our screen, so let's get to that.

## Rendering Colors

We'll render a red square to test whether our rendering is actually working. This will be a rect in
our scene which we'll create after creating the scene object, in our `main()`.

```c
int main(void) {
    // -- snip --
    assert(nye_server.wlr_allocator);

    float color[4] = {1.0, 0.0, 0.0, 1.0};  // RGBA
    struct wlr_scene_rect* wlr_scene_rect = wlr_scene_rect_create(
        &nye_server.wlr_scene->tree,
        100,
        100,
        color
    );
    wlr_scene_node_set_position(&wlr_scene_rect->node, 0, 0);
    // -- snip --
}
```

When you re-compile and re-run the compositor, you'll see that a 100x100 red sequare is now shown
in the compositor's window.

## Exitting the Compositor

You may have noticed that when you close the compositor's window instead of `Ctrl + C`-ing the
program, the program will keep running. This is because the compositor doesn't depend on a window
to be running. To exit the compositor, use `Ctrl + C` in your terminal.

That's it for now! The next part of this series will cover how to get apps to draw windows in our
compositor. That'll require to implement XDG, which I haven't investigated in depth yet.

If you have found any bugs in the code I showed, or have any suggestions, feel free to [open an
issue in GitHub]. Good luck!

---

Edit 8/11/2026: I forgot to destroy output globals when the outputs get deleted. Add the following
line before freeing a `nye_output`:

```c
wlr_output_destroy_global(nye_output->wlr_output);
```

[part 1 of this series]: /2026/10/30/1-welcome-to-wlroots
[open an issue in GitHub]: https://github.com/Nekidev/nekidev.github.io
