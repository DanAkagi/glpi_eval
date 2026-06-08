<template>
  <div class="assets">
    <div class="container-fluid py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3">
          <i class="bi bi-box-seam me-2"></i>Assets
        </h1>
        <div class="d-flex gap-2">
          <input 
            v-model="searchName" 
            type="text" 
            class="form-control" 
            placeholder="Search by name..." 
            style="max-width: 200px;"
            @keyup.enter="loadAssets"
          />
          <select v-model="filterStatus" class="form-select" style="max-width: 150px;" @change="loadAssets">
            <option value="">All Status</option>
            <option v-for="status in uniqueStatuses" :key="status" :value="status">{{ status }}</option>
          </select>
          <select v-model="filterType" class="form-select" style="max-width: 150px;" @change="loadAssets">
            <option value="">All Types</option>
            <option v-for="type in uniqueTypes" :key="type" :value="type">{{ type }}</option>
          </select>
          <button @click="loadAssets" class="btn btn-primary">
            <i class="bi bi-search me-1"></i>Search
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-muted">Loading assets...</p>
      </div>

      <div v-else-if="assets.length === 0" class="alert alert-info text-center">
        <i class="bi bi-info-circle me-2"></i>No assets found
      </div>

      <div v-else class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="bg-teal text-white">
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Manufacturer</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in assets" :key="asset.id">
                  <td>
                    <div v-if="assetImages[asset.id] && assetImages[asset.id].length > 0" class="asset-image">
                      <img :src="assetImages[asset.id][0].download_url" :alt="asset.name" @error="handleImageError" />
                    </div>
                    <div v-else class="no-image">
                      <i class="bi bi-image"></i>
                    </div>
                  </td>
                  <td><strong>{{ asset.name }}</strong></td>
                  <td>{{ asset.item_type }}</td>
                  <td><span class="badge bg-info">{{ asset.status }}</span></td>
                  <td>{{ asset.location }}</td>
                  <td>{{ asset.manufacturer }}</td>
                  <td>{{ asset.user }}</td>
                  <td>
                    <button @click="viewAsset(asset.id, asset.item_type)" class="btn btn-sm btn-primary">
                      <i class="bi bi-eye me-1"></i>View
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
const searchName = ref('');
const filterStatus = ref('');
const filterType = ref('');

const uniqueStatuses = computed(() => {
  const statuses = new Set(assets.value.map(a => a.status).filter(s => s));
  return Array.from(statuses).sort();
});

const uniqueTypes = computed(() => {
  const types = new Set(assets.value.map(a => a.item_type).filter(t => t));
  return Array.from(types).sort();
});

const loadAssets = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (searchName.value) params.name = searchName.value;
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterType.value) params.item_type = filterType.value;
    
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

onMounted(() => {
  loadAssets();
});
</script>

<style scoped>
.bg-teal {
  background-color: #20c997 !important;
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
