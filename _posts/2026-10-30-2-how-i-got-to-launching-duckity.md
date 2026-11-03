---
layout: post
title: How I Got to Launching Duckity
author: Nyeki
---

I'll be launching [Duckity] next week. In fact, it's already open for anyone to register but I
barely got any users to try it out.

Duckity begun because I wanted to start a company. I dropped out of university after a year of
systems engineering because I knew I wanted to live my life coding what I like and enjoy, not
working for someone else. I failed every subject at uni because I didn't even try, so I told my
parents I'd make an app.

I had no clue what app I would make, though, so to get started I started making a cute journaling
app in React Native that was zero-knowledge encrypted. All good, first version was ready, so I
bought my Google Play developer account with some $25 I had gotten for my birthday, uploaded my
app, and went on Payphone to get a bunch of testers. Got em testers, waited the 14 days, and
submitted my app to the play store for review.

The review got rejected. Why, you'd ask me? Thankfully, I had set up analytics in the app as one of
those cool things I was trying out, and it helped. Authentication was made with Logto, which opens
a browser tab to log in, and that wasn't working for Google Play reviewers, so they just left it
there.

So basically, Logto had to go. Logto was one of those things I was also trying out, because in
practice it was a bit cumbersome to integrate. Things weren't as smooth as a native ORM model. So I
started building my own auth endpoint. Then I realized I'd need a CAPTCHA or I'd get holy spammed.
It was zero-knowledge encrypted already, which meant I had barely any knowledge of who was who.

Also, I'm an obsessed-with-ux guy. If it doesn't work perfectly, I change it. And CAPTCHAs were one
of those triggers. reCAPTCHA? Put a webview. hCaptcha? They're there for Discord, and it's hell to
use there. Cloudflare? Same as reCAPTCHA. There was nothing there that could just be invisible and
smooth on UX. I also tried Altcha, but it solved challenges on my phone in, hear me out, from 1
second to 35 seconds. That's their landing page demo, so I assume they were nice on me. I didn't
want to hear about them again.

I went ahead and asked ChatGPT "hey, how do I make my own CAPTCHA" so it told me that there's
either PoW and all the browser-based ones. I liked the PoW idea, so I started playing with some
hashing algorithms and hashcash. It worked, it was really easy to make, it was native. But it
varied wildly in solving times. Add a bit? The time didn't grow up linearly, more like
exponentially. So how am I even gonna tune something like that?

I played with SHA-256, Argon (bad idea), Blake. None was good. SHA-256 showed the UX variety which
was bad. Argon means it's dead easy to overwhelm the validation server. Blake somehow never solved
because the first bits weren't perfectly random. So I asked ChatGPT if there's anything like PoW
without those drawbacks. And after a few tries, it mentioned VDFs.

VDFs, for context, are a bunch of recursive math functions that are sequential. I.e., you can't use
two CPU cores to go faster. That means an attacker with OpenAI's GPU farm won't solve VDFs in a
nanosecond while you in your Galaxy S1 take 4 business days for it to solve. It's pretty much a
loop of N iterations where each iteration depends on the previous one, so you can't just go ahead
and skip some steps or try to parallelize it. It's all gonna depend on your CPU speed. Those N
iterations are the "difficulty/hardness" of a VDF "challenge". I.e. what Duckity tweaks with your
policies.

I initially went for Sloth. It's simple and works. It did its job. The whole original
implementation was on Sloth. I made the control plane in FastAPI with Tortoise ORM (I have a
[template on GitHub] if you happen to be curious) and the data plane with Rust and Axum. I had
originally built it on [TurboStore], which is great for that stuff. Cache cleanup did not scale
well at all, but it is hella fast. Then I wanted to make it distributed while adding a caching
layer directly to the database, so I started working on the design.

