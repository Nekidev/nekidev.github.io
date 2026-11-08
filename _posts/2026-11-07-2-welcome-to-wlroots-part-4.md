---
title: Welcome to Wlroots! Part 4
layout: post
author: Nyeki
---

> This blog post is part of the [Welcome to Wlroots!](/2026/10/30/1-welcome-to-wlroots.html)
> series. It works on code we've written in past blog posts.

Input handling! In the last part of this series we got to rendering a very simple app on screen. I
wanted to write about how to render XDG popups too, yet there's no quick way to test it out without
writing a Wayland client, and I'm here to write a compositor, not a client.

In this post, we'll learn to use `wl_seat`. We'll also set up `wl_subcompositor` and
`wl_data_device_manager` since I believe they're enough to fill GTK4's required globals. Once
they're done, we can move onto rendering XDG popups using the GTK4 example apps.

## Easy Globals

Both `wl_subcompositor` and `wl_data_device_manager` are really easy to set up.

```c
// -- snip --
#include <wlr/types/wlr_subcompositor.h>
#include <wlr/types/wlr_data_device.h>

int main(void) {
    // -- snip --
    wlr_subcompositor_create(nye_server.wl_display);
    wlr_data_device_manager_create(nye_server.wl_display);

    wlr_compositor_create(nye_server.wl_display, 6, nye_server.wlr_renderer);
    // -- snip --
}
```

Actually, I just checked if `gtk4-demo` worked and it does. Great! We still can't open popups
without clicking, though, so let's get to it.

## Listening for New Input Devices

Same as with our outputs, the `wlr_backend` fires `new_input` events as it discovers them. Let's
create a wrapping struct for it to be able to reference the server on deletion.

```c
struct nye_server
{
    // -- snip --
    struct wl_list nye_inputs; // nye_input::link
    struct wl_listener on_input_add;
    // -- snip --
};

struct nye_input
{
    struct wl_list link; // nye_server::nye_inputs

    struct nye_server *nye_server;
    struct wlr_input_device *wlr_input_device;

    struct wl_listener on_input_del;
};

static void on_input_del(struct wl_listener *, void *) {}

static void on_input_add(struct wl_listener *, void *) {}

int main(void) {
    // -- snip --
    wl_list_init(&nye_server.nye_inputs);
    nye_server.on_input_add.notify = on_input_add;
    wl_signal_add(&nye_server.wlr_backend->events.new_input, &nye_server.on_input_add);
    // -- snip --
}
```

Something to keep in mind is that we can have multiple inputs of the same time attached at the same
time. For example, someone could plug in two mouses and have a trackpad, or seven keyboards and
type on any of them. For pointers, wlroots comes with the `wlr_cursor` struct which allows you to
plug in pointer-moving inputs and get a single source of events for all of them. It'll also keep
track of the cursor's position so we don't have to.

The input addition and removal is the same boilerplate as always. We `calloc()` and initialize our
`nye_input`, then unlink and free on input removal. The special handling part of input devices is
that if the input device type is pointer-moving, we also need to attach and detach it from the
`wlr_cursor` we'll create and store in our `nye_server`.

Since we don't have such `wlr_cursor` created yet, let's create it.

```c
// -- snip --
#include <wlr/types/wlr_cursor.h>

struct nye_server
{
    // -- snip --
    struct wlr_cursor *wlr_cursor;
    // -- snip --
};

int main(void) {
    // -- snip --
    struct wlr_cursor *wlr_cursor = wlr_cursor_create();
    assert(wlr_cursor);
    // -- snip --
}
```

Now back to our `on_input_add()` and `on_input_del()`, we can now add our initialization and
destruction code.

