<template>
  <aside class="sidebar">
    <div class="sidebar-content">
      <div class="logo">
        <h1>GLPI</h1>
        <p>Back-Office</p>
      </div>
      <nav class="nav">
        <router-link to="/dashboard" class="nav-link">
          <span class="icon">📊</span>
          Dashboard
        </router-link>
        <router-link to="/tickets" class="nav-link">
          <span class="icon">🎫</span>
          Tickets
        </router-link>
        <router-link to="/import" class="nav-link">
          <span class="icon">📥</span>
          Import
        </router-link>
        <router-link to="/reset" class="nav-link">
          <span class="icon">🔄</span>
          Reset
        </router-link>
      </nav>
      <div class="user-menu">
        <button @click="logout" class="logout-btn">
          <span class="icon">🚪</span>
          Logout
        </button>
      </div>
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
  background-color: #2c3e50;
  color: white;
  width: 250px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 2rem 1rem;
}

.logo {
  margin-bottom: 2rem;
  text-align: center;
}

.logo h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.logo p {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  opacity: 0.7;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nav-link:hover,
.nav-link.router-link-active {
  background-color: rgba(255, 255, 255, 0.1);
}

.icon {
  font-size: 1.25rem;
}

.user-menu {
  margin-top: auto;
}

.logout-btn {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  font-size: 1rem;
}

.logout-btn:hover {
  background-color: #c0392b;
}
</style>
