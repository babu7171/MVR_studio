(function() {
  'use strict';

  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const btnLogout = document.getElementById('btnLogout');
  const clearAllBtn = document.getElementById('btnClearAll');

  // Check auth status from sessionStorage
  let isAuthenticated = sessionStorage.getItem('mvr_admin_auth') === 'true';
  let authToken = sessionStorage.getItem('mvr_admin_auth_token') || '';

  updateUIForAuth();

  function updateUIForAuth() {
    if (isAuthenticated && authToken === 'static-token-123') {
      if (loginSection) loginSection.style.display = 'none';
      if (dashboardSection) {
        dashboardSection.style.display = 'block';
        initDashboard();
      }
    } else {
      if (loginSection) loginSection.style.display = 'flex';
      if (dashboardSection) dashboardSection.style.display = 'none';
    }
  }

  // Handle Login Submission Client-Side
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const passVal = document.getElementById('adminPass')?.value;
      if (!passVal) return;

      if (passVal === 'mvr@123') {
        isAuthenticated = true;
        authToken = 'static-token-123';
        sessionStorage.setItem('mvr_admin_auth', 'true');
        sessionStorage.setItem('mvr_admin_auth_token', 'static-token-123');
        if (loginError) loginError.style.display = 'none';
        updateUIForAuth();
      } else {
        if (loginError) {
          loginError.textContent = '❌ Incorrect password!';
          loginError.style.display = 'block';
        }
      }
    });
  }

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      isAuthenticated = false;
      authToken = '';
      sessionStorage.removeItem('mvr_admin_auth');
      sessionStorage.removeItem('mvr_admin_auth_token');
      location.reload();
    });
  }

  // Initialize Dashboard
  function initDashboard() {
    initTabs();
    renderBookings();
    initStatsEditor();
    initGalleryManager();
  }

  // Tab toggling
  function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Hide all contents
        document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
        
        // Show target
        const targetTab = tab.dataset.tab;
        const targetDiv = document.getElementById('tab-' + targetTab);
        if (targetDiv) targetDiv.style.display = 'block';
      });
    });
  }

  // Helper to load bookings from localStorage
  function getEnquiries() {
    try {
      return JSON.parse(localStorage.getItem('mvr_enquiries') || '[]');
    } catch (e) {
      return [];
    }
  }

  // ── Bookings Tab Logic ──
  function renderBookings() {
    const container = document.getElementById('adminBookingsContainer');
    if (!container) return;

    const enquiries = getEnquiries();

    if (enquiries.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.08); border-radius: var(--r2); color: var(--g3); font-size: 0.9rem;">
          📭 No booking requests received yet in this browser.
        </div>
      `;
      if (clearAllBtn) clearAllBtn.style.display = 'none';
      return;
    }

    if (clearAllBtn) clearAllBtn.style.display = 'inline-block';

    container.innerHTML = enquiries.map(item => {
      // 1. Event Date & Month Formatting
      let eventDateFormatted = 'Not specified';
      if (item.date) {
        try {
          const parts = item.date.split('-'); // ["YYYY", "MM", "DD"]
          if (parts.length === 3) {
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            eventDateFormatted = `${d} ${months[m]} ${y}`;
          } else {
            eventDateFormatted = item.date;
          }
        } catch (e) {
          eventDateFormatted = item.date;
        }
      }

      // 2. Booking Date & Month Formatting
      let bookingDateFormatted = item.timestamp || '';
      if (item.timestamp) {
        try {
          bookingDateFormatted = item.timestamp.split(',')[0];
        } catch (e) {}
      }

      return `
        <div class="admin-booking-card" id="adminCard-${item.id}">
          <div class="admin-booking-card-top">
            <div>
              <h4 class="admin-booking-client">${item.name}</h4>
              <span class="admin-booking-date">Booked: ${bookingDateFormatted}</span>
            </div>
            <div class="admin-booking-actions">
              <a href="https://wa.me/919652341566?text=Hello%20${encodeURIComponent(item.name)},%20this%20is%20MVR%20Studio%20regarding%20your%20booking%20enquiry%20for%20${encodeURIComponent(item.service)}." target="_blank" class="btn-gold" style="padding: 4px 10px; font-size: 0.76rem; border-radius: var(--r1); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; border: none; cursor: pointer; color: var(--navy); font-weight:700;">
                💬 Chat
              </a>
              <button onclick="window.deleteBooking(${item.id})" class="btn-ghost" style="padding: 4px 10px; font-size: 0.76rem; border-radius: var(--r1); border-color: rgba(255,82,82,0.3); color: #ff5252; cursor: pointer; background: transparent;">
                Delete
              </button>
            </div>
          </div>
          <div class="admin-booking-details">
            <div class="admin-booking-detail-item">
              <strong>Service</strong>
              <span>${item.service}</span>
            </div>
            <div class="admin-booking-detail-item">
              <strong>Event Date (Month)</strong>
              <span style="color: var(--white); font-weight:600;">${eventDateFormatted}</span>
            </div>
            <div class="admin-booking-detail-item">
              <strong>Phone</strong>
              <span>${item.phone}</span>
            </div>
            <div class="admin-booking-detail-item">
              <strong>Budget</strong>
              <span>${item.budget || 'Not specified'}</span>
            </div>
          </div>
          ${item.message ? `
            <div class="admin-booking-message">
              <strong>Requirements:</strong> ${item.message}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // Global delete booking handler
  window.deleteBooking = function(id) {
    if (confirm("Are you sure you want to delete this booking request?")) {
      try {
        let enquiries = getEnquiries();
        enquiries = enquiries.filter(item => item.id !== id);
        localStorage.setItem('mvr_enquiries', JSON.stringify(enquiries));
        renderBookings();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Clear all bookings
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to clear ALL booking requests? This action is permanent.")) {
        try {
          localStorage.removeItem('mvr_enquiries');
          renderBookings();
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  // ── Stats Editor Tab Logic ──
  const statsKeys = {
    projects: 'mvr_stats_projects',
    years: 'mvr_stats_years',
    satisfaction: 'mvr_stats_satisfaction',
    reviews: 'mvr_stats_reviews'
  };

  function initStatsEditor() {
    const statForm = document.getElementById('adminCountersForm');
    const inputProjects = document.getElementById('statProjects');
    const inputYears = document.getElementById('statYears');
    const inputSatisfaction = document.getElementById('statSatisfaction');
    const inputReviews = document.getElementById('statReviews');

    if (!statForm) return;

    // Load defaults or existing values from localStorage
    inputProjects.value = localStorage.getItem(statsKeys.projects) || '500';
    inputYears.value = localStorage.getItem(statsKeys.years) || '8';
    inputSatisfaction.value = localStorage.getItem(statsKeys.satisfaction) || '100';
    inputReviews.value = localStorage.getItem(statsKeys.reviews) || '50';

    statForm.addEventListener('submit', e => {
      e.preventDefault();
      try {
        localStorage.setItem(statsKeys.projects, inputProjects.value);
        localStorage.setItem(statsKeys.years, inputYears.value);
        localStorage.setItem(statsKeys.satisfaction, inputSatisfaction.value);
        localStorage.setItem(statsKeys.reviews, inputReviews.value);
        alert('Website counters saved successfully!');
      } catch (err) {
        console.error(err);
        alert('Failed to save stats.');
      }
    });
  }

  // ── Gallery Tab Logic (base64 local storage) ──
  function initGalleryManager() {
    const fileInput = document.getElementById('adminFileInput');
    const dropZone = document.getElementById('adminDropZone');
    const uploadProg = document.getElementById('adminUploadProg');
    const upFill = document.getElementById('adminUpFill');
    const upLabel = document.getElementById('adminUpLabel');
    const previewContainer = document.getElementById('adminGalPreview');

    if (!previewContainer) return;

    function getGallery() {
      try {
        return JSON.parse(localStorage.getItem('mvr_gallery') || '[]');
      } catch (e) {
        return [];
      }
    }

    function saveGallery(items) {
      try {
        localStorage.setItem('mvr_gallery', JSON.stringify(items));
      } catch (e) {
        alert('Storage quota limit reached! Base64 file storage exceeds browser limits. Try removing some old uploaded photos or uploading smaller compressed files.');
      }
    }

    function renderGalleryPreview() {
      const items = getGallery();

      if (items.length === 0) {
        previewContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.08); border-radius: var(--r2); color: var(--g3); font-size: 0.85rem;">
            No custom uploaded images/videos. Upload files using the dropzone above!
          </div>
        `;
        return;
      }

      previewContainer.innerHTML = items.map((item, idx) => {
        const mediaHTML = item.type === 'video'
          ? `<video src="${item.src}" muted playsinline preload="metadata"></video>`
          : `<img src="${item.src}" alt="${item.cap || ''}"/>`;

        return `
          <div class="admin-gal-card">
            ${mediaHTML}
            <button onclick="window.deleteGalleryItem(${idx})" class="admin-gal-del" title="Remove Item">✕</button>
            <div class="admin-gal-info">${item.cap || 'MVR Work'}</div>
          </div>
        `;
      }).join('');
    }

    // Global delete gallery handler
    window.deleteGalleryItem = function(index) {
      if (confirm("Are you sure you want to delete this gallery item from the website?")) {
        try {
          const items = getGallery();
          items.splice(index, 1);
          saveGallery(items);
          renderGalleryPreview();
        } catch (err) {
          console.error(err);
        }
      }
    };

    // Drag and drop event listeners
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(ev => {
        dropZone.addEventListener(ev, e => {
          e.preventDefault();
          dropZone.style.borderColor = 'var(--gold)';
          dropZone.style.background = 'rgba(201,165,90,0.04)';
        });
      });
      ['dragleave', 'drop'].forEach(ev => {
        dropZone.addEventListener(ev, e => {
          e.preventDefault();
          dropZone.style.borderColor = 'rgba(255,255,255,0.15)';
          dropZone.style.background = 'transparent';
        });
      });
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        handleUploadFiles(e.dataTransfer.files);
      });
      dropZone.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        handleUploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif',
                           'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

    function handleUploadFiles(files) {
      if (!files || !files.length) return;
      const valid = Array.from(files).filter(f => ALLOWED_TYPES.includes(f.type) || f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (!valid.length) {
        alert('Please upload valid image files (JPG, PNG, WEBP, GIF) or video files (MP4, MOV).');
        return;
      }

      if (uploadProg) uploadProg.style.display = 'flex';
      let done = 0;
      const items = getGallery();

      valid.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const url = ev.target.result;
          const isVid = file.type.startsWith('video/');
          const cap = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
          items.push({ src: url, type: isVid ? 'video' : 'photo', cap, isNew: true });
          done++;
          
          const pct = Math.round((done / valid.length) * 100);
          if (upFill) upFill.style.width = pct + '%';
          if (upLabel) upLabel.textContent = `Processing ${done} / ${valid.length}`;

          if (done === valid.length) {
            saveGallery(items);
            setTimeout(() => {
              if (uploadProg) uploadProg.style.display = 'none';
              if (upFill) upFill.style.width = '0%';
            }, 800);
            renderGalleryPreview();
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Render preview on start
    renderGalleryPreview();
  }

})();
