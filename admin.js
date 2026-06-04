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
    async function uploadFileToGithub(file, caption, category) {
      const isVid = file.type.startsWith('video/');
      const fileType = isVid ? 'video' : 'photo';

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
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
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
      dropZone.addEventListener('click', (e) => {
        if (e.target === fileInput) return;
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('click', e => e.stopPropagation());
      fileInput.addEventListener('change', () => {
        handleUploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    const chooseBtn = dropZone ? dropZone.querySelector('.btn-gold') : null;
    if (chooseBtn) {
      chooseBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (fileInput) fileInput.click();
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

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif',
                           'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

    async function handleUploadFiles(files) {
      if (!files || !files.length) return;
      const valid = Array.from(files).filter(f => ALLOWED_TYPES.includes(f.type) || f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (!valid.length) {
        alert('Please upload valid image files (JPG, PNG, WEBP, GIF) or video files (MP4, MOV).');
        return;
      }

      if (uploadProg) uploadProg.style.display = 'flex';
      let done = 0;

      const customCaption = uploadCaptionInput ? uploadCaptionInput.value.trim() : '';
      const customCategory = uploadCategorySelect ? uploadCategorySelect.value : 'all';
      const isSync = ghToken && syncToGithubCheck && syncToGithubCheck.checked;

      if (isSync) {
        for (const file of valid) {
          try {
            const caption = customCaption || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            await uploadFileToGithub(file, caption, customCategory);
            done++;
            const pct = Math.round((done / valid.length) * 100);
            if (upFill) upFill.style.width = pct + '%';
            if (upLabel) upLabel.textContent = `Completed ${done} / ${valid.length}`;
          } catch (err) {
            console.error('GitHub Upload Error for file ' + file.name, err);
            alert(`Failed to upload ${file.name} to GitHub: ${err.message}`);
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
        valid.forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const url = ev.target.result;
            const isVid = file.type.startsWith('video/');
            const caption = customCaption || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            items.unshift({ src: url, type: isVid ? 'video' : 'photo', cap: caption, category: customCategory, isNew: true });
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

})();
