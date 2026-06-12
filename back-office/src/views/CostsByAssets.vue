<template>
  <div class="costs-page">
    <div class="page-header">
      <h1><i class="bi bi-cash-coin me-2"></i>Coûts par type d'asset</h1>
      <p class="page-subtitle">
        Répartition des coûts supplémentaires (saisis à la clôture des tickets) par type d'asset associé.
        Si un ticket est lié à plusieurs assets, son coût est divisé équitablement entre eux.
      </p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3 text-muted">Chargement…</p>
    </div>

    <div v-else>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Coût total</div>
          <div class="summary-value">{{ formatCurrency(total) }}</div>
        </div>
        <div class="summary-card" v-if="unassigned > 0">
          <div class="summary-label">Non attribué (ticket sans asset lié)</div>
          <div class="summary-value text-muted">{{ formatCurrency(unassigned) }}</div>
        </div>
      </div>

      <div class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Type d'asset</th>
              <th>Coûts glpi</th>
              <th>Super coûts</th>
              <th class="text-end">Somme des coûts</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in types" :key="row.itemtype">
              <td>
                <span class="asset-type-badge">{{ assetIcon(row.itemtype) }} {{ row.itemtype }}</span>
              </td>
              <td class="text-end fw-semibold">{{ formatCurrency(row.costs) }}</td>
              <td class="text-end fw-semibold">{{ formatCurrency(row.super_costs) }}</td>
              <td class="text-end fw-semibold">{{ formatCurrency(row.total) }}</td>
            </tr>
            <tr v-if="types.length === 0">
              <td colspan="4" class="text-center text-muted py-4">
                Aucun coût enregistré pour le moment.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { costsApi } from '../services/api';

const loading = ref(true);
const types = ref<{ itemtype: string; costs: number; super_costs: number; total: number }[]>([]);
const total = ref(0);
const unassigned = ref(0);

onMounted(async () => {
  try {
    const res = await costsApi.getByAssetType();
    types.value = res.data.types || [];
    total.value = res.data.total || 0;
    unassigned.value = res.data.unassigned || 0;
  } catch (e) {
    console.error('Failed to load costs', e);
  } finally {
    loading.value = false;
  }
});

function formatCurrency(v: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v) + ' Ar';
}

function percent(v: number) {
  if (!total.value) return 0;
  return Math.round((v / total.value) * 1000) / 10;
}

function assetIcon(itemtype: string) {
  const map: Record<string, string> = {
    Computer: '🖥️', Monitor: '🖵', NetworkEquipment: '📡', Peripheral: '🖱️',
    Phone: '📱', Printer: '🖨️', SoftwareLicense: '💿', Certificate: '📜',
    Appliance: '⚙️', Unmanaged: '❓',
  };
  return map[itemtype] || '📦';
}
</script>

<style scoped>
.costs-page { padding: 2rem; max-width: 900px; }

.page-header { margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 700; color: #1a2233; margin-bottom: .3rem; }
.page-subtitle { color: #6b7280; font-size: .9rem; margin: 0; max-width: 700px; }

.loading-state { display: flex; flex-direction: column; align-items: center; padding: 4rem; }

.summary-cards {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.summary-card {
  background: #fff;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  flex: 1;
}
.summary-label { font-size: .8rem; color: #6b7280; margin-bottom: .25rem; }
.summary-value { font-size: 1.4rem; font-weight: 700; color: #1a2233; }

.table-card {
  background: #fff;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.asset-type-badge { font-weight: 600; color: #1a2233; }

.bar-track {
  width: 100px;
  height: 8px;
  background: #f3f4f6;
  border-radius: 99px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 99px;
}
</style>