```c
static void on_input_del(struct wl_listener *wl_listener, void *data)
{
    struct nye_input *nye_input = wl_container_of(wl_listener, nye_input, on_input_del);
    struct wlr_input_device *wlr_input_device = data;

    printf("INPUT DEL: %s\n", wlr_input_device->name);

    wl_list_remove(&nye_input->link);
    wl_list_remove(&nye_input->on_input_del.link);

    free(nye_input);
}

static void on_input_add(struct wl_listener *wl_listener, void *data)
{
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_input_add);
    struct wlr_input_device *wlr_input_device = data;

    printf("INPUT ADD: %s\n", wlr_input_device->name);

    struct nye_input *nye_input = calloc(1, sizeof(struct nye_input));
    nye_input->nye_server = nye_server;
    nye_input->wlr_input_device = wlr_input_device;
    nye_input->on_input_del.notify = on_input_del;
    wl_signal_add(&wlr_input_device->events.destroy, &nye_input->on_input_del);

    wl_list_insert(&nye_server->nye_inputs, &nye_input->link);
}
```

That's practically the same code than the one we needed for `wlr_output` and `wlr_xdg_toplevel`, so
we can skip re-explaining those.

The interesting part is attaching our new input device to our `wlr_cursor` and detaching it when
our device gets removed.

```c
static void on_input_del(struct wl_listener *wl_listener, void *data)
{
    // -- snip --
    printf("INPUT DEL: %s\n", wlr_input_device->name);

    switch (wlr_input_device->type)
    {
    case WLR_INPUT_DEVICE_POINTER:
    case WLR_INPUT_DEVICE_TABLET:
    case WLR_INPUT_DEVICE_TOUCH:
        wlr_cursor_detach_input_device(nye_input->nye_server->wlr_cursor, wlr_input_device);
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
    case WLR_INPUT_DEVICE_POINTER:
    case WLR_INPUT_DEVICE_TABLET:
    case WLR_INPUT_DEVICE_TOUCH:
        wlr_cursor_attach_input_device(nye_server->wlr_cursor, wlr_input_device);
        break;

    default:
        break;
    }

    wl_list_insert(&nye_server->nye_inputs, &nye_input->link);
}
```

## Output Layouts

Great! Now that we have those handled, our `wlr_cursor` is already getting movement events, but
we're not doing anything about it. However, we can't move our cursor without an output layout. In
older versions of wlroots, I think this was possible and the cursor just didn't stick to the output
(i.e. could go out of screen). However, when I tried to move my mouse without an output layout, I
got the following error:

```
compositor: types/wlr_cursor.c:445: wlr_cursor_move: Assertion `cur->state->layout' failed.
make: *** [Makefile:27: run] Aborted
```

Basically, it asks for an output layout, so let's create one.

Before we dive into creating an output layout, what's exactly an output layout? When you have a
single monitor, life is simple. You have a single screen, a single rectangle you can draw on. When
you have more layouts, that changes.

An output layout handles multiple layouts by placing them one next to each other in a bigger
rectangle. Something like this:

```
+--------------+--------------+
|              |              |
|   Monitor 1  |  Monitor 2   |
|              |              |
+--------------+--------------+
0            1920           3840
```

That way, life is still simple. We can draw anywhere within the bigger rectangle.

There are two output layout types and unfortunately we have to do the high-level sync plumbing
ourselves.

1. `wlr_output_layout`: The physical monitor arrangement. It's used by inputs (pointers).
2. `wlr_scene_output_layout`: The rendering monitor arrangement. Wlroots keeps them separate, so we
   need a version of the layout specific to rendering.

Now that we understand what they are, we have to update our functions to do a few things:

1. `main()`: Create the output layout, attach it to the `wlr_cursor` and the `wlr_scene`, store the
   scene's output layout
2. `on_output_add()`: Attach the new output to the output layout
3. `on_output_del()`: Detach the output from the output layout

Creating the output layout and registering/unregistering outputs from it is easy.

```c
struct nye_server
{
    // -- snip --
    struct wlr_output_layout *wlr_output_layout;
    struct wlr_scene_output_layout *wlr_scene_output_layout;
    // -- snip --
};

struct nye_output
{
    // -- snip --
    struct wlr_output_layout_output *wlr_output_layout_output;
    // -- snip --
};

static void on_output_del(struct wl_listener *wl_listener, void *data)
{
    // -- snip --
    wlr_scene_output_destroy(nye_output->wlr_scene_output);
    wlr_output_layout_remove(nye_output->nye_server->wlr_output_layout, wlr_output);

    free(nye_output);
}

