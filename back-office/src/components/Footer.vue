<template>
  <footer class="footer">
    <span class="footer-text">
      <i class="bi bi-shield-check me-1"></i>
      GLPI Back-Office &mdash; &copy; 2026
    </span>
    <span class="footer-version">v2.3</span>
  </footer>
</template>

<script setup lang="ts">
</script>

<style scoped>
.footer {
  background: #0f4c75;
  color: rgba(255,255,255,0.55);
  padding: 0.6rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  margin-top: auto;
}

.footer-version {
  background: rgba(255,255,255,0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}
</style>