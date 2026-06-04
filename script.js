/* =====================================================
   MVR STUDIO — script.js | Production Build
   Indian Wedding & Events Photography
   ===================================================== */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════
     STUDIO NOTIFICATION CONFIG
     Change the email below to update where booking notification emails are sent!
  ══════════════════════════════════════════════════ */
  const STUDIO_EMAIL        = 'info@mvrstudio.in';

  /* ══════════════════════════════════════════════════
     PRELOADER
  ══════════════════════════════════════════════════ */
  const preloader = document.getElementById('preloader');
  const plFill    = document.getElementById('plFill');
  let   plProg    = 0;

  // Guaranteed remove after 3 seconds no matter what
  const forceRemove = setTimeout(() => {
    if (preloader) preloader.classList.add('done');
  }, 3000);

  const plTimer = setInterval(() => {
    plProg += Math.random() * 18 + 6;
    if (plProg >= 100) { plProg = 100; clearInterval(plTimer); }
    if (plFill) plFill.style.width = plProg + '%';
  }, 140);

  function hidePreloader() {
    clearTimeout(forceRemove);
    setTimeout(() => {
      if (preloader) preloader.classList.add('done');
      // Activate scroll animations AFTER preloader hides
      document.body.classList.add('js-ready');
      // Immediately reveal elements already in viewport
      document.querySelectorAll('.rv, .rv-left, .rv-right').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) el.classList.add('in');
      });
    }, 400);
  }

  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener('load', hidePreloader);
    // Safety net: hide after 2.5s even if load hasn't fired
    setTimeout(hidePreloader, 2500);
  }

  /* ══════════════════════════════════════════════════
     NAVBAR — scroll effect + active links
  ══════════════════════════════════════════════════ */
  const navbar   = document.getElementById('navbar');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nl');

  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);

    // Highlight active nav link
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 140) current = s.id;
    });
    navLinks.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === '#' + current);
    });
  }, { passive: true });

  /* ══════════════════════════════════════════════════
     MOBILE HAMBURGER MENU
  ══════════════════════════════════════════════════ */
  const burger  = document.getElementById('navBurger');
  const navMenu = document.getElementById('navMenu');

  if (burger && navMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      navMenu.classList.toggle('open');
    });
    navMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        burger.classList.remove('open');
        navMenu.classList.remove('open');
      });
    });
  }

  /* ══════════════════════════════════════════════════
     HERO REEL — auto-rotating background slideshow
  ══════════════════════════════════════════════════ */
  const slides  = document.querySelectorAll('.reel-slide');
  const rdots   = document.querySelectorAll('.rdot');
  let   current = 0;
  let   reelInterval;

  function goSlide(idx) {
    slides[current].classList.remove('active');
    rdots[current].classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    rdots[current].classList.add('active');
  }

  function startReel() {
    reelInterval = setInterval(() => goSlide(current + 1), 4500);
  }
  if (slides.length) startReel();

  rdots.forEach(btn => {
    btn.addEventListener('click', () => {
      clearInterval(reelInterval);
      goSlide(+btn.dataset.idx);
      startReel();
    });
  });

  /* ══════════════════════════════════════════════════
     COUNTER ANIMATION & ADMIN STATS EDITOR
  ══════════════════════════════════════════════════ */
  const counters = document.querySelectorAll('.count-num[data-target]');
  let   counted  = false;

  // Load stats from localStorage or keep defaults
  const statsKeys = {
    projects: 'mvr_stats_projects',
    years: 'mvr_stats_years',
    satisfaction: 'mvr_stats_satisfaction',
    reviews: 'mvr_stats_reviews'
  };

  function loadSavedStats() {
    if (counters.length < 4) return;
    const savedProjects = localStorage.getItem(statsKeys.projects);
    const savedYears = localStorage.getItem(statsKeys.years);
    const savedSatisfaction = localStorage.getItem(statsKeys.satisfaction);
    const savedReviews = localStorage.getItem(statsKeys.reviews);

    if (savedProjects !== null) counters[0].dataset.target = savedProjects;
    if (savedYears !== null) counters[1].dataset.target = savedYears;
    if (savedSatisfaction !== null) counters[2].dataset.target = savedSatisfaction;
    if (savedReviews !== null) counters[3].dataset.target = savedReviews;
  }

  // Initial load
  loadSavedStats();

  function animateCounters() {
    counters.forEach(el => {
      const target = +el.dataset.target;
      let   val    = 0;
      const step   = target / 55;
      const tick   = setInterval(() => {
        val += step;
        if (val >= target) { val = target; clearInterval(tick); }
        el.textContent = Math.floor(val);
      }, 18);
    });
  }

  const cntObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !counted) {
      counted = true;
      animateCounters();
    }
  }, { threshold: .5 });

  if (counters.length) cntObs.observe(counters[0]);

  // Form submission handler for Admin Stats Form
  const adminStatsForm = document.getElementById('adminStatsForm');
  if (adminStatsForm) {
    adminStatsForm.addEventListener('submit', e => {
      e.preventDefault();
      const proj = document.getElementById('inputProjects')?.value;
      const yrs = document.getElementById('inputYears')?.value;
      const sat = document.getElementById('inputSatisfaction')?.value;
      const revs = document.getElementById('inputReviews')?.value;

      if (proj) localStorage.setItem(statsKeys.projects, proj);
      if (yrs) localStorage.setItem(statsKeys.years, yrs);
      if (sat) localStorage.setItem(statsKeys.satisfaction, sat);
      if (revs) localStorage.setItem(statsKeys.reviews, revs);

      // Re-load and run animation
      loadSavedStats();
      animateCounters();

      alert('Website statistics saved successfully!');
    });
  }

  /* ══════════════════════════════════════════════════
     TESTIMONIAL SLIDER — Dynamic & Review Modal
  ══════════════════════════════════════════════════ */
  const DEFAULT_REVIEWS = [
    {
      stars: 5,
      text: "MVR Studio ne hamare wedding ko itna sundar capture kiya! Drone shots toh bilkul filmy lag rahe the. Har ritual ka ek-ek photo perfect hai. Zindagi bhar yaad rahega!",
      name: "Ananya & Arjun",
      role: "Wedding Clients, Hyderabad"
    },
    {
      stars: 5,
      text: "The drone footage of our baraat was absolutely breathtaking! MVR Studio covered our entire 3-day wedding — Mehndi, Sangeet, Wedding — and every photo is magazine quality!",
      name: "Sneha & Rahul",
      role: "Wedding Clients, Bangalore"
    },
    {
      stars: 5,
      text: "Best decision to hire MVR Studio for our daughter's wedding. The aerial drone shots of the mandap and the Vidaai moment were so emotional. Highly recommend to everyone!",
      name: "Rajesh Sharma",
      role: "Father of Bride, Mumbai"
    }
  ];

  function getReviews() {
    try {
      const stored = JSON.parse(localStorage.getItem('mvr_reviews'));
      return Array.isArray(stored) ? [...DEFAULT_REVIEWS, ...stored] : DEFAULT_REVIEWS;
    } catch {
      return DEFAULT_REVIEWS;
    }
  }

  const tsTrack = document.getElementById('tsTrack');
  const tsDots = document.getElementById('tsDots');
  let testiInterval;
  let tsIdx = 0;

  function renderTestimonials() {
    if (!tsTrack || !tsDots) return;
    tsTrack.innerHTML = '';
    tsDots.innerHTML = '';

    const list = getReviews();

    list.forEach((item, idx) => {
      // Create slide
      const tc = document.createElement('div');
      tc.className = 'tc';
      tc.id = 'tc' + (idx + 1);
      
      const starText = '★'.repeat(item.stars) + '☆'.repeat(5 - item.stars);
      
      tc.innerHTML = `
        <div class="tc-stars" style="color:var(--gold);">${starText}</div>
        <p class="tc-text">"${item.text}"</p>
        <div class="tc-author">
          <div class="tc-av">${item.name.charAt(0)}</div>
          <div><strong>${item.name}</strong><span>${item.role}</span></div>
        </div>
      `;
      tsTrack.appendChild(tc);

      // Create dot
      const td = document.createElement('button');
      td.className = 'td' + (idx === 0 ? ' active' : '');
      td.dataset.i = idx;
      tsDots.appendChild(td);
    });

    bindTestiControllers(list.length);
  }

  function bindTestiControllers(count) {
    const tsDotBtns = document.querySelectorAll('.td');
    const tsPrev = document.getElementById('tsPrev');
    const tsNext = document.getElementById('tsNext');

    function goTesti(idx) {
      if (count === 0) return;
      tsIdx = (idx + count) % count;
      if (tsTrack) tsTrack.style.transform = `translateX(-${tsIdx * 100}%)`;
      tsDotBtns.forEach((d, i) => d.classList.toggle('active', i === tsIdx));
    }

    if (tsPrev) {
      const newPrev = tsPrev.cloneNode(true);
      tsPrev.parentNode.replaceChild(newPrev, tsPrev);
      newPrev.addEventListener('click', () => goTesti(tsIdx - 1));
    }
    if (tsNext) {
      const newNext = tsNext.cloneNode(true);
      tsNext.parentNode.replaceChild(newNext, tsNext);
      newNext.addEventListener('click', () => goTesti(tsIdx + 1));
    }

    tsDotBtns.forEach(d => {
      const newD = d.cloneNode(true);
      d.parentNode.replaceChild(newD, d);
      newD.addEventListener('click', () => goTesti(+newD.dataset.i));
    });

    if (testiInterval) clearInterval(testiInterval);
    if (count > 1) {
      testiInterval = setInterval(() => goTesti(tsIdx + 1), 5000);
    }
  }

  // Review Modal controllers
  const btnWriteReview = document.getElementById('btnWriteReview');
  const reviewModal = document.getElementById('reviewModal');
  const closeReviewModal = document.getElementById('closeReviewModal');
  const reviewForm = document.getElementById('reviewForm');
  const starsRating = document.getElementById('starsRating');
  const revStarsInput = document.getElementById('revStars');

  if (btnWriteReview && reviewModal) {
    btnWriteReview.addEventListener('click', () => {
      reviewModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  }

  function closeRevMdl() {
    if (reviewModal) {
      reviewModal.style.display = 'none';
      document.body.style.overflow = '';
      if (reviewForm) reviewForm.reset();
      resetStars();
    }
  }

  if (closeReviewModal) closeReviewModal.addEventListener('click', closeRevMdl);
  if (reviewModal) {
    reviewModal.addEventListener('click', e => { if (e.target === reviewModal) closeRevMdl(); });
  }

  // Star rating logic
  if (starsRating && revStarsInput) {
    const stars = starsRating.querySelectorAll('span');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = +star.dataset.val;
        revStarsInput.value = val;
        stars.forEach((s, idx) => {
          if (idx < val) {
            s.style.color = 'var(--gold)';
          } else {
            s.style.color = 'rgba(255,255,255,.2)';
          }
        });
      });
      star.addEventListener('mouseenter', () => {
        const val = +star.dataset.val;
        stars.forEach((s, idx) => {
          if (idx < val) s.style.color = 'var(--gold)';
        });
      });
      star.addEventListener('mouseleave', () => {
        const currentVal = +revStarsInput.value;
        stars.forEach((s, idx) => {
          if (idx < currentVal) {
            s.style.color = 'var(--gold)';
          } else {
            s.style.color = 'rgba(255,255,255,.2)';
          }
        });
      });
    });
  }

  function resetStars() {
    if (starsRating && revStarsInput) {
      revStarsInput.value = '5';
      starsRating.querySelectorAll('span').forEach(s => s.style.color = 'var(--gold)');
    }
  }

  resetStars();

  // Review Form Submit
  if (reviewForm) {
    reviewForm.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('revName')?.value.trim();
      const role = document.getElementById('revRole')?.value.trim();
      const text = document.getElementById('revText')?.value.trim();
      const stars = +revStarsInput.value;

      if (!name || !role || !text) return;

      const newReview = { stars, text, name, role };
      
      try {
        const stored = JSON.parse(localStorage.getItem('mvr_reviews') || '[]');
        stored.push(newReview);
        localStorage.setItem('mvr_reviews', JSON.stringify(stored));
      } catch (err) {
        console.warn(err);
      }

      renderTestimonials();
      closeRevMdl();

      // Send to WhatsApp to notify the brother!
      const whatsappMsg = `Hi MVR Studio! I wrote a review for you:\n\nRating: ${'★'.repeat(stars)}\nReview: "${text}"\n- ${name} (${role})`;
      const waUrl = `https://wa.me/919652341566?text=${encodeURIComponent(whatsappMsg)}`;
      
      alert('Thank you for your review! It has been submitted.');
      window.open(waUrl, '_blank');
    });
  }

  // Render on load
  renderTestimonials();

  /* ══════════════════════════════════════════════════
     SCROLL REVEAL — elements fade in on scroll
  ══════════════════════════════════════════════════ */
  const revEls = document.querySelectorAll('.rv, .rv-left, .rv-right');
  const revObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
  revEls.forEach(el => revObs.observe(el));

  // Also reveal on scroll in case observer misses anything
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.rv:not(.in), .rv-left:not(.in), .rv-right:not(.in)').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 20) el.classList.add('in');
    });
  }, { passive: true });



  /* ══════════════════════════════════════════════════
     GALLERY — UPLOAD HANDLER
  ══════════════════════════════════════════════════ */
  const fileInput = document.getElementById('fileInput');
  const dropZone  = document.getElementById('dropZone');
  const uploadProg = document.getElementById('uploadProg');
  const upFill    = document.getElementById('upFill');
  const upLabel   = document.getElementById('upLabel');
  const galGrid   = document.getElementById('galGrid');
  const galEmpty  = document.getElementById('galEmpty');

  // Seed galleryItems from existing HTML (only once, these are permanent items)
  let galleryItems = [];
  if (galGrid) {
    galGrid.querySelectorAll('.gal-item').forEach(el => {
      galleryItems.push({
        src:     el.dataset.src || el.querySelector('img,video')?.src || '',
        type:    el.dataset.type || 'photo',
        cap:     el.dataset.cap  || 'MVR Studio',
        isNew:   false
      });
    });
  }

  // Load custom saved items from localStorage (uploaded locally by admin)
  // Load custom saved items from localStorage (local test) + gallery_db.json (GitHub)
  async function loadCustomGallery() {


    // 2. Fetch live items from gallery_db.json
    try {
      const token = localStorage.getItem('mvr_github_token') || '';
      let dbResp;
      if (token) {
        try {
          dbResp = await fetch('https://api.github.com/repos/babu7171/MVR_studio/contents/gallery_db.json?t=' + Date.now(), {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3.raw'
            }
          });
        } catch (e) {
          console.warn('Authenticated API fetch failed, falling back to public CDN', e);
        }
      }
      if (!dbResp || !dbResp.ok) {
        dbResp = await fetch('https://raw.githubusercontent.com/babu7171/MVR_studio/main/gallery_db.json?t=' + Date.now());
      }

      if (dbResp.ok) {
        const data = await dbResp.json();
        if (data) {
          if (data.budgets) {
            window.customBudgetsDb = data.budgets;
          }
          if (Array.isArray(data.services) && typeof window.initDynamicServices === 'function') {
            window.initDynamicServices(data.services);
          }
          if (Array.isArray(data.gallery)) {
            // Store in a global variable for index.html's openGallery to access
            window.customGalleryDb = data.gallery;

            data.gallery.forEach(item => {
              // Check if already loaded to avoid duplicates
              if (!galleryItems.some(existing => existing.src === item.src)) {
                // Prepend live public items
                galleryItems.unshift({
                  src: item.src,
                  type: item.type || 'photo',
                  cap: item.cap || 'MVR Work',
                  category: item.category || 'all',
                  isNew: true
                });
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch public gallery_db.json, showing local items only');
    }

    // 3. Re-apply filter and rebuild lightbox after loading items
    applyFilter(activeFilter);
  }

  /* ══════════════════════════════════════════════════
     GALLERY FILTER
  ══════════════════════════════════════════════════ */
  const gfBtns    = document.querySelectorAll('.gf');
  let   activeFilter = 'all';

  gfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.f;
      applyFilter(activeFilter);
    });
  });

  function applyFilter(f) {
    if (!galGrid) return;
    galGrid.innerHTML = '';
    const list = f === 'all' ? galleryItems : galleryItems.filter(i => i.type === f);
    if (!list.length) { if (galEmpty) galEmpty.style.display = 'block'; return; }
    if (galEmpty) galEmpty.style.display = 'none';
    list.forEach(item => galGrid.appendChild(makeCard(item)));
    // re-attach lightbox to new cards
    buildLbList();
  }

  function resolveMediaSrc(src) {
    if (src && src.startsWith('uploads/')) {
      return 'https://raw.githubusercontent.com/babu7171/MVR_studio/main/' + src;
    }
    return src;
  }

  function makeCard(item) {
    const div = document.createElement('div');
    div.className = 'gal-item ' + item.type;
    div.dataset.type = item.type;
    div.dataset.src  = item.src;
    div.dataset.cap  = item.cap;

    const resolvedSrc = resolveMediaSrc(item.src);
    const mediaHTML = item.type === 'video'
      ? `<video src="${resolvedSrc}" muted playsinline preload="metadata"></video>`
      : `<img src="${resolvedSrc}" alt="${item.cap}" loading="lazy"/>`;

    div.innerHTML = `
      ${mediaHTML}
      <div class="gi-hover">
        <div class="gi-zoom">⊕</div>
        <div class="gi-info">
          <span class="gi-type">${item.type === 'video' ? '🎥 Video' : '📸 Photo'}</span>
          <span class="gi-cap">${item.cap}</span>
        </div>
      </div>
      ${(item.isNew && sessionStorage.getItem('mvr_admin_auth') === 'true') ? '<button class="gal-del" title="Remove">✕</button>' : ''}
    `;

    // Remove button (if logged in as admin)
    if (item.isNew && sessionStorage.getItem('mvr_admin_auth') === 'true') {
      const delBtn = div.querySelector('.gal-del');
      if (delBtn) {
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          if (confirm("Are you sure you want to delete this gallery item?")) {
            try {
              let stored = JSON.parse(localStorage.getItem('mvr_gallery') || '[]');
              stored = stored.filter(g => g.src !== item.src);
              localStorage.setItem('mvr_gallery', JSON.stringify(stored));
              
              const idx = galleryItems.findIndex(g => g.src === item.src);
              if (idx !== -1) galleryItems.splice(idx, 1);
              
              applyFilter(activeFilter);
            } catch (err) {
              console.error(err);
            }
          }
        });
      }
    }

    // Click to open lightbox
    div.addEventListener('click', () => openLightbox(item.src, item.cap, item.type));

    // Video hover play
    const vid = div.querySelector('video');
    if (vid) {
      div.addEventListener('mouseenter', () => vid.play().catch(() => {}));
      div.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    }

    return div;
  }

  /* ══════════════════════════════════════════════════
     LIGHTBOX
  ══════════════════════════════════════════════════ */
  const lbox      = document.getElementById('lbox');
  const lboxMedia = document.getElementById('lboxMedia');
  const lboxCap   = document.getElementById('lboxCap');
  const lboxClose = document.getElementById('lboxClose');
  const lboxPrev  = document.getElementById('lboxPrev');
  const lboxNext  = document.getElementById('lboxNext');
  let   lbList    = [];
  let   lbIdx     = 0;

  function buildLbList() {
    lbList = activeFilter === 'all'
      ? [...galleryItems]
      : galleryItems.filter(i => i.type === activeFilter);
  }

  function openLightbox(src, cap, type) {
    buildLbList();
    lbIdx = lbList.findIndex(i => i.src === src);
    if (lbIdx < 0) lbIdx = 0;
    renderLb();
    if (lbox) lbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function renderLb() {
    const item = lbList[lbIdx];
    if (!item || !lboxMedia) return;
    const resolvedSrc = resolveMediaSrc(item.src);
    lboxMedia.innerHTML = item.type === 'video'
      ? `<video src="${resolvedSrc}" controls autoplay style="max-width:90vw;max-height:85vh;border-radius:14px;"></video>`
      : `<img src="${resolvedSrc}" alt="${item.cap}"/>`;
    if (lboxCap) lboxCap.textContent = item.cap;
  }

  function closeLb() {
    if (lbox) { lbox.classList.remove('open'); lboxMedia.innerHTML = ''; }
    document.body.style.overflow = '';
  }

  if (lboxClose) lboxClose.addEventListener('click', closeLb);
  if (lbox)      lbox.addEventListener('click', e => { if (e.target === lbox) closeLb(); });
  if (lboxPrev)  lboxPrev.addEventListener('click', () => { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; renderLb(); });
  if (lboxNext)  lboxNext.addEventListener('click', () => { lbIdx = (lbIdx + 1) % lbList.length; renderLb(); });

  document.addEventListener('keydown', e => {
    if (!lbox || !lbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLb();
    if (e.key === 'ArrowLeft')  { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; renderLb(); }
    if (e.key === 'ArrowRight') { lbIdx = (lbIdx + 1) % lbList.length; renderLb(); }
  });

  // Init gallery
  loadCustomGallery();

  /* ══════════════════════════════════════════════════
     CONTACT FORM — with EmailJS + localStorage storage
  ══════════════════════════════════════════════════ */
  const bookingForm = document.getElementById('bookingForm');
  const formOk      = document.getElementById('formOk');
  const formErr     = document.getElementById('formErr');
  const submitBtn   = document.getElementById('submitBtn');
  const btnText     = document.getElementById('btnText');

  if (bookingForm) {
    bookingForm.addEventListener('submit', async e => {
      e.preventDefault();

      const name    = document.getElementById('fName')?.value.trim();
      const phone   = document.getElementById('fPhone')?.value.trim();
      const service = document.getElementById('fService')?.value;
      const email   = document.getElementById('fEmail')?.value.trim();
      const date    = document.getElementById('fDate')?.value;
      const guests  = document.getElementById('fGuests')?.value;
      const budget  = document.getElementById('fBudget')?.value;
      const message = document.getElementById('fMessage')?.value.trim();

      // Validate required fields
      if (!name || !phone || !email || !service || !date) {
        if (formErr) {
          formErr.textContent = '❌ Please fill in Name, Phone, Email, Service, and Preferred Date.';
          formErr.style.display = 'block';
          setTimeout(() => formErr.style.display = 'none', 5000);
        }
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        if (formErr) {
          formErr.textContent = '❌ Please enter a valid email address.';
          formErr.style.display = 'block';
          setTimeout(() => formErr.style.display = 'none', 5000);
        }
        return;
      }

      // Validate 10-digit mobile number
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        cleanPhone = cleanPhone.substring(2);
      } else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
        cleanPhone = cleanPhone.substring(1);
      }
      const isValidPhone = /^[6-9]\d{9}$/.test(cleanPhone);
      const allSame = /^(.)\1+$/.test(cleanPhone); // Detects identical repeating numbers (9999999999)

      if (!isValidPhone || allSame) {
        if (formErr) {
          formErr.textContent = '❌ Please enter a valid 10-digit mobile number.';
          formErr.style.display = 'block';
          setTimeout(() => formErr.style.display = 'none', 5000);
        }
        return;
      }

      // Set loading state
      if (submitBtn) submitBtn.disabled = true;
      if (btnText)   btnText.textContent = 'Sending Request…';

      // Build enquiry object
      const enquiry = {
        id:        Date.now(),
        timestamp: new Date().toLocaleString('en-IN'),
        name, phone, email, service, date, guests, budget, message,
        status: 'New'
      };

      // ── ALWAYS send WhatsApp notification to MVR Studio ──
      const cleanBudgetVal = (budget || 'Not specified')
        .replace(/&/g, '')
        .replace(/₹/g, 'Rs. ')
        .replace(/–/g, '-')
        .replace(/[^\x20-\x7E]/g, '');

      const waMsg =
        `🔔 *BOOKING CONFIRMED — MVR Studio*\n\n` +
        `📄 *Quotation Ref:* MVR-${enquiry.id}\n` +
        `👤 *Name:* ${name}\n` +
        `📞 *Phone:* ${phone}\n` +
        `📧 *Email:* ${email || 'Not provided'}\n` +
        `🎬 *Service:* ${service}\n` +
        `📅 *Event Date:* ${date || 'Not specified'}\n` +
        `👥 *Guests:* ${guests || 'Not specified'}\n` +
        `💰 *Budget:* ${cleanBudgetVal}\n` +
        `💬 *Message:* ${message || 'No message'}\n\n` +
        `📝 _Note: Client has generated the official Quotation PDF and will attach it below._\n\n` +
        `⏰ Confirmed: ${enquiry.timestamp}`;

      const waUrl = 'https://wa.me/919652341566?text=' + encodeURIComponent(waMsg);

      // ── Save to localStorage ──
      saveEnquiry(enquiry);
      try { localStorage.setItem('hide_booking_status', 'false'); } catch (e) {}

      // ── Automatically generate and download PDF Quotation ──
      generateQuotationPDF(enquiry);

      // ── Show success alert ──
      if (formOk) {
        formOk.textContent = '✅ Booking request confirmed! We will contact you within 2 hours.';
        formOk.style.display = 'block';
      }
      if (bookingForm) bookingForm.reset();
      setTimeout(() => { if (formOk) formOk.style.display = 'none'; }, 8000);

      // Open WhatsApp to notify owner
      window.open(waUrl, '_blank');

      // Update personalized status card
      checkBookingStatus();

      // ── Send Email via FormSubmit ──
      try {
        await fetch(`https://formsubmit.co/ajax/${STUDIO_EMAIL}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            _subject: `🔔 NEW BOOKING REQUEST: ${name} (${service})`,
            _autoresponse: `Thank you for booking with MVR Studio! We have received your booking request for ${service} on ${date}. We will contact you at ${phone} within 2 hours to confirm details.`,
            Name: name,
            Phone: phone,
            email: email || '',
            Service: service,
            "Event Date": date || 'Not specified',
            Guests: guests || 'Not specified',
            Budget: cleanBudgetVal,
            Message: message || 'No message',
            _honey: ""
          })
        });
      } catch (err) {
        console.error('FormSubmit email error:', err);
      }

      // Restore form button state
      if (submitBtn) submitBtn.disabled = false;
      if (btnText)   btnText.textContent = 'Send Booking Request';
    });
  }

  // ── Auto-adjust budget based on selected service ──
  const fService = document.getElementById('fService');
  const fBudget  = document.getElementById('fBudget');
  if (fService && fBudget) {
    fService.addEventListener('change', () => {
      const val = fService.value;
      if (!val) {
        fBudget.value = '';
        return;
      }

      // Check if custom budget is loaded from gallery_db.json
      if (window.customBudgetsDb && window.customBudgetsDb[val]) {
        const customVal = window.customBudgetsDb[val];
        if (customVal) {
          let exists = false;
          for (let i = 0; i < fBudget.options.length; i++) {
            if (fBudget.options[i].value === customVal) {
              exists = true;
              break;
            }
          }
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = customVal;
            opt.textContent = customVal;
            fBudget.appendChild(opt);
          }
          fBudget.value = customVal;
          return;
        }
      }

      // Default budget mapping
      const defaults = {
        "Wedding Photographers": "₹50,000 – ₹1,00,000",
        "Pre Wedding Photoshoot": "₹25,000 – ₹50,000",
        "Baraat & Reception": "₹25,000 – ₹50,000",
        "Mehndi & Haldi": "₹25,000 – ₹50,000",
        "Candid Wedding Photography": "₹50,000 – ₹1,00,000",
        "Wedding Videographers": "₹50,000 – ₹1,00,000",
        "Sangeet Ceremony": "₹25,000 – ₹50,000",
        "Engagement Photoshoot": "₹25,000 – ₹50,000",
        "Drone Aerial Photography": "₹10,000 – ₹25,000",
        "Event Photographers": "₹25,000 – ₹50,000",
        "Birthday Photoshoot": "₹10,000 – ₹25,000",
        "House Warming Photoshoot": "₹25,000 – ₹50,000",
        "Naming Ceremony": "₹10,000 – ₹25,000",
        "Upanayanam Photography": "₹25,000 – ₹50,000",
        "Family Photoshoot": "₹10,000 – ₹25,000",
        "Maternity Photoshoot": "₹10,000 – ₹25,000",
        "Newborn Photoshoot": "₹10,000 – ₹25,000",
        "Portfolio Shoot": "₹10,000 – ₹25,000",
        "Album Design & Print": "₹25,000 – ₹50,000",
        "Full Wedding Package": "Above ₹1,00,000"
      };
      fBudget.value = defaults[val] || '';
    });
  }

  // ── PDF Quotation Generator ──
  function generateQuotationPDF(booking) {
    if (!window.jspdf) {
      alert("PDF library is still loading. Please try again in a few seconds.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Sanitize strings to avoid ASCII/Unicode corruption in standard PDF fonts
    const cleanName = (booking.name || '').replace(/&/g, '').replace(/[^\x20-\x7E]/g, '');
    const cleanPhone = (booking.phone || '').replace(/[^\x20-\x7E]/g, '');
    const cleanEmail = (booking.email || 'Not provided').replace(/[^\x20-\x7E]/g, '');
    const cleanService = (booking.service || '').replace(/&/g, '').replace(/[^\x20-\x7E]/g, '');
    const cleanDate = (booking.date || 'Not specified').replace(/[^\x20-\x7E]/g, '');
    
    let cleanBudget = (booking.budget || 'Custom Quote')
      .replace(/&/g, '')
      .replace(/₹/g, 'Rs. ')
      .replace(/–/g, '-')
      .replace(/[^\x20-\x7E]/g, '');
    if (!cleanBudget.includes('Rs.')) {
      cleanBudget = cleanBudget.replace(/(\d[\d,]*)/g, 'Rs. $1');
    }

    // Color Palette
    const cNavy = [8, 12, 24];     // #080c18
    const cGold = [201, 165, 90];   // #c9a55a
    const cDark = [51, 51, 51];     // #333333

    // Header Navy Block
    doc.setFillColor(cNavy[0], cNavy[1], cNavy[2]);
    doc.rect(0, 0, 210, 42, 'F');

    // Header Gold Line
    doc.setFillColor(cGold[0], cGold[1], cGold[2]);
    doc.rect(0, 42, 210, 2, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text("MVR STUDIO", 15, 18);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(cGold[0], cGold[1], cGold[2]);
    doc.text("INDIAN WEDDING & EVENTS PHOTOGRAPHY", 15, 24);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text("ESTIMATED QUOTATION", 132, 20);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`Ref: MVR-${booking.id || Date.now()}`, 132, 26);
    doc.text(`Date: ${booking.timestamp ? booking.timestamp.split(',')[0].replace(/[^\x20-\x7E]/g, '') : new Date().toLocaleDateString('en-IN')}`, 132, 31);

    // Business details
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text("MVR Studio Hyderabad", 15, 54);
    doc.setFont('Helvetica', 'normal');
    doc.text("Near Main Market, Hyderabad, Telangana", 15, 60);
    doc.text("Phone: +91 96523 41566", 15, 66);
    doc.text("Email: info@mvrstudio.in", 15, 72);

    // Client details block
    doc.setFont('Helvetica', 'bold');
    doc.text("Quotation Prepared For:", 120, 54);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Name: ${cleanName}`, 120, 60);
    doc.text(`Phone: ${cleanPhone}`, 120, 66);
    doc.text(`Email: ${cleanEmail}`, 120, 72);

    // Divider Line
    doc.setDrawColor(220, 220, 220);
    doc.line(15, 80, 195, 80);

    // Table Header
    doc.setFillColor(cNavy[0], cNavy[1], cNavy[2]);
    doc.rect(15, 88, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("SERVICE DESCRIPTION", 18, 93);
    doc.text("PREFERRED DATE", 110, 93);
    doc.text("ESTIMATED BUDGET", 150, 93);

    // Table Body Row
    doc.setFillColor(248, 248, 250);
    doc.rect(15, 96, 180, 12, 'F');
    
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(cleanService, 18, 103);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(cleanDate, 110, 103);
    
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(cGold[0], cGold[1], cGold[2]);
    doc.text(cleanBudget, 150, 103);

    // Table Bottom Line
    doc.setDrawColor(cNavy[0], cNavy[1], cNavy[2]);
    doc.line(15, 108, 195, 108);

    // Note Section
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("Note:", 15, 125);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text("* This is an estimated price range. Final quotation will be provided after discussing exact timeline and details.", 15, 131);
    doc.text("* Includes professional editing, high-resolution digital delivery, and professional equipment setup.", 15, 136);

    // Standard Booking Terms
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(cNavy[0], cNavy[1], cNavy[2]);
    doc.text("Standard Booking Terms & Conditions:", 15, 150);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(cDark[0], cDark[1], cDark[2]);
    
    const terms = [
      "1. Date Reservation: A 30% non-refundable advance payment is required to secure your booking date.",
      "2. Travel & Logistics: For events outside Hyderabad, travel and accommodation charges shall be covered by client.",
      "3. Raw Files: Raw unedited files remain copyright of MVR Studio and are delivered upon request.",
      "4. Delivery Timeline: High-resolution edited photos will be delivered via online gallery within 7-15 working days.",
      "5. Balance Payment: The remaining 70% balance must be cleared on or before the day of the main event."
    ];

    let y = 157;
    terms.forEach(term => {
      doc.text(term, 15, y);
      y += 6.5;
    });

    // Thank you message
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(cGold[0], cGold[1], cGold[2]);
    doc.text("Thank you for choosing MVR Studio to capture your beautiful memories!", 15, y + 12);

    // Signature Block
    doc.setDrawColor(200, 200, 200);
    doc.line(140, y + 30, 190, y + 30);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Authorized Signature", 148, y + 34);
    doc.text("MVR Studio Team", 153, y + 38);

    // Save PDF
    doc.save(`MVR_Studio_Quotation_${booking.id || Date.now()}.pdf`);
  }

  // ── Check last booking status on this browser ──
  function checkBookingStatus() {
    const statusPanel = document.getElementById('bookingStatusPanel');
    if (!statusPanel || !bookingForm) return;

    const enquiries = getEnquiries();
    let hideStatus = false;
    try { hideStatus = localStorage.getItem('hide_booking_status') === 'true'; } catch (e) {}

    if (enquiries && enquiries.length > 0 && !hideStatus) {
      const latest = enquiries[enquiries.length - 1];

      statusPanel.innerHTML = `
        <h3>📅 Your Booking Status</h3>
        <p style="font-size: 0.88rem; color: var(--g3); margin-bottom: 20px; line-height: 1.5;">
          Hello <strong>${latest.name}</strong>, here are the details of your latest booking request:
        </p>
        <div class="bsc-grid">
          <div class="bsc-item"><span class="bsc-label">Service:</span><span class="bsc-val">${latest.service}</span></div>
          <div class="bsc-item"><span class="bsc-label">Preferred Date:</span><span class="bsc-val">${latest.date || 'Not specified'}</span></div>
          <div class="bsc-item"><span class="bsc-label">Phone:</span><span class="bsc-val">${latest.phone}</span></div>
          <div class="bsc-item"><span class="bsc-label">Budget:</span><span class="bsc-val">${latest.budget || 'Not specified'}</span></div>
          <div class="bsc-item" style="border-bottom:none; margin-top: 10px;">
            <span class="bsc-label">Current Status:</span>
            <span class="bsc-status-badge">⏳ Under Review</span>
          </div>
        </div>
        <p style="font-size: 0.8rem; color: var(--g4); margin-bottom: 20px; font-style: italic;">
          * We will contact you at <strong>${latest.phone}</strong> within 2 hours.
        </p>
        <div class="bsc-actions" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn-download-pdf" id="btnDownloadPdf">📄 Download Quotation PDF</button>
          <button type="button" class="btn-new-booking" id="btnNewBooking">Book Another Event</button>
        </div>
        <p style="font-size: 0.76rem; color: var(--g4); margin-top: 15px; border-top: 1px solid rgba(255,255,255,.05); padding-top: 12px; display: flex; align-items: center; gap: 6px;">
          💡 <span>Tip: You can attach the downloaded PDF to your WhatsApp message to share it with MVR Studio.</span>
        </p>
      `;

      bookingForm.style.display = 'none';
      statusPanel.style.display = 'block';

      const btnDownload = document.getElementById('btnDownloadPdf');
      if (btnDownload) {
        btnDownload.addEventListener('click', () => generateQuotationPDF(latest));
      }

      const btnNew = document.getElementById('btnNewBooking');
      if (btnNew) {
        btnNew.addEventListener('click', () => {
          try {
            localStorage.removeItem('mvr_enquiries');
            localStorage.removeItem('hide_booking_status');
          } catch (e) {}
          statusPanel.style.display = 'none';
          bookingForm.style.display = 'block';
          bookingForm.scrollIntoView({ behavior: 'smooth' });
        });
      }
    } else {
      statusPanel.style.display = 'none';
      bookingForm.style.display = 'block';
    }
  }

  // Run status check on load
  checkBookingStatus();

  /* ══════════════════════════════════════════════════
     DATA STORAGE (localStorage)
  ══════════════════════════════════════════════════ */
  const STORAGE_KEY = 'mvr_enquiries';

  function saveEnquiry(enquiry) {
    const existing = getEnquiries();
    existing.push(enquiry);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(existing)); } catch (e) { console.warn('Storage full'); }
  }

  function getEnquiries() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function saveToStorage() {
    // Persist only admin-uploaded items (isNew:true) as base64 to localStorage
    const toSave = galleryItems.filter(i => i.isNew && i.src.startsWith('data:'));
    try {
      localStorage.setItem('mvr_gallery', JSON.stringify(toSave));
    } catch (e) {
      // Storage quota exceeded — keep going, non-critical
      console.warn('Gallery storage full, clearing old items');
      localStorage.removeItem('mvr_gallery');
    }
  }

  // Admin panel access logic moved to separate page admin.html and admin.js

  /* ══════════════════════════════════════════════════
     SMOOTH SCROLL for anchor links
  ══════════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    // Skip if it's the admin link
    if (a.id === 'ftAdminLink') return;
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  /* ══════════════════════════════════════════════════
     FAQ ACCORDION
  ══════════════════════════════════════════════════ */
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      // Open clicked if it was closed
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ══════════════════════════════════════════════════
     PACKAGE BUTTONS → Pre-fill booking form service
  ══════════════════════════════════════════════════ */
  document.querySelectorAll('.pkg-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const pkg = btn.dataset.pkg;
      if (!pkg) return;
      const svcSelect = document.getElementById('fService');
      const msgArea = document.getElementById('fMessage');
      if (svcSelect) {
        // Try to find matching option
        const opts = Array.from(svcSelect.options);
        const match = opts.find(o => o.value.toLowerCase().includes('wedding'));
        if (match) svcSelect.value = match.value;
      }
      if (msgArea && !msgArea.value) {
        msgArea.value = `I am interested in the ${pkg}. Please contact me with details.`;
      }
    });
  });

})();
