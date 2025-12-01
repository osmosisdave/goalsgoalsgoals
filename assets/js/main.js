"use strict";
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Materialize components (sidenav, etc.)
    if (typeof M !== 'undefined' && M && M.AutoInit) {
        M.AutoInit();
    }
    // Set current year
    const year = document.getElementById('year');
    if (year)
        year.textContent = String(new Date().getFullYear());
    // Theme toggle (applies to any element with data-theme-toggle)
    const saved = localStorage.getItem('theme');
    if (saved === 'dark')
        document.documentElement.classList.add('dark');
    const toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach((el) => {
        el.addEventListener('click', (ev) => {
            ev.preventDefault();
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    });
});
