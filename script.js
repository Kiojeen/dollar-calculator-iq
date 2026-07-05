(function () {
  const CHANNEL = "dolarprices2";
  const SOURCE_URL = "https://t.me/s/" + CHANNEL;
  const PROXIES = [
    (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
    (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
    (u) => "https://r.jina.ai/" + u,
  ];

  const $ = (id) => document.getElementById(id);
  const statusDot = $("statusDot"),
    statusText = $("statusText");
  const sellValue = $("sellValue"),
    buyValue = $("buyValue");
  const sellTile = $("sellTile"),
    buyTile = $("buyTile");
  const postTime = $("postTime"),
    rawPost = $("rawPost"),
    errorBox = $("errorBox");
  const refreshBtn = $("refreshBtn");

  let rates = { sell: null, buy: null };

  function setStatus(kind, text) {
    statusDot.className = "dot " + kind;
    statusText.textContent = text;
  }

  function toNumber(str) {
    if (!str) return NaN;
    return parseFloat(str.replace(/,/g, "").trim());
  }

  function fmtIQD(n) {
    if (!isFinite(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }
  function fmtUSD(n) {
    if (!isFinite(n)) return "—";
    return (
      "$" +
      n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function messageNodeToText(node) {
    let out = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        out += child.textContent;
      } else if (child.nodeType === 1) {
        if (child.tagName === "BR") {
          out += "\n";
        } else {
          out += messageNodeToText(child);
        }
      }
    });
    return out;
  }

  function extractRatesFromText(text) {
    let sell = NaN;
    let buy = NaN;

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const match = line.match(/(\d{1,3}(?:,\d{3})+|\d+)/);

      if (!match) continue;

      const value = toNumber(match[1]);

      if (line.includes("البيع")) {
        sell = value;
      }

      if (line.includes("الشراء")) {
        buy = value;
      }
    }

    return { sell, buy };
  }

  function flashTile(tile) {
    tile.classList.add("flash");
    setTimeout(() => tile.classList.remove("flash"), 900);
  }

  function applyRates(newRates, postText, postDatetime) {
    const changed = newRates.sell !== rates.sell || newRates.buy !== rates.buy;
    rates = newRates;

    if (isFinite(rates.sell)) {
      sellValue.innerHTML =
        fmtIQD(rates.sell) + '<span class="unit">IQD / $100</span>';
      if (changed) flashTile(sellTile);
    }
    if (isFinite(rates.buy)) {
      buyValue.innerHTML =
        fmtIQD(rates.buy) + '<span class="unit">IQD / $100</span>';
      if (changed) flashTile(buyTile);
    }

    if (postText) {
      const normalized = postText.trim().replace(/\n{2,}/g, "\n");
      rawPost.textContent = normalized;
    }
    if (postDatetime) {
      try {
        const d = new Date(postDatetime);
        postTime.textContent = d.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        postTime.textContent = postDatetime;
      }
    }
    convertBoth();
  }

  async function attemptProxy(proxyFn) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(proxyFn(SOURCE_URL), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      return parseChannelHtml(html);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function loadLatest() {
    refreshBtn.disabled = true;
    setStatus("load", "fetching latest post…");
    errorBox.innerHTML = "";

    try {
      const {
        rates: parsed,
        text,
        datetime,
      } = await Promise.any(PROXIES.map(attemptProxy));
      applyRates(parsed, text, datetime);
      setStatus("live", "live — updated just now");
      refreshBtn.disabled = false;
    } catch (aggregateErr) {
      const firstErr =
        (aggregateErr && aggregateErr.errors && aggregateErr.errors[0]) ||
        aggregateErr;
      setStatus("stale", "could not reach channel");
      errorBox.innerHTML =
        '<div class="error-box">' +
        "Couldn't fetch a fresh rate right now (" +
        (firstErr ? firstErr.message : "unknown error") +
        ")." +
        " You can enter a rate manually below, or hit refresh to try again, or check the channel directly at " +
        '<a href="https://t.me/dolarprices2" target="_blank" rel="noopener" style="color:var(--brass-2)">t.me/dolarprices2</a>.' +
        "</div>";
      refreshBtn.disabled = false;
    }
  }

  function parseChannelHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const messages = doc.querySelectorAll(".tgme_widget_message_text");
    if (!messages.length) throw new Error("no messages found in page");

    for (let i = messages.length - 1; i >= 0; i--) {
      const el = messages[i];
      const text = messageNodeToText(el);
      const parsed = extractRatesFromText(text);
      if (isFinite(parsed.sell) || isFinite(parsed.buy)) {
        const wrapper = el.closest(".tgme_widget_message");
        const timeEl = wrapper
          ? wrapper.querySelector(".tgme_widget_message_date time")
          : null;
        const dt = timeEl ? timeEl.getAttribute("datetime") : null;
        return { rates: parsed, text, datetime: dt };
      }
    }
    throw new Error("no rate numbers found in recent posts");
  }

  const iqdInput = $("iqdInput"),
    usdInput = $("usdInput");
  const iqdOut = $("iqdOut"),
    usdOut = $("usdOut");
  const rateForIqd = $("rateForIqd"),
    rateForUsd = $("rateForUsd");

  function activeRate(sel) {
    const which = sel.value;
    const r = rates[which];
    return isFinite(r) ? r : null;
  }

  function convertIqdToUsd() {
    const amount = toNumber(iqdInput.value);
    const r = activeRate(rateForIqd);
    if (!r || !isFinite(amount)) {
      iqdOut.textContent = "$0.00";
      return;
    }
    iqdOut.textContent = fmtUSD((amount * 100) / r);
  }
  function convertUsdToIqd() {
    const amount = toNumber(usdInput.value);
    const r = activeRate(rateForUsd);
    if (!r || !isFinite(amount)) {
      usdOut.textContent = "٠";
      return;
    }
    usdOut.textContent = fmtIQD((amount * r) / 100) + " IQD";
  }
  function convertBoth() {
    convertIqdToUsd();
    convertUsdToIqd();
  }

  iqdInput.addEventListener("input", convertIqdToUsd);
  usdInput.addEventListener("input", convertUsdToIqd);
  rateForIqd.addEventListener("change", convertIqdToUsd);
  rateForUsd.addEventListener("change", convertUsdToIqd);
  refreshBtn.addEventListener("click", loadLatest);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  loadLatest();
})();
