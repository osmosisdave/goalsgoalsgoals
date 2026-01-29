// Example usage of the Mock Football API
// This file demonstrates how to use the mock API endpoints

(function() {
  'use strict';

  // Example 1: Get all fixtures for Premier League
  async function getFixturesExample() {
    console.log('=== Example 1: Get All Fixtures ===');
    const response = await window.MockFootballAPI.getFixtures({
      league: 39,
      season: 2025
    });
    console.log(`Found ${response.results} fixtures`);
    console.log('First fixture:', response.response[0]);
  }

  // Example 2: Get live fixtures
  async function getLiveFixtures() {
    console.log('\n=== Example 2: Get Live Fixtures ===');
    const response = await window.MockFootballAPI.getFixtures({
      live: 'all'
    });
    console.log(`Found ${response.results} live fixtures`);
    response.response.forEach(f => {
      console.log(`${f.teams.home.name} ${f.goals.home} - ${f.goals.away} ${f.teams.away.name} (${f.fixture.status.short} ${f.fixture.status.elapsed}')`);
    });
  }

  // Example 3: Get next 10 upcoming fixtures
  async function getUpcomingFixtures() {
    console.log('\n=== Example 3: Get Next 10 Fixtures ===');
    const response = await window.MockFootballAPI.getFixtures({
      next: 10,
      league: 39
    });
    console.log(`Found ${response.results} upcoming fixtures`);
    response.response.forEach(f => {
      const date = new Date(f.fixture.date);
      console.log(`${date.toLocaleDateString()} - ${f.teams.home.name} vs ${f.teams.away.name}`);
    });
  }

  // Example 4: Get fixtures for a specific date
  async function getFixturesByDate() {
    console.log('\n=== Example 4: Get Fixtures by Date ===');
    const today = new Date().toISOString().split('T')[0];
    const response = await window.MockFootballAPI.getFixtures({
      date: today
    });
    console.log(`Found ${response.results} fixtures on ${today}`);
  }

  // Example 5: Get standings
  async function getStandings() {
    console.log('\n=== Example 5: Get Standings ===');
    const response = await window.MockFootballAPI.getStandings({
      league: 39,
      season: 2025
    });
    console.log('Top 5 teams:');
    response.response[0].league.standings[0].slice(0, 5).forEach(team => {
      console.log(`${team.rank}. ${team.team.name} - ${team.points} pts (${team.all.win}W ${team.all.draw}D ${team.all.lose}L)`);
    });
  }

  // Example 6: Get fixtures for a specific team
  async function getTeamFixtures() {
    console.log('\n=== Example 6: Get Team Fixtures ===');
    const response = await window.MockFootballAPI.getFixtures({
      team: 33, // Manchester United
      league: 39,
      season: 2025
    });
    console.log(`Found ${response.results} fixtures for Manchester United`);
    response.response.slice(0, 5).forEach(f => {
      console.log(`${f.teams.home.name} ${f.goals.home || '-'} - ${f.goals.away || '-'} ${f.teams.away.name} (${f.fixture.status.short})`);
    });
  }

  // Example 7: Filter by status (finished matches only)
  async function getFinishedMatches() {
    console.log('\n=== Example 7: Get Finished Matches ===');
    const response = await window.MockFootballAPI.getFixtures({
      status: 'FT',
      league: 39,
      last: 10
    });
    console.log(`Found ${response.results} finished matches`);
    response.response.forEach(f => {
      console.log(`${f.teams.home.name} ${f.goals.home} - ${f.goals.away} ${f.teams.away.name}`);
    });
  }

  // Run all examples when DOM is ready
  document.addEventListener('DOMContentLoaded', async function() {
    if (!window.MockFootballAPI) {
      console.error('Mock API not loaded!');
      return;
    }

    console.log('Mock Football API Examples');
    console.log('==========================\n');

    try {
      await getFixturesExample();
      await getLiveFixtures();
      await getUpcomingFixtures();
      await getFixturesByDate();
      await getStandings();
      await getTeamFixtures();
      await getFinishedMatches();
    } catch (error) {
      console.error('Error running examples:', error);
    }
  });
})();