static void on_output_add(struct wl_listener *wl_listener, void *data)
{
    // -- snip --

    // Register it in the scene layout
    nye_output->wlr_scene_output = wlr_scene_output_create(nye_server->wlr_scene, wlr_output);
    // Register it in the output layout
    nye_output->wlr_output_layout_output = wlr_output_layout_add_auto(nye_server->wlr_output_layout, wlr_output);

    // Synchronize the scene output layout and the output layout.
    wlr_scene_output_layout_add_output(
        nye_server->wlr_scene_output_layout,
        nye_output->wlr_output_layout_output,
        nye_output->wlr_scene_output);

    nye_output->on_frame.notify = on_frame;
    // -- snip --
}

int main(void)
{
    // -- snip --
    assert(nye_server.wlr_backend);

    nye_server.wlr_output_layout = wlr_output_layout_create(nye_server.wl_display);
    assert(nye_server.wlr_output_layout);

    // -- snip --

    nye_server.wlr_cursor = wlr_cursor_create();
    assert(nye_server.wlr_cursor);
    wlr_cursor_attach_output_layout(nye_server.wlr_cursor, nye_server.wlr_output_layout);

    nye_server.wlr_scene = wlr_scene_create();
    assert(nye_server.wlr_scene);
    nye_server.wlr_scene_output_layout = wlr_scene_attach_output_layout(
        nye_server.wlr_scene,
        nye_server.wlr_output_layout);

    // -- snip --
}
```

Now, this will be really nice if you have two monitors. If you're like me, who is in a laptop with
a single monitor, this is just ugly code I have no chance but to implement properly. Fortunately,
that's all we need to handle multi-monitor outputs for now, which is overall decently simple.

Now, if you run the compositor with a single output, you'll notice nothing seems to have changed.
Let's run our compositor with two outputs to see how it goes.

```sh
WLR_WL_OUTPUTS=2 build/compositor
```

You'll now have two outputs simulated with two windows. Right now, you'll just see two pitch black
windows, but we'll get to drawing a little cursor in a minute.

## Drawing a Cursor

Now that we have all the background plumbing done, let's get to drawing a cursor! Let's keep it
simple and make it a little red dot for now.

Remember when we drew a red rectangle in part 2 when handling outputs? Time to bring it back! Let's
store a rect for our cursor in our `nye_server` and move it when the cursor moves.

```c
struct nye_server
{
    // -- snip --
    struct wl_listener on_cursor_move;
    struct wlr_scene_rect *cursor_node; // The scene node we use to render the cursor
};

static void on_cursor_move(struct wl_listener *wl_listener, void *data) {}

int main(void) {
    // -- snip --

    float color[4] = {1.0, 0.0, 0.0, 1.0};
    nye_server.cursor_node = wlr_scene_rect_create(&nye_server.wlr_scene->tree, 4, 4, color);
    nye_server.on_cursor_move.notify = on_cursor_move;
    wl_signal_add(&nye_server.wlr_cursor->events.motion, &nye_server.on_cursor_move);

    // -- snip --
}
```

Great! Now that those are done, if you recompile and run the compositor, you'll see a little red
dot appears on the top left corner, but nothing happens if you move your mouse. Let's fix that.

```c
static void on_cursor_move(struct wl_listener *wl_listener, void *data)
{
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_cursor_move);
    struct wlr_pointer_motion_event *wlr_pointer_motion_event = data;

    // Update our `wlr_cursor`'s state
    wlr_cursor_move(
        nye_server->wlr_cursor,
        &wlr_pointer_motion_event->pointer->base,
        wlr_pointer_motion_event->delta_x,
        wlr_pointer_motion_event->delta_y);

    // Put our cursor rect where the cursor is
    wlr_scene_node_set_position(
        &nye_server->cursor_node->node,
        nye_server->wlr_cursor->x,
        nye_server->wlr_cursor->y);
}
```

Re-compile, re-render, and...

It works! Now it's a good time to run the compositor with two outputs and see your cursor going
from one "monitor" to the other when it goes out of one's screen to the other's.

Something interesting to check out is how each wayland window, each of our simulated monitors, gets
its own pointer input device. You can watch them get deleted when you close one window but keep the
other one open.

What happens when you open a window in your compositor, though? Yeah, it:

1. goes under the screen, and
2. the window doesn't seem to notice the cursor is over it.

That's because even though we're moving our rectangle to act like our cursor, we're not letting any
clients know where the cursor is. In fact, they need `wl_seat` to know of that, which we haven't
created yet so clients don't even know there are any inputs. Let's get to that.

## Seats

The `wl_seat` interface is used by clients to receive input events, either pointer, touch, or
keyboard.

This seat exposes its capabilities:

- Keyboard
- Pointer
- Touch

To get started with this interface, we'll make our applications able to move the mouse over
applications and let them know when the mouse is over them. We'll ditch the little square dot that
helped us test mouse movement and instead display a real xcursor cursor from an installed theme.

To do that, we'll need to create two things:

1. The `wl_seat` global, and
2. An xcursor theme manager

```c
// -- snip --
#include <wlr/types/wlr_seat.h>
#include <wlr/types/wlr_xcursor_manager.h>

