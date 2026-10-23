/**
 * Job Tracker In-Gmail Action Banner
 * Injects top banner with active deadlines and links to the full Workbench
 */

(function () {
  console.log('[JobTracker] Content script active in Gmail.');

  // Check if banner already injected
  if (document.getElementById('job-tracker-banner')) return;

  function injectBanner() {
    // Find Gmail's primary top container
    const target = document.querySelector('div[role="main"]') || document.body;
    if (!target) return;

    const banner = document.createElement('div');
    banner.id = 'job-tracker-banner';

    // Mock live state matching the demo tracker
    banner.innerHTML = `
      <div class="job-banner-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Jobs Cockpit: 2 Deadlines Impending</span>
      </div>
      <div class="job-banner-items">
        <div class="job-banner-pill urgent" title="Palantir Product Design Challenge ('within 7 days')">
          <strong>Palantir:</strong> Video due in 3d 14h
        </div>
        <div class="job-banner-pill warning" title="Stripe Technical Screen Availability">
          <strong>Stripe:</strong> Select timeslot (48h left)
        </div>
        <div class="job-banner-pill" title="Scale AI Assessment">
          <strong>Scale AI:</strong> HackerRank pending
        </div>
      </div>
      <div class="job-banner-actions">
        <a href="http://localhost:5173" target="_blank" class="job-banner-btn">
          Open Jobs Board
          <svg width="14" height="14" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/>
          </svg>
        </a>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);
  }

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }
})();