After a while of designing it and working on implementing it, I realized that Redis was gonna be
the quicker development choice, so I put TurboStore on hold and migrated to Redis. Actually, I
rewrote the data plane at least 3 times, which again, not good at all. That's one of the many
lessons I've learned.

I also later migrated to Wesolowski VDF after hearing something about side channel attacks on Sloth
VDF, so to be sure and not having to migrate later on, I went ahead and made it Wesolowski VDFs
instead.

Remember how I originally needed [Duckity] for a React Native app? Well, I haven't yet made one,
because I haven't been working on that app ever since. I've told myself I'm launching that app,
though, it's just paused, so I'll write that React Native SDK sooner than later.

Well, fast forward to about a month ago, I had to make a landing page and I had no clue how to make
one that sells. I learned a few things by asking ChatGPT:

- It has to be customer-outcome oriented. The customer wants to know how it serves them, not really
  how other than to know you're not a faker.
- That's it.

But whatever, I'll learn once it's up. So I set up Umami and started sending cold emails. At first
I went to publicapis.dev and started going one by one checking out if I could get emails to send to
from their websites and keeping track of them in a Google Sheets doc. First day I sent 4 emails in
about 4 hrs, because I was learning how to write the cold emails properly. Day 2 I sent like 8.
Yet, that was being wayy too slow. It was hours and hours of work for a few emails, so I found out
[Hunter] God knows how.

Hunter's a great platform. It has a free tier, and I used up all of those 50 credits in my first
month. For context, a credit is more or less equal to one email you get to cold email, so that was
about 50 emails. I kept sending cold emails by hand, which was taking me too much time, getting me
no replies, and I couldn't use that time on something else. So I checked out their sequences tool
to make email templates and send them out, but I had 3 issues:

1. Their templating is extremely basic, you can't do more than basic substring replacement. It
   makes those emails smell like autogenerated from kilometers away, and people like to be talked
   to by humans, not robots.
2. Their AI reviewer was not reliable at all. I wrote an email, it said "great! not spammy, sounds
   human," etc. I changed one word and it went "nah, hella spammy, nobody's gonna read this."
   Someone who knows more than I do about marketing may not find this issue big, but as a thing I
   was relying on, not good.
3. Time to send those emails. I had read that company emails (i.e. @duckity.com) get better reply
   rates than free personal ones (i.e. @gmail.com). And Hunter required a paid subscription to send
   emails via SMTP.

So I had an issue. I also had issues with my emails reaching the spam folder with my custom SMTP
server, so I decided I'd have a better time having some established provider host my email. And
[Zoho Mail] was quite good! Their free tier gives me up to 5 email addresses for my duckity.com
domain, so I set that up. SMTP is only available on paid plans, but Hunter doesn't integrate with
SMTP for free anyway, so not a big loss.

So Hunter wasn't gonna work for the email sending thing, and I had my Zoho Mail set up. I went
ahead and built my own little cold email app with FastAPI and Jinja! It lets me do everything I
needed Hunter to do, like scheduling, and it imports my leads from Hunter. Plus, email templating
is with Jinja and I made it so that I can add custom fields to leads, so I can personalize cold
emails even more. The thing had:

- Sequences with many steps,
- An email scheduler,
- Email frequency limits,
- Automatic email sending via the Zoho Mail API,
- Listening for incoming emails and stopping sequences for a lead on reply,
- Jinja email templating (with a basic highlighted editor),
- Custom fields to label leads,
- Basic analytics,
- A conversation viewer in-app

The UI was very basic HTML, CSS just enough to place stuff where it should go. It didn't even have
multi-user support because it was just for me. I wrote my emails, I left it running for some days,
and once all emails were sent, I had no replies. Days passed, no replies.

I told myself that after ~50 emails sent, no replies was little evidence, but I had a problem. I
didn't know of a reliable way to scale it up. Today I think I could go through GitHub and checking
out those people who have public emails, but by now I have left aside the cold email strategy for a
while.