struct nye_server
{
    // -- snip --
    struct wlr_seat *wlr_seat;
    struct wlr_xcursor_manager *wlr_xcursor_manager;
    // -- snip --
};

int main(void) {
    // -- snip --
    wl_signal_add(&nye_server.wlr_cursor->events.motion, &nye_server.on_cursor_move);

    nye_server.wlr_xcursor_manager = wlr_xcursor_manager_create(NULL, 24);
    wlr_cursor_set_xcursor(nye_server.wlr_cursor, nye_server.wlr_xcursor_manager, "default");

    nye_server.wlr_seat = wlr_seat_create(nye_server.wl_display, "default");
    // -- snip --
}
```

We'll also remove the `cursor_node`-related code, these lines:

```c
static void on_cursor_move(struct wl_listener *wl_listener, void *data) {
    // -- snip --
    wlr_scene_node_set_position(
        &nye_server->cursor_node->node,
        nye_server->wlr_cursor->x,
        nye_server->wlr_cursor->y);
    // -- snip --
}

int main(void) {
    // -- snip --
    float color[4] = {1.0, 0.0, 0.0, 1.0};
    nye_server.cursor_node = wlr_scene_rect_create(&nye_server.wlr_scene->tree, 4, 4, color);
    // -- snip --
}
```

Now that we have those changes in place, you should be able to see the xcursor pointer instead.
Great!

However, you'll notice that if you hover over a window, the window stays unfazed about it. That's
because our `wl_seat` doesn't have any exposed capabilities and we haven't notified the window that
the cursor is moving on it either. Let's fix that.

To set the `wl_seat`'s capabilities, we have to call `wlr_seat_set_capabilities()` every time the
capabilities are updated. That is, whenever an input is added or removed. Since calculating the
capabilities is something we'll do in both `on_input_add()` and `on_input_del()`, let's extract it
to a function called `nye_seat_get_capabilities()`.

```c
static uint32_t nye_seat_get_capabilities(struct wl_list *wl_list)
{
    uint32_t capabilities = 0;
    struct nye_input *nye_input;
    wl_list_for_each(nye_input, wl_list, link)
    {
        switch (nye_input->wlr_input_device->type)
        {
        case WLR_INPUT_DEVICE_KEYBOARD:
            capabilities |= WL_SEAT_CAPABILITY_KEYBOARD;
            break;

        case WLR_INPUT_DEVICE_POINTER:
            capabilities |= WL_SEAT_CAPABILITY_POINTER;
            break;

        case WLR_INPUT_DEVICE_TOUCH:
            capabilities |= WL_SEAT_CAPABILITY_TOUCH;
            break;

        default:
            break;
        }
    }

    return capabilities;
}
```

A `wl_seat`'s capabilties are bitflags. Capabilities are three:

1. KEYBOARD
2. POINTER
3. TOUCH

As you may assume, the keyboard one is for keyboard events, the pointer one is for mouse events,
and the touch one is for touchscreen events. Not every input device exposes a capability, in fact
tablets have their own protocol, so we'll skip them for now. Then in our `on_input_add()` and
`on_input_del()`, we'll call our new function once we have updated our inputs list.

```c
static void on_input_del(struct wl_listener *wl_listener, void *data)
{
    // -- snip --

    // Make sure to store the pointer while you still can.
    struct nye_server *nye_server = nye_input->nye_server;

    // -- snip --

    free(nye_input);

    uint32_t capabilities = nye_seat_get_capabilities(&nye_server->nye_inputs);
    wlr_seat_set_capabilities(nye_server->wlr_seat, capabilities);
}

