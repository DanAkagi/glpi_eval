<template>
  <div class="create-ticket">
    <div class="create-ticket-header">
      <h1>Create New Ticket</h1>
    </div>

    <div class="ticket-form">
      <div class="form-section">
        <h2>Ticket Information</h2>
        <div class="form-group">
          <label for="type">Type *</label>
          <select id="type" v-model="ticket.type" required>
            <option value="">Select type</option>
            <option value="Incident">Incident</option>
            <option value="Request">Request</option>
          </select>
        </div>
        <div class="form-group">
          <label for="titre">Title *</label>
          <input id="titre" v-model="ticket.titre" type="text" placeholder="Enter ticket title" required />
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea id="description" v-model="ticket.description" rows="4" placeholder="Enter ticket description"></textarea>
        </div>
        <div class="form-group">
          <label for="priority">Priority *</label>
          <select id="priority" v-model="ticket.priority" required>
            <option value="">Select priority</option>
            <option value="Very Low">Very Low</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Very High">Very High</option>
          </select>
        </div>
        <div class="form-group">
          <label for="date">Date *</label>
          <input id="date" v-model="ticket.date" type="date" required />
        </div>
        <div class="form-group">
          <label for="heure">Time *</label>
          <input id="heure" v-model="ticket.heure" type="time" required />
        </div>
      </div>

      <div class="form-section">
        <h2>Associated Assets</h2>
        <div class="assets-selection">
          <div class="search-assets">
            <input v-model="assetSearch" type="text" placeholder="Search assets by name..." @input="loadAssets" />
            <select v-model="assetTypeFilter" @change="loadAssets">
              <option value="">All Types</option>
              <option v-for="type in uniqueAssetTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
          <div class="assets-list">
            <div v-if="loadingAssets" class="loading">Loading assets...</div>
            <div v-else-if="availableAssets.length === 0" class="empty">No assets available</div>
            <div v-else class="asset-items">
              <div v-for="asset in availableAssets" :key="asset.id" class="asset-item">
                <input 
                  :id="`asset-${asset.id}`" 
                  type="checkbox" 
                  :value="asset.name"
                  v-model="selectedAssets"
                />
                <label :for="`asset-${asset.id}`">
                  <span class="asset-name">{{ asset.name }}</span>
                  <span class="asset-info">({{ asset.item_type }} - {{ asset.location }})</span>
                </label>
              </div>
            </div>
          </div>
          <div class="selected-summary">
            <strong>{{ selectedAssets.length }} asset(s) selected</strong>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button @click="submitTicket" class="submit-btn" :disabled="loading || !isFormValid">
          {{ loading ? 'Creating...' : 'Create Ticket' }}
        </button>
        <button @click="resetForm" class="reset-btn">Reset</button>
      </div>

      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="success" class="success-message">{{ success }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { assetsApi, ticketsApi } from '../services/api';

const ticket = ref({
  type: '',
  titre: '',
  description: '',
  priority: '',
  date: new Date().toISOString().split('T')[0],
  heure: new Date().toTimeString().slice(0, 5),
});

const availableAssets = ref<any[]>([]);
const loadingAssets = ref(false);
const assetSearch = ref('');
const assetTypeFilter = ref('');
const selectedAssets = ref<string[]>([]);
const loading = ref(false);
const error = ref('');
const success = ref('');

const isFormValid = computed(() => {
  return ticket.value.type && ticket.value.titre && ticket.value.priority && ticket.value.date && ticket.value.heure;
});

const uniqueAssetTypes = computed(() => {
  const types = new Set(availableAssets.value.map(a => a.item_type).filter(t => t));
  return Array.from(types).sort();
});

onMounted(async () => {
  await loadAssets();
});

const loadAssets = async () => {
  loadingAssets.value = true;
  try {
    const params: any = {};
    if (assetSearch.value) params.name = assetSearch.value;
    if (assetTypeFilter.value) params.item_type = assetTypeFilter.value;
    
    const response = await assetsApi.getAll(params);
    availableAssets.value = response.data;
  } catch (err) {
    console.error('Failed to load assets:', err);
  } finally {
    loadingAssets.value = false;
  }
};

const submitTicket = async () => {
  if (!isFormValid.value) return;

  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    // Convert selected asset names to asset objects with id and itemtype
    const items = selectedAssets.value.map(name => {
      const asset = availableAssets.value.find(a => a.name === name);
      return asset ? { id: asset.id, itemtype: 'Computer' } : null;
    }).filter(Boolean);

    const ticketData = {
      type: ticket.value.type,
      titre: ticket.value.titre,
      description: ticket.value.description,
      priority: ticket.value.priority,
      date: ticket.value.date,
      items: items,
    };

    await ticketsApi.create(ticketData);
    success.value = 'Ticket created successfully!';
    resetForm();
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to create ticket';
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  ticket.value = {
    type: '',
    titre: '',
    description: '',
    priority: '',
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toTimeString().slice(0, 5),
  };
  selectedAssets.value = [];
  assetSearch.value = '';
  assetTypeFilter.value = '';
  error.value = '';
  success.value = '';
};
</script>

<style scoped>
.create-ticket {
  padding: 2rem;
}

.create-ticket-header {
  margin-bottom: 2rem;
}

.create-ticket-header h1 {
  margin: 0;
  color: #2c3e50;
}

.ticket-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.form-section h2 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
}

.assets-selection {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
}

.search-assets {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-assets input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-assets select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 150px;
}

.assets-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 0.5rem;
}

.loading,
.empty {
  text-align: center;
  padding: 1rem;
  color: #7f8c8d;
}

.asset-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.asset-item:hover {
  background-color: #f8f9fa;
}

.asset-item label {
  flex: 1;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.asset-name {
  font-weight: 500;
  color: #2c3e50;
}

.asset-info {
  font-size: 0.875rem;
  color: #7f8c8d;
}

.selected-summary {
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
  color: #2c3e50;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.submit-btn,
.reset-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn {
  background-color: #3498db;
  color: white;
  border: none;
}

.submit-btn:hover:not(:disabled) {
  background-color: #2980b9;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-btn {
  background-color: #95a5a6;
  color: white;
  border: none;
}

.reset-btn:hover {
  background-color: #7f8c8d;
}

.error-message {
  color: #e74c3c;
  font-size: 0.875rem;
  margin-top: 1rem;
  text-align: center;
}

.success-message {
  color: #27ae60;
  font-size: 0.875rem;
  margin-top: 1rem;
  text-align: center;
}
</style>
