// ---------- Elements ----------
const items = [...document.querySelectorAll(".gallery-item")];
const filters = [...document.querySelectorAll(".filter")];
const searchInput = document.getElementById("search");
const resultCount = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");
const themeToggle = document.getElementById("theme-toggle");
const toTop = document.getElementById("to-top");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lbCaption = document.getElementById("lb-caption");
const lbCounter = document.getElementById("lb-counter");
const lbFav = document.getElementById("lb-fav");
const lbPlay = document.getElementById("lb-play");
const lbDownload = document.getElementById("lb-download");
const lbFullscreen = document.getElementById("lb-fullscreen");
const lbClose = document.getElementById("lb-close");
const lbPrev = document.getElementById("lb-prev");
const lbNext = document.getElementById("lb-next");

// ---------- State ----------
let activeCategory = "all";
let query = "";
let visible = [];
let current = 0;
let slideshowTimer = null;
let lastFocused = null;

// ---------- Safe localStorage helpers ----------
function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function save(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* storage unavailable, ignore */
    }
}

const favorites = new Set(load("gallery-favorites", []));

// Give each item an id (its image path) and a staggered entrance delay
items.forEach((item, i) => {
    item.dataset.id = item.querySelector("img").getAttribute("src");
    item.style.setProperty("--i", i);

    // Show a placeholder if an image fails to load
    item.querySelector("img").addEventListener("error", () => {
        item.classList.add("broken");
    });
});

// ---------- Favorites ----------
function isFav(item) {
    return favorites.has(item.dataset.id);
}

function paintFavorite(item) {
    const btn = item.querySelector(".fav");
    const on = isFav(item);
    btn.setAttribute("aria-pressed", on);
    btn.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
}

function toggleFavorite(item) {
    const id = item.dataset.id;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    save("gallery-favorites", [...favorites]);
    paintFavorite(item);
    updateCounts();
    if (lightbox.hidden) applyFilters();
    syncLightboxFavorite();
}

items.forEach(paintFavorite);

items.forEach(item => {
    item.querySelector(".fav").addEventListener("click", event => {
        event.stopPropagation(); // don't open the lightbox
        toggleFavorite(item);
    });
});

// ---------- Filtering and search ----------
function updateCounts() {
    filters.forEach(btn => {
        const cat = btn.dataset.category;
        let n;
        if (cat === "all") n = items.length;
        else if (cat === "favorites") n = items.filter(isFav).length;
        else n = items.filter(i => i.dataset.category === cat).length;
        btn.querySelector(".count").textContent = n;
    });
}

function applyFilters() {
    items.forEach(item => {
        const cat = item.dataset.category;
        const title = (item.dataset.title || "").toLowerCase();

        const categoryOk =
            activeCategory === "all" ||
            (activeCategory === "favorites" ? isFav(item) : cat === activeCategory);

        const searchOk = !query || title.includes(query) || cat.includes(query);

        item.hidden = !(categoryOk && searchOk);
    });

    visible = items.filter(item => !item.hidden);
    emptyState.hidden = visible.length > 0;
    resultCount.textContent =
        visible.length === items.length
            ? `${items.length} photos`
            : `Showing ${visible.length} of ${items.length} photos`;
}

filters.forEach(filter => {
    filter.addEventListener("click", () => {
        filters.forEach(btn => btn.classList.remove("active"));
        filter.classList.add("active");
        activeCategory = filter.dataset.category;
        applyFilters();
    });
});

searchInput.addEventListener("input", () => {
    query = searchInput.value.trim().toLowerCase();
    applyFilters();
});

// ---------- Theme ----------
function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
    themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
    save("gallery-theme", theme);
}

themeToggle.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

setTheme(document.documentElement.dataset.theme || "light");

