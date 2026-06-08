<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="bi bi-grid-1x2-fill me-2"></i>Dashboard</h1>
        <p class="page-subtitle">Vue d'ensemble du parc informatique</p>
      </div>
      <button class="btn-refresh" @click="loadStats" :disabled="loading">
        <i class="bi bi-arrow-clockwise" :class="{ 'spin': loading }"></i>
        Actualiser
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner-border text-primary" role="status"></div>
      <p>Chargement des statistiques…</p>
    </div>

    <div v-else-if="stats">
      <!-- KPI Row -->
      <div class="kpi-row">
        <div class="kpi-card kpi-assets">
          <div class="kpi-icon"><i class="bi bi-pc-display"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ stats.assets.total }}</span>
            <span class="kpi-label">Assets total</span>
          </div>
        </div>
        <div class="kpi-card kpi-tickets">
          <div class="kpi-icon"><i class="bi bi-ticket-perforated-fill"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ stats.tickets.total }}</span>
            <span class="kpi-label">Tickets total</span>
          </div>
        </div>
        <div class="kpi-card kpi-open">
          <div class="kpi-icon"><i class="bi bi-exclamation-circle-fill"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ openTickets }}</span>
            <span class="kpi-label">Tickets ouverts</span>
          </div>
        </div>
        <div class="kpi-card kpi-solved">
          <div class="kpi-icon"><i class="bi bi-check-circle-fill"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ solvedTickets }}</span>
            <span class="kpi-label">Tickets résolus</span>
          </div>
        </div>
      </div>

      <!-- Detail cards -->
      <div class="detail-grid">
        <!-- Assets by type -->
        <div class="detail-card">
          <div class="card-header-inner">
            <i class="bi bi-pc-display-horizontal"></i>
            <h3>Assets par type</h3>
            <span class="badge-total">{{ stats.assets.total }}</span>
          </div>
          <div class="bar-list">
            <div v-for="item in stats.assets.byType" :key="item.label" class="bar-item">
              <div class="bar-meta">
                <span class="bar-label">{{ item.label }}</span>
                <span class="bar-count">{{ item.count }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--teal"
                  :style="{ width: pct(item.count, stats.assets.total) + '%' }">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Assets by status -->
        <div class="detail-card">
          <div class="card-header-inner">
            <i class="bi bi-activity"></i>
            <h3>Assets par statut</h3>
          </div>
          <div class="badge-list">
            <div v-for="item in stats.assets.byStatus" :key="item.label" class="badge-item">
              <span class="status-dot" :class="statusDotClass(item.label)"></span>
              <span class="badge-label">{{ item.label }}</span>
              <span class="badge-count">{{ item.count }}</span>
            </div>
          </div>
        </div>

        <!-- Tickets by type -->
        <div class="detail-card">
          <div class="card-header-inner">
            <i class="bi bi-tags-fill"></i>
            <h3>Tickets par type</h3>
          </div>
          <div class="donut-row">
            <div v-for="item in stats.tickets.byType" :key="item.label" class="donut-item">
              <div class="donut-circle" :class="item.label === 'Incident' ? 'donut--orange' : 'donut--teal'">
                {{ item.count }}
              </div>
              <span class="donut-label">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <!-- Tickets by status -->
        <div class="detail-card">
          <div class="card-header-inner">
            <i class="bi bi-kanban-fill"></i>
            <h3>Tickets par statut</h3>
            <span class="badge-total">{{ stats.tickets.total }}</span>
          </div>
          <div class="bar-list">
            <div v-for="item in stats.tickets.byStatus" :key="item.label" class="bar-item">
              <div class="bar-meta">
                <span class="bar-label">{{ item.label }}</span>
                <span class="bar-count">{{ item.count }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--blue"
                  :style="{ width: pct(item.count, stats.tickets.total) + '%' }">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tickets by priority -->
        <div class="detail-card">
          <div class="card-header-inner">
            <i class="bi bi-flag-fill"></i>
            <h3>Tickets par priorité</h3>
          </div>
          <div class="badge-list">
            <div v-for="item in stats.tickets.byPriority" :key="item.label" class="badge-item">
              <span class="status-dot" :class="priorityDotClass(item.label)"></span>
              <span class="badge-label">{{ item.label }}</span>
              <span class="badge-count">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <i class="bi bi-bar-chart-line"></i>
      <p>Aucune donnée disponible</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { statsApi } from '../services/api';

const stats = ref<any>(null);
const loading = ref(false);

const openTickets = computed(() => {
  if (!stats.value) return 0;
  return (stats.value.tickets.byStatus || [])
    .filter((s: any) => ['New', 'Assigned', 'Planned', 'Waiting'].includes(s.label))
    .reduce((acc: number, s: any) => acc + s.count, 0);
});

const solvedTickets = computed(() => {
  if (!stats.value) return 0;
  return (stats.value.tickets.byStatus || [])
    .filter((s: any) => ['Solved', 'Closed'].includes(s.label))
    .reduce((acc: number, s: any) => acc + s.count, 0);
});

const pct = (val: number, total: number) => total ? Math.round((val / total) * 100) : 0;

const statusDotClass = (status: string) => {
  const map: Record<string, string> = {
    'En production': 'dot--green', 'En stock': 'dot--blue',
    'En réparation': 'dot--orange', 'Hors service': 'dot--red',
    'Unknown': 'dot--grey',
  };
  return map[status] || 'dot--grey';
};

const priorityDotClass = (priority: string) => {
  const map: Record<string, string> = {
    'Very High': 'dot--red', 'High': 'dot--orange',
    'Medium': 'dot--yellow', 'Low': 'dot--blue', 'Very Low': 'dot--grey',
  };
  return map[priority] || 'dot--grey';
};

const loadStats = async () => {
  loading.value = true;
  try {
    const response = await statsApi.get();
    stats.value = response.data;
  } catch (error) {
    console.error('Failed to load stats:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(loadStats);
</script>

<style scoped>
.page { padding: 1.75rem 2rem; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.75rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f4c75;
}

.page-subtitle { color: #6c757d; font-size: 0.875rem; margin: 0; }

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1.5px solid #1b6ca8;
  color: #1b6ca8;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
}

.btn-refresh:hover:not(:disabled) { background: #1b6ca8; color: white; }
.btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; display: inline-block; }

/* KPI */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.kpi-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  border-left: 4px solid transparent;
}

.kpi-assets { border-left-color: #1b6ca8; }
.kpi-tickets { border-left-color: #0d7377; }
.kpi-open { border-left-color: #e87722; }
.kpi-solved { border-left-color: #28a745; }

.kpi-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.kpi-assets .kpi-icon { background: rgba(27,108,168,0.12); color: #1b6ca8; }
.kpi-tickets .kpi-icon { background: rgba(13,115,119,0.12); color: #0d7377; }
.kpi-open .kpi-icon { background: rgba(232,119,34,0.12); color: #e87722; }
.kpi-solved .kpi-icon { background: rgba(40,167,69,0.12); color: #28a745; }

.kpi-body { display: flex; flex-direction: column; }
.kpi-value { font-size: 1.75rem; font-weight: 700; color: #0f4c75; line-height: 1; }
.kpi-label { font-size: 0.78rem; color: #6c757d; margin-top: 0.2rem; }

/* Detail grid */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.detail-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}

.card-header-inner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
}

.card-header-inner i { color: #1b6ca8; font-size: 1rem; }
.card-header-inner h3 { margin: 0; font-size: 0.95rem; font-weight: 600; color: #0f4c75; flex: 1; }

.badge-total {
  background: #e8f4fd;
  color: #1b6ca8;
  border-radius: 20px;
  padding: 0.15rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
}

/* Bars */
.bar-list { display: flex; flex-direction: column; gap: 0.65rem; }

.bar-meta { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
.bar-label { font-size: 0.82rem; color: #495057; }
.bar-count { font-size: 0.82rem; font-weight: 600; color: #0f4c75; }

.bar-track { height: 6px; background: #f0f4f8; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
.bar-fill--teal { background: linear-gradient(90deg, #0d7377, #14d9c4); }
.bar-fill--blue { background: linear-gradient(90deg, #1b6ca8, #5ba3d9); }

/* Badges */
.badge-list { display: flex; flex-direction: column; gap: 0.6rem; }

.badge-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--green { background: #28a745; }
.dot--blue { background: #1b6ca8; }
.dot--orange { background: #e87722; }
.dot--red { background: #dc3545; }
.dot--yellow { background: #ffc107; }
.dot--grey { background: #adb5bd; }

.badge-label { font-size: 0.83rem; color: #495057; flex: 1; }
.badge-count { font-size: 0.83rem; font-weight: 700; color: #0f4c75; }

/* Donut */
.donut-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }

.donut-item { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }

.donut-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 700;
  color: white;
}

.donut--orange { background: linear-gradient(135deg, #e87722, #f5a623); }
.donut--teal { background: linear-gradient(135deg, #0d7377, #14d9c4); }
.donut-label { font-size: 0.8rem; color: #6c757d; font-weight: 500; }

/* States */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem;
  color: #6c757d;
}

.empty-state {
  text-align: center;
  padding: 4rem;
  color: #adb5bd;
}

.empty-state i { font-size: 3rem; display: block; margin-bottom: 1rem; }

@media (max-width: 1100px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .detail-grid { grid-template-columns: 1fr; }
}
</style>