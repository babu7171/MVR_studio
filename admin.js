(function() {
  'use strict';

  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const btnLogout = document.getElementById('btnLogout');
  const clearAllBtn = document.getElementById('btnClearAll');

  // ─── Backend API JWT Auth ──────────────────────────────────────────────────
  // JWT token obtained from /api/auth/login, stored in sessionStorage
  let jwtToken = sessionStorage.getItem('mvr_jwt_token') || '';
  let isAuthenticated = !!jwtToken;

  // Helper: make authenticated API requests
  function apiRequest(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (jwtToken) opts.headers['Authorization'] = 'Bearer ' + jwtToken;
    if (body) opts.body = JSON.stringify(body);
    return fetch(path, opts);
  }

  // Helper: fetch services from backend
  async function fetchDbContent() {
    try {
      const resp = await fetch('/api/services');
      if (resp.ok) return await resp.json();
    } catch (err) {
      console.warn('Could not fetch services from backend API', err);
    }
    return null;
  }

  function updateUIForAuth() {
    if (isAuthenticated && jwtToken) {
      if (loginSection) loginSection.style.display = 'none';
      if (dashboardSection) {
        dashboardSection.style.display = 'block';
        initDashboard();
      }
    } else {
      if (loginSection) loginSection.style.display = 'flex';
      if (dashboardSection) dashboardSection.style.display = 'none';
      
      // Stop background polling on logout
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    }
  }

  // Handle Login Submission — calls backend /api/auth/login
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const passVal = document.getElementById('adminPass')?.value;
      if (!passVal) return;

      if (loginError) { loginError.style.display = 'none'; }

      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: passVal })
        });
        const data = await resp.json();

        if (resp.ok && data.token) {
          jwtToken = data.token;
          isAuthenticated = true;
          sessionStorage.setItem('mvr_jwt_token', jwtToken);
          // Keep backward compat for any code checking old session keys
          sessionStorage.setItem('mvr_admin_auth', 'true');
          if (loginError) loginError.style.display = 'none';
          updateUIForAuth();
        } else {
          if (loginError) {
            loginError.textContent = '\u274C ' + (data.error || 'Incorrect password!');
            loginError.style.display = 'block';
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        if (loginError) {
          loginError.textContent = '\u274C Cannot connect to server. Is it running?';
          loginError.style.display = 'block';
        }
      }
    });
  }

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      jwtToken = '';
      isAuthenticated = false;
      sessionStorage.removeItem('mvr_jwt_token');
      sessionStorage.removeItem('mvr_admin_auth');
      location.reload();
    });
  }

  // Initialize Dashboard
  function initDashboard() {
    initTabs();
    renderBookings();
    initStatsEditor();
    initGalleryManager();
    initBudgetsManager();

    // Start background polling for new bookings every 10 seconds
    if (!pollIntervalId) {
      pollIntervalId = setInterval(() => {
        renderBookings(true);
      }, 10000);
    }
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

  // Helper to fetch enquiries from server database
  async function fetchServerEnquiries() {
    try {
      const resp = await apiRequest('GET', '/api/enquiries');
      if (resp.ok) {
        const data = await resp.json();
        return data.enquiries || [];
      }
    } catch (err) {
      console.warn('Failed to fetch enquiries from server:', err);
    }
    // Fallback to local storage
    try {
      return JSON.parse(localStorage.getItem('mvr_enquiries') || '[]');
    } catch {
      return [];
    }
  }

  let lastKnownEnquiryIds = [];
  let pollIntervalId = null;

  // ── Bookings Tab Logic ──
  async function renderBookings(isBackgroundPoll = false) {
    const container = document.getElementById('adminBookingsContainer');
    if (!container) return;

    const enquiries = await fetchServerEnquiries();

    // If it's a background poll and we have new bookings, show floating toasts
    if (isBackgroundPoll && lastKnownEnquiryIds.length > 0 && enquiries.length > 0) {
      const newBookings = enquiries.filter(e => !lastKnownEnquiryIds.includes(e.id));
      if (newBookings.length > 0) {
        newBookings.forEach(booking => {
          showNewBookingToast(booking);
        });
      }
    }

    // Keep track of all known booking IDs
    lastKnownEnquiryIds = enquiries.map(e => e.id);

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
      const eventDateVal = item.event_date || item.date;
      if (eventDateVal) {
        try {
          const parts = eventDateVal.split('-'); // ["YYYY", "MM", "DD"]
          if (parts.length === 3) {
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            eventDateFormatted = `${d} ${months[m]} ${y}`;
          } else {
            eventDateFormatted = eventDateVal;
          }
        } catch (e) {
          eventDateFormatted = eventDateVal;
        }
      }

      // 2. Booking Date & Month Formatting
      let bookingDateFormatted = item.created_at || item.timestamp || '';
      if (bookingDateFormatted) {
        try {
          if (bookingDateFormatted.includes('-')) {
            // ISO format from SQLite database
            const d = new Date(bookingDateFormatted.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
              bookingDateFormatted = d.toLocaleDateString('en-IN');
            }
          } else {
            // Old timestamp format from local storage
            bookingDateFormatted = bookingDateFormatted.split(',')[0];
          }
        } catch (e) {}
      }

      let statusColor = 'rgba(255,255,255,0.4)';
      let statusBg = 'rgba(255,255,255,0.05)';
      const curStatus = item.status || 'New';
      if (curStatus === 'New') { statusColor = 'var(--gold)'; statusBg = 'rgba(201,165,90,0.1)'; }
      else if (curStatus === 'Contacted') { statusColor = '#00bcd4'; statusBg = 'rgba(0,188,212,0.1)'; }
      else if (curStatus === 'Confirmed') { statusColor = '#4caf50'; statusBg = 'rgba(76,175,80,0.1)'; }
      else if (curStatus === 'Completed') { statusColor = '#8bc34a'; statusBg = 'rgba(139,195,74,0.1)'; }
      else if (curStatus === 'Cancelled') { statusColor = '#ff5252'; statusBg = 'rgba(255,82,82,0.1)'; }

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
            <div class="admin-booking-detail-item">
              <strong>Status</strong>
              <select onchange="window.updateBookingStatus(${item.id}, this.value)" style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}; border-radius: var(--r1); padding: 3px 6px; font-size: 0.78rem; outline: none; cursor: pointer; font-weight: 600; width: 100%; max-width: 130px;">
                <option value="New" style="background: var(--navy); color: var(--gold);" ${curStatus === 'New' ? 'selected' : ''}>⏳ New</option>
                <option value="Contacted" style="background: var(--navy); color: #00bcd4;" ${curStatus === 'Contacted' ? 'selected' : ''}>📞 Contacted</option>
                <option value="Confirmed" style="background: var(--navy); color: #4caf50;" ${curStatus === 'Confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                <option value="Completed" style="background: var(--navy); color: #8bc34a;" ${curStatus === 'Completed' ? 'selected' : ''}>🎉 Completed</option>
                <option value="Cancelled" style="background: var(--navy); color: #ff5252;" ${curStatus === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>
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

  // Show a premium floating toast notification for new bookings
  function showNewBookingToast(booking) {
    // 1. Create a sound notification
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.25);
      }, 150);
    } catch (e) {
      console.warn('Audio Context failed:', e);
    }

    // Inject CSS animations if they don't exist
    if (!document.getElementById('admin-toast-styles')) {
      const styles = document.createElement('style');
      styles.id = 'admin-toast-styles';
      styles.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(styles);
    }

    // 2. Create the toast element
    const toast = document.createElement('div');
    toast.className = 'admin-booking-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: linear-gradient(135deg, var(--navy3), #0a1124);
      border: 1px solid var(--gold);
      border-radius: var(--r2);
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(201,165,90,0.15);
      color: var(--white);
      z-index: 9999;
      width: 320px;
      animation: slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
      text-align: left;
    `;

    toast.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
        <span style="font-size: 1.1rem; display:flex; align-items:center; gap:6px;">🔔 <strong style="color:var(--gold);">New Booking!</strong></span>
        <button class="toast-close-btn" style="background:transparent; border:none; color:var(--g4); font-size:1.2rem; cursor:pointer; padding:0; line-height:1;">&times;</button>
      </div>
      <p style="font-size: 0.85rem; margin: 0 0 12px 0; color: var(--g3); line-height: 1.4;">
        <strong>${booking.name}</strong> just requested a <strong>${booking.service}</strong>.
      </p>
      <div style="display:flex; gap: 8px;">
        <button class="toast-view-btn" style="background:var(--gold); color:var(--navy); border:none; padding:6px 12px; font-size:0.78rem; font-weight:700; border-radius:var(--r1); cursor:pointer;">
          View Booking
        </button>
        <button class="toast-dismiss-btn" style="background:rgba(255,255,255,0.06); color:var(--white); border:1px solid rgba(255,255,255,0.1); padding:6px 12px; font-size:0.78rem; border-radius:var(--r1); cursor:pointer;">
          Dismiss
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Event listener: close button
    toast.querySelector('.toast-close-btn').addEventListener('click', () => toast.remove());
    // Event listener: dismiss button
    toast.querySelector('.toast-dismiss-btn').addEventListener('click', () => toast.remove());

    // Event listener: view button
    toast.querySelector('.toast-view-btn').addEventListener('click', () => {
      const bookingsTab = document.querySelector('[data-tab="bookings"]');
      if (bookingsTab) bookingsTab.click();
      
      const card = document.getElementById(`adminCard-${booking.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.borderColor = 'var(--gold)';
        card.style.boxShadow = '0 0 15px rgba(201,165,90,0.4)';
        setTimeout(() => {
          card.style.borderColor = '';
          card.style.boxShadow = '';
        }, 3000);
      }
      toast.remove();
    });

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'fadeOut 0.5s var(--ease) both';
        setTimeout(() => toast.remove(), 500);
      }
    }, 10000);
  }

  // Global delete booking handler
  window.deleteBooking = async function(id) {
    if (confirm("Are you sure you want to delete this booking request?")) {
      try {
        const resp = await apiRequest('DELETE', `/api/enquiries/${id}`);
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to delete booking from database');
        }
        
        // Also remove from local storage fallback
        try {
          let local = JSON.parse(localStorage.getItem('mvr_enquiries') || '[]');
          local = local.filter(item => item.id !== id);
          localStorage.setItem('mvr_enquiries', JSON.stringify(local));
        } catch (e) {}
        
        renderBookings();
      } catch (err) {
        console.error(err);
        alert('Delete failed: ' + err.message);
      }
    }
  };

  // Global update booking status handler
  window.updateBookingStatus = async function(id, newStatus) {
    try {
      const resp = await apiRequest('PATCH', `/api/enquiries/${id}/status`, { status: newStatus });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to update status in database');
      }
      
      // Also update in local storage fallback
      try {
        let local = JSON.parse(localStorage.getItem('mvr_enquiries') || '[]');
        const idx = local.findIndex(item => item.id === id);
        if (idx !== -1) {
          local[idx].status = newStatus;
          localStorage.setItem('mvr_enquiries', JSON.stringify(local));
        }
      } catch (e) {}

      // Re-render the bookings tab to reflect updated styling and status dropdown
      renderBookings();
    } catch (err) {
      console.error(err);
      alert('Status update failed: ' + err.message);
    }
  };

  // Clear all bookings
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', async () => {
      if (confirm("Are you sure you want to clear ALL booking requests? This action is permanent.")) {
        try {
          const resp = await apiRequest('DELETE', '/api/enquiries');
          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || 'Failed to clear database');
          }
          localStorage.removeItem('mvr_enquiries');
          renderBookings();
        } catch (err) {
          console.error(err);
          alert('Failed to clear bookings: ' + err.message);
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

  // ── Gallery Tab Logic — uses backend REST API ──
  function initGalleryManager() {
    const fileInput = document.getElementById('adminFileInput');
    const dropZone = document.getElementById('adminDropZone');
    const uploadProg = document.getElementById('adminUploadProg');
    const upFill = document.getElementById('adminUpFill');
    const upLabel = document.getElementById('adminUpLabel');
    const previewContainer = document.getElementById('adminGalPreview');

    let activeUploadCategory = null;
    let isFolderTriggered = false;

    // GitHub Connection controls
    const ghTokenInput = document.getElementById('ghToken');
    const btnConnectGh = document.getElementById('btnConnectGh');
    const btnDisconnectGh = document.getElementById('btnDisconnectGh');
    const ghStatusBadge = document.getElementById('ghStatusBadge');

    // Metadata inputs
    const uploadCaptionInput = document.getElementById('uploadCaption');
    const uploadCategorySelect = document.getElementById('uploadCategory');
    const syncToGithubCheck = document.getElementById('syncToGithub');
    const adminFilterCategorySelect = document.getElementById('adminFilterCategory');

    const btnDeleteSelected = document.getElementById('btnDeleteSelected');
    const selectedCountSpan = document.getElementById('selectedCount');

    function updateDeleteSelectedButton() {
      if (!btnDeleteSelected) return;
      const checkedBoxes = previewContainer.querySelectorAll('.admin-gal-select-checkbox:checked');
      const count = checkedBoxes.length;
      if (count > 0) {
        btnDeleteSelected.style.display = 'inline-block';
        if (selectedCountSpan) selectedCountSpan.textContent = count;
      } else {
        btnDeleteSelected.style.display = 'none';
      }
    }

    if (!previewContainer) return;

    // Render Folder Grid dynamically
    async function renderFolderGrid() {
      const grid = document.getElementById('adminFoldersGrid');
      if (!grid) return;

      let services = [];
      try {
        const data = await fetchDbContent();
        if (data) {
          services = data.services || [];
        }
      } catch (err) {
        console.warn('Could not load services for folders from gallery_db.json, using fallback', err);
      }

      if (!services || services.length === 0) {
        services = DEFAULT_SERVICES_FALLBACK;
      }

      grid.innerHTML = services.map(svc => {
        return `
          <div class="admin-folder-card" onclick="window.triggerFolderUpload('${svc.id}')" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--r1); padding: 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s ease; user-select: none;" onmouseover="this.style.background='rgba(201,165,90,0.08)'; this.style.borderColor='var(--gold)';" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.06)';">
            <span style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: rgba(255,255,255,0.04); border-radius: 8px;">
              ${svc.icon || '📁'}
            </span>
            <div style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;">
              <span style="font-size: 0.82rem; font-weight: 600; color: var(--white); overflow: hidden; text-overflow: ellipsis;">${svc.name}</span>
              <span style="font-size: 0.68rem; color: var(--gold); font-weight: 500;">Click to upload</span>
            </div>
          </div>
        `;
      }).join('');

      // Also update the select dropdown options to stay in sync with the database services list
      if (uploadCategorySelect) {
        uploadCategorySelect.innerHTML = services.map(svc => {
          return `<option value="${svc.id}">${svc.icon} ${svc.name}</option>`;
        }).join('');
        uploadCategorySelect.insertAdjacentHTML('afterbegin', '<option value="all">General Gallery (All)</option>');
        uploadCategorySelect.value = services[0]?.id || 'wedding';
      }

      if (adminFilterCategorySelect) {
        adminFilterCategorySelect.innerHTML = services.map(svc => {
          return `<option value="${svc.id}">${svc.icon} ${svc.name}</option>`;
        }).join('');
        adminFilterCategorySelect.insertAdjacentHTML('afterbegin', '<option value="all">Show All Categories</option>');
        adminFilterCategorySelect.value = 'all';
      }
    }

    window.triggerFolderUpload = function(categoryId) {
      activeUploadCategory = categoryId;
      isFolderTriggered = true;
      if (fileInput) {
        fileInput.click();
      }
    };

    renderFolderGrid();

    // ── Google Drive Connection Diagnostic Check ──
    const btnCheckDrive = document.getElementById('btnCheckDrive');
    const driveStatusBadge = document.getElementById('driveStatusBadge');
    const driveDebugResult = document.getElementById('driveDebugResult');

    if (btnCheckDrive) {
      btnCheckDrive.addEventListener('click', async () => {
        btnCheckDrive.disabled = true;
        btnCheckDrive.textContent = 'Checking...';
        if (driveDebugResult) {
          driveDebugResult.style.display = 'block';
          driveDebugResult.innerHTML = '<span style="color: var(--g3);">Testing connection to Google Drive API...</span>';
        }

        try {
          const resp = await fetch('/api/gallery/debug', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + jwtToken }
          });
          const data = await resp.json();

          if (data.success) {
            if (driveStatusBadge) {
              driveStatusBadge.textContent = 'Active';
              driveStatusBadge.style.background = 'rgba(76, 175, 80, 0.1)';
              driveStatusBadge.style.borderColor = '#4caf50';
              driveStatusBadge.style.color = '#4caf50';
            }
            if (driveDebugResult) {
              const accountDetails = data.clientType === 'OAuth2 User'
                ? `<strong>OAuth2 Client ID:</strong> <code>${data.clientId}</code>`
                : `<strong>Service Account Email:</strong> <code>${data.clientEmail}</code>`;

              driveDebugResult.innerHTML = `
                <div style="color: #4caf50; font-weight: bold; margin-bottom: 10px;">✅ Connection Successful!</div>
                <strong>Connection Mode:</strong> ${data.clientType}<br/>
                <strong>Folder Name:</strong> ${data.folderName}<br/>
                <strong>Folder ID:</strong> <code>${data.folderId}</code><br/>
                ${accountDetails}<br/>
                <div style="margin-top: 10px; color: var(--g3);">Your photos/videos will be uploaded directly to this Google Drive folder.</div>
              `;
            }
          } else {
            if (driveStatusBadge) {
              driveStatusBadge.textContent = 'Connection Error';
              driveStatusBadge.style.background = 'rgba(255, 82, 82, 0.1)';
              driveStatusBadge.style.borderColor = '#ff5252';
              driveStatusBadge.style.color = '#ff5252';
            }
            
            // Helpful troubleshooting advice based on Google error message
            let advice = '';
            const isOAuth2 = data.clientType === 'OAuth2 User';

            if (data.error && data.error.includes('File not found')) {
              if (isOAuth2) {
                advice = `
                  <div style="margin-top: 10px; padding: 12px; background: rgba(255,193,7,0.15); border-left: 4px solid #ffc107; color: #ffc107; border-radius: 4px; line-height: 1.4;">
                    <strong>💡 How to Fix:</strong><br/>
                    Google cannot find the folder <code>${data.folderId || '1Wi8mnDm_0uK9HkPFx1t-txly5oMVIZOC'}</code>.<br/>
                    Please ensure that the folder exists in your personal Google Drive and has not been deleted.
                  </div>
                `;
              } else {
                advice = `
                  <div style="margin-top: 10px; padding: 12px; background: rgba(255,193,7,0.15); border-left: 4px solid #ffc107; color: #ffc107; border-radius: 4px; line-height: 1.4;">
                    <strong>💡 How to Fix:</strong><br/>
                    Google cannot find the folder <code>${data.folderId || '1Wi8mnDm_0uK9HkPFx1t-txly5oMVIZOC'}</code>. Please share this folder in Google Drive with your Service Account email address as an <strong>Editor</strong>:<br/>
                    <strong style="color: var(--white); select-all: true;">${data.clientEmail || 'your-service-account-email'}</strong>
                  </div>
                `;
              }
            } else if (data.error && data.error.includes('invalid_grant')) {
              if (isOAuth2) {
                advice = `
                  <div style="margin-top: 10px; padding: 12px; background: rgba(255,82,82,0.15); border-left: 4px solid #ff5252; color: #ff5252; border-radius: 4px; line-height: 1.4;">
                    <strong>💡 How to Fix:</strong><br/>
                    Your Google Refresh Token is invalid or has expired/been revoked. Please re-authorize your account:<br/>
                    1. Open a new tab and visit: <a href="/api/auth/google" target="_blank" style="color: var(--gold); font-weight: bold; text-decoration: underline;">mvr-studio.onrender.com/api/auth/google</a><br/>
                    2. Complete the Google login and copy the newly generated <strong>Refresh Token</strong>.<br/>
                    3. Update the <code>GOOGLE_REFRESH_TOKEN</code> environment variable in your Render.com settings, and wait for Render to redeploy.
                  </div>
                `;
              } else {
                advice = `
                  <div style="margin-top: 10px; padding: 12px; background: rgba(255,82,82,0.15); border-left: 4px solid #ff5252; color: #ff5252; border-radius: 4px; line-height: 1.4;">
                    <strong>💡 How to Fix:</strong><br/>
                    The private key or service account details in your <code>GOOGLE_DRIVE_CREDENTIALS</code> environment variable on Render are invalid. Please check your credentials JSON and copy-paste it again.
                  </div>
                `;
              }
            } else if (isOAuth2) {
              advice = `
                <div style="margin-top: 10px; padding: 12px; background: rgba(255,193,7,0.15); border-left: 4px solid #ffc107; color: #ffc107; border-radius: 4px; line-height: 1.4;">
                  <strong>💡 How to Fix:</strong><br/>
                  1. Make sure your Google Cloud App is in 'Testing' status and your Gmail address is added to the <strong>Test Users</strong> list on the OAuth Consent Screen in your Google Cloud Console.<br/>
                  2. Double check that your <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> match exactly.
                </div>
              `;
            }

            if (driveDebugResult) {
              const accountDetails = data.clientType === 'OAuth2 User'
                ? `<strong>OAuth2 Client ID:</strong> <code>${data.clientId || 'Not loaded'}</code>`
                : `<strong>Service Account Email:</strong> <code>${data.clientEmail || 'Not loaded'}</code>`;

              driveDebugResult.innerHTML = `
                <div style="color: #ff5252; font-weight: bold; margin-bottom: 10px;">❌ Connection Failed!</div>
                <strong>Connection Mode:</strong> ${data.clientType || 'Unknown'}<br/>
                <strong>Folder ID:</strong> <code>${data.folderId || 'Not loaded'}</code><br/>
                ${accountDetails}<br/>
                <strong>Error Details:</strong> <span style="color: #ff5252;">${data.error || 'Unknown error'}</span>
                ${advice}
              `;
            }
          }
        } catch (err) {
          if (driveStatusBadge) {
            driveStatusBadge.textContent = 'Offline';
            driveStatusBadge.style.background = 'rgba(255, 82, 82, 0.1)';
            driveStatusBadge.style.borderColor = '#ff5252';
            driveStatusBadge.style.color = '#ff5252';
          }
          if (driveDebugResult) {
            driveDebugResult.innerHTML = `<span style="color: #ff5252;">Failed to connect to backend server: ${err.message}</span>`;
          }
        } finally {
          btnCheckDrive.disabled = false;
          btnCheckDrive.textContent = '🔍 Run Connection Check';
        }
      });
    }

    // Hide GitHub-specific UI elements since we now use the backend
    if (syncToGithubCheck) {
      const syncRow = syncToGithubCheck.closest?.('label') || syncToGithubCheck.parentElement;
      if (syncRow) syncRow.style.display = 'none';
    }

    // ── Gallery data from backend ──
    let serverGalleryItems = [];

    async function fetchServerGallery(category) {
      try {
        const url = category && category !== 'all' ? `/api/gallery?category=${category}` : '/api/gallery';
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          serverGalleryItems = data.gallery || [];
        }
      } catch (err) {
        console.error('Error fetching gallery from server:', err);
        serverGalleryItems = [];
      }
    }

    function renderGalleryPreview() {
      const selectedFilter = adminFilterCategorySelect ? adminFilterCategorySelect.value : 'all';
      let displayItems = [...serverGalleryItems];

      if (selectedFilter !== 'all') {
        displayItems = displayItems.filter(item => item.category === selectedFilter);
      }

      if (displayItems.length === 0) {
        previewContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.08); border-radius: var(--r2); color: var(--g3); font-size: 0.85rem;">
            No uploaded items found. Upload your first photo above!
          </div>
        `;
        updateDeleteSelectedButton();
        return;
      }

      previewContainer.innerHTML = displayItems.map((item) => {
        const mediaHTML = item.type === 'video'
          ? `<video src="${item.src}" muted playsinline preload="metadata"></video>`
          : `<img src="${item.src}" alt="${item.cap || ''}"/>`;

        return `
          <div class="admin-gal-card" style="position: relative;">
            ${mediaHTML}
            <input type="checkbox" class="admin-gal-select-checkbox" data-id="${item.id}" style="position: absolute; top: 10px; left: 10px; z-index: 10; width: 18px; height: 18px; cursor: pointer; accent-color: var(--gold); border: 2px solid var(--gold); border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"/>
            <button onclick="window.deleteGalleryItem(${item.id})" class="admin-gal-del" title="Remove Item">✕</button>
            <div class="admin-gal-info" style="display:flex; justify-content:space-between; align-items:center; gap:5px; bottom: 0; background: linear-gradient(transparent, rgba(0,0,0,0.85));">
              <span style="overflow:hidden; text-overflow:ellipsis; max-width: 65%;">${item.cap || 'MVR Work'}</span>
              <span style="font-size: 0.58rem; padding: 1px 4px; border-radius: 4px; border: 1px solid var(--gold); color: var(--gold); font-weight:700;">Server</span>
            </div>
          </div>
        `;
      }).join('');

      updateDeleteSelectedButton();

      // Re-attach checkbox listeners
      previewContainer.querySelectorAll('.admin-gal-select-checkbox').forEach(cb => {
        cb.addEventListener('change', updateDeleteSelectedButton);
      });
    }

    // ── Delete single item ──
    window.deleteGalleryItem = async function(itemId) {
      if (!confirm('Are you sure you want to delete this gallery item?')) return;
      try {
        if (uploadProg) uploadProg.style.display = 'flex';
        if (upFill) upFill.style.width = '50%';
        if (upLabel) upLabel.textContent = 'Deleting...';

        const resp = await fetch(`/api/gallery/${itemId}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + jwtToken }
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Delete failed');
        }

        await fetchServerGallery();
        renderGalleryPreview();

        if (upFill) upFill.style.width = '100%';
        if (upLabel) upLabel.textContent = 'Deleted successfully!';
        setTimeout(() => {
          if (uploadProg) uploadProg.style.display = 'none';
          if (upFill) upFill.style.width = '0%';
        }, 800);
      } catch (err) {
        console.error(err);
        alert('Delete failed: ' + err.message);
        if (uploadProg) uploadProg.style.display = 'none';
      }
    };

    // ── Drag and drop ──
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
        activeUploadCategory = null; // Ensure drag and drop uses the global select
        handleUploadFiles(e.dataTransfer.files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('click', () => {
        if (!isFolderTriggered) {
          activeUploadCategory = null;
        }
        isFolderTriggered = false;
      });

      fileInput.addEventListener('change', () => {
        handleUploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    // ── File Upload to backend via multipart form data ──
    async function handleUploadFiles(files) {
      if (!files || !files.length) return;

      const category = activeUploadCategory || (uploadCategorySelect ? uploadCategorySelect.value : 'wedding');
      activeUploadCategory = null; // reset immediately

      const categoryOption = uploadCategorySelect ? uploadCategorySelect.querySelector(`option[value="${category}"]`) : null;
      let categoryName = categoryOption ? categoryOption.textContent.trim() : category;

      if (categoryName === category) {
        const fallbackSvc = (typeof DEFAULT_SERVICES_FALLBACK !== 'undefined')
          ? DEFAULT_SERVICES_FALLBACK.find(s => s.id === category)
          : null;
        if (fallbackSvc) {
          categoryName = `${fallbackSvc.icon} ${fallbackSvc.name}`;
        }
      }

      if (uploadProg) uploadProg.style.display = 'flex';
      if (upLabel) upLabel.textContent = `Uploading ${files.length} file(s) to ${categoryName}...`;
      if (upFill) upFill.style.width = '30%';

      const formData = new FormData();
      const caption = uploadCaptionInput ? uploadCaptionInput.value.trim() : '';

      Array.from(files).forEach(file => formData.append('files', file));
      if (caption) formData.append('caption', caption);
      formData.append('category', category);

      try {
        if (upFill) upFill.style.width = '60%';
        const resp = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + jwtToken },
          body: formData  // Note: no Content-Type header for multipart!
        });

        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Upload failed');

        if (upFill) upFill.style.width = '100%';
        if (upLabel) upLabel.textContent = `✅ Uploaded ${result.uploaded} file(s) successfully!`;

        await fetchServerGallery();
        renderGalleryPreview();
        if (uploadCaptionInput) uploadCaptionInput.value = '';

        setTimeout(() => {
          if (uploadProg) uploadProg.style.display = 'none';
          if (upFill) upFill.style.width = '0%';
        }, 1500);
      } catch (err) {
        console.error('Upload error:', err);
        alert('Upload failed: ' + err.message);
        if (uploadProg) uploadProg.style.display = 'none';
      }
    }

    if (adminFilterCategorySelect) {
      adminFilterCategorySelect.addEventListener('change', renderGalleryPreview);
    }

    // ── Batch delete button ──
    if (btnDeleteSelected) {
      btnDeleteSelected.addEventListener('click', async () => {
        const checkedBoxes = previewContainer.querySelectorAll('.admin-gal-select-checkbox:checked');
        const count = checkedBoxes.length;
        if (count === 0) return;

        if (!confirm(`Delete ${count} selected gallery items from the server?`)) return;

        const idsToDelete = [];
        checkedBoxes.forEach(cb => {
          const id = parseInt(cb.dataset.id, 10);
          if (!isNaN(id)) idsToDelete.push(id);
        });

        try {
          if (uploadProg) uploadProg.style.display = 'flex';
          if (upFill) upFill.style.width = '50%';
          if (upLabel) upLabel.textContent = `Deleting ${count} items...`;

          const resp = await fetch('/api/gallery/batch', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + jwtToken
            },
            body: JSON.stringify({ ids: idsToDelete })
          });

          const result = await resp.json();
          if (!resp.ok) throw new Error(result.error || 'Batch delete failed');

          if (upFill) upFill.style.width = '100%';
          if (upLabel) upLabel.textContent = `✅ Deleted ${result.deleted} items!`;

          await fetchServerGallery();
          renderGalleryPreview();

          setTimeout(() => {
            if (uploadProg) uploadProg.style.display = 'none';
            if (upFill) upFill.style.width = '0%';
          }, 1000);
        } catch (err) {
          console.error(err);
          alert('Batch delete failed: ' + err.message);
          if (uploadProg) uploadProg.style.display = 'none';
        }
      });
    }
  }

  // ── Budgets & Services Editor Tab Logic ──
  const DEFAULT_SERVICES_FALLBACK = [
    { id: "wedding", icon: "💍", name: "Wedding Photographers", desc: "Full coverage — Mandap, Pheras, Vidaai & Portraits", group: "Wedding & Ceremonies", budget: "₹50,000 – ₹1,00,000", bg: "gallery-wedding.png" },
    { id: "prewedding", icon: "💑", name: "Pre Wedding Photoshoot", desc: "Romantic couple sessions at heritage & scenic locations", group: "Wedding & Ceremonies", budget: "₹25,000 – ₹50,000", bg: "svc-prewedding.png" },
    { id: "baraat", icon: "🐴", name: "Baraat & Reception", desc: "Grand procession with dhol & band baja to the elegant Reception", group: "Wedding & Ceremonies", budget: "₹25,000 – ₹50,000", bg: "gallery-baraat.png" },
    { id: "mehndi", icon: "🌸", name: "Mehndi & Haldi", desc: "Colourful traditions captured beautifully", group: "Wedding & Ceremonies", budget: "₹25,000 – ₹50,000", bg: "gallery-mehndi.png" },
    { id: "candid", icon: "📷", name: "Candid Wedding Photography", desc: "Natural, unposed moments full of genuine emotion", group: "Wedding & Ceremonies", budget: "₹50,000 – ₹1,00,000", bg: "gallery-wedding2.png" },
    { id: "videographers", icon: "🎬", name: "Wedding Videographers", desc: "Bollywood-style cinematic 4K wedding films", group: "Wedding & Ceremonies", budget: "₹50,000 – ₹1,00,000", bg: "gallery-drone2.png" },
    { id: "sangeet", icon: "💃", name: "Sangeet Ceremony", desc: "Vibrant dance & celebration photography", group: "Wedding & Ceremonies", budget: "₹25,000 – ₹50,000", bg: "gallery-event.png" },
    { id: "engagement", icon: "💎", name: "Engagement Photoshoot", desc: "Capture the joy of your commitment day", group: "Wedding & Ceremonies", budget: "₹25,000 – ₹50,000", bg: "svc-prewedding.png" },
    { id: "drone", icon: "🚁", name: "Drone Aerial Photography", desc: "DGCA-licensed stunning aerial shots from the sky", group: "Wedding & Ceremonies", budget: "₹10,000 – ₹25,000", bg: "gallery-drone.png" },
    { id: "events", icon: "🎉", name: "Event Photographers", desc: "Corporate events, grand parties & cultural programs", group: "Events & Special Occasions", budget: "₹25,000 – ₹50,000", bg: "svc-event.png" },
    { id: "birthday", icon: "🎂", name: "Birthday Photoshoot", desc: "Fun & vibrant birthday celebration photography", group: "Events & Special Occasions", budget: "₹10,000 – ₹25,000", bg: "gallery-event.png" },
    { id: "housewarming", icon: "🏠", name: "House Warming Photoshoot", desc: "Griha Pravesh pooja & family moments", group: "Events & Special Occasions", budget: "₹25,000 – ₹50,000", bg: "gallery-event.png" },
    { id: "naming", icon: "👶", name: "Naming Ceremony", desc: "Namkaran blessings & first name-giving ritual", group: "Events & Special Occasions", budget: "₹10,000 – ₹25,000", bg: "gallery-event.png" },
    { id: "upanayanam", icon: "🙏", name: "Upanayanam Photography", desc: "Sacred thread ceremony — every ritual covered", group: "Events & Special Occasions", budget: "₹25,000 – ₹50,000", bg: "gallery-event.png" },
    { id: "family", icon: "👨‍👩‍👧‍👦", name: "Family Photoshoot", desc: "Warm portraits capturing the bond of your family", group: "Events & Special Occasions", budget: "₹10,000 – ₹25,000", bg: "gallery-event.png" },
    { id: "maternity", icon: "🤰", name: "Maternity Photoshoot", desc: "Celebrating the glow of motherhood", group: "Portrait & Specialty Photography", budget: "₹10,000 – ₹25,000", bg: "svc-portrait.png" },
    { id: "newborn", icon: "🍼", name: "Newborn Photoshoot", desc: "Tiny toes, peaceful sleeps, precious first days", group: "Portrait & Specialty Photography", budget: "₹10,000 – ₹25,000", bg: "svc-portrait.png" },
    { id: "portfolio", icon: "👤", name: "Portfolio Shoot", desc: "Professional portfolios for models, actors & professionals", group: "Portrait & Specialty Photography", budget: "₹10,000 – ₹25,000", bg: "svc-portrait.png" },
    { id: "album", icon: "📚", name: "Album Design & Print", desc: "Premium custom wedding albums & photo books", group: "Portrait & Specialty Photography", budget: "₹25,000 – ₹50,000", bg: "gallery-wedding2.png" }
  ];
 
  const BUDGET_OPTIONS = [
    "Under ₹10,000",
    "₹10,000 – ₹25,000",
    "₹25,000 – ₹50,000",
    "₹50,000 – ₹1,00,000",
    "Above ₹1,00,000"
  ];
 
  function initBudgetsManager() {
    const budgetsForm = document.getElementById('adminBudgetsForm');
    const container = document.getElementById('budgetsListContainer');
    const btnReset = document.getElementById('btnResetBudgets');
     
    if (!container || !budgetsForm) return;
     
    const repoOwner = 'babu7171';
    const repoName = 'MVR_studio';
    let currentServices = [];
 
    function renderServicesInputs(servicesList) {
      const listToRender = (servicesList && servicesList.length > 0) ? servicesList : DEFAULT_SERVICES_FALLBACK;
      
      const datalistHTML = `
        <datalist id="budgetRanges">
          ${BUDGET_OPTIONS.map(opt => `<option value="${opt}"></option>`).join('')}
        </datalist>
      `;

      container.innerHTML = listToRender.map((svc, index) => {
        const currentBudget = svc.budget || '';
        const svcId = 'svc_' + svc.id;
        
        return `
          <div class="admin-service-edit-card" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:var(--r2); padding:20px; display:flex; flex-direction:column; gap:12px;" data-index="${index}" data-id="${svc.id}" data-group="${svc.group}" data-bg="${svc.bg || ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 8px;">
              <span style="font-size:0.75rem; color:var(--gold); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${svc.group}</span>
              <span style="font-size:0.7rem; color:var(--g4);">Key: ${svc.id}</span>
            </div>
            
            <div style="display:grid; grid-template-columns: 60px 1fr; gap:12px;">
              <div class="fg">
                <label style="display:block; font-size:0.75rem; color:var(--g3); margin-bottom:4px;">Emoji</label>
                <input type="text" class="svc-edit-icon" value="${svc.icon || ''}" style="width:100%; text-align:center; padding:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:var(--r1); color:var(--white); font-size:1.1rem; outline:none;"/>
              </div>
              <div class="fg">
                <label style="display:block; font-size:0.75rem; color:var(--g3); margin-bottom:4px;">Service Name</label>
                <input type="text" class="svc-edit-name" value="${svc.name || ''}" style="width:100%; padding:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:var(--r1); color:var(--white); font-size:0.85rem; outline:none;"/>
              </div>
            </div>
            
            <div class="fg">
              <label style="display:block; font-size:0.75rem; color:var(--g3); margin-bottom:4px;">Description</label>
              <textarea class="svc-edit-desc" rows="2" style="width:100%; padding:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:var(--r1); color:var(--white); font-size:0.8rem; outline:none; font-family:sans-serif; resize:none;">${svc.desc || ''}</textarea>
            </div>
            
            <div class="fg">
              <label style="display:block; font-size:0.75rem; color:var(--g3); margin-bottom:4px;">Default Budget Range</label>
              <input type="text" list="budgetRanges" class="svc-edit-budget" value="${currentBudget}" placeholder="e.g. ₹50,000 – ₹1,00,000 or custom amount" style="width:100%; padding:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:var(--r1); color:var(--white); font-size:0.85rem; outline:none;"/>
            </div>
          </div>
        `;
      }).join('') + datalistHTML;
    }
 
    async function loadBudgets() {
      try {
        const data = await fetchDbContent();
        if (data) {
          currentServices = data.services || [];
        }
      } catch (err) {
        console.warn('Could not load current budgets from gallery_db.json', err);
      }
      renderServicesInputs(currentServices);
    }
 
    budgetsForm.addEventListener('submit', async e => {
      e.preventDefault();
       
      const updatedServices = [];
      const cards = container.querySelectorAll('.admin-service-edit-card');
      cards.forEach(card => {
        const id = card.dataset.id;
        const group = card.dataset.group;
        const bg = card.dataset.bg;
        const icon = card.querySelector('.svc-edit-icon').value.trim();
        const name = card.querySelector('.svc-edit-name').value.trim();
        const desc = card.querySelector('.svc-edit-desc').value.trim();
        const budget = card.querySelector('.svc-edit-budget').value;
        
        updatedServices.push({
          id: id,
          icon: icon,
          name: name,
          desc: desc,
          group: group,
          budget: budget,
          bg: bg
        });
      });
       
      try {
        const btnSave = document.getElementById('btnSaveBudgets');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Saving...';
        }
         
        const resp = await fetch('/api/services', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + jwtToken
          },
          body: JSON.stringify({ services: updatedServices })
        });
        
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Failed to save services');
         
        alert('Service settings and budgets saved successfully to server!');
        currentServices = updatedServices;
      } catch (err) {
        console.error(err);
        alert('Failed to save services: ' + err.message);
      } finally {
        const btnSave = document.getElementById('btnSaveBudgets');
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Save Services & Budgets';
        }
      }
    });
 
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all service settings to their default values? (Note: you must click Save to write the changes to the server).')) {
          renderServicesInputs(DEFAULT_SERVICES_FALLBACK);
        }
      });
    }
 
    loadBudgets();
  }

  updateUIForAuth();

})();