static void on_input_add(struct wl_listener *wl_listener, void *data)
{
    // -- snip --
    wl_list_insert(&nye_server->nye_inputs, &nye_input->link);

    uint32_t capabilities = nye_seat_get_capabilities(&nye_server->nye_inputs);
    wlr_seat_set_capabilities(nye_server->wlr_seat, capabilities);
}
```

Great! Now if you check `wayland-info`, it'll say the following:

```
interface: 'wl_seat',                                    version:  9, name:  6
        name: default
        capabilities: pointer keyboard touch
```

If your laptop/PC does not have a touchscreen, you won't see the touch capability. That's fine.

## Forwarding Pointer Movement

Now that we have our seat set up, it's time to let windows know when the cursor is over them. We'll
do that in a new function since we'll need to handle `on_cursor_warp()` too in a minute.

Before we can forward the pointer's location to any app, we need to know what window is currently
being hovered by the pointer. Wlroots has a `wlr_scene_node_at()` function that lets us know what's
the top node at a certain position (i.e. the node being hovered).

```c
static void nye_input_pointer_move(struct nye_server *nye_server, uint32_t timestamp)
{
    // NX and NY are the coordinates relative to the surface instead of to the screen. This is what
    // pointer events will need to be sent.
    double nx;
    double ny;
    struct wlr_scene_node *wlr_scene_node = wlr_scene_node_at(
        &nye_server->wlr_scene->tree.node,
        nye_server->wlr_cursor->x,
        nye_server->wlr_cursor->y,
        &nx,
        &ny);
}
```

As the comment says, pointer events require cursor coordinates relative to the surface we're
hovering, so `wlr_cursor->x/y` won't pull it off. `nx` and `ny` take care of that automatically.
Pointer events require a timestamp saying when the pointer event occurred, so we're letting the
caller pass it as an argument.

Now that we know what node, if any, is under the cursor, it's time to get the surface it
corresponds to. In the wlroots scene API, the layers are like follows:

1. wlr_scene_node
2. wlr_scene_buffer (same type as above, but made specific)
3. wlr_scene_surface
4. wlr_surface

We need the `wlr_surface`, so we'll do some peeling.

```c
static void nye_input_pointer_move(struct nye_server *nye_server, uint32_t timestamp)
{
    // -- snip --

    if (wlr_scene_node != NULL)
    {
        if (wlr_scene_node->type == WLR_SCENE_NODE_BUFFER)
        {
            struct wlr_scene_buffer *wlr_scene_buffer = wlr_scene_buffer_from_node(wlr_scene_node);
            struct wlr_scene_surface *wlr_scene_surface = wlr_scene_surface_try_from_buffer(wlr_scene_buffer);
            if (wlr_scene_surface != NULL)
            {
                // TODO
                return;
            }
        }
    }

    wlr_seat_pointer_notify_clear_focus(nye_server->wlr_seat);
}
```

Our `wlr_surface` will be at `wlr_scene_surface->surface`, so we now have everything we need to
send the pointer event to the window.

```c
if (wlr_scene_surface != NULL)
{
    // Let the window know the pointer is now on them. Windows won't respond to pointer events
    // without this call.
    //
    // This function also automatically schedules a leave event to the previously entered surface.
    wlr_seat_pointer_notify_enter(
        nye_server->wlr_seat,
        wlr_scene_surface->surface,
        nx,
        ny);
    
    // We now let them know the pointer moved. Coordinates relative to the surface.
    wlr_seat_pointer_notify_motion(
        nye_server->wlr_seat,
        timestamp,
        nx,
        ny);

    // Once our calls are done, we call this function which is the "commit" equivalent for seats.
    wlr_seat_pointer_notify_frame(nye_server->wlr_seat);
    return;
}
```

Now that our pointer-moving function is done, we can call it when our `on_cursor_move()` callback
is fired.

```c
static void on_cursor_move(struct wl_listener *wl_listener, void *data)
{
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_cursor_move);
    struct wlr_pointer_motion_event *wlr_pointer_motion_event = data;

    wlr_cursor_move(
        nye_server->wlr_cursor,
        &wlr_pointer_motion_event->pointer->base,
        wlr_pointer_motion_event->delta_x,
        wlr_pointer_motion_event->delta_y);

    nye_input_pointer_move(nye_server, wlr_pointer_motion_event->time_msec);
}
```

Great! Re-compile the compositor, run it, and you'll see now your windows react to your cursor
going over things! But you'll also likely have noticed the cursor does not show at the location
apps think the cursor is. If you can't manage to get apps to react, your cursor is just likely way
too off from the actual location. Let's fix that.

This is where our `nye_input_pointer_move()` function comes in handy. We'll create an
almost-identical-to-`on_cursor_move()` callback called `on_cursor_warp()` which will add support
for teleporting the cursor. This is useful on touch screens, for example, and it'll also fix our
cursor location errors since when running as a nested wayland client we also get absolute
coordinate events via this callback on every movement.

```c
struct nye_server
{
    // -- snip --
    struct wl_listener on_cursor_warp;
    // -- snip --
};

