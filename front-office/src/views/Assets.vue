<template>
  <div class="assets">
    <div class="assets-header">
      <h1>Assets</h1>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>Name:</label>
        <input v-model="filters.name" type="text" placeholder="Search by name" />
      </div>
      <div class="filter-group">
        <label>Status:</label>
        <select v-model="filters.status">
          <option value="">All</option>
          <option v-for="status in uniqueStatuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Location:</label>
        <input v-model="filters.location" type="text" placeholder="Search by location" />
      </div>
      <div class="filter-group">
        <label>Item Type:</label>
        <select v-model="filters.item_type">
          <option value="">All</option>
          <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>User:</label>
        <input v-model="filters.user" type="text" placeholder="Search by user" />
      </div>
      <button @click="applyFilters" class="filter-btn">Apply Filters</button>
      <button @click="clearFilters" class="clear-btn">Clear</button>
    </div>

    <div v-if="loading" class="loading">
      Loading assets...
    </div>

    <div v-else-if="assets.length === 0" class="empty">
      No assets found
    </div>

    <div v-else class="assets-table">
      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>Name</th>
            <th>Status</th>
            <th>Location</th>
            <th>Manufacturer</th>
            <th>Type</th>
            <th>Model</th>
            <th>Inventory #</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in assets" :key="asset.id" @click="viewAsset(asset.id, asset.item_type)" class="asset-row">
            <td>
              <div v-if="assetImages[asset.id] && assetImages[asset.id].length > 0" class="asset-image">
                <img :src="assetImages[asset.id][0].download_url" :alt="asset.name" @error="handleImageError" />
              </div>
              <div v-else class="no-image">
                <i class="bi bi-image"></i>
              </div>
            </td>
            <td>{{ asset.name }}</td>
            <td>{{ asset.status }}</td>
            <td>{{ asset.location }}</td>
            <td>{{ asset.manufacturer }}</td>
            <td>{{ asset.item_type }}</td>
            <td>{{ asset.model }}</td>
            <td>{{ asset.inventory_number }}</td>
            <td>{{ asset.user || 'N/A' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { assetsApi, documentsApi } from '../services/api';

const router = useRouter();
const assets = ref<any[]>([]);
const loading = ref(true);
const assetImages = ref<Record<number, any[]>>({});
const filters = ref({
  name: '',
  status: '',
  location: '',
  item_type: '',
  user: '',
});

const uniqueTypes = computed(() => {
  const types = new Set(assets.value.map(a => a.item_type).filter(t => t));
  return Array.from(types).sort();
});

const uniqueStatuses = computed(() => {
  const statuses = new Set(assets.value.map(a => a.status).filter(s => s));
  return Array.from(statuses).sort();
});

onMounted(async () => {
  await loadAssets();
});

const loadAssets = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (filters.value.name) params.name = filters.value.name;
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.location) params.location = filters.value.location;
    if (filters.value.item_type) params.item_type = filters.value.item_type;
    if (filters.value.user) params.user = filters.value.user;

    const response = await assetsApi.getAll(params);
    assets.value = response.data;
    
    // Load images for each asset
    await loadAssetImages();
  } catch (error) {
    console.error('Failed to load assets:', error);
  } finally {
    loading.value = false;
  }
};

const loadAssetImages = async () => {
  for (const asset of assets.value) {
    // Construct local image URLs based on asset name/ID
    const possibleFilenames = [
      `${asset.name}.png`,
      `${asset.name}.jpg`,
      `${asset.name}.jpeg`,
      `${asset.id}.png`,
      `${asset.id}.jpg`,
      `${asset.id}.jpeg`
    ];
    
    // Filter to only include images that actually exist
    assetImages.value[asset.id] = [];
    for (const filename of possibleFilenames) {
      try {
        const response = await fetch(`http://localhost:3001/images/${filename}`, { method: 'HEAD' });
        if (response.ok) {
          assetImages.value[asset.id].push({
            id: filename,
            filename: filename,
            download_url: `http://localhost:3001/images/${filename}`
          });
          // Only keep the first matching image for the table view
          break;
        }
      } catch (error) {
        // Image doesn't exist, skip it
      }
    }
  }
};

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
};

const viewAsset = (id: number, itemType: string) => {
  router.push({ name: 'asset-detail', params: { id, itemType } });
};

const applyFilters = () => {
  loadAssets();
};

const clearFilters = () => {
  filters.value = {
    name: '',
    status: '',
    location: '',
    item_type: '',
    user: '',
  };
  loadAssets();
};
</script>

<style scoped>
.assets {
  padding: 2rem;
}

.assets-header {
  margin-bottom: 2rem;
}

.assets-header h1 {
  margin: 0;
  color: #2c3e50;
}

.filters {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.875rem;
}

.filter-group input,
.filter-group select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 150px;
}

.filter-btn,
.clear-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.filter-btn {
  background-color: #3498db;
  color: white;
  border: none;
}

.filter-btn:hover {
  background-color: #2980b9;
}

.clear-btn {
  background-color: #95a5a6;
  color: white;
  border: none;
}

.clear-btn:hover {
  background-color: #7f8c8d;
}

.loading,
.empty {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
}

.assets-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background-color: #3498db;
  color: white;
}

th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
}

tbody tr {
  border-bottom: 1px solid #eee;
}

tbody tr:hover {
  background-color: #f8f9fa;
}

.asset-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.asset-row:hover {
  background-color: #e3f2fd;
}

td {
  padding: 1rem;
}

.asset-image img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.no-image {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  border-radius: 4px;
  color: #7f8c8d;
  font-size: 1.5rem;
}
</style>
