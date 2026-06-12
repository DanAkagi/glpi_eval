<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="brand-icon">
        <i class="bi bi-server"></i>
      </div>
      <div class="brand-text">
        <span class="brand-name">GLPI</span>
        <span class="brand-sub">Back-Office</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <p class="nav-section-label">Navigation</p>
      <router-link to="/dashboard" class="nav-item">
        <i class="bi bi-grid-1x2-fill"></i>
        <span>Dashboard</span>
      </router-link>
      <router-link to="/tickets" class="nav-item">
        <i class="bi bi-ticket-perforated-fill"></i>
        <span>Tickets</span>
      </router-link>
      <router-link to="/kanban-settings" class="nav-item">
        <i class="bi bi-kanban-fill"></i>
        <span>Kanban</span>
      </router-link>
      <router-link to="/costs-by-assets" class="nav-item">
        <i class="bi bi-coin"></i>
        <span>Costs</span>
      </router-link>
      <router-link to="/assets" class="nav-item">
        <i class="bi bi-pc-display"></i>
        <span>Assets</span>
      </router-link>
      <router-link to="/import" class="nav-item">
        <i class="bi bi-cloud-upload-fill"></i>
        <span>Import</span>
      </router-link>
      <router-link to="/reset" class="nav-item nav-item--danger">
        <i class="bi bi-arrow-counterclockwise"></i>
        <span>Reset</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <button @click="logout" class="logout-btn">
        <i class="bi bi-box-arrow-left"></i>
        <span>Déconnexion</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { authApi } from '../services/api';
import { useRouter } from 'vue-router';

const router = useRouter();

const logout = async () => {
  try {
    await authApi.logout();
    router.push('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
</script>

<style scoped>
.sidebar {
  background: linear-gradient(180deg, #0f4c75 0%, #1b6ca8 60%, #0d7377 100%);
  color: white;
  width: 240px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 20px rgba(0,0,0,0.25);
  z-index: 1000;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.12);
}

.brand-icon {
  width: 40px;
  height: 40px;
  background: rgba(255,255,255,0.15);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-name {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.brand-sub {
  font-size: 0.7rem;
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nav-section-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.5;
  padding: 0 0.5rem;
  margin: 0.5rem 0 0.4rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  color: rgba(255,255,255,0.8);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.18s ease;
}

.nav-item i {
  font-size: 1.05rem;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.nav-item:hover {
  background: rgba(255,255,255,0.12);
  color: white;
}

.nav-item.router-link-active {
  background: rgba(255,255,255,0.18);
  color: white;
  box-shadow: inset 3px 0 0 #e87722;
}

.nav-item--danger:hover {
  background: rgba(232, 119, 34, 0.2);
  color: #ffb07c;
}

.nav-item--danger.router-link-active {
  box-shadow: inset 3px 0 0 #e87722;
  background: rgba(232, 119, 34, 0.15);
}

.sidebar-footer {
  padding: 1rem 0.75rem 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.12);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.65rem 0.85rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  color: rgba(255,255,255,0.8);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.logout-btn:hover {
  background: rgba(220, 53, 69, 0.3);
  border-color: rgba(220, 53, 69, 0.4);
  color: #ff8f9a;
}

.logout-btn i {
  font-size: 1rem;
}
</style>