// ---------- Lightbox ----------
function showImage() {
    const item = visible[current];
    if (!item) return;

    const img = item.querySelector("img");
    lightboxImg.classList.add("loading");
    lightboxImg.onload = () => lightboxImg.classList.remove("loading");
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;

    lbCaption.textContent = item.dataset.title || img.alt;
    lbCounter.textContent = `${current + 1} / ${visible.length}`;
    lbDownload.href = img.src;
    lbDownload.setAttribute("download", item.dataset.id.split("/").pop());
    syncLightboxFavorite();

    // Preload neighbours so next/prev feels instant
    [1, -1].forEach(step => {
        const neighbour = visible[(current + step + visible.length) % visible.length];
        if (neighbour) new Image().src = neighbour.querySelector("img").src;
    });
}

function syncLightboxFavorite() {
    const item = visible[current];
    if (!item) return;
    const on = isFav(item);
    lbFav.setAttribute("aria-pressed", on);
    lbFav.setAttribute("aria-label", on ? "Remove from favorites" : "Add to favorites");
    lbFav.innerHTML = on ? "&#9829; Saved" : "&#9829; Favorite";
}

function openLightbox(item) {
    if (item.classList.contains("broken")) return;
    lastFocused = document.activeElement;
    visible = items.filter(i => !i.hidden);
    current = visible.indexOf(item);

    showImage();
    lightbox.hidden = false;
    document.body.classList.add("no-scroll");
    lbClose.focus();
}

function closeLightbox() {
    stopSlideshow();
    if (document.fullscreenElement) document.exitFullscreen();
    lightbox.hidden = true;
    document.body.classList.remove("no-scroll");
    applyFilters(); // refresh in case favorites changed
    if (lastFocused) lastFocused.focus();
}

function nextImage() {
    current = (current + 1) % visible.length;
    showImage();
}

function prevImage() {
    current = (current - 1 + visible.length) % visible.length;
    showImage();
}

items.forEach(item => {
    item.addEventListener("click", () => openLightbox(item));
    item.addEventListener("keydown", event => {
        if (event.target !== item) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox(item);
        }
    });
});

lbNext.addEventListener("click", () => {
    nextImage();
    if (slideshowTimer) startSlideshow(); // restart the timer
});

lbPrev.addEventListener("click", () => {
    prevImage();
    if (slideshowTimer) startSlideshow();
});

lbClose.addEventListener("click", closeLightbox);
lbFav.addEventListener("click", () => toggleFavorite(visible[current]));

// Click the dark background to close
lightbox.addEventListener("click", event => {
    if (event.target === lightbox) closeLightbox();
});

// ---------- Slideshow ----------
function startSlideshow() {
    clearInterval(slideshowTimer);
    slideshowTimer = setInterval(nextImage, 3000);
    lbPlay.setAttribute("aria-pressed", "true");
    lbPlay.textContent = "Pause slideshow";
}

function stopSlideshow() {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
    lbPlay.setAttribute("aria-pressed", "false");
    lbPlay.textContent = "Play slideshow";
}

lbPlay.addEventListener("click", () => {
    slideshowTimer ? stopSlideshow() : startSlideshow();
});

// ---------- Fullscreen ----------
if (!lightbox.requestFullscreen) {
    lbFullscreen.hidden = true; // e.g. iPhone Safari
}

lbFullscreen.addEventListener("click", () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        lightbox.requestFullscreen().catch(() => {});
    }
});

// ---------- Keyboard ----------
document.addEventListener("keydown", event => {
    if (lightbox.hidden) return;

    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowRight") lbNext.click();
    else if (event.key === "ArrowLeft") lbPrev.click();
    else if (event.key === "Tab") {
        // Keep keyboard focus inside the lightbox
        const focusable = [...lightbox.querySelectorAll("button, a[href]")].filter(
            el => !el.hidden && el.offsetParent !== null
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

// ---------- Swipe on touch devices ----------
let touchStartX = 0;

lightbox.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0].clientX;
}, { passive: true });

lightbox.addEventListener("touchend", event => {
    const dx = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    dx < 0 ? lbNext.click() : lbPrev.click();
}, { passive: true });

// ---------- Back to top ----------
window.addEventListener("scroll", () => {
    toTop.hidden = window.scrollY < 600;
}, { passive: true });

toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- Init ----------
updateCounts();
applyFilters();