static void on_cursor_warp(struct wl_listener *wl_listener, void *data)
{
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_cursor_warp);
    struct wlr_pointer_motion_absolute_event *wlr_pointer_motion_absolute_event = data;

    wlr_cursor_warp_absolute(
        nye_server->wlr_cursor,
        &wlr_pointer_motion_absolute_event->pointer->base,
        wlr_pointer_motion_absolute_event->x,
        wlr_pointer_motion_absolute_event->y);

    nye_input_pointer_move(nye_server, wlr_pointer_motion_absolute_event->time_msec);
}

int main(void) {
    // -- snip --
    nye_server.on_cursor_move.notify = on_cursor_move;
    wl_signal_add(&nye_server.wlr_cursor->events.motion, &nye_server.on_cursor_move);
    nye_server.on_cursor_warp.notify = on_cursor_warp;
    wl_signal_add(&nye_server.wlr_cursor->events.motion_absolute, &nye_server.on_cursor_warp);
    // -- snip --
}
```

Try running it again. Now it works well!

We don't handle any events other than movements yet, so you won't be able to click on things.
However, things are way easier now that movement is set up.

## Forwarding Clicks

Forwarding clicks is practically the same as what we did with movement. Since getting the hovered
`wlr_surface` is becoming a common thing, let's extract it into a function.

```c
static struct wlr_surface *nye_scene_get_hovered_surface(struct nye_server *nye_server, double *nx, double *ny)
{
    struct wlr_scene_node *wlr_scene_node = wlr_scene_node_at(
        &nye_server->wlr_scene->tree.node,
        nye_server->wlr_cursor->x,
        nye_server->wlr_cursor->y,
        nx,
        ny);

    if (wlr_scene_node != NULL)
    {
        if (wlr_scene_node->type == WLR_SCENE_NODE_BUFFER)
        {
            struct wlr_scene_buffer *wlr_scene_buffer = wlr_scene_buffer_from_node(wlr_scene_node);
            struct wlr_scene_surface *wlr_scene_surface = wlr_scene_surface_try_from_buffer(wlr_scene_buffer);
            if (wlr_scene_surface != NULL)
            {
                return wlr_scene_surface->surface;
            }
        }
    }

    return NULL;
}

