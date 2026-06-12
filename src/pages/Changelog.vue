<template>
  <div class="changelog-page">
    <div class="lcars-text-bar"><span>Mission Patch Notes</span></div>
    <p class="changelog-intro">A log of all updates, improvements, and bug fixes deployed to CompuTrek Academy.</p>

    <div class="entry-list">
      <div v-for="entry in changelog" :key="entry.version" class="entry-card">
        <div class="entry-header">
          <span class="entry-version">v{{ entry.version }}</span>
          <span class="entry-date">{{ formatDate(entry.date) }}</span>
          <span class="entry-title">{{ entry.title }}</span>
        </div>
        <ul class="entry-changes">
          <li v-for="(change, i) in entry.changes" :key="i">{{ change }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import changelog from '@/assets/data/changelog.json';

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
</script>

<style scoped>
@import '@/assets/styles/classic.css';

.changelog-page {
  max-width: 52rem;
  margin: 0 auto;
  padding: 0 1rem 3rem;
}

.changelog-intro {
  color: var(--gray);
  font-size: 0.875rem;
  margin: 0.5rem 0 2rem;
  letter-spacing: 0.03em;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.entry-card {
  background: rgba(11, 18, 42, 0.7);
  border: 1px solid rgba(121, 144, 250, 0.2);
  border-left: 3px solid var(--champsdefault);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem 1.1rem;
}

.entry-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}

.entry-version {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.12em;
  color: var(--champsdefault);
  background: rgba(121, 144, 250, 0.12);
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}

.entry-date {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: var(--gray);
  white-space: nowrap;
}

.entry-title {
  font-family: 'Antonio', 'Arial Narrow', sans-serif;
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  color: #c8d8f8;
}

.entry-changes {
  margin: 0;
  padding-left: 1.25rem;
  list-style: none;
}

.entry-changes li {
  position: relative;
  color: #8899bb;
  font-size: 0.85rem;
  line-height: 1.6;
  padding-left: 0.1rem;
}

.entry-changes li::before {
  content: '▸';
  position: absolute;
  left: -1rem;
  color: var(--champsdefault);
  opacity: 0.6;
  font-size: 0.7rem;
  top: 0.25em;
}
</style>
