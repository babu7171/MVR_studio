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
    initBudgetsManager();
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

  // ── Gallery Tab Logic (base64 local storage + GitHub integration) ──
  function initGalleryManager() {
    const fileInput = document.getElementById('adminFileInput');
    const dropZone = document.getElementById('adminDropZone');
    const uploadProg = document.getElementById('adminUploadProg');
    const upFill = document.getElementById('adminUpFill');
    const upLabel = document.getElementById('adminUpLabel');
    const previewContainer = document.getElementById('adminGalPreview');

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

    if (!previewContainer) return;

    // Render Folder Grid dynamically
    async function renderFolderGrid() {
      const grid = document.getElementById('adminFoldersGrid');
      if (!grid) return;

      let services = [];
      try {
        const resp = await fetch('gallery_db.json?t=' + Date.now());
        if (resp.ok) {
          const data = await resp.json();
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
      if (uploadCategorySelect) {
        uploadCategorySelect.value = categoryId;
        // Visual cue
        uploadCategorySelect.style.border = '1px solid var(--gold)';
        uploadCategorySelect.style.boxShadow = '0 0 10px rgba(201,165,90,0.2)';
        setTimeout(() => {
          uploadCategorySelect.style.border = '1px solid rgba(255,255,255,0.08)';
          uploadCategorySelect.style.boxShadow = 'none';
        }, 1500);
      }
      if (fileInput) {
        fileInput.click();
      }
    };

    renderFolderGrid();

    let ghToken = localStorage.getItem('mvr_github_token') || '';
    const repoOwner = 'babu7171';
    const repoName = 'MVR_studio';
    let githubItems = [];

    // Connection UI status updates
    function updateGhUI() {
      if (ghToken) {
        if (ghStatusBadge) {
          ghStatusBadge.textContent = 'Connected to babu7171/MVR_studio';
          ghStatusBadge.style.background = 'rgba(201, 165, 90, 0.1)';
          ghStatusBadge.style.borderColor = 'var(--gold)';
          ghStatusBadge.style.color = 'var(--gold)';
        }
        if (ghTokenInput) {
          ghTokenInput.value = '••••••••••••••••••••';
          ghTokenInput.disabled = true;
        }
        if (btnConnectGh) btnConnectGh.style.display = 'none';
        if (btnDisconnectGh) btnDisconnectGh.style.display = 'inline-block';
      } else {
        if (ghStatusBadge) {
          ghStatusBadge.textContent = 'Disconnected';
          ghStatusBadge.style.background = 'rgba(255,82,82,0.1)';
          ghStatusBadge.style.borderColor = 'rgba(255,82,82,0.3)';
          ghStatusBadge.style.color = '#ff5252';
        }
        if (ghTokenInput) {
          ghTokenInput.value = '';
          ghTokenInput.disabled = false;
        }
        if (btnConnectGh) btnConnectGh.style.display = 'inline-block';
        if (btnDisconnectGh) btnDisconnectGh.style.display = 'none';
      }
    }

    if (btnConnectGh) {
      btnConnectGh.addEventListener('click', () => {
        const val = ghTokenInput.value.trim();
        if (!val || val.startsWith('•••')) {
          alert('Please enter a valid GitHub Personal Access Token (PAT).');
          return;
        }
        ghToken = val;
        localStorage.setItem('mvr_github_token', val);
        alert('GitHub Token saved successfully!');
        updateGhUI();
        fetchGithubGallery().then(renderGalleryPreview);
      });
    }

    if (btnDisconnectGh) {
      btnDisconnectGh.addEventListener('click', () => {
        if (confirm('Disconnect GitHub account?')) {
          ghToken = '';
          githubItems = [];
          localStorage.removeItem('mvr_github_token');
          updateGhUI();
          renderGalleryPreview();
        }
      });
    }

    updateGhUI();

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

    // Fetch public gallery database file from the GitHub repository
    async function fetchGithubGallery() {
      if (!ghToken) return;
      try {
        const dbUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/gallery_db.json?t=${Date.now()}`;
        const dbGetResp = await fetch(dbUrl, {
          method: 'GET',
          headers: {
            'Authorization': `token ${ghToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (dbGetResp.ok) {
          const dbGetData = await dbGetResp.json();
          const decoded = atob(dbGetData.content.replace(/\s/g, ''));
          const dbContentObj = JSON.parse(decoded);
          githubItems = dbContentObj.gallery || [];
        }
      } catch (err) {
        console.error('Error fetching gallery DB from GitHub:', err);
      }
    }

    function renderGalleryPreview() {
      const fullList = ghToken && syncToGithubCheck && syncToGithubCheck.checked ? githubItems : getGallery();
      let displayItems = [...fullList];

      const selectedFilter = adminFilterCategorySelect ? adminFilterCategorySelect.value : 'all';
      if (selectedFilter !== 'all') {
        displayItems = displayItems.filter(item => item.category === selectedFilter);
      }

      if (displayItems.length === 0) {
        previewContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.08); border-radius: var(--r2); color: var(--g3); font-size: 0.85rem;">
            No uploaded items found under this filter category.
          </div>
        `;
        return;
      }

      previewContainer.innerHTML = displayItems.map((item) => {
        const originalIndex = fullList.findIndex(x => x.src === item.src);
        const mediaHTML = item.type === 'video'
          ? `<video src="${item.src}" muted playsinline preload="metadata"></video>`
          : `<img src="${item.src}" alt="${item.cap || ''}"/>`;

        const isSync = ghToken && syncToGithubCheck && syncToGithubCheck.checked;
        const badgeText = isSync ? 'Live Sync' : 'Local';
        const badgeColor = isSync ? 'var(--gold)' : '#ff5252';

        return `
          <div class="admin-gal-card">
            ${mediaHTML}
            <button onclick="window.deleteGalleryItem(${originalIndex})" class="admin-gal-del" title="Remove Item">✕</button>
            <div class="admin-gal-info" style="display:flex; justify-content:space-between; align-items:center; gap:5px; bottom: 0; background: linear-gradient(transparent, rgba(0,0,0,0.85));">
              <span style="overflow:hidden; text-overflow:ellipsis; max-width: 65%;">${item.cap || 'MVR Work'}</span>
              <span style="font-size: 0.58rem; padding: 1px 4px; border-radius: 4px; border: 1px solid ${badgeColor}; color: ${badgeColor}; font-weight:700;">${badgeText}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Direct upload of a single file to GitHub repository contents
    async function uploadFileToGithub(file, caption, category, detectedType, fileExt) {
      const fileType = detectedType || (file.type.startsWith('video/') ? 'video' : 'photo');

      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const parts = reader.result.split(',');
          resolve(parts[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const timestamp = Math.floor(Date.now() / 1000);
      let cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      if (fileExt && !cleanName.toLowerCase().endsWith(fileExt.toLowerCase())) {
        cleanName += fileExt;
      }
      const filename = `${timestamp}-${cleanName}`;
      const repoFilePath = `uploads/${filename}`;

      if (upLabel) upLabel.textContent = `Uploading ${file.name} to GitHub...`;

      const fileUploadUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${repoFilePath}`;
      const fileUploadBody = {
        message: `Upload ${fileType} via Admin: ${caption}`,
        content: base64Data,
        branch: 'main'
      };

      const fileResp = await fetch(fileUploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fileUploadBody)
      });

      if (!fileResp.ok) {
        const errJson = await fileResp.json().catch(() => ({}));
        throw new Error(errJson.message || `File upload failed with status ${fileResp.status}`);
      }

      // Update gallery_db.json
      if (upLabel) upLabel.textContent = `Updating database (gallery_db.json)...`;

      const dbUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/gallery_db.json`;
      let dbSha = '';
      let dbContentObj = { gallery: [] };

      const dbGetResp = await fetch(dbUrl, {
        method: 'GET',
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (dbGetResp.ok) {
        const dbGetData = await dbGetResp.json();
        dbSha = dbGetData.sha;
        try {
          const decoded = decodeURIComponent(escape(atob(dbGetData.content.replace(/\s/g, ''))));
          dbContentObj = JSON.parse(decoded);
          if (!dbContentObj.gallery) dbContentObj.gallery = [];
        } catch (e) {
          console.error('Failed to parse existing gallery_db.json, starting fresh', e);
        }
      }

      dbContentObj.gallery.unshift({
        src: repoFilePath,
        type: fileType,
        cap: caption,
        category: category,
        uploadedAt: new Date().toISOString().split('T')[0]
      });

      const updatedDbBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(dbContentObj, null, 2))));

      const dbUpdateBody = {
        message: `Update gallery_db.json for ${caption}`,
        content: updatedDbBase64,
        branch: 'main'
      };
      if (dbSha) {
        dbUpdateBody.sha = dbSha;
      }

      const dbPutResp = await fetch(dbUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbUpdateBody)
      });

      if (!dbPutResp.ok) {
        const errJson = await dbPutResp.json().catch(() => ({}));
        throw new Error(errJson.message || `Database update failed with status ${dbPutResp.status}`);
      }
    }

    // Delete photo/video metadata entry from GitHub repository
    async function deleteGalleryItemFromGithub(index) {
      if (!ghToken) return;
      const dbUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/gallery_db.json`;
      const dbGetResp = await fetch(dbUrl, {
        method: 'GET',
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!dbGetResp.ok) return;
      const dbGetData = await dbGetResp.json();
      const dbSha = dbGetData.sha;
      const decoded = decodeURIComponent(escape(atob(dbGetData.content.replace(/\s/g, ''))));
      const dbContentObj = JSON.parse(decoded);
      if (!dbContentObj.gallery) dbContentObj.gallery = [];

      dbContentObj.gallery.splice(index, 1);

      const updatedDbBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(dbContentObj, null, 2))));
      const dbUpdateBody = {
        message: `Delete item index ${index} from gallery_db.json`,
        content: updatedDbBase64,
        branch: 'main',
        sha: dbSha
      };

      const dbPutResp = await fetch(dbUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbUpdateBody)
      });

      if (!dbPutResp.ok) {
        const errJson = await dbPutResp.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to update DB after deletion: ${errJson.message}`);
      }
    }

    // Global delete gallery handler
    window.deleteGalleryItem = async function(index) {
      const isSync = ghToken && syncToGithubCheck && syncToGithubCheck.checked;
      const targetStr = isSync ? "GitHub repository (Live Site)" : "local browser storage";
      if (confirm(`Are you sure you want to delete this gallery item from ${targetStr}?`)) {
        try {
          if (isSync) {
            if (uploadProg) uploadProg.style.display = 'flex';
            if (upFill) upFill.style.width = '50%';
            if (upLabel) upLabel.textContent = 'Deleting from GitHub...';

            await deleteGalleryItemFromGithub(index);
            await fetchGithubGallery();

            if (uploadProg) uploadProg.style.display = 'none';
            if (upFill) upFill.style.width = '0%';
          } else {
            const items = getGallery();
            items.splice(index, 1);
            saveGallery(items);
          }
          renderGalleryPreview();
        } catch (err) {
          console.error(err);
          alert('Delete failed: ' + err.message);
          if (uploadProg) uploadProg.style.display = 'none';
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
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        handleUploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    if (syncToGithubCheck) {
      syncToGithubCheck.addEventListener('change', () => {
        if (syncToGithubCheck.checked && ghToken && githubItems.length === 0) {
          if (uploadProg) uploadProg.style.display = 'flex';
          if (upLabel) upLabel.textContent = 'Loading live items...';
          fetchGithubGallery().then(() => {
            if (uploadProg) uploadProg.style.display = 'none';
            renderGalleryPreview();
          });
        } else {
          renderGalleryPreview();
        }
      });
    }

    function detectFileDetails(file) {
      return new Promise((resolve) => {
        // If type is already recognized by the browser, use it
        if (file.type && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
          let ext = '';
          const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
          if (match) {
            ext = '.' + match[1].toLowerCase();
          } else {
            if (file.type.includes('png')) ext = '.png';
            else if (file.type.includes('webp')) ext = '.webp';
            else if (file.type.includes('gif')) ext = '.gif';
            else if (file.type.includes('mp4')) ext = '.mp4';
            else if (file.type.includes('quicktime')) ext = '.mov';
            else ext = '.jpg';
          }
          resolve({
            file: file,
            mime: file.type,
            type: file.type.startsWith('video/') ? 'video' : 'photo',
            ext: ext,
            isValid: true
          });
          return;
        }

        // Check if filename has a known media extension
        const knownExtensions = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif',
          'mp4': 'video/mp4', 'mov': 'video/quicktime', 'mkv': 'video/x-matroska', 'avi': 'video/x-msvideo'
        };
        const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
        if (match) {
          const extStr = match[1].toLowerCase();
          if (knownExtensions[extStr]) {
            const mime = knownExtensions[extStr];
            resolve({
              file: file,
              mime: mime,
              type: mime.startsWith('video/') ? 'video' : 'photo',
              ext: '.' + extStr,
              isValid: true
            });
            return;
          }
        }

        // For extensionless or unrecognized files, read magic bytes
        const blob = file.slice(0, 16);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (!e.target || !e.target.result) {
            resolve({ file: file, mime: 'image/jpeg', type: 'photo', ext: '.jpg', isValid: true });
            return;
          }
          const arr = new Uint8Array(e.target.result);
          let header = '';
          for (let i = 0; i < Math.min(arr.length, 12); i++) {
            header += arr[i].toString(16).padStart(2, '0').toUpperCase();
          }

          if (header.startsWith('89504E47')) {
            resolve({ file: file, mime: 'image/png', type: 'photo', ext: '.png', isValid: true });
          } else if (header.startsWith('FFD8FF')) {
            resolve({ file: file, mime: 'image/jpeg', type: 'photo', ext: '.jpg', isValid: true });
          } else if (header.startsWith('47494638')) {
            resolve({ file: file, mime: 'image/gif', type: 'photo', ext: '.gif', isValid: true });
          } else if (header.startsWith('52494646') && header.slice(16, 24) === '57454250') {
            resolve({ file: file, mime: 'image/webp', type: 'photo', ext: '.webp', isValid: true });
          } else if (header.slice(8, 16) === '66747970') {
            resolve({ file: file, mime: 'video/mp4', type: 'video', ext: '.mp4', isValid: true });
          } else {
            resolve({ file: file, mime: 'image/jpeg', type: 'photo', ext: '.jpg', isValid: true });
          }
        };
        reader.onerror = () => {
          resolve({ file: file, mime: 'image/jpeg', type: 'photo', ext: '.jpg', isValid: true });
        };
        reader.readAsArrayBuffer(blob);
      });
    }

    async function handleUploadFiles(files) {
      if (!files || !files.length) return;

      if (uploadProg) uploadProg.style.display = 'flex';
      if (upLabel) upLabel.textContent = 'Analyzing files...';

      const analyzedFiles = [];
      for (const file of Array.from(files)) {
        const details = await detectFileDetails(file);
        if (details.isValid) {
          analyzedFiles.push(details);
        }
      }

      if (!analyzedFiles.length) {
        alert('Please upload valid image files (JPG, PNG, WEBP, GIF) or video files (MP4, MOV).');
        if (uploadProg) uploadProg.style.display = 'none';
        return;
      }

      let done = 0;
      const customCaption = uploadCaptionInput ? uploadCaptionInput.value.trim() : '';
      const customCategory = uploadCategorySelect ? uploadCategorySelect.value : 'all';
      const isSync = ghToken && syncToGithubCheck && syncToGithubCheck.checked;

      if (isSync) {
        for (const item of analyzedFiles) {
          try {
            const file = item.file;
            const caption = customCaption || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            await uploadFileToGithub(file, caption, customCategory, item.type, item.ext);
            done++;
            const pct = Math.round((done / analyzedFiles.length) * 100);
            if (upFill) upFill.style.width = pct + '%';
            if (upLabel) upLabel.textContent = `Completed ${done} / ${analyzedFiles.length}`;
          } catch (err) {
            console.error('GitHub Upload Error for file ' + item.file.name, err);
            alert(`Failed to upload ${item.file.name} to GitHub: ${err.message}`);
          }
        }

        await fetchGithubGallery();

        setTimeout(() => {
          if (uploadProg) uploadProg.style.display = 'none';
          if (upFill) upFill.style.width = '0%';
        }, 1200);

        renderGalleryPreview();
        if (uploadCaptionInput) uploadCaptionInput.value = '';
      } else {
        const items = getGallery();
        analyzedFiles.forEach(item => {
          const file = item.file;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const url = ev.target.result;
            const caption = customCaption || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            items.unshift({ src: url, type: item.type, cap: caption, category: customCategory, isNew: true });
            done++;

            const pct = Math.round((done / analyzedFiles.length) * 100);
            if (upFill) upFill.style.width = pct + '%';
            if (upLabel) upLabel.textContent = `Processing ${done} / ${analyzedFiles.length}`;

            if (done === analyzedFiles.length) {
              saveGallery(items);
              setTimeout(() => {
                if (uploadProg) uploadProg.style.display = 'none';
                if (upFill) upFill.style.width = '0%';
              }, 800);
              renderGalleryPreview();
              if (uploadCaptionInput) uploadCaptionInput.value = '';
            }
          };
          reader.readAsDataURL(file);
        });
      }
    }

    if (adminFilterCategorySelect) {
      adminFilterCategorySelect.addEventListener('change', renderGalleryPreview);
    }

    // Initial load
    if (ghToken) {
      if (uploadProg) uploadProg.style.display = 'flex';
      if (upLabel) upLabel.textContent = 'Loading live items...';
      fetchGithubGallery().then(() => {
        if (uploadProg) uploadProg.style.display = 'none';
        renderGalleryPreview();
      });
    } else {
      renderGalleryPreview();
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
        const resp = await fetch('gallery_db.json?t=' + Date.now());
        if (resp.ok) {
          const data = await resp.json();
          currentServices = data.services || [];
        }
      } catch (err) {
        console.warn('Could not load current budgets from gallery_db.json', err);
      }
      renderServicesInputs(currentServices);
    }
 
    budgetsForm.addEventListener('submit', async e => {
      e.preventDefault();
       
      const token = localStorage.getItem('mvr_github_token') || '';
      if (!token) {
        alert('Please connect your GitHub account under the "Portfolio Gallery" tab first to save changes to the live site!');
        return;
      }
       
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
        
        // Find existing service item to preserve its default photos array
        const existingSvc = currentServices.find(s => s.id === id) || {};
        const photos = existingSvc.photos || [];
        
        updatedServices.push({
          id: id,
          icon: icon,
          name: name,
          desc: desc,
          group: group,
          budget: budget,
          bg: bg,
          photos: photos
        });
      });
       
      try {
        const btnSave = document.getElementById('btnSaveBudgets');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Saving to GitHub...';
        }
         
        const dbUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/gallery_db.json`;
        const dbGetResp = await fetch(dbUrl, {
          method: 'GET',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
         
        if (!dbGetResp.ok) {
          const errJson = await dbGetResp.json().catch(() => ({}));
          throw new Error(errJson.message || `Failed to fetch database file from GitHub.`);
        }
         
        const dbGetData = await dbGetResp.json();
        const dbSha = dbGetData.sha;
        const decoded = decodeURIComponent(escape(atob(dbGetData.content.replace(/\s/g, ''))));
        const dbContentObj = JSON.parse(decoded);
         
        // Update the services field
        dbContentObj.services = updatedServices;
        
        // Also keep updated budgets mapping for backwards compatibility
        dbContentObj.budgets = {};
        updatedServices.forEach(s => {
          dbContentObj.budgets[s.name] = s.budget;
        });
         
        const updatedDbBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(dbContentObj, null, 2))));
        const dbUpdateBody = {
          message: `Update services list & budgets via Admin panel`,
          content: updatedDbBase64,
          branch: 'main',
          sha: dbSha
        };
         
        const dbPutResp = await fetch(dbUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dbUpdateBody)
        });
         
        if (!dbPutResp.ok) {
          const errJson = await dbPutResp.json().catch(() => ({}));
          throw new Error(errJson.message || `Failed to write database file to GitHub.`);
        }
         
        alert('Service settings saved successfully to GitHub! The changes will be live on the homepage in a few minutes.');
        currentServices = updatedServices;
         
      } catch (err) {
        console.error(err);
        alert('Failed to save services: ' + err.message);
      } finally {
        const btnSave = document.getElementById('btnSaveBudgets');
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Save Budget Ranges';
        }
      }
    });
 
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all service settings to their default values? (Note: you must click Save to write the changes to GitHub).')) {
          renderServicesInputs(DEFAULT_SERVICES_FALLBACK);
        }
      });
    }
 
    loadBudgets();
  }

  updateUIForAuth();

})();