static void nye_input_pointer_move(struct nye_server *nye_server, uint32_t timestamp)
{
    // NX and NY are the coordinates relative to the surface instead of to the screen. This is what
    // pointer events will need to be sent.
    double nx;
    double ny;
    struct wlr_surface *wlr_surface = nye_scene_get_hovered_surface(nye_server, &nx, &ny);

    if (wlr_surface != NULL)
    {
        wlr_seat_pointer_notify_enter(
            nye_server->wlr_seat,
            wlr_surface,
            nx,
            ny);
        wlr_seat_pointer_notify_motion(
            nye_server->wlr_seat,
            timestamp,
            nx,
            ny);
        wlr_seat_pointer_notify_frame(nye_server->wlr_seat);
        return;
    }

    wlr_seat_pointer_notify_clear_focus(nye_server->wlr_seat);
}
```

Easy peasy. Now yes, let's add a callback for mouse button events, AKA press and release.

```c
static void on_cursor_button(struct wl_listener *wl_listener, void *data)
{
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_cursor_button);
    struct wlr_pointer_button_event *wlr_pointer_button_event = data;

    double nx;
    double ny;
    struct wlr_surface *wlr_surface = nye_scene_get_hovered_surface(nye_server, &nx, &ny);

    if (wlr_surface != NULL)
    {
        wlr_seat_pointer_notify_button(
            nye_server->wlr_seat,
            wlr_pointer_button_event->time_msec,
            wlr_pointer_button_event->button,
            wlr_pointer_button_event->state);
        wlr_seat_pointer_notify_frame(nye_server->wlr_seat);
    }
}
```

That's it! Now, let's hook it to our `wlr_cursor` and that's all you'll need to be able to click on
stuff.

```c
struct nye_server
{
    // -- snip --
    struct wl_listener on_cursor_move;
    struct wl_listener on_cursor_warp;
    struct wl_listener on_cursor_button;
};

int main(void) {
    // -- snip --
    nye_server.on_cursor_move.notify = on_cursor_move;
    wl_signal_add(&nye_server.wlr_cursor->events.motion, &nye_server.on_cursor_move);
    nye_server.on_cursor_warp.notify = on_cursor_warp;
    wl_signal_add(&nye_server.wlr_cursor->events.motion_absolute, &nye_server.on_cursor_warp);
    nye_server.on_cursor_button.notify = on_cursor_button;
    wl_signal_add(&nye_server.wlr_cursor->events.button, &nye_server.on_cursor_button);
    // -- snip --
}
```

Compile again and you'll be able to click on stuff. Great!

## Forwarding Scroll

Do I even need to explain how this one works? I think all I have to say ATP is to check out the
axis event.

```c
struct nye_server
{
    // -- snip --
    struct wl_listener on_cursor_axis;
};

static void on_cursor_axis(struct wl_listener *wl_listener, void *data)
{
    struct nye_server *nye_server = wl_container_of(wl_listener, nye_server, on_cursor_axis);
    struct wlr_pointer_axis_event *wlr_pointer_axis_event = data;

    double nx;
    double ny;
    struct wlr_surface *wlr_surface = nye_scene_get_hovered_surface(nye_server, &nx, &ny);

    if (wlr_surface != NULL)
    {
        wlr_seat_pointer_notify_axis(
            nye_server->wlr_seat,
            wlr_pointer_axis_event->time_msec,
            wlr_pointer_axis_event->orientation,
            wlr_pointer_axis_event->delta,
            wlr_pointer_axis_event->delta_discrete,
            wlr_pointer_axis_event->source,
            wlr_pointer_axis_event->relative_direction);
        wlr_seat_pointer_notify_frame(nye_server->wlr_seat);
    }
}

int main(void) {
    // -- snip --
    nye_server.on_cursor_axis.notify = on_cursor_axis;
    wl_signal_add(&nye_server.wlr_cursor->events.axis, &nye_server.on_cursor_axis);
    // -- snip --
}
```

That's it for now! The next part will handle keyboard input. It'll be more of the same, so you can
start playing with `wlr_keyboard` already. Good luck!
