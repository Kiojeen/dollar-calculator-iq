# Dollar Calculator — Iraq

A small installable web app that shows the current USD/IQD "sarrafa" street rate and lets you convert between dinars and dollars.

## What it does

The app displays a live sell/buy rate board (styled like a currency-exchange split-flap display) plus two converter cards — Dinar → Dollar and Dollar → Dinar. Rates update automatically on load, or on demand with the refresh button.

## Where the data comes from

The rate isn't typed in or hardcoded — it's read directly off a public Telegram channel: **[t.me/dolarprices2](https://t.me/dolarprices2)** (شركة سولاف للصيرفة), which posts the day's buy/sell rate.

Telegram exposes a read-only, no-login HTML preview of any public channel at `t.me/s/<channel>`. Since browsers block a page from fetching another site's HTML directly (CORS), the app routes that request through a public CORS relay (trying a few in parallel and using whichever answers first) and then:

1. Parses the fetched HTML for the channel's messages.
2. Walks backward from the newest message until it finds one containing the Arabic labels **البيع** (sell) and **الشراء** (buy) followed by numbers.
3. Reads the real post timestamp straight from Telegram's own markup.
4. Displays the original post text underneath the board, credited back to the channel, so you can sanity-check the numbers against the source yourself.

The rate on the board is quoted the way the channel quotes it — **per $100**, not per $1 — and the converter math accounts for that.

If the channel is unreachable or all the relays are down, the app shows an error state rather than a silent or stale-looking number, and links straight back to the Telegram channel so you can check manually.

## Important caveat

This is an informal, black-market street rate, not an official Central Bank of Iraq or bank rate. Treat it as a reference point, not as pricing for an actual transfer.

## Installing it on your phone

The app ships with a manifest and service worker, so once it's served over HTTPS you can "Add to Home Screen" and it'll behave like a native app, including a cached app shell for offline opening. (The live rate itself still needs a connection to refresh.)

---

Built by Claude Sonnet 5.