I got v0 to make me the landing page, and I liked the style. Made some tweaks with v0 over the
course of some days, yet at the end of it all, it was obviously AI-generated. Google refused to
index it. And the copy was so generic. So I ditched it.

That v0 landing page was after another landing page I had made, but I was getting anxious so I
wasn't being able to finish it. And it was looking too playful so I worried it wouldn't get me any
serious customers. Anyway, with that hand-made landing page I joined a lot of programming Discord
servers and posted it in every showcase channel I found. Yeah, it's not open source, yet I broke
some rules for the sake of it.

And it worked. I got 3 users to sign up, which was great news. And even more, I had ended up
restraining from posting in every server because I was worried I'd fuck up my opportunities so I
didn't use them. Bad mistake too.

I never heard back from those 3 users, but at least I got them to sign up, which is great. It means
that worked. I also DMed one guy making an anime API, and I made a few mistakes like claiming they
don't use a CAPTCHA when they do, but only in their signup form while I only checked their login
form. Mistakes and all, they replied with a decently-long message.

The message was great. They said they wouldn't try Duckity out, but they told me *why*, which is
great.

- They didn't know whether Duckity actually works,
- They didn't want to have to add me as a processor and update their privacy policy,
- They didn't know what data I collect or process,
- They didn't know how I collect and process data.

All useful information, so I added all that info as FAQs to the landing page. In the end they
didn't sign up, but I got all of that useful information.

Fast forward to 2 weeks ago, I started working on a new landing page after ditching the
AI-generated one. I wanted to be really creative, after all Duckity's branding is meant to get out
of that serious security corporation vibe and be more approachable and friendly. So I made it
slides-like, with Rubik and Rubik Glitch fonts, with a bright yellow background, and cartoonish
buttons.

God knows whether it'll sell, yet it's done and works. I finished it some days ago. It's now
indexed on Google, unlike the AI-generated one. Now that it's done and launch is coming soon (next
Tuesday), no point in getting anxious over it.

Anxiety was a big, big thing during these almost 2 years of working on launching a company. Mind
blocks, freezes, stress 24/7. Now I'm getting to the launch date, and only because I read
everywhere that you have to launch ASAP. I was trying to get something done perfectly, but that
just won't get me anywhere since there'll always be something to do. I cut off everything that was
pending from my project manager tasks list, and worked to get it launched soon.

Right now, I'm finishing a guide on how to tune policies. It's Friday, I have today and tomorrow to
work on Duckity, then I'll use Sunday to keep playing with wayland and wlroots (check my previous
blog post), then Monday to work on Duckity and polish all I need for launch on Tuesday. I'll be
launching on Hacker News, Product Hunt, Indie Hacker, and Reddit to begin with. Maybe TinyLaunch
too. I'm also gonna need to start blogging to work on SEO.

Anxiety. I've said it already, it's a big one. Throughout these almost 2 years, anxiety has been on
me most of the time. Yet, I know I'm not giving up, so I'm still figuring out how to handle it. My
main complaint about it is how it makes it harder to learn when it's all about learning. And it has
slowed down my progress many, many times. But hey, never giving up and never stopping.

I live with my parents, and they're not making it easy either at all. They've insulted me
consistently, cut my wifi so I can't work at home nor out of the schedules they want me to, have
told me all the ways they think it won't work, how they see everyone fail, not nice. But welp, this
company will take me out of here, and if it's not this one, the next one will be. Or the next one.
First thing I'll buy once company costs are covered is some big fat juicy hamburger.

Welp, whatever. Back to coding. I feel like I should be writing a conclusion but I don't have
anything to say because I drifted when anxiety hit. Good luck with whatever you're building!

[Duckity]: https://duckity.com/
[TurboStore]: https://docs.rs/turbostore
[template on GitHub]: https://github.com/nekidev/uv-fastapi-tortoise
[Hunter]: https://hunter.io/
[Zoho Mail]: https://mail.zoho.com/
