// API Rate Limit Status Widget
// Displays current API usage and limits

(function() {
  'use strict';

  const API_BASE_URL = window.GGG_API_ORIGIN || 'http://localhost:4000';

  class RateLimitWidget {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error(`Container ${containerId} not found`);
        return;
      }
      this.render();
      this.fetchStatus();
      // Auto-refresh every 30 seconds
      setInterval(() => this.fetchStatus(), 30000);
    }

    render() {
      this.container.innerHTML = `
        <div class="card" id="rate-limit-card">
          <div class="card-content">
            <span class="card-title">API Usage</span>
            <div id="rate-limit-content">
              <div class="progress">
                <div class="indeterminate"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    async fetchStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/rate-limit/status`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        this.updateDisplay(data);
      } catch (error) {
        console.error('Error fetching rate limit status:', error);
        this.showError();
      }
    }

    updateDisplay(status) {
      const content = document.getElementById('rate-limit-content');
      if (!content) return;

      const percentage = (status.count / status.softLimit) * 100;
      const percentageRounded = Math.round(percentage);
      
      let statusColor = 'green';
      let statusText = 'Good';
      if (status.isBlocked) {
        statusColor = 'red';
        statusText = 'Limit Reached';
      } else if (status.isNearLimit) {
        statusColor = 'orange';
        statusText = 'Near Limit';
      }

      const expiryDate = status.oldestCallExpiry ? new Date(status.oldestCallExpiry).toLocaleString() : 'N/A';

      content.innerHTML = `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 24px; font-weight: bold;">${status.count} / ${status.softLimit}</span>
            <span class="${statusColor}-text" style="font-weight: bold;">${statusText}</span>
          </div>
          
          <div class="progress" style="height: 10px;">
            <div class="determinate ${statusColor}" style="width: ${percentageRounded}%"></div>
          </div>
          
          <p style="margin-top: 10px; color: #666; font-size: 12px;">
            ${status.remaining} calls remaining this week
          </p>
        </div>

        <div style="font-size: 13px; color: #666;">
          <p><strong>Weekly Limit:</strong> ${status.softLimit} calls (soft limit)</p>
          <p><strong>Hard Limit:</strong> ${status.hardLimit} calls</p>
          ${status.oldestCallExpiry ? `<p><strong>Next Reset:</strong> ${expiryDate}</p>` : ''}
        </div>

        ${status.isBlocked ? `
          <div class="card-panel red lighten-4" style="margin-top: 15px; padding: 10px;">
            <p class="red-text" style="margin: 0;">
              <i class="material-icons tiny">warning</i>
              API calls are currently blocked. The limit will reset when the oldest call expires.
            </p>
          </div>
        ` : ''}

        ${status.isNearLimit && !status.isBlocked ? `
          <div class="card-panel orange lighten-4" style="margin-top: 15px; padding: 10px;">
            <p class="orange-text text-darken-2" style="margin: 0;">
              <i class="material-icons tiny">info</i>
              You're approaching the weekly limit. Consider waiting before making more calls.
            </p>
          </div>
        ` : ''}
      `;
    }

    showError() {
      const content = document.getElementById('rate-limit-content');
      if (!content) return;

      content.innerHTML = `
        <p class="red-text">
          <i class="material-icons tiny">error</i>
          Unable to load API usage status
        </p>
      `;
    }
  }

  // Auto-initialize if container exists
  document.addEventListener('DOMContentLoaded', function() {
    const container = document.getElementById('api-rate-limit-widget');
    if (container) {
      new RateLimitWidget('api-rate-limit-widget');
    }
  });

  // Export for manual initialization
  window.RateLimitWidget = RateLimitWidget;
})();
